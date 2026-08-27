'use strict'

const fs = require('fs')
const os = require('os')
const path = require('path')
const assert = require('assert/strict')
const crypto = require('crypto')
const registry = require('../lib/demonyx/command-registry')
const agent = require('../lib/demonyx/agent')
const telemetry = require('../lib/demonyx/telemetry')
const { LocalMoE } = require('../lib/demonyx/moe')
const { SaveSoStore } = require('../lib/demonyx/saveso')
const { UserSessionStore } = require('../lib/demonyx/user-sessions')
const { validateConfig, safeSnapshot } = require('../lib/demonyx/config')
const { classifyUrl, redact, RateLimiter } = require('../lib/demonyx/safety')
const { verifyMetaSignature, verifyChallenge, ReplayGuard } = require('../lib/demonyx/webhook')
const { KeyedQueue } = require('../lib/demonyx/queue')

async function main() {
  telemetry.clear()
  for (const requiredPath of ['index.js', 'config.js', 'lib/client.js', 'lib/api.js', 'plugins/alive.js', 'plugins/antiLink.js', 'lang/en.json', 'media/black.jpg', 'Dockerfile', 'heroku.yml']) {
    assert.equal(fs.existsSync(requiredPath), true, `preserved path missing: ${requiredPath}`)
  }
  assert.ok(registry.size >= 11000, `expected at least 11000 commands, got ${registry.size}`)
  assert.equal(registry.getCommand('help').name, 'help')
  assert.equal(registry.getCommand('commands').name, 'count')
  assert.equal(registry.getCommand('dx-audit-access').category, 'admin')
  assert.equal(registry.getCommand('moderation-scan-links').capability, 'moderation.scan.links')
  assert.equal(registry.getCommand('dx-automation-inspect-account').capability, 'automation.inspect.account')
  assert.equal(Object.keys(registry.getCategories()).length, 23)

  const count = await agent.run('count', { sender: 'tester' })
  assert.match(count, new RegExp(`${registry.size} registered specialist commands`))
  assert.match(await agent.run('categories', { sender: 'tester' }), /automation/)
  assert.match(await agent.run('categories', { sender: 'tester' }), /moderation/)
  assert.match(await agent.run('search webhook', { sender: 'tester' }), /webhook/)

  const execution = await agent.run('dx-audit-access', { sender: 'tester', API_KEY: 'must-not-leak' })
  assert.match(execution, /Dēmonyx specialist prepared: dx-audit-access/)
  assert.match(execution, /No external state was changed/)
  assert.equal(await agent.run('utility-calculate-number 2 + 3 * 4'), 'Result: 14')
  assert.match(await agent.run('utility-encode-text hello'), /Base64: aGVsbG8=/)
  assert.match(await agent.run('utility-format-json {"ok":true}'), /"ok": true/)
  assert.match(await agent.run('security-check-url http://127.0.0.1:8080'), /URL rejected/)
  assert.match(await agent.run('security-check-url https://example.com/path'), /URL accepted/)
  assert.match(await agent.run('status', { sender: 'tester' }), /MoE experts:/)
  assert.match(await agent.run('does-not-exist', { sender: 'tester' }), /Command not found/)

  const localMoe = new LocalMoE()
  assert.ok(Object.keys(localMoe.model.experts).length >= 8)
  assert.equal(localMoe.route('please calculate and format this JSON').expert, 'utility')
  assert.equal(localMoe.route('audit this webhook secret').expert, 'security')
  assert.match(localMoe.respond('make a task reminder', { sessionId: 'tester' }), /local MoE routed/)

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

  const sessionDir = fs.mkdtempSync(path.join(os.tmpdir(), 'demonyx-user-sessions-'))
  const sessionPath = path.join(sessionDir, 'sessions.json')
  const userSessions = new UserSessionStore({ filePath: sessionPath, idleTtlMs: 100, maxAgeMs: 1_000, maxSessions: 10 })
  const aliceFirst = userSessions.getOrCreate('alice', 1_000)
  const aliceSame = userSessions.getOrCreate('alice', 1_050)
  const bobFirst = userSessions.getOrCreate('bob', 1_050)
  assert.equal(aliceFirst.id, aliceSame.id)
  assert.notEqual(aliceFirst.id, bobFirst.id)
  const aliceRotated = userSessions.rotate('alice', 'test', 1_060)
  assert.notEqual(aliceRotated.id, aliceFirst.id)
  assert.equal(userSessions.inspect('alice', 1_100).id, aliceRotated.id)
  assert.notEqual(userSessions.getOrCreate('alice', 1_200).id, aliceRotated.id)
  const reloadedSessions = new UserSessionStore({ filePath: sessionPath, idleTtlMs: 100, maxAgeMs: 1_000, maxSessions: 10 })
  assert.equal(reloadedSessions.size, 1)
  assert.equal(reloadedSessions.logout('bob', 1_250), false)
  assert.equal(reloadedSessions.size, 1)
  fs.rmSync(sessionDir, { recursive: true, force: true })

  const savePath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'demonyx-saveso-')), 'saves.json')
  const saves = new SaveSoStore({ filePath: savePath, maxItems: 10 })
  const saved = saves.save('alice', 'Remember to review the deployment checklist')
  assert.equal(saved.ok, true)
  assert.equal(saves.list('bob').length, 0)
  assert.equal(saves.get('alice', saved.item.id).text, 'Remember to review the deployment checklist')
  assert.equal(saves.search('alice', 'deployment').length, 1)
  const reloaded = new SaveSoStore({ filePath: savePath, maxItems: 10 })
  assert.equal(reloaded.list('alice').length, 1)
  assert.equal(reloaded.remove('alice', saved.item.id), true)
  assert.equal(reloaded.get('alice', saved.item.id), null)
  fs.rmSync(path.dirname(savePath), { recursive: true, force: true })

  const libPath = require.resolve('../lib/')
  const pluginPath = require.resolve('../plugins/demonyx')
  const savePluginPath = require.resolve('../plugins/saveso')
  const originalLib = require.cache[libPath]
  const registrations = []
  require.cache[libPath] = { id: libPath, filename: libPath, loaded: true, exports: { bot: (config, handler) => registrations.push({ config, handler }) } }
  delete require.cache[pluginPath]
  delete require.cache[savePluginPath]
  const demonyxPlugin = require(pluginPath)
  require(savePluginPath)
  assert.equal(registrations.length, 2)
  const pluginSessionDir = fs.mkdtempSync(path.join(os.tmpdir(), 'demonyx-plugin-session-'))
  const pluginSessions = new UserSessionStore({ filePath: path.join(pluginSessionDir, 'sessions.json') })
  assert.match(demonyxPlugin.sessionResponse('alice', 'session', pluginSessions), /Logical session active/)
  assert.match(demonyxPlugin.sessionResponse('alice', 'SESSION ROTATE', pluginSessions), /Logical session rotated/)
  assert.match(demonyxPlugin.sessionResponse('alice', 'session logout', pluginSessions), /Logical session revoked/)
  fs.rmSync(pluginSessionDir, { recursive: true, force: true })
  assert.equal(registrations.some(({ config }) => config.pattern === 'dx ?(.*)'), true)
  assert.equal(registrations.some(({ config }) => config.pattern === 'saveso ?(.*)'), true)
  assert.equal(registrations.every(({ handler }) => typeof handler === 'function'), true)
  delete require.cache[pluginPath]
  delete require.cache[savePluginPath]
  if (originalLib) require.cache[libPath] = originalLib
  else delete require.cache[libPath]

  assert.ok((await agent.run('count')).includes(`${registry.size}`))
  console.log(`Dēmonyx tests passed: ${registry.size} commands registered`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
