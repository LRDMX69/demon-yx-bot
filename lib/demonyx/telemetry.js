'use strict'

const { redact } = require('./safety')

const maxEvents = Math.max(50, Number(process.env.DEMONYX_TELEMETRY_MAX || 500))
const events = []

function record(type, data = {}) {
  events.push(Object.freeze({
    at: new Date().toISOString(),
    type: String(type),
    data: redact(data),
  }))
  while (events.length > maxEvents) events.shift()
}

function snapshot(limit = 20) {
  return events.slice(-Math.max(1, Math.min(Number(limit) || 20, maxEvents)))
}

function summary() {
  const byType = {}
  for (const event of events) byType[event.type] = (byType[event.type] || 0) + 1
  return { total: events.length, maxEvents, byType }
}

function clear() {
  events.length = 0
}

module.exports = { record, snapshot, summary, clear }
