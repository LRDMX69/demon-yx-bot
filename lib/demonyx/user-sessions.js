'use strict'

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

function numberEnv(name, fallback, minimum, maximum) {
  const value = Number(process.env[name])
  if (!Number.isFinite(value)) return fallback
  return Math.max(minimum, Math.min(maximum, value))
}

class UserSessionStore {
  constructor({
    filePath = process.env.DEMONYX_USER_SESSION_FILE || path.join(process.cwd(), 'data', 'user-sessions.json'),
    idleTtlMs = numberEnv('DEMONYX_USER_SESSION_TTL_MS', 24 * 60 * 60 * 1000, 60_000, 30 * 24 * 60 * 60 * 1000),
    maxAgeMs = numberEnv('DEMONYX_USER_SESSION_MAX_AGE_MS', 30 * 24 * 60 * 60 * 1000, 5 * 60_000, 365 * 24 * 60 * 60 * 1000),
    maxSessions = numberEnv('DEMONYX_USER_SESSION_MAX', 10_000, 100, 100_000),
  } = {}) {
    this.filePath = path.resolve(filePath)
    this.idleTtlMs = idleTtlMs
    this.maxAgeMs = maxAgeMs
    this.maxSessions = maxSessions
    this.sessions = this.#load()
  }

  #ownerKey(owner) {
    return crypto.createHash('sha256').update(`demonyx-owner-v1:${String(owner || 'anonymous')}`).digest('hex')
  }

  #load() {
    try {
      const parsed = JSON.parse(fs.readFileSync(this.filePath, 'utf8'))
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
    } catch {
      return {}
    }
  }

  #persist() {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true })
    const tempPath = `${this.filePath}.${process.pid}.tmp`
    fs.writeFileSync(tempPath, `${JSON.stringify(this.sessions, null, 2)}\n`, { mode: 0o600 })
    fs.renameSync(tempPath, this.filePath)
  }

  #newSession(ownerKey, now, reason = 'created') {
    const session = {
      id: crypto.randomBytes(18).toString('base64url'),
      ownerKey,
      createdAt: now,
      lastSeenAt: now,
      expiresAt: now + this.idleTtlMs,
      absoluteExpiresAt: now + this.maxAgeMs,
      rotations: 0,
      reason,
    }
    this.sessions[ownerKey] = session
    this.#trim(now)
    this.#persist()
    return session
  }

  #trim(now) {
    const entries = Object.entries(this.sessions).filter(([, session]) => session && session.expiresAt > now && session.absoluteExpiresAt > now)
    entries.sort((a, b) => b[1].lastSeenAt - a[1].lastSeenAt)
    this.sessions = Object.fromEntries(entries.slice(0, this.maxSessions))
  }

  getOrCreate(owner, now = Date.now()) {
    const ownerKey = this.#ownerKey(owner)
    const current = this.sessions[ownerKey]
    if (!current || current.revokedAt || current.expiresAt <= now || current.absoluteExpiresAt <= now) {
      return this.#newSession(ownerKey, now, current ? 'expired' : 'created')
    }
    const previousLastSeenAt = current.lastSeenAt
    current.lastSeenAt = now
    current.expiresAt = Math.min(now + this.idleTtlMs, current.absoluteExpiresAt)
    if (now - previousLastSeenAt >= 60_000) this.#persist()
    return current
  }

  rotate(owner, reason = 'manual', now = Date.now()) {
    const ownerKey = this.#ownerKey(owner)
    const current = this.sessions[ownerKey]
    const next = this.#newSession(ownerKey, now, reason)
    next.rotations = current ? Number(current.rotations || 0) + 1 : 0
    this.sessions[ownerKey] = next
    this.#persist()
    return next
  }

  logout(owner, now = Date.now()) {
    const ownerKey = this.#ownerKey(owner)
    const current = this.sessions[ownerKey]
    if (!current) return false
    current.revokedAt = now
    delete this.sessions[ownerKey]
    this.#persist()
    return true
  }

  inspect(owner, now = Date.now()) {
    const session = this.getOrCreate(owner, now)
    return {
      id: session.id,
      createdAt: session.createdAt,
      lastSeenAt: session.lastSeenAt,
      expiresAt: session.expiresAt,
      absoluteExpiresAt: session.absoluteExpiresAt,
      rotations: session.rotations,
      reason: session.reason,
    }
  }

  get size() {
    return Object.keys(this.sessions).length
  }
}

module.exports = { UserSessionStore }
