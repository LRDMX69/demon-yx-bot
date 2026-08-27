'use strict'

const fs = require('fs')
const path = require('path')

const DEFAULT_MODEL_PATH = path.join(__dirname, '../../models/demonyx-moe.json')

const defaultModel = {
  version: 1,
  trainedAt: null,
  experts: {
    moderation: { keywords: ['spam', 'link', 'warn', 'mute', 'ban', 'group', 'admin'], bias: 0 },
    utility: { keywords: ['calculate', 'convert', 'format', 'json', 'encode', 'decode', 'time'], bias: 0 },
    security: { keywords: ['security', 'url', 'token', 'secret', 'webhook', 'audit', 'safe'], bias: 0 },
    productivity: { keywords: ['task', 'note', 'save', 'plan', 'remind', 'schedule', 'list'], bias: 0 },
    knowledge: { keywords: ['explain', 'what', 'why', 'how', 'learn', 'define', 'summary'], bias: 0 },
    media: { keywords: ['image', 'video', 'audio', 'sticker', 'media', 'thumbnail', 'caption'], bias: 0 },
    developer: { keywords: ['code', 'debug', 'test', 'plugin', 'api', 'config', 'error'], bias: 0 },
    community: { keywords: ['welcome', 'poll', 'announce', 'member', 'mention', 'event', 'community'], bias: 0 },
  },
}

function loadModel(modelPath = DEFAULT_MODEL_PATH) {
  try {
    const parsed = JSON.parse(fs.readFileSync(modelPath, 'utf8'))
    if (parsed && parsed.experts && typeof parsed.experts === 'object') return parsed
  } catch {}
  return JSON.parse(JSON.stringify(defaultModel))
}

function tokenize(text) {
  return String(text || '').toLowerCase().match(/[a-z0-9_-]+/g) || []
}

class BoundedMemory {
  constructor({ maxSessions = 1_000, maxItemsPerSession = 20 } = {}) {
    this.maxSessions = Math.max(1, Number(maxSessions) || 1_000)
    this.maxItemsPerSession = Math.max(1, Number(maxItemsPerSession) || 20)
    this.sessions = new Map()
  }

  add(sessionId, value) {
    const key = String(sessionId || 'default')
    if (!this.sessions.has(key) && this.sessions.size >= this.maxSessions) this.sessions.delete(this.sessions.keys().next().value)
    const items = this.sessions.get(key) || []
    items.push(String(value || '').slice(0, 500))
    while (items.length > this.maxItemsPerSession) items.shift()
    this.sessions.set(key, items)
  }

  recent(sessionId, limit = 5) {
    const items = this.sessions.get(String(sessionId || 'default')) || []
    return items.slice(-Math.max(1, Math.min(Number(limit) || 5, this.maxItemsPerSession)))
  }
}

class LocalMoE {
  constructor({ modelPath = DEFAULT_MODEL_PATH, memory } = {}) {
    this.modelPath = modelPath
    this.model = loadModel(modelPath)
    this.memory = memory || new BoundedMemory()
  }

  refresh() {
    this.model = loadModel(this.modelPath)
    return this.model
  }

  route(input, { sessionId } = {}) {
    const tokens = tokenize(input)
    const scores = Object.entries(this.model.experts).map(([name, expert]) => {
      const keywordSet = new Set((expert.keywords || []).map((keyword) => String(keyword).toLowerCase()))
      const matches = tokens.filter((token) => keywordSet.has(token)).length
      const score = matches + Number(expert.bias || 0)
      return { name, score, matches }
    }).sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    const winner = scores[0] || { name: 'knowledge', score: 0, matches: 0 }
    const runnerUp = scores[1] || { score: 0 }
    const confidence = winner.score <= 0 ? 0 : Math.min(1, (winner.score - runnerUp.score + 1) / (winner.score + 1))
    this.memory.add(sessionId, input)
    return {
      expert: winner.name,
      confidence: Number(confidence.toFixed(2)),
      matches: winner.matches,
      recentContext: this.memory.recent(sessionId),
      scores,
    }
  }

  respond(input, context = {}) {
    const route = this.route(input, context)
    const text = String(input || '').trim()
    const prefix = `Dēmonyx local MoE routed this to the ${route.expert} expert (${Math.round(route.confidence * 100)}% confidence).`
    if (!text) return `${prefix}\nSend a short request or use .dx help.`
    return `${prefix}\nLocal-first response: I can prepare a safe ${route.expert} workflow for “${text.slice(0, 280)}”. External AI is not required for this routing decision.`
  }
}

module.exports = { LocalMoE, BoundedMemory, loadModel, defaultModel, tokenize }
