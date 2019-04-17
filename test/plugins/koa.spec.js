'use strict'

const axios = require('axios')
const getPort = require('get-port')
const agent = require('./agent')
const plugin = require('../../src/plugins/koa')

wrapIt()

const sort = spans => spans.sort((a, b) => a.start.toString() >= b.start.toString() ? 1 : -1)

describe('Plugin', () => {
  let tracer
  let Koa
  let appListener

  describe('koa', () => {
    withVersions(plugin, 'koa', version => {
      let port

      beforeEach(() => {
        tracer = require('../..')
        Koa = require(`../../versions/koa@${version}`).get()
        return getPort().then(newPort => {
          port = newPort
        })
      })

      afterEach(done => {
        appListener.close(() => done())
      })

      describe('without configuration', () => {
        before(() => agent.load(plugin, 'koa'))
        after(() => agent.close())

        it('should do automatic instrumentation on 2.x middleware', done => {
          const app = new Koa()

          app.use(function handle (ctx) {
            ctx.body = ''
          })

          agent
            .use(traces => {
              const spans = sort(traces[0])

              expect(spans[0]).to.have.property('service', 'test')
              expect(spans[0]).to.have.property('name', 'GET')
              expect(spans[0].meta).to.have.property('component', 'koa')
              expect(spans[0].meta).to.have.property('span.kind', 'server')
              expect(spans[0].meta).to.have.property('http.url', `http://localhost:${port}/user`)
              expect(spans[0].meta).to.have.property('http.method', 'GET')
              expect(spans[0].meta).to.have.property('http.status_code', '200')

              expect(spans[1]).to.have.property('service', 'test')
              expect(spans[1]).to.have.property('name', 'handle')
              expect(spans[1].meta).to.have.property('component', 'koa')
            })
            .then(done)
            .catch(done)

          appListener = app.listen(port, 'localhost', () => {
            axios
              .get(`http://localhost:${port}/user`)
              .catch(done)
          })
        })

        it('should do automatic instrumentation on 1.x middleware', done => {
          const app = new Koa()

          app.use(function * handle (next) {
            this.body = ''
            yield next
          })

          agent
            .use(traces => {
              const spans = sort(traces[0])

              expect(spans[0]).to.have.property('service', 'test')
              expect(spans[0]).to.have.property('name', 'GET')
              expect(spans[0].meta).to.have.property('component', 'koa')
              expect(spans[0].meta).to.have.property('span.kind', 'server')
              expect(spans[0].meta).to.have.property('http.url', `http://localhost:${port}/user`)
              expect(spans[0].meta).to.have.property('http.method', 'GET')
              expect(spans[0].meta).to.have.property('http.status_code', '200')

              expect(spans[1]).to.have.property('service', 'test')
              expect(spans[1]).to.have.property('name', 'handle')
              expect(spans[1].meta).to.have.property('component', 'koa')
            })
            .then(done)
            .catch(done)

          appListener = app.listen(port, 'localhost', () => {
            axios
              .get(`http://localhost:${port}/user`)
              .catch(done)
          })
        })

        it('should run middleware in the request scope', done => {
          if (process.env.SIGNALFX_CONTEXT_PROPAGATION === 'false') return done()

          const app = new Koa()

          app.use((ctx, next) => {
            ctx.body = ''

            expect(tracer.scope().active()).to.not.be.null

            return next()
              .then(() => {
                expect(tracer.scope().active()).to.not.be.null
                done()
              })
              .catch(done)
          })

          appListener = app.listen(port, 'localhost', () => {
            axios
              .get(`http://localhost:${port}/app/user/123`)
              .catch(done)
          })
        })

        it('should activate a scope per middleware', done => {
          if (process.env.SIGNALFX_CONTEXT_PROPAGATION === 'false') return done()
          const app = new Koa()

          let span

          app.use((ctx, next) => {
            span = tracer.scope().active()
            return tracer.scope().activate(null, () => next())
          })

          app.use(ctx => {
            ctx.body = ''

            try {
              expect(tracer.scope().active()).to.not.be.null.and.not.equal(span)
              done()
            } catch (e) {
              done(e)
            }
          })

          getPort().then(port => {
            appListener = app.listen(port, 'localhost', () => {
              axios.get(`http://localhost:${port}/user`)
                .catch(done)
            })
          })
        })

        it('should finish middleware spans in the correct order', done => {
          const app = new Koa()

          let parentSpan
          let childSpan

          app.use((ctx, next) => {
            parentSpan = tracer.scope().active()

            sinon.spy(parentSpan, 'finish')

            setImmediate(() => {
              try {
                expect(childSpan.finish).to.have.been.called
                expect(parentSpan.finish).to.have.been.called
                expect(parentSpan.finish).to.have.been.calledAfter(childSpan.finish)
                expect(childSpan.context()._parentId.toString()).to.equal(parentSpan.context().toSpanId())
                expect(parentSpan.context()._parentId).to.not.be.null
                done()
              } catch (e) {
                done(e)
              }
            })

            return next()
          })

          app.use((ctx, next) => {
            childSpan = tracer.scope().active()

            sinon.spy(childSpan, 'finish')

            ctx.body = ''

            setImmediate(() => {
              try {
                expect(childSpan.finish).to.have.been.called
              } catch (e) {
                done(e)
              }
            })

            expect(parentSpan.finish).to.not.have.been.called

            return next()
          })

          getPort().then(port => {
            appListener = app.listen(port, 'localhost', () => {
              axios
                .get(`http://localhost:${port}/app/user/1`)
                .catch(done)
            })
          })
        })

        withVersions(plugin, 'koa-router', routerVersion => {
          let Router

          beforeEach(() => {
            Router = require(`../../versions/koa-router@${routerVersion}`).get()
          })

          it('should do automatic instrumentation on routers', done => {
            const app = new Koa()
            const router = new Router()

            router.get('user', '/user/:id', function handle (ctx, next) {
              ctx.body = ''
            })

            app
              .use(router.routes())
              .use(router.allowedMethods())

            agent
              .use(traces => {
                const spans = sort(traces[0])

                expect(spans[0]).to.have.property('name', 'GET /user/:id')
                expect(spans[0].meta).to.have.property('http.url', `http://localhost:${port}/user/123`)

                expect(spans[1]).to.have.property('name', 'dispatch')

                expect(spans[2]).to.have.property('name', 'handle')
              })
              .then(done)
              .catch(done)

            appListener = app.listen(port, 'localhost', (e) => {
              axios
                .get(`http://localhost:${port}/user/123`)
                .catch(done)
            })
          })

          it('should not lose the route if next() is called', done => {
            const app = new Koa()
            const router = new Router()

            router.get('/user/:id', (ctx, next) => {
              ctx.body = ''
              return next()
            })

            app
              .use(router.routes())
              .use(router.allowedMethods())

            agent
              .use(traces => {
                const spans = sort(traces[0])

                expect(spans[0]).to.have.property('name', 'GET /user/:id')
              })
              .then(done)
              .catch(done)

            appListener = app.listen(port, 'localhost', (e) => {
              axios
                .get(`http://localhost:${port}/user/123`)
                .catch(done)
            })
          })

          it('should support nested routers', done => {
            const app = new Koa()
            const forums = new Router()
            const posts = new Router()

            posts.get('/:pid', (ctx, next) => {
              ctx.body = ''
            })

            forums.use('/forums/:fid/posts', posts.routes(), posts.allowedMethods())

            app.use(forums.routes())

            agent
              .use(traces => {
                const spans = sort(traces[0])

                expect(spans[0]).to.have.property('name', 'GET /forums/:fid/posts/:pid')
                expect(spans[0].meta).to.have.property('http.url', `http://localhost:${port}/forums/123/posts/456`)
              })
              .then(done)
              .catch(done)

            appListener = app.listen(port, 'localhost', () => {
              axios
                .get(`http://localhost:${port}/forums/123/posts/456`)
                .catch(done)
            })
          })

          it('should only match the current HTTP method', done => {
            const app = new Koa()
            const forums = new Router()
            const posts = new Router()

            posts.get('/:pid', (ctx, next) => {
              ctx.body = ''
            })
            posts.post('/:pid', (ctx, next) => {
              ctx.body = ''
            })

            forums.use('/forums/:fid/posts', posts.routes(), posts.allowedMethods())

            app.use(forums.routes())

            agent
              .use(traces => {
                const spans = sort(traces[0])

                expect(spans[0]).to.have.property('name', 'GET /forums/:fid/posts/:pid')
                expect(spans[0].meta).to.have.property('http.url', `http://localhost:${port}/forums/123/posts/456`)
              })
              .then(done)
              .catch(done)

            appListener = app.listen(port, 'localhost', () => {
              axios
                .get(`http://localhost:${port}/forums/123/posts/456`)
                .catch(done)
            })
          })

          it('should support a router prefix', done => {
            const app = new Koa()
            const router = new Router({
              prefix: '/user'
            })

            router.get('/:id', (ctx, next) => {
              ctx.body = ''
            })

            app
              .use(router.routes())
              .use(router.allowedMethods())

            agent
              .use(traces => {
                const spans = sort(traces[0])

                expect(spans[0]).to.have.property('name', 'GET /user/:id')
                expect(spans[0].meta).to.have.property('http.url', `http://localhost:${port}/user/123`)
              })
              .then(done)
              .catch(done)

            appListener = app.listen(port, 'localhost', () => {
              axios
                .get(`http://localhost:${port}/user/123`)
                .catch(done)
            })
          })

          it('should handle request errors', done => {
            const error = new Error('boom')
            const app = new Koa()
            const router = new Router({
              prefix: '/user'
            })

            router.get('/:id', (ctx, next) => {
              throw error
            })

            app.silent = true
            app
              .use(router.routes())
              .use(router.allowedMethods())

            agent
              .use(traces => {
                const spans = sort(traces[0])

                expect(spans[0]).to.have.property('name', 'GET /user/:id')
                expect(spans[0].meta).to.have.property('http.url', `http://localhost:${port}/user/123`)
                expect(spans[0].meta.error).to.equal('true')

                expect(spans[1]).to.have.property('name', 'dispatch')
                expect(spans[1].meta).to.include({
                  'error.type': error.name
                })
                expect(spans[0].meta.error).to.equal('true')
              })
              .then(done)
              .catch(done)

            appListener = app.listen(port, 'localhost', () => {
              axios
                .get(`http://localhost:${port}/user/123`)
                .catch(() => { })
            })
          })

          withVersions(plugin, 'koa-websocket', wsVersion => {
            let WebSocket
            let websockify
            let ws

            beforeEach(() => {
              WebSocket = require(`../../versions/ws@6.1.0`).get()
              websockify = require(`../../versions/koa-websocket@${wsVersion}`).get()
            })

            afterEach(() => {
              ws && ws.close()
            })

            it('should skip instrumentation', done => {
              const app = websockify(new Koa())
              const router = new Router()

              router.all('/message', (ctx, next) => {
                ctx.websocket.send('pong')
                ctx.websocket.on('message', message => { })
              })

              app.ws
                .use(router.routes())
                .use(router.allowedMethods())

              appListener = app.listen(port, 'localhost', () => {
                ws = new WebSocket(`ws://localhost:${port}/message`)
                ws.on('error', done)
                ws.on('open', () => {
                  ws.send('ping', err => err && done(err))
                })
                ws.on('message', msg => {
                  if (msg === 'pong') {
                    done()
                  }
                })
              })
            })
          })
        })
      })
      describe('with client and without configuration', () => {
        before(() => agent.load(plugin, ['koa', 'http/client']))
        after(() => agent.close())

        it('should propagate a client request to parent the server response', done => {
          if (process.env.SIGNALFX_CONTEXT_PROPAGATION === 'false') return done()
          const app = new Koa()

          app.use((ctx) => {
            ctx.body = ''
          })

          const spans = []
          agent
            .use(traces => {
              spans.push(...sort(traces[0]))
            }).then(() => {
              agent.use(t => {
                spans.push(t[0][0])
                expect(spans).to.have.length(3)
                expect(spans[0]).to.have.property('name', 'GET')
                expect(spans[0].meta).to.have.property('component', 'koa')
                expect(spans[0].meta).to.have.property('span.kind', 'server')
                expect(spans[0].parent_id.toString()).to.equal(spans[2].trace_id.toString())

                expect(spans[2].meta).to.have.property('span.kind', 'client')
                expect(spans[2].meta).to.have.property('component', 'http')
              }).then(done).catch(done)
            })

          const http = require('http')
          appListener = app.listen(port, 'localhost', () => {
            const req = http.request(`http://localhost:${port}/user`, res => {
              res.on('data', () => { })
            })
            req.end()
          })
        })
      })
    })
  })
})
