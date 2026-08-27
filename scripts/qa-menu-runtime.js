'use strict'

const assert = require('assert')
const path = require('path')

const libPath = require.resolve('../lib/')
const menuPath = require.resolve('../plugins/_menu')
const registrations = []
const lang = {
  plugins: {
    menu: {
      help: { format: (...args) => `HELP ${args.join('|')}` },
      menu: { format: (...args) => `MENU ${args.join('|')}` },
      disabled: 'disabled',
    },
  },
}
require.cache[libPath] = {
  id: libPath,
  filename: libPath,
  loaded: true,
  exports: {
    addSpace: () => '',
    textToStylist: (text) => text,
    getUptime: () => '1m',
    getRam: () => '100 MB',
    getDate: () => [new Date('2026-01-01T00:00:00Z'), '00:00'],
    getPlatform: () => 'test',
    bot: (config, handler) => registrations.push({ config, handler }),
    lang,
  },
}
delete require.cache[menuPath]
require(menuPath)

const menu = registrations.find(({ config }) => config.pattern === 'menu ?(.*)')
assert.ok(menu, 'menu plugin did not register')
const assetPath = path.resolve(__dirname, '../assets/demonyx-menu.png')
const ctx = {
  PREFIX: '.',
  VERSION: 'test',
  pluginsCount: 2,
  commands: [
    { name: 'menu', type: 'general', pattern: 'menu' },
    { name: 'ping', type: 'utility', pattern: 'ping' },
  ],
}

async function run() {
  const successfulCalls = []
  await menu.handler({ pushName: 'QA', data: {}, send: async (...args) => successfulCalls.push(args) }, '', ctx)
  assert.equal(successfulCalls.length, 1)
  assert.equal(successfulCalls[0][0], assetPath)
  assert.equal(successfulCalls[0][2], 'image')
  assert.match(successfulCalls[0][1].caption, /MENU/)
  assert.match(successfulCalls[0][1].caption, /PING/)

  const fallbackCalls = []
  await menu.handler({ pushName: 'QA', data: {}, send: async (...args) => {
    fallbackCalls.push(args)
    if (args[2] === 'image') throw new Error('simulated media failure')
  } }, '', ctx)
  assert.equal(fallbackCalls.length, 2)
  assert.equal(typeof fallbackCalls[1][0], 'string')
  assert.match(fallbackCalls[1][0], /MENU/)
  console.log('Menu runtime QA passed: image-first delivery and text fallback verified')
}

run().catch((error) => {
  console.error(error.stack || error.message)
  process.exitCode = 1
})
