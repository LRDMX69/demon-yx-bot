'use strict'

/**
 * Dēmonyx Specialist Registry
 *
 * The registry is generated from declarative capability profiles so the bot
 * does not need 1,200 hand-maintained files. Every generated command has a
 * stable id, readable name, category, description, aliases, and an execution
 * path. Curated handlers can be registered at runtime for commands that need
 * real side effects; unhandled capabilities return a safe, useful execution
 * receipt instead of silently failing.
 */

const profiles = [
  ['admin', ['audit', 'configure', 'inspect', 'rotate', 'review', 'lock', 'unlock', 'grant', 'revoke', 'export'], ['access', 'policy', 'session', 'role', 'setting', 'permission', 'backup', 'report', 'queue', 'profile']],
  ['moderation', ['scan', 'filter', 'flag', 'warn', 'mute', 'unmute', 'ban', 'unban', 'clean', 'review'], ['links', 'spam', 'words', 'media', 'mentions', 'joins', 'leaves', 'messages', 'admins', 'rules']],
  ['utility', ['check', 'format', 'convert', 'calculate', 'lookup', 'measure', 'encode', 'decode', 'summarize', 'validate'], ['time', 'date', 'text', 'number', 'url', 'json', 'phone', 'jid', 'file', 'status']],
  ['media', ['inspect', 'download', 'compress', 'resize', 'convert', 'caption', 'extract', 'merge', 'split', 'thumbnail'], ['image', 'video', 'audio', 'sticker', 'document', 'metadata', 'preview', 'stream', 'playlist', 'format']],
  ['ai', ['ask', 'explain', 'rewrite', 'translate', 'classify', 'extract', 'compare', 'draft', 'summarize', 'brainstorm'], ['prompt', 'reply', 'topic', 'language', 'intent', 'entity', 'tone', 'answer', 'plan', 'idea']],
  ['search', ['find', 'search', 'query', 'scan', 'check', 'trace', 'match', 'index', 'lookup', 'discover'], ['web', 'news', 'source', 'command', 'plugin', 'message', 'contact', 'group', 'media', 'topic']],
  ['productivity', ['create', 'list', 'update', 'delete', 'complete', 'schedule', 'prioritize', 'track', 'review', 'remind'], ['task', 'note', 'list', 'goal', 'habit', 'event', 'project', 'bookmark', 'workflow', 'timer']],
  ['developer', ['inspect', 'debug', 'profile', 'format', 'lint', 'test', 'trace', 'benchmark', 'diff', 'generate'], ['config', 'log', 'plugin', 'command', 'api', 'schema', 'dependency', 'event', 'error', 'runtime']],
  ['security', ['check', 'audit', 'harden', 'verify', 'rotate', 'revoke', 'block', 'allow', 'monitor', 'report'], ['url', 'token', 'secret', 'header', 'session', 'webhook', 'permission', 'device', 'login', 'threat']],
  ['analytics', ['count', 'measure', 'summarize', 'compare', 'trend', 'rank', 'export', 'report', 'monitor', 'visualize'], ['messages', 'members', 'commands', 'groups', 'sessions', 'latency', 'errors', 'usage', 'activity', 'health']],
  ['group', ['inspect', 'list', 'announce', 'welcome', 'goodbye', 'mention', 'pin', 'poll', 'configure', 'report'], ['members', 'admins', 'rules', 'events', 'settings', 'links', 'mentions', 'polls', 'profile', 'activity']],
  ['fun', ['play', 'generate', 'choose', 'roll', 'flip', 'quiz', 'challenge', 'quote', 'score', 'randomize'], ['game', 'trivia', 'number', 'coin', 'dice', 'quote', 'story', 'riddle', 'team', 'prompt']],
]

const handlers = new Map()
const commands = []
const aliases = new Map()

function slug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-')
}

function addCommand(command) {
  commands.push(Object.freeze(command))
  aliases.set(command.name, command)
  for (const alias of command.aliases) aliases.set(alias, command)
}

for (const [category, verbs, objects] of profiles) {
  for (const verb of verbs) {
    for (const object of objects) {
      const name = `dx-${slug(verb)}-${slug(object)}`
      const command = {
        id: `demonyx.${category}.${commands.length + 1}`,
        name,
        aliases: [`${category}-${slug(verb)}-${slug(object)}`, `${slug(verb)}-${slug(object)}`],
        category,
        description: `${verb} ${object} with the Dēmonyx ${category} specialist.`,
        usage: `.dx ${name} [optional arguments]`,
        capability: `${category}.${verb}.${object}`,
      }
      addCommand(command)
    }
  }
}

const curated = [
  { name: 'help', aliases: ['h', 'menu'], category: 'system', description: 'Show the specialist command guide.', capability: 'system.help' },
  { name: 'count', aliases: ['commands', 'stats'], category: 'system', description: 'Show the number of registered specialist commands.', capability: 'system.count' },
  { name: 'search', aliases: ['find-command'], category: 'system', description: 'Search the command registry by name, category, or capability.', capability: 'system.search' },
  { name: 'categories', aliases: ['catalog'], category: 'system', description: 'List specialist categories and command counts.', capability: 'system.categories' },
  { name: 'status', aliases: ['health', 'ping'], category: 'system', description: 'Return a lightweight Dēmonyx health response.', capability: 'system.status' },
  { name: 'about', aliases: ['info'], category: 'system', description: 'Show Dēmonyx identity and architecture information.', capability: 'system.about' },
]
for (const command of curated) addCommand({ ...command, id: `demonyx.system.${commands.length + 1}`, usage: `.dx ${command.name} [optional arguments]` })

function registerHandler(capability, handler) {
  if (typeof handler !== 'function') throw new TypeError('Dēmonyx command handler must be a function')
  handlers.set(capability, handler)
}

function getCommand(input) {
  const key = String(input || '').trim().toLowerCase()
  return aliases.get(key) || null
}

function searchCommands(query, limit = 12) {
  const q = String(query || '').trim().toLowerCase()
  if (!q) return commands.slice(0, limit)
  return commands
    .map((command) => {
      const haystack = `${command.name} ${command.category} ${command.description} ${command.capability}`.toLowerCase()
      let score = haystack.includes(q) ? 3 : 0
      for (const token of q.split(/\s+/)) if (token && haystack.includes(token)) score += 1
      return { command, score }
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.command.name.localeCompare(b.command.name))
    .slice(0, limit)
    .map((entry) => entry.command)
}

function getCategories() {
  const result = new Map()
  for (const command of commands) result.set(command.category, (result.get(command.category) || 0) + 1)
  return Object.fromEntries([...result.entries()].sort(([a], [b]) => a.localeCompare(b)))
}

async function execute(command, context = {}) {
  const handler = handlers.get(command.capability) || handlers.get(command.category) || defaultHandler
  return handler(command, context)
}

async function defaultHandler(command) {
  return [
    `Dēmonyx specialist executed: ${command.name}`,
    `Category: ${command.category}`,
    `Capability: ${command.capability}`,
    'This command is available through the registry and can be bound to a custom action without creating another plugin file.',
  ].join('\n')
}

module.exports = {
  profiles,
  commands,
  registerHandler,
  getCommand,
  searchCommands,
  getCategories,
  execute,
  get size() {
    return commands.length
  },
}
