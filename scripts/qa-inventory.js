'use strict'

const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

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
const functions = []
const registrations = []
const syntaxFailures = []
const suspicious = []
const patternMap = new Map()

for (const file of jsFiles) {
  const rel = path.relative(root, file)
  const source = fs.readFileSync(file, 'utf8')
  const syntax = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' })
  if (syntax.status !== 0) syntaxFailures.push({ file: rel, error: (syntax.stderr || syntax.stdout).trim() })

  const functionRegex = /(?:async\s+)?function\s+([A-Za-z_$][\w$]*)|(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/g
  for (let match = functionRegex.exec(source); match; match = functionRegex.exec(source)) {
    functions.push({ file: rel, name: match[1] || match[2] })
  }

  const patternRegex = /pattern\s*:\s*['"`]([^'"`]+)['"`]/g
  for (let match = patternRegex.exec(source); match; match = patternRegex.exec(source)) {
    const pattern = match[1]
    registrations.push({ file: rel, pattern })
    if (!patternMap.has(pattern)) patternMap.set(pattern, [])
    patternMap.get(pattern).push(rel)
  }

  const secretRegex = /(?:API_KEY|TOKEN|PASSWORD|SECRET|SESSION_ID)\s*[:=]\s*['"][^'"\n]{12,}['"]/g
  for (const match of source.matchAll(secretRegex)) {
    if (!/example|test|README|docs|node_modules/i.test(rel)) suspicious.push({ file: rel, sample: match[0].slice(0, 80) })
  }
}

const duplicates = [...patternMap.entries()]
  .filter(([, owners]) => owners.length > 1)
  .map(([pattern, owners]) => ({ pattern, files: [...new Set(owners)] }))

const required = ['index.js', 'config.js', 'package.json', 'README.md', 'Dockerfile', 'plugins/_menu.js', 'plugins/demonyx.js', 'plugins/saveso.js', 'assets/demonyx-menu.png']
const missingRequired = required.filter((item) => !fs.existsSync(path.join(root, item)))
const jsonFailures = []
for (const file of files.filter((item) => /\.json$/.test(item))) {
  try { JSON.parse(fs.readFileSync(file, 'utf8')) } catch (error) { jsonFailures.push({ file: path.relative(root, file), error: error.message }) }
}

const result = {
  root,
  javascriptFiles: jsFiles.length,
  functionDefinitions: functions.length,
  functions,
  pluginRegistrations: registrations.length,
  registrations,
  duplicatePatterns: duplicates,
  syntaxFailures,
  jsonFailures,
  suspiciousSecretLiterals: suspicious,
  missingRequired,
  trackedMenuAssetBytes: fs.existsSync(path.join(root, 'assets/demonyx-menu.png')) ? fs.statSync(path.join(root, 'assets/demonyx-menu.png')).size : 0,
}
console.log(JSON.stringify(result, null, 2))
if (syntaxFailures.length || jsonFailures.length || missingRequired.length || suspicious.length) process.exitCode = 1
