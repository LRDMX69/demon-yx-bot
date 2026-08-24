'use strict'

const { redact } = require('./safety')

function validateConfig(env = process.env) {
  const issues = []
  const mode = String(env.API_MODE || 'false').toLowerCase()
  if (!['false', 'true', 'both', 'only', 'api'].includes(mode)) issues.push('API_MODE must be false, true, both, only, or api')
  if (mode !== 'false' && !String(env.API_KEY || '').trim()) issues.push('API_KEY is required when API mode is enabled')
  if (String(env.API_WEBHOOK_URL || '').trim() && !/^https:\/\//i.test(String(env.API_WEBHOOK_URL).trim())) issues.push('API_WEBHOOK_URL should use HTTPS')
  if (String(env.API_PUBLIC_URL || '').trim() && !/^https:\/\//i.test(String(env.API_PUBLIC_URL).trim())) issues.push('API_PUBLIC_URL should use HTTPS')
  if (String(env.SUDO || '').trim() === '0') issues.push('SUDO must not use a placeholder value')
  if (String(env.DEMONYX_DX_RATE_LIMIT || '').trim() && Number(env.DEMONYX_DX_RATE_LIMIT) < 1) issues.push('DEMONYX_DX_RATE_LIMIT must be positive')
  return { ok: issues.length === 0, issues }
}

function safeSnapshot(env = process.env) {
  return redact({
    API_MODE: env.API_MODE || 'false',
    API_KEY: env.API_KEY || '',
    API_WEBHOOK_URL: env.API_WEBHOOK_URL || '',
    API_PUBLIC_URL: env.API_PUBLIC_URL || '',
    SESSION_ID: env.SESSION_ID || '',
    SUDO: env.SUDO || '',
    DEMONYX_DX_RATE_LIMIT: env.DEMONYX_DX_RATE_LIMIT || '30',
    DEMONYX_DX_WINDOW_MS: env.DEMONYX_DX_WINDOW_MS || '60000',
  })
}

module.exports = { validateConfig, safeSnapshot }
