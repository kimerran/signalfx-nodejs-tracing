'use strict'

const SpanContext = require('opentracing').SpanContext

class SignalFxSpanContext extends SpanContext {
  constructor (props) {
    super()

    props = props || {}

    this._traceId = props.traceId
    this._spanId = props.spanId
    this._parentId = props.parentId || null
    this._name = props.name
    this._isFinished = props.isFinished || false
    this._tags = props.tags || {}
    this._logs = props.logs || []
    this._metrics = props.metrics || {}
    this._sampling = props.sampling || {}
    this._baggageItems = props.baggageItems || {}
    this._trace = props.trace || {
      started: [],
      finished: []
    }
  }

  toTraceId () {
    return this._traceId.toString()
  }

  toSpanId () {
    return this._spanId.toString()
  }
}

module.exports = SignalFxSpanContext
