'use strict'

class KeyedQueue {
  constructor({ maxKeys = 10_000 } = {}) {
    this.maxKeys = Math.max(100, Number(maxKeys) || 10_000)
    this.queues = new Map()
  }

  async run(key, task) {
    if (typeof task !== 'function') throw new TypeError('queue task must be a function')
    const id = String(key || 'anonymous')
    const previous = this.queues.get(id) || Promise.resolve()
    const current = previous.catch(() => undefined).then(task)
    this.queues.set(id, current)
    try {
      return await current
    } finally {
      if (this.queues.get(id) === current) this.queues.delete(id)
    }
  }

  get size() {
    return this.queues.size
  }
}

module.exports = { KeyedQueue }
