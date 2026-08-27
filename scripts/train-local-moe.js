'use strict'

const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const { tokenize, defaultModel } = require('../lib/demonyx/moe')

const inputPath = path.resolve(process.argv[2] || path.join(__dirname, '../data/moe-training.jsonl'))
const outputPath = path.resolve(process.argv[3] || path.join(__dirname, '../models/demonyx-moe.json'))
const stopwords = new Set(['a', 'an', 'and', 'are', 'be', 'for', 'in', 'is', 'of', 'on', 'the', 'this', 'to', 'with', 'what', 'why', 'how'])
const trainingSource = fs.readFileSync(inputPath, 'utf8')
const trainingFingerprint = crypto.createHash('sha256').update(trainingSource).digest('hex')
const rows = trainingSource.split(/\r?\n/).filter(Boolean).map((line, index) => {
  try {
    const row = JSON.parse(line)
    if (!row.expert || !row.text) throw new Error('expert and text are required')
    return row
  } catch (error) {
    throw new Error(`invalid training row ${index + 1}: ${error.message}`)
  }
})

const experts = {}
for (const row of rows) {
  const expert = String(row.expert).toLowerCase()
  const counts = experts[expert] || { documents: 0, counts: new Map() }
  counts.documents += 1
  for (const token of tokenize(row.text)) {
    if (token.length < 3 || stopwords.has(token)) continue
    counts.counts.set(token, (counts.counts.get(token) || 0) + 1)
  }
  experts[expert] = counts
}

const model = {
  ...defaultModel,
  version: 2,
  trainedAt: `offline:${trainingFingerprint.slice(0, 16)}`,
  trainingFingerprint,
  trainingExamples: rows.length,
  experts: {},
}
for (const [name, value] of Object.entries(experts)) {
  const keywords = [...value.counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 32)
    .map(([token]) => token)
  model.experts[name] = { keywords, bias: 0 }
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true })
fs.writeFileSync(outputPath, `${JSON.stringify(model, null, 2)}\n`)
console.log(`Trained local MoE: ${Object.keys(model.experts).length} experts from ${rows.length} examples -> ${outputPath}`)
