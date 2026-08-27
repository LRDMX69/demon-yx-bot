'use strict'

const { bot } = require('../lib/')
const agent = require('../lib/demonyx/agent')
const telemetry = require('../lib/demonyx/telemetry')
const { RateLimiter } = require('../lib/demonyx/safety')
const { KeyedQueue } = require('../lib/demonyx/queue')
const { UserSessionStore } = require('../lib/demonyx/user-sessions')

const limiter = new RateLimiter({
  max: process.env.DEMONYX_DX_RATE_LIMIT || 30,
  windowMs: process.env.DEMONYX_DX_WINDOW_MS || 60_000,
})
const queue = new KeyedQueue()
const sessions = new UserSessionStore()

function identityFor(message) {
  return message.sender || message.jid || 'anonymous'
}

function sessionHelp() {
  return [
    'Dēmonyx logical sessions',
    '.dx session — inspect your current bot session',
    '.dx session rotate — rotate your logical session',
    '.dx session logout — revoke your logical session',
    'This does not rotate the WhatsApp authentication session.',
  ].join('\n')
}

function sessionResponse(identity, input, sessionStore = sessions) {
  const action = (String(input || '').trim().split(/\s+/)[1] || 'inspect').toLowerCase()
  if (action === 'rotate') {
    const session = sessionStore.rotate(identity, 'manual')
    telemetry.record('user_session.rotated', { sender: identity })
    return `Logical session rotated. New session expires at ${new Date(session.expiresAt).toISOString()}. WhatsApp login was not changed.`
  }
  if (action === 'logout') {
    const removed = sessionStore.logout(identity)
    telemetry.record('user_session.logout', { sender: identity })
    return removed ? 'Logical session revoked. A new one will be created on your next request. WhatsApp login was not changed.' : 'No logical session was active. WhatsApp login was not changed.'
  }
  if (action !== 'inspect') return sessionHelp()
  const session = sessionStore.inspect(identity)
  return [`Logical session active`, `Session fingerprint: ${session.id.slice(0, 8)}`, `Expires: ${new Date(session.expiresAt).toISOString()}`, `Absolute expiry: ${new Date(session.absoluteExpiresAt).toISOString()}`, `Rotations: ${session.rotations}`, `WhatsApp SESSION_ID: unchanged`].join('\n')
}

bot(
  {
    pattern: 'dx ?(.*)',
    desc: 'Dēmonyx specialist: search and execute 11,000+ registered commands.',
    type: 'specialist',
  },
  async (message, match, ctx) => {
    const identity = identityFor(message)
    const logicalSession = sessions.getOrCreate(identity)
    const decision = limiter.check(identity)
    if (!decision.allowed) {
      telemetry.record('specialist.rate_limited', { sender: message.sender, jid: message.jid, logicalSessionId: logicalSession.id })
      const seconds = Math.max(1, Math.ceil(decision.retryAfterMs / 1000))
      return message.send(`Dēmonyx specialist rate limit reached. Try again in ${seconds}s.`)
    }

    const raw = String(match || '').trim()
    if (raw === 'session' || raw.startsWith('session ')) return message.send(sessionResponse(identity, raw))

    return queue.run(logicalSession.id, async () => {
      try {
        const response = await agent.run(match, {
          message,
          ctx,
          jid: message.jid,
          sender: message.sender,
          logicalSessionId: logicalSession.id,
          rateLimitRemaining: decision.remaining,
        })
        return message.send(response)
      } catch (error) {
        telemetry.record('specialist.failure', { sender: message.sender, jid: message.jid, logicalSessionId: logicalSession.id, error: error.message })
        if (typeof logger !== 'undefined') logger.error({ msg: 'Dēmonyx specialist failed', error: error.message })
        return message.send('Dēmonyx specialist could not complete that request. No external state was changed.')
      }
    })
  }
)

module.exports = { sessions, identityFor, sessionResponse }
