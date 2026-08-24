'use strict'

const { classifyUrl, redact } = require('./safety')

function argsText(context) {
  return (context.args || []).join(' ').trim()
}

function calculate(expression) {
  const source = String(expression || '').replace(/\s+/g, '')
  if (!source || !/^[0-9+\-*/().%]+$/.test(source)) return 'Provide a numeric expression using digits and + - * / % ( ).'
  const tokens = source.match(/\d+(?:\.\d+)?|[()+\-*/%]/g) || []
  const precedence = { '+': 1, '-': 1, '*': 2, '/': 2, '%': 2 }
  const values = []
  const ops = []
  const apply = () => {
    const op = ops.pop()
    const b = values.pop()
    const a = values.pop()
    if ([op, a, b].some((value) => value === undefined)) throw new Error('invalid expression')
    if (op === '+') values.push(a + b)
    if (op === '-') values.push(a - b)
    if (op === '*') values.push(a * b)
    if (op === '/') values.push(b === 0 ? NaN : a / b)
    if (op === '%') values.push(b === 0 ? NaN : a % b)
  }
  for (const token of tokens) {
    if (/^\d/.test(token)) values.push(Number(token))
    else if (token === '(') ops.push(token)
    else if (token === ')') {
      while (ops.length && ops.at(-1) !== '(') apply()
      if (ops.pop() !== '(') throw new Error('unbalanced parentheses')
    } else {
      while (ops.length && ops.at(-1) !== '(' && precedence[ops.at(-1)] >= precedence[token]) apply()
      ops.push(token)
    }
  }
  while (ops.length) {
    if (ops.at(-1) === '(') throw new Error('unbalanced parentheses')
    apply()
  }
  const result = values[0]
  return Number.isFinite(result) ? `Result: ${result}` : 'The expression does not produce a finite result.'
}

function utilityHandler(command, context) {
  const input = argsText(context)
  const [, verb, object] = command.capability.split('.')
  if (verb === 'calculate' || object === 'number') return calculate(input)
  if (verb === 'encode' && object === 'text') return `Base64: ${Buffer.from(input, 'utf8').toString('base64')}`
  if (verb === 'decode' && object === 'text') {
    try { return `Decoded: ${Buffer.from(input, 'base64').toString('utf8')}` } catch { return 'Invalid Base64 input.' }
  }
  if (verb === 'format' && object === 'json') {
    try { return JSON.stringify(JSON.parse(input), null, 2) } catch { return 'Provide valid JSON to format.' }
  }
  if (verb === 'validate' && object === 'url') return urlHandler(command, context)
  return `Prepared utility capability: ${command.capability}\nInput: ${redact(input || '(none)')}`
}

function urlHandler(command, context) {
  const result = classifyUrl(argsText(context))
  return result.ok ? `URL accepted for review: ${result.hostname}` : `URL rejected: ${result.reason}`
}

function securityHandler(command, context) {
  const input = argsText(context)
  if (command.capability.endsWith('.url') || command.capability.endsWith('.webhook')) return urlHandler(command, context)
  return `Security capability available: ${command.capability}\nNo external state was changed.`
}

function genericHandler(command, context) {
  const input = argsText(context)
  return [`Dēmonyx specialist prepared: ${command.name}`, `Capability: ${command.capability}`, input ? `Arguments: ${redact(input)}` : 'Arguments: none', 'No external state was changed. Bind an authorized handler to enable side effects.'].join('\n')
}

function bindBuiltins(registry) {
  registry.registerHandler('utility', utilityHandler)
  registry.registerHandler('security', securityHandler)
  registry.registerHandler('developer', genericHandler)
  registry.registerHandler('admin', genericHandler)
  registry.registerHandler('moderation', genericHandler)
  registry.registerHandler('media', genericHandler)
  registry.registerHandler('ai', genericHandler)
  registry.registerHandler('search', genericHandler)
  registry.registerHandler('productivity', genericHandler)
  registry.registerHandler('analytics', genericHandler)
  registry.registerHandler('group', genericHandler)
  registry.registerHandler('fun', genericHandler)
}

module.exports = { bindBuiltins, calculate }
