'use strict'

const { bot } = require('../lib/')
const { SaveSoStore, formatItem } = require('../lib/demonyx/saveso')
const { UserSessionStore } = require('../lib/demonyx/user-sessions')

const store = new SaveSoStore()
const sessions = new UserSessionStore()

function ownerFor(message) {
  return message.sender || message.jid || 'anonymous'
}

function help() {
  return [
    'Dēmonyx SaveSo',
    '.saveso <text> — save a note or item',
    '.saveso list — list your saved items',
    '.saveso get <id> — retrieve one item',
    '.saveso search <term> — search your items',
    '.saveso delete <id> — delete one of your items',
  ].join('\n')
}

bot(
  {
    pattern: 'saveso ?(.*)',
    desc: 'Save and retrieve personal notes safely with Dēmonyx SaveSo.',
    type: 'utility',
  },
  async (message, match) => {
    const input = String(match || '').trim()
    const [action, ...rest] = input.split(/\s+/)
    const owner = ownerFor(message)
    const logicalSession = sessions.getOrCreate(owner)

    if (!input) return message.send(help())
    if (action.toLowerCase() === 'list') {
      const items = store.list(owner)
      return message.send(items.length ? ['Your saved items:', ...items.map(formatItem)].join('\n') : 'You have no saved items yet.')
    }
    if (action.toLowerCase() === 'get') {
      const item = store.get(owner, rest[0])
      return message.send(item ? formatItem(item) : 'Saved item not found.')
    }
    if (action.toLowerCase() === 'search') {
      const items = store.search(owner, rest.join(' '))
      return message.send(items.length ? ['Matching saved items:', ...items.map(formatItem)].join('\n') : 'No matching saved items.')
    }
    if (action.toLowerCase() === 'delete') {
      if (!rest[0]) return message.send('Use `.saveso delete <id>`.')
      return message.send(store.remove(owner, rest[0]) ? 'Saved item deleted.' : 'Saved item not found.')
    }

    const result = store.save(owner, input)
    return message.send(result.ok ? `Saved as ${result.item.id} in logical session ${logicalSession.id.slice(0, 8)}. Use ".saveso get ${result.item.id}" to retrieve it.` : result.error)
  }
)
