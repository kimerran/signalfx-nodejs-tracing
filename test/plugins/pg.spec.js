'use strict'

const semver = require('semver')
const agent = require('./agent')
const plugin = require('../../src/plugins/pg')

wrapIt()

const clients = {
  pg: pg => pg.Client
}

if (process.env.PG_TEST_NATIVE === 'true') {
  clients['pg.native'] = pg => pg.native.Client
}

describe('Plugin', () => {
  let pg
  let client
  let tracer

  describe('pg', () => {
    withVersions(plugin, 'pg', version => {
      beforeEach(() => {
        tracer = require('../..')
      })

      Object.keys(clients).forEach(implementation => {
        describe(`when using ${implementation}.Client`, () => {
          before(() => {
            return agent.load(plugin, 'pg')
          })

          after(() => {
            return agent.close()
          })

          beforeEach(done => {
            pg = require(`../../versions/pg@${version}`).get()

            const Client = clients[implementation](pg)

            client = new Client({
              user: 'postgres',
              password: 'postgres',
              database: 'postgres',
              application_name: 'test'
            })

            client.connect(err => done(err))
          })

          it('should do automatic instrumentation when using callbacks', done => {
            agent.use(traces => {
              expect(traces[0][0]).to.have.property('service', 'test')
              expect(traces[0][0]).to.have.property('name', 'SELECT')
              expect(traces[0][0].meta).to.have.property('component', 'pg')
              expect(traces[0][0].meta).to.have.property('db.instance', 'postgres')
              expect(traces[0][0].meta).to.have.property('db.user', 'postgres')
              expect(traces[0][0].meta).to.have.property('db.type', 'postgres')
              expect(traces[0][0].meta).to.have.property('db.statement', 'SELECT $1::text as message')
              expect(traces[0][0].meta).to.have.property('span.kind', 'client')

              done()
            })

            client.query('SELECT $1::text as message', ['Hello world!'], (err, result) => {
              if (err) throw err

              client.end((err) => {
                if (err) throw err
              })
            })
          })

          if (semver.intersects(version, '>=5.1')) { // initial promise support
            it('should do automatic instrumentation when using promises', done => {
              agent.use(traces => {
                expect(traces[0][0]).to.have.property('service', 'test')
                expect(traces[0][0]).to.have.property('name', 'SELECT')
                expect(traces[0][0].meta).to.have.property('component', 'pg')
                expect(traces[0][0].meta).to.have.property('db.instance', 'postgres')
                expect(traces[0][0].meta).to.have.property('db.user', 'postgres')
                expect(traces[0][0].meta).to.have.property('db.type', 'postgres')
                expect(traces[0][0].meta).to.have.property('db.statement', 'SELECT $1::text as message')
                expect(traces[0][0].meta).to.have.property('span.kind', 'client')

                done()
              })

              client.query('SELECT $1::text as message', ['Hello world!'])
                .then(() => client.end())
                .catch(done)
            })
          }

          it('should handle errors', done => {
            let error

            agent.use(traces => {
              expect(traces[0][0].meta).to.have.property('error.type', error.name)
              expect(traces[0][0].meta).to.have.property('error.msg', error.message)
              expect(traces[0][0].meta).to.have.property('error.stack', error.stack)

              done()
            })

            client.query('INVALID', (err, result) => {
              error = err

              client.end((err) => {
                if (err) throw err
              })
            })
          })

          it('should run the callback in the parent context', done => {
            if (process.env.SIGNALFX_CONTEXT_PROPAGATION === 'false') return done()

            const span = {}

            tracer.scope().activate(span, () => {
              const span = tracer.scope().active()

              client.query('SELECT $1::text as message', ['Hello World!'], () => {
                expect(tracer.scope().active()).to.equal(span)
                done()
              })

              client.end((err) => {
                if (err) throw err
              })
            })
          })
        })
      })

      describe('with configuration', () => {
        before(() => {
          return agent.load(plugin, 'pg', { service: 'custom' })
        })

        after(() => {
          return agent.close()
        })

        beforeEach(done => {
          pg = require(`../../versions/pg@${version}`).get()

          client = new pg.Client({
            user: 'postgres',
            password: 'postgres',
            database: 'postgres'
          })

          client.connect(err => done(err))
        })

        it('should be configured with the correct values', done => {
          agent.use(traces => {
            expect(traces[0][0]).to.have.property('service', 'test')

            done()
          })

          client.query('SELECT $1::text as message', ['Hello world!'], (err, result) => {
            if (err) throw err

            client.end((err) => {
              if (err) throw err
            })
          })
        })
      })
    })
  })
})
