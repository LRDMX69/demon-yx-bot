#!/usr/bin/env node
'use strict'

const assert = require('assert')
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const pluginDir = path.join(root, 'plugins')
const pluginFiles = fs.readdirSync(pluginDir).filter((name) => name.endsWith('.js'))
const sources = new Map(pluginFiles.map((name) => [name, fs.readFileSync(path.join(pluginDir, name), 'utf8')]))

const unsafeReplyPatterns = [
  /match\s*=\s*match\s*\|\|\s*message\.reply_message\.text/,
  /match\s*=\s*isUrl\(match\s*\|\|\s*message\.reply_message\.text\)/,
  /let\s+\w+\s*=\s*message\.reply_message\.text/,
  /message\.reply_message\.txt/,
]

const unsafe = []
for (const [name, source] of sources) {
  for (const pattern of unsafeReplyPatterns) {
    if (pattern.test(source)) unsafe.push({ file: name, pattern: pattern.source })
  }
}
assert.deepStrictEqual(unsafe, [], `unsafe reply-message patterns found: ${JSON.stringify(unsafe)}`)

const guardedFallbacks = [
  ['bing.js', 'message.reply_message && message.reply_message.text'],
  ['group.js', 'message.reply_message && message.reply_message.text'],
  ['insta.js', 'message.reply_message && message.reply_message.text'],
  ['mediafire.js', 'message.reply_message && message.reply_message.text'],
  ['pinterest.js', 'message.reply_message && message.reply_message.text'],
  ['plugins.js', 'message.reply_message && message.reply_message.text'],
  ['reddit.js', 'message.reply_message && message.reply_message.text'],
  ['spotify.js', 'message.reply_message && message.reply_message.text'],
  ['ss.js', 'message.reply_message && message.reply_message.text'],
  ['tts.js', 'message.reply_message && message.reply_message.text'],
  ['upload.js', 'message.reply_message && message.reply_message.text'],
  ['y2mate.js', 'message.reply_message && message.reply_message.text'],
  ['yts.js', 'message.reply_message && message.reply_message.text'],
  ['mute.js', 'message.reply_message && message.reply_message.text'],
]
for (const [file, fragment] of guardedFallbacks) {
  assert(sources.get(file).includes(fragment), `${file} is missing its guarded reply fallback`)
}

for (const file of ['filters.js', 'gfilters.js']) {
  const source = sources.get(file)
  assert(source.includes('message.reply_message.text'), `${file} lost its reply text path`)
  assert(!source.includes('message.reply_message.txt'), `${file} regressed to the misspelled txt property`)
}

const tagSource = sources.get('tag.js')
assert(tagSource.includes('const replyText = message.reply_message && message.reply_message.text'))
assert(!tagSource.includes('message.reply_message.txt'))

const pluginSource = sources.get('plugins.js')
assert(pluginSource.includes('fromMe: true'), 'external plugin management must remain owner-only')
assert(pluginSource.includes('gist.githubusercontent.com'))
assert(pluginSource.includes('maxContentLength: MAX_PLUGIN_BYTES'))
assert(pluginSource.includes('timeout: 15000'))
assert(!pluginSource.includes('await message.send(e.stack'))
assert(!pluginSource.includes('await message.send(`${error.message}'))

console.log(JSON.stringify({ checkedPluginFiles: pluginFiles.length, guardedFallbacks: guardedFallbacks.length, status: 'ok' }, null, 2))
