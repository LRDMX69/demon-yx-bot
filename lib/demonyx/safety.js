'use strict'

const net = require('net')

function isPrivateIpv4(hostname) {
  const parts = hostname.split('.').map(Number)
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false
  const [a, b] = parts
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)
}

function isPrivateHost(hostname) {
  const host = String(hostname || '').toLowerCase().replace(/^\[|\]$/g, '')
  if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host === 'metadata.google.internal') return true
  if (net.isIPv4(host)) return isPrivateIpv4(host)
  if (net.isIPv6(host)) return host === '::1' || host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80:')
  return false
}

function classifyUrl(input, options = {}) {
  const value = String(input || '').trim()
  if (!value) return { ok: false, reason: 'empty URL' }
  let url
  try {
    url = new URL(value)
  } catch {
    return { ok: false, reason: 'invalid URL' }
  }
  const protocols = options.allowHttp === false ? ['https:'] : ['http:', 'https:']
  if (!protocols.includes(url.protocol)) return { ok: false, reason: 'only approved HTTP(S) URLs are allowed' }
  if (url.username || url.password) return { ok: false, reason: 'credential-bearing URLs are blocked' }
  if (isPrivateHost(url.hostname)) return { ok: false, reason: 'private, loopback, link-local, or metadata hosts are blocked' }
  return { ok: true, url: url.toString(), hostname: url.hostname }
}

function redact(value) {
  const sensitive = /pass(word)?|secret|token|session|api[-_]?key|cookie|authorization|credential|jid/i
  if (Array.isArray(value)) return value.map(redact)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, sensitive.test(key) ? '[redacted]' : redact(item)]))
  }
  if (typeof value !== 'string') return value
  return value.replace(/(SESSION_ID|API_KEY|PASSWORD|TOKEN|SECRET)\s*=\s*[^\s&]+/gi, '$1=[redacted]')
}

class RateLimiter {
  constructor({ max = 30, windowMs = 60_000, maxKeys = 10_000 } = {}) {
    this.max = Math.max(1, Number(max) || 30)
    this.windowMs = Math.max(1_000, Number(windowMs) || 60_000)
    this.maxKeys = Math.max(100, Number(maxKeys) || 10_000)
    this.buckets = new Map()
  }

  check(key) {
    const now = Date.now()
    const id = String(key || 'anonymous')
    const bucket = this.buckets.get(id)
    if (!bucket || now - bucket.startedAt >= this.windowMs) {
      if (this.buckets.size >= this.maxKeys) this.buckets.delete(this.buckets.keys().next().value)
      this.buckets.set(id, { startedAt: now, count: 1 })
      return { allowed: true, remaining: this.max - 1, retryAfterMs: 0 }
    }
    if (bucket.count >= this.max) return { allowed: false, remaining: 0, retryAfterMs: this.windowMs - (now - bucket.startedAt) }
    bucket.count += 1
    return { allowed: true, remaining: this.max - bucket.count, retryAfterMs: 0 }
  }

  reset() {
    this.buckets.clear()
  }
}

module.exports = { classifyUrl, isPrivateHost, redact, RateLimiter }
