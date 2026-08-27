'use strict'

const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const skip = new Set(['node_modules', '.git', '.yarn'])
const files = []
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skip.has(entry.name)) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full)
    else files.push(full)
  }
}
walk(root)

const jsFiles = files.filter((file) => file.endsWith('.js'))
const findings = []
const unresolvedRelativeRequires = []
const sideEffects = []
const pluginIssues = []
const intentionalEventHandlers = []

for (const file of jsFiles) {
  const rel = path.relative(root, file)
  const source = fs.readFileSync(file, 'utf8')
  const line = (index) => source.slice(0, index).split(/\r?\n/).length

  for (const match of source.matchAll(/require\(['"](\.\.?\/[^'"]+)['"]\)/g)) {
    const request = match[1]
    const candidate = path.resolve(path.dirname(file), request)
    const resolved = [candidate, `${candidate}.js`, `${candidate}.json`, path.join(candidate, 'index.js')].some((item) => fs.existsSync(item))
    if (!resolved) unresolvedRelativeRequires.push({ file: rel, line: line(match.index), request })
  }

  for (const match of source.matchAll(/\b(eval|Function)\s*\(|child_process|execSync|spawnSync|exec\s*\(|new\s+Worker\s*\(/g)) findings.push({ kind: 'dynamic-or-process-execution', file: rel, line: line(match.index), token: match[0] })
  for (const match of source.matchAll(/(?:fs\.(?:writeFile|writeFileSync|renameSync|unlink|unlinkSync|rm|rmSync|mkdir|mkdirSync)|updateProfilePicture|(?:ban|kick|promote|demote)\s*\()/g)) sideEffects.push({ kind: 'external-or-persistent-side-effect', file: rel, line: line(match.index), token: match[0] })
  for (const match of source.matchAll(/(?:axios|fetch|got|node-fetch|https?\.request|https?\.get)\s*\(/g)) sideEffects.push({ kind: 'network-call', file: rel, line: line(match.index), token: match[0] })
  for (const match of source.matchAll(/bot\s*\(\s*\{/g)) {
    const nearby = source.slice(match.index, match.index + 500)
    if (/pattern\s*:/.test(nearby)) continue
    if (/\bon\s*:/.test(nearby)) {
      intentionalEventHandlers.push({ kind: 'intentional-event-handler', file: rel, line: line(match.index) })
    } else {
      pluginIssues.push({ kind: 'registration-without-pattern', file: rel, line: line(match.index) })
    }
  }
  for (const match of source.matchAll(/async\s+(?:function\s+)?[A-Za-z_$][\w$]*\s*\([^)]*\)\s*\{/g)) {
    const body = source.slice(match.index, Math.min(source.length, match.index + 1400))
    if (!/await\b|return\s+Promise|\.then\s*\(/.test(body)) findings.push({ kind: 'async-without-await-nearby', file: rel, line: line(match.index) })
  }
}

const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
const result = {
  javascriptFiles: jsFiles.length,
  unresolvedRelativeRequires,
  dynamicExecutionFindings: findings.filter((item) => item.kind === 'dynamic-or-process-execution'),
  asyncHeuristicFindings: findings.filter((item) => item.kind === 'async-without-await-nearby'),
  sideEffects,
  pluginIssues,
  intentionalEventHandlers,
  packageScripts: Object.keys(packageJson.scripts || {}),
}
console.log(JSON.stringify(result, null, 2))
if (unresolvedRelativeRequires.length || pluginIssues.length) process.exitCode = 1
