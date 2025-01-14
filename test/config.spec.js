'use strict'

const version = require('../lib/version')

describe('Config', () => {
  let Config
  let platform

  beforeEach(() => {
    platform = {
      env: sinon.stub()
    }

    Config = proxyquire('../src/config', {
      './platform': platform
    })
  })

  it('should initialize with the correct defaults', () => {
    const config = new Config()

    expect(config).to.have.property('service', 'unnamed-nodejs-service')
    expect(config).to.have.property('enabled', true)
    expect(config).to.have.property('debug', false)
    expect(config).to.have.nested.property('url.protocol', 'http:')
    expect(config).to.have.nested.property('url.hostname', 'localhost')
    expect(config).to.have.nested.property('url.port', '9080')
    expect(config).to.have.property('flushInterval', 2000)
    expect(config).to.have.property('sampleRate', 1)
    expect(config).to.have.property('runtimeMetrics', false)
    expect(config).to.have.deep.property('tags', {
      'signalfx.tracing.library': 'nodejs-tracing',
      'signalfx.tracing.version': version
    })
    expect(config).to.have.property('plugins', true)
    expect(config).to.have.property('env', undefined)
  })

  it('should initialize from the default service', () => {
    const config = new Config('test')

    expect(config).to.have.property('service', 'test')
  })

  it('should initialize from environment variables', () => {
    platform.env.withArgs('SIGNALFX_TRACE_AGENT_HOSTNAME').returns('agent')
    platform.env.withArgs('SIGNALFX_TRACE_AGENT_PORT').returns('6218')
    platform.env.withArgs('SIGNALFX_TRACING_ENABLED').returns('false')
    platform.env.withArgs('SIGNALFX_TRACING_DEBUG').returns('true')
    platform.env.withArgs('SIGNALFX_TRACE_ANALYTICS').returns('true')
    platform.env.withArgs('SIGNALFX_SERVICE_NAME').returns('service')
    platform.env.withArgs('SIGNALFX_ENV').returns('test')

    const config = new Config()

    expect(config).to.have.property('enabled', false)
    expect(config).to.have.property('debug', true)
    expect(config).to.have.property('analytics', true)
    expect(config).to.have.nested.property('url.protocol', 'http:')
    expect(config).to.have.nested.property('url.hostname', 'localhost')
    expect(config).to.have.nested.property('url.port', '9080')
    expect(config).to.have.property('runtimeMetrics', false)
    expect(config).to.have.property('service', 'service')
    expect(config).to.have.property('env', 'test')
  })

  it('should initialize from environment variables with url taking precedence', () => {
    platform.env.withArgs('SIGNALFX_ENDPOINT_URL').returns('https://agent2:7777')
    platform.env.withArgs('SIGNALFX_TRACE_AGENT_HOSTNAME').returns('agent')
    platform.env.withArgs('SIGNALFX_TRACE_AGENT_PORT').returns('6218')
    platform.env.withArgs('SIGNALFX_TRACING_ENABLED').returns('false')
    platform.env.withArgs('SIGNALFX_TRACING_DEBUG').returns('true')
    platform.env.withArgs('SIGNALFX_SERVICE_NAME').returns('service')
    platform.env.withArgs('SIGNALFX_ENV').returns('test')

    const config = new Config()

    expect(config).to.have.property('enabled', false)
    expect(config).to.have.property('debug', true)
    expect(config).to.have.nested.property('url.protocol', 'https:')
    expect(config).to.have.nested.property('url.hostname', 'agent2')
    expect(config).to.have.nested.property('url.port', '7777')
    expect(config).to.have.property('service', 'service')
    expect(config).to.have.property('env', 'test')
  })

  it('should initialize from the options', () => {
    const logger = {}
    const tags = {
      'foo': 'bar'
    }
    const config = new Config('test', {
      enabled: false,
      debug: true,
      analytics: true,
      hostname: 'agent',
      port: 6218,
      dogstatsd: {
        port: 5218
      },
      service: 'service',
      env: 'test',
      sampleRate: 0.5,
      logger,
      tags,
      flushInterval: 5000,
      accessToken: 'MyToken',
      runtimeMetrics: true,
      plugins: false
    })

    expect(config).to.have.property('enabled', false)
    expect(config).to.have.property('debug', true)
    expect(config).to.have.property('analytics', true)
    expect(config).to.have.nested.property('url.protocol', 'http:')
    expect(config).to.have.nested.property('url.hostname', 'localhost')
    expect(config).to.have.nested.property('url.port', '9080')
    expect(config).to.have.nested.property('dogstatsd.port', '5218')
    expect(config).to.have.property('service', 'service')
    expect(config).to.have.property('env', 'test')
    expect(config).to.have.property('sampleRate', 0.5)
    expect(config).to.have.property('logger', logger)
    expect(config.tags).to.have.property('foo', 'bar')
    expect(config).to.have.property('flushInterval', 5000)
    expect(config).to.have.property('runtimeMetrics', true)
    expect(config).to.have.property('plugins', false)
    expect(config.headers).to.have.property('x-sf-token', 'MyToken')
    expect(config).to.have.deep.property('tags', {
      'foo': 'bar',
      'signalfx.tracing.library': 'nodejs-tracing',
      'signalfx.tracing.version': version
    })
  })

  it('should initialize from the options with url taking precedence', () => {
    const logger = {}
    const tags = { foo: 'bar' }
    const config = new Config('test', {
      enabled: false,
      debug: true,
      hostname: 'agent',
      url: 'https://agent2:7777',
      port: 6218,
      service: 'service',
      env: 'test',
      sampleRate: 0.5,
      logger,
      tags,
      flushInterval: 5000,
      plugins: false
    })

    expect(config).to.have.property('enabled', false)
    expect(config).to.have.property('debug', true)
    expect(config).to.have.nested.property('url.protocol', 'https:')
    expect(config).to.have.nested.property('url.hostname', 'agent2')
    expect(config).to.have.nested.property('url.port', '7777')
    expect(config).to.have.property('service', 'service')
    expect(config).to.have.property('env', 'test')
    expect(config).to.have.property('sampleRate', 0.5)
    expect(config).to.have.property('logger', logger)
    expect(config.tags).to.have.property('foo', 'bar')
    expect(config).to.have.property('flushInterval', 5000)
    expect(config).to.have.property('plugins', false)
  })

  it('should give priority to the common agent environment variable', () => {
    platform.env.withArgs('SIGNALFX_TRACE_AGENT_HOSTNAME').returns('trace-agent')
    platform.env.withArgs('SIGNALFX_AGENT_HOST').returns('agent')

    const config = new Config()

    expect(config).to.have.nested.property('url.hostname', 'localhost')
  })

  it('should give priority to the options', () => {
    platform.env.withArgs('SIGNALFX_ENDPOINT_URL').returns('https://agent2:6218')
    platform.env.withArgs('SIGNALFX_TRACE_AGENT_HOSTNAME').returns('agent')
    platform.env.withArgs('SIGNALFX_TRACE_AGENT_PORT').returns('6218')
    platform.env.withArgs('SIGNALFX_TRACING_ENABLED').returns('false')
    platform.env.withArgs('SIGNALFX_TRACING_DEBUG').returns('true')
    platform.env.withArgs('SIGNALFX_TRACE_ANALYTICS').returns('true')
    platform.env.withArgs('SIGNALFX_SERVICE_NAME').returns('service')
    platform.env.withArgs('SIGNALFX_ENV').returns('test')
    platform.env.withArgs('SIGNALFX_RUNTIME_METRICS_ENABLED').returns('true')

    const config = new Config('test', {
      enabled: true,
      debug: false,
      analytics: false,
      protocol: 'https',
      hostname: 'server',
      port: 7777,
      dogstatsd: {
        port: 8888
      },
      runtimeMetrics: false,
      service: 'test',
      env: 'development'
    })

    expect(config).to.have.property('enabled', true)
    expect(config).to.have.property('debug', false)
    expect(config).to.have.property('analytics', false)
    expect(config).to.have.nested.property('url.protocol', 'https:')
    expect(config).to.have.nested.property('url.hostname', 'agent2')
    expect(config).to.have.nested.property('url.port', '6218')
    expect(config).to.have.nested.property('dogstatsd.port', '8888')
    expect(config).to.have.property('runtimeMetrics', false)
    expect(config).to.have.property('service', 'test')
    expect(config).to.have.property('env', 'development')
  })

  it('should give priority to the options especially url', () => {
    platform.env.withArgs('SIGNALFX_TRACE_AGENT_URL').returns('http://agent2:6218')
    platform.env.withArgs('SIGNALFX_TRACE_AGENT_HOSTNAME').returns('agent')
    platform.env.withArgs('SIGNALFX_TRACE_AGENT_PORT').returns('6218')
    platform.env.withArgs('SIGNALFX_TRACING_ENABLED').returns('false')
    platform.env.withArgs('SIGNALFX_TRACING_DEBUG').returns('true')
    platform.env.withArgs('SIGNALFX_SERVICE_NAME').returns('service')
    platform.env.withArgs('SIGNALFX_ENV').returns('test')

    const config = new Config('test', {
      enabled: true,
      debug: false,
      url: 'https://agent3:7778',
      protocol: 'http',
      hostname: 'server',
      port: 7777,
      service: 'test',
      env: 'development'
    })

    expect(config).to.have.property('enabled', true)
    expect(config).to.have.property('debug', false)
    expect(config).to.have.nested.property('url.protocol', 'https:')
    expect(config).to.have.nested.property('url.hostname', 'agent3')
    expect(config).to.have.nested.property('url.port', '7778')
    expect(config).to.have.property('service', 'test')
    expect(config).to.have.property('env', 'development')
  })

  it('should sanitize the sample rate to be between 0 and 1', () => {
    expect(new Config('test', { sampleRate: -1 })).to.have.property('sampleRate', 0)
    expect(new Config('test', { sampleRate: 2 })).to.have.property('sampleRate', 1)
    expect(new Config('test', { sampleRate: NaN })).to.have.property('sampleRate', 1)
  })
})
