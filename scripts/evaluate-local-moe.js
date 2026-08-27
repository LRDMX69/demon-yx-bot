'use strict'

const fs = require('fs')
const path = require('path')
const { LocalMoE } = require('../lib/demonyx/moe')

const inputPath = path.resolve(process.argv[2] || path.join(__dirname, '../data/moe-training.jsonl'))
const rows = fs.readFileSync(inputPath, 'utf8').split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line))
const model = new LocalMoE()
let correct = 0
for (const row of rows) {
  const route = model.route(row.text, { sessionId: 'evaluation' })
  if (route.expert === String(row.expert).toLowerCase()) correct += 1
}
const accuracy = rows.length ? correct / rows.length : 0
console.log(JSON.stringify({ examples: rows.length, correct, accuracy: Number(accuracy.toFixed(4)), experts: Object.keys(model.model.experts).length }))
if (accuracy < 0.75) process.exitCode = 1
