# Dēmonyx Security Policy

## Supported versions

The `main` branch and the latest tagged release are the supported development targets. Deployment copies, generated session folders, and unpinned third-party snapshots are not considered supported release artifacts.

## Protect credentials

Never commit WhatsApp session data, `config.env`, API keys, dashboard passwords, cookies, database files, or private keys. Rotate any credential that appears in logs, screenshots, issue reports, or chat. The repository ignore rules exclude common session and credential paths, but operators must still verify the final Git diff before publishing.

## Webhooks and public endpoints

Use HTTPS for public endpoints. Where Meta-compatible webhooks are used, verify the challenge token and validate the `X-Hub-Signature-256` HMAC before processing a payload. Deduplicate event identifiers because providers may retry deliveries. Keep the existing API key requirement enabled when Dēmonyx API mode is exposed, and place the service behind network access controls and a reverse proxy where possible.

## URL and media inputs

Treat user-provided URLs as untrusted. Use the Dēmonyx URL classifier before fetching external content, reject credential-bearing URLs and private or metadata hosts, and enforce timeouts, response-size limits, and content-type checks in provider-specific handlers.

## Specialist commands

Registry membership does not grant authorization. Commands that change group membership, permissions, stored data, or external systems must be bound to explicit handlers with sender authorization, audit logging, rate limiting, and clear failure responses. The default Dēmonyx handlers intentionally report when no external state was changed.

## Reporting a vulnerability

Do not publish exploitable credentials or a complete exploit in a public issue. Contact the repository owner privately through GitHub’s security reporting channel if it is enabled, or provide a minimal reproduction that excludes secrets and personally identifying data.
