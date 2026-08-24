'use strict'

const crypto = require('crypto')

function verifyMetaSignature(rawBody, signatureHeader, appSecret) {
  if (!rawBody || !signatureHeader || !appSecret) return false
  const supplied = String(signatureHeader).replace(/^sha256=/i, '').trim().toLowerCase()
  if (!/^[a-f0-9]{64}$/.test(supplied)) return false
  const expected = crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex')
  const left = Buffer.from(supplied, 'hex')
  const right = Buffer.from(expected, 'hex')
  return left.length === right.length && crypto.timingSafeEqual(left, right)
}

function verifyChallenge({ mode, token, challenge }, expectedToken) {
  if (mode !== 'subscribe' || !token || !expectedToken || token !== expectedToken || challenge === undefined) return { ok: false, status: 403 }
  return { ok: true, status: 200, challenge: String(challenge) }
}

class ReplayGuard {
  constructor({ ttlMs = 10 * 60_000, maxEntries = 10_000 } = {}) {
    this.ttlMs = Math.max(1_000, Number(ttlMs) || 10 * 60_000)
    this.maxEntries = Math.max(100, Number(maxEntries) || 10_000)
    this.entries = new Map()
  }

  seen(id) {
    const key = String(id || '')
    if (!key) return false
    const now = Date.now()
    for (const [entry, expiresAt] of this.entries) if (expiresAt <= now) this.entries.delete(entry)
    if (this.entries.has(key)) return true
    while (this.entries.size >= this.maxEntries) this.entries.delete(this.entries.keys().next().value)
    this.entries.set(key, now + this.ttlMs)
    return false
  }

  clear() {
    this.entries.clear()
  }
}

module.exports = { verifyMetaSignature, verifyChallenge, ReplayGuard }
