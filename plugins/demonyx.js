'use strict'

const { bot } = require('../lib/')
const agent = require('../lib/demonyx/agent')
const telemetry = require('../lib/demonyx/telemetry')
const { RateLimiter } = require('../lib/demonyx/safety')
const { KeyedQueue } = require('../lib/demonyx/queue')

const limiter = new RateLimiter({
  max: process.env.DEMONYX_DX_RATE_LIMIT || 30,
  windowMs: process.env.DEMONYX_DX_WINDOW_MS || 60_000,
})
const queue = new KeyedQueue()

bot(
  {
    pattern: 'dx ?(.*)',
    desc: 'Dēmonyx specialist: search and execute 1,200+ registered commands.',
    type: 'specialist',
  },
  async (message, match, ctx) => {
    const identity = message.sender || message.jid || 'anonymous'
    const decision = limiter.check(identity)
    if (!decision.allowed) {
      telemetry.record('specialist.rate_limited', { sender: message.sender, jid: message.jid })
      const seconds = Math.max(1, Math.ceil(decision.retryAfterMs / 1000))
      return message.send(`Dēmonyx specialist rate limit reached. Try again in ${seconds}s.`)
    }

    return queue.run(identity, async () => {
      try {
        const response = await agent.run(match, {
          message,
          ctx,
          jid: message.jid,
          sender: message.sender,
          rateLimitRemaining: decision.remaining,
        })
        return message.send(response)
      } catch (error) {
        telemetry.record('specialist.failure', { sender: message.sender, jid: message.jid, error: error.message })
        if (typeof logger !== 'undefined') logger.error({ msg: 'Dēmonyx specialist failed', error: error.message })
        return message.send('Dēmonyx specialist could not complete that request. No external state was changed.')
      }
    })
  }
)
