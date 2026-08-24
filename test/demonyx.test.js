'use strict'

const assert = require('assert/strict')
const crypto = require('crypto')
const registry = require('../lib/demonyx/command-registry')
const agent = require('../lib/demonyx/agent')
const telemetry = require('../lib/demonyx/telemetry')
const { validateConfig, safeSnapshot } = require('../lib/demonyx/config')
const { classifyUrl, redact, RateLimiter } = require('../lib/demonyx/safety')
const { verifyMetaSignature, verifyChallenge, ReplayGuard } = require('../lib/demonyx/webhook')
const { KeyedQueue } = require('../lib/demonyx/queue')

async function main() {
  telemetry.clear()
  assert.ok(registry.size >= 1000, `expected at least 1000 commands, got ${registry.size}`)
  assert.equal(registry.getCommand('help').name, 'help')
  assert.equal(registry.getCommand('commands').name, 'count')
  assert.equal(registry.getCommand('dx-audit-access').category, 'admin')
  assert.equal(registry.getCommand('moderation-scan-links').capability, 'moderation.scan.links')
  assert.equal(Object.keys(registry.getCategories()).length, 13)

  const count = await agent.run('count', { sender: 'tester' })
  assert.match(count, new RegExp(`${registry.size} registered specialist commands`))
  assert.match(await agent.run('categories', { sender: 'tester' }), /moderation/)
  assert.match(await agent.run('categories', { sender: 'tester' }), /developer/)
  assert.match(await agent.run('search webhook', { sender: 'tester' }), /webhook/)

  const execution = await agent.run('dx-audit-access', { sender: 'tester', API_KEY: 'must-not-leak' })
  assert.match(execution, /Dēmonyx specialist prepared: dx-audit-access/)
  assert.match(execution, /No external state was changed/)
  assert.equal(await agent.run('utility-calculate-number 2 + 3 * 4'), 'Result: 14')
  assert.match(await agent.run('utility-encode-text hello'), /Base64: aGVsbG8=/)
  assert.match(await agent.run('utility-format-json {"ok":true}'), /"ok": true/)
  assert.match(await agent.run('security-check-url http://127.0.0.1:8080'), /URL rejected/)
  assert.match(await agent.run('security-check-url https://example.com/path'), /URL accepted/)
  assert.match(await agent.run('status', { sender: 'tester' }), /Requests recorded:/)
  assert.match(await agent.run('does-not-exist', { sender: 'tester' }), /Command not found/)

  const limiter = new RateLimiter({ max: 2, windowMs: 60_000 })
  assert.equal(limiter.check('tester').allowed, true)
  assert.equal(limiter.check('tester').allowed, true)
  assert.equal(limiter.check('tester').allowed, false)
  assert.equal(redact({ API_KEY: 'secret', nested: { password: 'hidden' } }).API_KEY, '[redacted]')
  assert.equal(classifyUrl('https://user:pass@example.com').ok, false)
  assert.equal(telemetry.snapshot(100).some((event) => JSON.stringify(event).includes('must-not-leak')), false)

  const rawBody = JSON.stringify({ object: 'whatsapp_business_account', entry: [] })
  const appSecret = 'test-secret'
  const signature = crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex')
  assert.equal(verifyMetaSignature(rawBody, `sha256=${signature}`, appSecret), true)
  assert.equal(verifyMetaSignature(rawBody, `sha256=${'0'.repeat(64)}`, appSecret), false)
  assert.deepEqual(verifyChallenge({ mode: 'subscribe', token: 'verify-me', challenge: 'abc' }, 'verify-me'), { ok: true, status: 200, challenge: 'abc' })
  assert.equal(verifyChallenge({ mode: 'subscribe', token: 'wrong', challenge: 'abc' }, 'verify-me').ok, false)

  const guard = new ReplayGuard({ ttlMs: 60_000 })
  assert.equal(guard.seen('event-1'), false)
  assert.equal(guard.seen('event-1'), true)
  assert.equal(guard.seen('event-2'), false)

  assert.equal(validateConfig({ API_MODE: 'both', API_KEY: 'set', API_WEBHOOK_URL: 'https://example.com/hook' }).ok, true)
  const invalid = validateConfig({ API_MODE: 'both', API_KEY: '', API_WEBHOOK_URL: 'http://example.com/hook' })
  assert.equal(invalid.ok, false)
  assert.match(invalid.issues.join(' '), /API_KEY/)
  assert.match(invalid.issues.join(' '), /HTTPS/)
  assert.equal(safeSnapshot({ API_KEY: 'secret', SESSION_ID: 'session', API_MODE: 'true' }).API_KEY, '[redacted]')

  const queue = new KeyedQueue()
  const order = []
  await Promise.all([
    queue.run('same-sender', async () => { order.push('first-start'); await new Promise((resolve) => setTimeout(resolve, 5)); order.push('first-end') }),
    queue.run('same-sender', async () => { order.push('second-start'); order.push('second-end') }),
  ])
  assert.deepEqual(order, ['first-start', 'first-end', 'second-start', 'second-end'])
  assert.equal(queue.size, 0)

  console.log(`Dēmonyx tests passed: ${registry.size} commands registered`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
