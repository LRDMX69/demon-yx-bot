'use strict'

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

class SaveSoStore {
  constructor({ filePath = process.env.DEMONYX_SAVESO_FILE || path.join(process.cwd(), 'data', 'saveso.json'), maxItems = 5_000 } = {}) {
    this.filePath = path.resolve(filePath)
    this.maxItems = Math.max(100, Number(maxItems) || 5_000)
    this.items = this.#load()
  }

  #load() {
    try {
      const parsed = JSON.parse(fs.readFileSync(this.filePath, 'utf8'))
      return Array.isArray(parsed) ? parsed.filter((item) => item && item.id && item.owner && item.text) : []
    } catch {
      return []
    }
  }

  #persist() {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true })
    const tempPath = `${this.filePath}.${process.pid}.tmp`
    fs.writeFileSync(tempPath, `${JSON.stringify(this.items, null, 2)}\n`, { mode: 0o600 })
    fs.renameSync(tempPath, this.filePath)
  }

  save(owner, text) {
    const normalizedOwner = String(owner || 'anonymous').slice(0, 160)
    const normalizedText = String(text || '').trim().slice(0, 4_000)
    if (!normalizedText) return { ok: false, error: 'Nothing to save. Use `.saveso <text>`.' }
    const item = { id: crypto.randomBytes(4).toString('hex'), owner: normalizedOwner, text: normalizedText, createdAt: new Date().toISOString() }
    this.items.push(item)
    while (this.items.length > this.maxItems) this.items.shift()
    this.#persist()
    return { ok: true, item }
  }

  list(owner, limit = 10) {
    const normalizedOwner = String(owner || 'anonymous')
    return this.items.filter((item) => item.owner === normalizedOwner).slice(-Math.max(1, Math.min(Number(limit) || 10, 50))).reverse()
  }

  get(owner, id) {
    const normalizedOwner = String(owner || 'anonymous')
    return this.items.find((item) => item.owner === normalizedOwner && item.id === String(id || '')) || null
  }

  search(owner, query, limit = 10) {
    const normalizedOwner = String(owner || 'anonymous')
    const q = String(query || '').trim().toLowerCase()
    return this.items.filter((item) => item.owner === normalizedOwner && (!q || item.text.toLowerCase().includes(q))).slice(-Math.max(1, Math.min(Number(limit) || 10, 50))).reverse()
  }

  remove(owner, id) {
    const normalizedOwner = String(owner || 'anonymous')
    const index = this.items.findIndex((item) => item.owner === normalizedOwner && item.id === String(id || ''))
    if (index < 0) return false
    this.items.splice(index, 1)
    this.#persist()
    return true
  }
}

function formatItem(item) {
  return `[${item.id}] ${item.text} (${item.createdAt})`
}

module.exports = { SaveSoStore, formatItem }
