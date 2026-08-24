'use strict'

const assert = require('assert/strict')
const registry = require('../lib/demonyx/command-registry')
const agent = require('../lib/demonyx/agent')

async function main() {
  assert.ok(registry.size >= 1000, `expected at least 1000 commands, got ${registry.size}`)
  assert.equal(registry.getCommand('help').name, 'help')
  assert.equal(registry.getCommand('commands').name, 'count')
  assert.equal(registry.getCommand('dx-audit-access').category, 'admin')
  assert.equal(registry.getCommand('moderation-scan-links').capability, 'moderation.scan.links')
  assert.equal(Object.keys(registry.getCategories()).length, 13)

  const count = await agent.run('count')
  assert.match(count, new RegExp(`${registry.size} registered specialist commands`))

  const categoryGuide = await agent.run('categories')
  assert.match(categoryGuide, /moderation/)
  assert.match(categoryGuide, /developer/)

  const search = await agent.run('search webhook')
  assert.match(search, /webhook/)

  const execution = await agent.run('dx-audit-access')
  assert.match(execution, /Dēmonyx specialist executed: dx-audit-access/)

  const unknown = await agent.run('does-not-exist')
  assert.match(unknown, /Command not found/)

  console.log(`Dēmonyx tests passed: ${registry.size} commands registered`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
