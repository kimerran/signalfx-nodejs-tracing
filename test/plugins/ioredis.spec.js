'use strict'

const agent = require('./agent')
const plugin = require('../../src/plugins/ioredis')

wrapIt()

describe('Plugin', () => {
  let Redis
  let redis
  let tracer

  describe('ioredis', () => {
    withVersions(plugin, 'ioredis', version => {
      beforeEach(() => {
        tracer = require('../..')
        Redis = require(`../../versions/ioredis@${version}`).get()
        redis = new Redis()
      })

      afterEach(() => {
        redis.quit()
      })

      describe('without configuration', () => {
        before(() => agent.load(plugin, ['ioredis', 'bluebird']))
        after(() => agent.close())

        it('should do automatic instrumentation when using callbacks', done => {
          agent.use(() => {}) // wait for initial info command
          agent
            .use(traces => {
              expect(traces[0][0]).to.have.property('service', 'test')
              expect(traces[0][0]).to.have.property('name', 'get')
              expect(traces[0][0].meta).to.have.property('component', 'redis')
              expect(traces[0][0].meta).to.have.property('db.instance', '0')
              expect(traces[0][0].meta).to.have.property('db.type', 'redis')
              expect(traces[0][0].meta).to.have.property('span.kind', 'client')
              expect(traces[0][0].meta).to.have.property('peer.hostname', 'localhost')
              expect(traces[0][0].meta).to.have.property('peer.port', '6379')
              expect(traces[0][0].meta).to.have.property('db.statement', 'GET foo')
            })
            .then(done)
            .catch(done)

          redis.get('foo').catch(done)
        })

        it('should run the callback in the parent context', () => {
          if (process.env.SIGNALFX_CONTEXT_PROPAGATION === 'false') return

          const span = {}

          return tracer.scope().activate(span, () => {
            return redis.get('foo')
              .then(() => {
                expect(tracer.scope().active()).to.equal(span)
              })
          })
        })

        it('should handle errors', done => {
          let error

          agent.use(() => {}) // wait for initial info command
          agent
            .use(traces => {
              expect(traces[0][0].meta).to.have.property('error', 'true')
              expect(traces[0][0].meta).to.have.property('error.type', error.name)
              expect(traces[0][0].meta).to.have.property('error.msg', error.message)
              expect(traces[0][0].meta).to.have.property('error.stack', error.stack)
            })
            .then(done)
            .catch(done)

          redis.set('foo', 123, 'bar')
            .catch(err => {
              error = err
            })
        })
      })

      describe('with configuration', () => {
        before(() => agent.load(plugin, 'ioredis', { service: 'custom' }))
        after(() => agent.close())

        it('should be configured with the correct values', done => {
          agent
            .use(traces => {
              expect(traces[0][0]).to.have.property('service', 'test')
            })
            .then(done)
            .catch(done)

          redis.get('foo').catch(done)
        })
      })
    })
  })
})
