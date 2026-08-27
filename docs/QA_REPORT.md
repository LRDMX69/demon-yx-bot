# Dēmonyx Repository-Wide QA Report

**Date:** 27 August 2026  
**Branch:** `qa/full-root-inspection`  
**Scope:** Root entrypoints, readable plugins and helpers, generated specialist registry, local-first MoE, persistence/session boundaries, menu behavior, CI, and static risk boundaries.

## Executive summary

The QA pass completed successfully for the deterministic and locally mockable portions of Dēmonyx. The repository contains **195 JavaScript files**, **14,038 regex-detected function definitions**, and **189 plugin registrations**. The function count is intentionally described as a heuristic: several inherited Levanter modules are compressed or obfuscated, so regex inventory over-counts constructs and does not represent a semantic line-by-line review.

The specialist registry remains intact at **11,406 registered commands**, including legacy names and aliases. The local MoE evaluator remains **32/32 correct (1.0 accuracy) across 8 experts**. No WhatsApp credentials were requested or used, and no live WhatsApp account, external API credential, or destructive production operation was exercised.

## QA tracks and results

| Track | Result | Evidence |
| --- | --- | --- |
| JavaScript syntax | Passed | `yarn test:syntax`; zero syntax failures |
| Specialist and preservation tests | Passed | `yarn test`; 11,406 commands registered |
| Local MoE training | Passed | `yarn train:moe`; 8 experts from 32 examples |
| Local MoE evaluation | Passed | `yarn evaluate:moe`; 32/32, accuracy 1.0 |
| Repository inventory | Passed | 195 JS files, 189 plugin registrations, zero duplicate patterns, zero invalid JSON, zero missing required files |
| Reply-guard regression check | Passed | 87 plugin files checked; 14 reply-fallback families protected |
| Menu runtime boundary | Passed | Image-first send and text fallback verified with isolated mocks |
| Relative-import scan | Passed | Zero unresolved relative requires |
| Risk-boundary scan | Passed | Zero unclassified registration issues; four intentional `on: 'text'` handlers classified explicitly |
| Diff hygiene | Passed | `git diff --check` passed with the repository’s existing CRLF endings treated as valid |

The inventory, risk, and menu checks are intentionally bounded tests. They validate source structure and controlled behavior; they do not claim that third-party APIs, WhatsApp transport, media providers, or every obfuscated function work under live production conditions.

## Confirmed fixes

The following defects were corrected with minimal, feature-preserving changes.

| Area | Defect | Correction |
| --- | --- | --- |
| Optional reply inputs | Multiple commands dereferenced `message.reply_message.text` before checking whether a reply existed. | Added defensive reply fallbacks in Bing, group join/info, Instagram, MediaFire, Pinterest, plugin management, Reddit, Spotify, screenshots, TTS, upload, y2mate, yts, and mute handlers. |
| Tagging | The command used the misspelled `message.reply_message.txt` and could dereference a missing reply before its usage response. | Added a guarded `replyText` value and preserved direct text, usage, and broadcast behavior. |
| Filter creation | Filter and group-filter commands checked `.txt` while later reading `.text`, preventing normal quoted-text filters from being created. | Corrected both group and personal filter guards to use `.text`. |
| Status commands | Three status handlers used the same `.txt` typo when accepting text replies. | Corrected the checks to `.text`. |
| Heroku plugin | `headers` was assigned without declaration, creating an accidental global in non-strict execution. | Declared it as a block-local `const`. |
| External plugin management | Remote plugin management was not explicitly owner-only, accepted an unrestricted parsed URL result, had no bounded request options, and exposed raw installation/download errors. | Added `fromMe: true` to install/remove commands, restricted parsed URLs to HTTPS Gist hosts, bounded request timeout and body size, and replaced raw error disclosure with the existing generic invalid response. |
| QA risk classification | The scanner treated intentional `bot({ on: 'text' })` event handlers as missing command patterns. | Classified these four registrations as intentional event handlers while retaining genuine registration findings as failing issues. |
| MoE reproducibility | Training rewrote the checked-in artifact with a wall-clock timestamp on every run. | The trainer now records a deterministic offline corpus fingerprint, and repeated training produces an identical artifact. |

## Residual risks and limitations

The risk scanner reports **18 dynamic/process-execution findings** and **21 side-effect findings**. These are inventory findings rather than automatic vulnerabilities. The main residual execution surfaces are inherited `Function` usage in `lib/youtube.js`, shell execution in the readable `img.js`, `y2mate.js`, and `yts.js` media paths, and the dynamic external-plugin loader. The external-plugin loader is now owner-only and bounded at the readable boundary, but it still installs and executes remote JavaScript by design; operators should treat Gist content as trusted code and keep owner credentials protected.

Several upstream modules are heavily obfuscated or compressed, particularly portions of `lib/*`. They passed syntax and boundary checks, but their auditability is limited. A complete semantic review of every expression in those modules would require an upstream deobfuscation or source replacement project and was intentionally not attempted because unsafe automated deobfuscation could change behavior.

The side-effect inventory includes expected persistence writes for SaveSo, logical sessions, MoE training, and isolated tests, as well as expected profile/media operations. Four `on: 'text'` registrations in `filters.js` and `gfilters.js` are intentional event handlers, not missing command patterns.

The dependency tree retains inherited audit exposure noted during earlier work, including approximately 230 `yarn audit` findings. Only the direct `node-fetch` refresh was previously made; a broad dependency upgrade was not attempted because the custom Baileys fork and media stack require compatibility testing. This remains a follow-up hardening item.

API-only startup was previously smoke-tested: it starts without launching a WhatsApp client, rejects unauthenticated session access with 401, and returns 503 for an authenticated request when no bot is connected. Live WhatsApp pairing, QR flow, message delivery, third-party media providers, Heroku, and external plugin installation remain untested because no live credentials were used.

## Reproducibility

The core checks can be run locally from the repository root:

```bash
yarn train:moe
yarn evaluate:moe
yarn test
yarn test:syntax
yarn qa:plugin-guards
node scripts/qa-inventory.js
node scripts/qa-risk-scan.js
node scripts/qa-menu-runtime.js
git diff --check
```

The GitHub Actions workflow now runs the specialist tests, syntax validation, plugin-guard regression, repository inventory, and risk-boundary scan on pushes and pull requests. The workflow continues to install dependencies with lifecycle scripts disabled, matching the project’s existing CI safety boundary.

## Conclusion

The QA branch is suitable for review and contains no unresolved relative-import, syntax, JSON, duplicate-command, or intentional-registration classification failures in the bounded checks above. The most important confirmed runtime and authorization defects found in readable code were corrected without removing existing Dēmonyx/Levanter features. Remaining risk is concentrated in inherited obfuscated code, deliberate dynamic plugin execution, shell-backed media tooling, third-party services, dependency exposure, and untested live WhatsApp integrations.

This report should be read as evidence of the executed QA scope, not as a claim of formal verification or live-production certification.
