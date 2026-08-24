# Dēmonyx wide-research notes

This note records the external engineering signals used for the additive hardening pass. It is not a replacement for provider documentation and should be reviewed again before production deployment.

## WhatsApp webhook delivery

Meta’s current WhatsApp Business Platform documentation states that webhook payloads can be retried for up to seven days, that duplicate notifications can occur, and that webhook payloads can reach 3 MB. It documents HTTPS requirements, optional mutual TLS, GET challenge verification, and HMAC-SHA256 validation of the `X-Hub-Signature-256` header for POST requests.

Sources:

- https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/overview
- https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/create-webhook-endpoint/

Dēmonyx therefore includes reusable challenge verification, HMAC verification, and bounded replay deduplication in `lib/demonyx/webhook.js`. These helpers do not automatically replace the existing API route; they provide a tested foundation for future provider-specific adapters.

## Long-lived Baileys sessions

Recent Baileys issue reports describe long-lived connection closures, status code 428 failures, session churn, duplicated processing, and the need to classify terminal disconnect reasons instead of reconnecting indefinitely. The reports are issue evidence rather than normative API documentation, but they reinforce the need for serialized application work, bounded retries, clear health signals, and careful auth-state handling.

Sources:

- https://github.com/WhiskeySockets/Baileys/issues/1625
- https://github.com/WhiskeySockets/Baileys/issues/2340

Dēmonyx addresses the application-side portion conservatively by serializing specialist actions per sender or chat through `lib/demonyx/queue.js`, recording bounded telemetry, and keeping side-effectful specialist actions behind explicit handlers. The upstream WhatsApp connection lifecycle remains intact and still requires deployment-specific testing.

## Security posture

User-controlled URLs, webhook bodies, session identifiers, API keys, and dashboard passwords are treated as sensitive or untrusted inputs. The Dēmonyx safety layer rejects obvious private, loopback, link-local, metadata, credential-bearing, and unsupported-protocol URLs; redacts secrets in diagnostic objects; and applies a bounded per-sender rate limit to the specialist entrypoint. Provider-specific network fetchers should still add request timeouts, response-size caps, content-type checks, and redirect validation.
