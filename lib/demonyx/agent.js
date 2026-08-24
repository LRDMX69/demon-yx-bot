'use strict'

const os = require('os')
const registry = require('./command-registry')
const { bindBuiltins } = require('./actions')
const telemetry = require('./telemetry')

bindBuiltins(registry)

function compact(command) {
  return `• .dx ${command.name} — ${command.description}`
}

function help(query) {
  const matches = registry.searchCommands(query, 16)
  const title = query ? `Dēmonyx specialist matches for “${query}”` : 'Dēmonyx specialist command guide'
  return [title, `Registered commands: ${registry.size}`, ...matches.map(compact)].join('\n')
}

function categories() {
  return ['Dēmonyx specialist categories', ...Object.entries(registry.getCategories()).map(([name, count]) => `• ${name}: ${count} commands`)].join('\n')
}

function suggestions(input) {
  const matches = registry.searchCommands(input, 8)
  if (!matches.length) return 'Command not found. Try `.dx help`, `.dx categories`, or `.dx search <term>`.'
  return ['Command not found. Did you mean:', ...matches.map(compact)].join('\n')
}

async function run(input, context = {}) {
  const raw = String(input || '').trim()
  const [first, ...rest] = raw.split(/\s+/)
  const query = rest.join(' ')
  const normalized = first.toLowerCase()
  telemetry.record('specialist.request', { sender: context.sender, jid: context.jid, command: normalized })

  if (!raw || normalized === 'help' || normalized === 'h' || normalized === 'menu') return help(query)
  if (normalized === 'categories' || normalized === 'catalog') return categories()
  if (normalized === 'count' || normalized === 'commands' || normalized === 'stats') return `Dēmonyx currently has ${registry.size} registered specialist commands.`
  if (normalized === 'search' || normalized === 'find-command') return help(query)
  if (normalized === 'status' || normalized === 'health' || normalized === 'ping') {
    const summary = telemetry.summary()
    return [`Dēmonyx specialist online`, `Commands: ${registry.size}`, `Requests recorded: ${summary.total}`, `Node: ${process.version}`, `Platform: ${process.platform}`, `Memory: ${Math.round(os.freemem() / 1024 / 1024)} MB free`].join('\n')
  }
  if (normalized === 'about' || normalized === 'info') {
    return 'Dēmonyx is an additive specialist layer for the Levanter-compatible WhatsApp bot. It keeps the existing plugin system and adds a declarative, searchable, extensible command registry.'
  }

  const command = registry.getCommand(normalized)
  if (!command) return suggestions(raw)
  return registry.execute(command, { ...context, args: rest, input: raw })
}

module.exports = { run, help, categories }
