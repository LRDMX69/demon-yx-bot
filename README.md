# Dēmonyx WhatsApp MD User Bot

<p align="center">
  <img src="assets/demonyx-menu.png" alt="Dēmonyx WhatsApp bot artwork" width="760" />
</p>

<p align="center"><strong>Dēmonyx — intelligence beyond limits, built to serve and made to evolve.</strong></p>

Dēmonyx is a powerful, feature-rich WhatsApp bot built from the Levanter codebase, with multi-session support, plugin system, group moderation, media tools, and an optional **API** for sending and receiving messages programmatically.

## Features

- **Multi-Session** – run several WhatsApp accounts from one instance.
- **Plugin System** – built-in and external (`eplugins`) command plugins.
- **Group Moderation** – anti-link, anti-spam, anti-word, warnings, welcome/goodbye.
- **Media Tools** – stickers, conversions, downloads, and more.
- **API Mode** – send messages and receive incoming messages via webhooks ([see below](#-api-mode)).
- **Localized** – responses in 11 languages.
- **Easy Deployment** – Koyeb, Render, Heroku, or any VPS/PC.

## Supported Languages

Set your preferred language with `BOT_LANG` in `config.env`.

| Code | Language   |
|------|------------|
| `en` | English    |
| `es` | Spanish    |
| `fr` | French     |
| `hi` | Hindi      |
| `bn` | Bengali    |
| `id` | Indonesian |
| `ur` | Urdu       |
| `tr` | Turkish    |
| `ru` | Russian    |
| `ar` | Arabic     |
| `ml` | Malayalam  |
| `zh` | Chinese    |

```env
BOT_LANG=es
```

---

## 🔌 API Mode

Expose an API to **send messages** and **receive incoming messages via
webhooks** — useful for integrating the bot with your own app, CRM, or
chat dashboard.

### Enable

`API_MODE` is a tri-state switch:

| Value | Mode | Behavior |
|-------|------|----------|
| `false` *(default)* | bot only | normal bot, API off |
| `true` | bot **+** api | commands work **and** the API is exposed |
| `only` | api only | pure gateway, no bot commands |

Minimal `config.env` to turn it on:

```env
API_MODE=true
API_KEY=your-secret-key      # required — every request needs it
PORT=3000                    # port
API_PUBLIC_URL=https://bot.example.com   # public base url (for media links)
API_WEBHOOK_URL=https://your-app.com/hook # optional — receive incoming messages
```

On start, the bot messages itself an **API quick-start card** (localized) with
the base URL, auth status, and a ready-to-run example.

### Authentication

Every request must carry your key as a header:

```
x-api-key: your-secret-key
```

Requests without a valid key get `401`. If `API_KEY` is unset, the API is locked.

### Sessions

Sessions are addressed by **positional index** — `"0"` is the first session,
`"1"` the second, and so on (following the `SESSION_ID` order). `session` is
optional in requests and defaults to `"0"`.

---

### `POST /api/send` — send a message

Body:

| Field | Required | Notes |
|-------|----------|-------|
| `to` | ✅ | phone number (`919876543210`) or full jid (`...@g.us` for a group) |
| `type` | ✅ | `text` \| `image` \| `video` \| `audio` \| `document` |
| `text` | for `text` | body, or caption for media |
| `url` | for media | **public http(s) URL** of the media |
| `session` | – | defaults to `"0"` |
| `fileName` | – | document/file name |
| `mimetype` | – | override mimetype |
| `ptt` | – | `true` sends audio as a voice note |
| `quoted` | – | a received message `id` to reply/quote |

**Send text:**

```bash
curl -X POST https://bot.example.com/api/send \
 -H "x-api-key: your-secret-key" \
 -H "Content-Type: application/json" \
 -d '{"to":"919876543210","type":"text","text":"hello from api"}'
```

**Send an image with caption:**

```bash
curl -X POST https://bot.example.com/api/send \
 -H "x-api-key: your-secret-key" \
 -H "Content-Type: application/json" \
 -d '{"to":"919876543210","type":"image","url":"https://picsum.photos/600","text":"nice pic"}'
```

**Reply to a received message:**

```bash
curl -X POST https://bot.example.com/api/send \
 -H "x-api-key: your-secret-key" \
 -H "Content-Type: application/json" \
 -d '{"to":"919876543210","type":"text","text":"got it","quoted":"<msgId-from-webhook>"}'
```

Response:

```json
{ "status": 200, "id": "3EB0XXXXXXXXXXXX" }
```

---

### `GET /api/sessions` — list sessions

```bash
curl https://bot.example.com/api/sessions -H "x-api-key: your-secret-key"
```

```json
{
  "count": 1,
  "sessions": [
    { "id": "0", "name": "main", "connected": true, "number": "919876543210" }
  ]
}
```

`number` is `null` until the session connects.

---

### `GET /api/media/:session/:id` — download received media

Fetch the bytes of a received image/video/audio/document by its message id
(the id from a webhook payload). Media is cached ~10 minutes after arrival.

```bash
curl https://bot.example.com/api/media/0/<msgId> -H "x-api-key: your-secret-key" -o file.jpg
```

---

### Webhooks — receive incoming messages

Set `API_WEBHOOK_URL` and the bot POSTs a JSON payload for **every incoming
message** (its own and other bots' messages are skipped):

```json
{
  "session": "0",
  "id": "3EB0XXXX",
  "from": "919876543210@s.whatsapp.net",
  "sender": "919876543210@s.whatsapp.net",
  "pushName": "Alice",
  "isGroup": false,
  "timestamp": 1736500000,
  "type": "image",
  "text": "check this",
  "media": {
    "mimetype": "image/jpeg",
    "fileName": "photo.jpg",
    "url": "https://bot.example.com/api/media/0/3EB0XXXX"
  },
  "quoted": null
}
```

- `media` is present only for media messages; download it from `media.url`
  (send your `x-api-key`).
- The webhook request itself carries `x-api-key` so you can verify it's from your bot.

### Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `API_MODE` | `false` | `false` \| `true` \| `only` |
| `API_KEY` | – | secret for the `x-api-key` header (required) |
| `PORT` | `3000` | port |
| `API_PUBLIC_URL` | auto | public base url used in media links. Auto-detected on Render/Heroku; set manually behind a proxy/custom domain/VPS |
| `API_WEBHOOK_URL` | – | where incoming messages are POSTed (optional) |

### Notes & limits

- Media is **URL-only** for sending; the bot downloads the URL (or, for webhooks, serves a download link). Only `http(s)` URLs to public hosts are accepted (private/loopback/metadata hosts are blocked).
- A single `API_KEY` grants access to **all** sessions — intended for single-tenant use.
- API sends share the bot's send queue; avoid flooding.

---

## Deployment

### 1️⃣ Koyeb

[Deploy Now](https://levanter.site/) to set up on Koyeb.

### 2️⃣ Render

[Deploy Now](https://levanter.site/) to set up on Render.

### 3️⃣ VPS or PC (Ubuntu)

**Quick install:**

```sh
bash <(curl -fsSL http://bit.ly/43JqREw)
```

**Manual install:**

1. **System deps:**

   ```sh
   sudo apt update && sudo apt upgrade -y
   sudo apt install git ffmpeg curl -y
   ```

2. **Node.js 20.x:**

   ```sh
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt install nodejs -y
   ```

3. **Yarn + PM2:**

   ```sh
   sudo npm install -g yarn
   yarn global add pm2
   ```

4. **Clone & install:**

   ```sh
   git clone https://github.com/LRDMX69/demon-yx-bot botName
   cd botName
   yarn install
   ```

5. **Configure `config.env`:**

   ```sh
   SESSION_ID=your_session_id_here
   PREFIX=.
   STICKER_PACKNAME=LyFE
   ALWAYS_ONLINE=false
   RMBG_KEY=null
   LANGUAG=en
   BOT_LANG=en
   WARN_LIMIT=3
   FORCE_LOGOUT=false
   BRAINSHOP=159501,6pq8dPiYt7PdqHz3
   MAX_UPLOAD=200
   REJECT_CALL=false
   SUDO=989876543210
   TZ=Asia/Kolkata
   VPS=true
   AUTO_STATUS_VIEW=true
   SEND_READ=true
   AJOIN=true
   DISABLE_START_MESSAGE=false
   PERSONAL_MESSAGE=null

   # --- API mode (optional) ---
   # API_MODE=true
   # API_KEY=your-secret-key
   # PORT=3000
   # API_PUBLIC_URL=https://bot.example.com
   # API_WEBHOOK_URL=https://your-app.com/hook
   ```

6. **Run with PM2:**

   ```sh
   pm2 start . --name botName --attach --time   # start
   pm2 stop botName                              # stop
   ```

---

## Credits

- **[Yusuf Usta](https://github.com/Quiec)** – creator of [WhatsAsena](https://github.com/yusufusta/WhatsAsena).
- **[@adiwajshing](https://github.com/adiwajshing)** – developer of [Baileys](https://github.com/adiwajshing/Baileys).

---

## 🛠 Need Help?

- [Bot Environment Variables](https://levanter.site/)
- [Frequently Asked Questions](https://levanter.site/)


# Dēmonyx

Dēmonyx is the successor distribution built from the Levanter WhatsApp bot. The original bot’s multi-session support, plugin system, group moderation, media tools, localization, API mode, webhook support, and deployment files remain in this repository. The Dēmonyx layer is additive: it introduces a searchable specialist agent without deleting the established command and integration surface.

## Dēmonyx specialist agent

Use the `dx` command to access the specialist layer. The registry currently contains more than 1,200 stable command definitions generated from declarative capability profiles. This keeps the command catalog large without forcing every command into a separate plugin file, and it allows real handlers to be added later through the registry’s extension hook.

```text
.dx help
.dx count
.dx categories
.dx search webhook
.dx dx-audit-access
.dx moderation-scan-links
.dx ai-translate-language
.dx status
```

Every registered command has a stable identifier, category, aliases, description, usage string, and capability key. Curated system commands provide help, search, category counts, status, and identity information. Commands without a custom side-effect handler return a transparent execution receipt instead of pretending that an external action succeeded. This is intentional: sensitive operations such as banning users, changing permissions, sending media, or calling third-party AI services should be bound to explicit handlers and authorization checks before production use.

## Safety and deployment notes

The original configuration surface is preserved, including `SESSION_ID`, `API_MODE`, `API_KEY`, webhook configuration, database settings, moderation settings, media settings, and deployment files. Do not commit live session strings, API keys, dashboard passwords, or database files. For production, pin dependencies, review install scripts, run the bot with least privilege, and put any API or dashboard endpoint behind network access controls.

The GitHub repository slug uses ASCII (`demon-yx-bot`) for package-manager compatibility, while the product and bot display name is **Dēmonyx**.

## Validation

```bash
yarn test
yarn test:syntax
```

The included deterministic test verifies that the registry contains more than 11,000 commands, preserves legacy aliases, checks extended namespaces and categories, exercises search and execution, and validates the unknown-command path.


## Wide-research hardening layer

The Dēmonyx specialist entrypoint now applies a bounded per-sender rate limit before dispatch. The defaults allow 30 requests per minute per sender or chat identity; operators can tune them with `DEMONYX_DX_RATE_LIMIT` and `DEMONYX_DX_WINDOW_MS`. Specialist failures return a safe user-facing message while detailed errors remain in the existing logger when available.

The additive safety module includes SSRF-aware URL classification for HTTP(S) inputs, rejection of loopback/private/link-local/metadata hosts, rejection of credential-bearing URLs, recursive secret redaction for diagnostics, and an in-memory bounded rate limiter. These helpers are dependency-free and covered by deterministic tests. They do not replace the upstream API’s own authentication or URL controls; they provide reusable safeguards for future Dēmonyx handlers.

Several specialist capabilities now perform real, deterministic local work without external side effects. Examples include safe arithmetic evaluation without `eval`, Base64 text encoding and decoding, JSON formatting, URL classification, command search, category discovery, and runtime status reporting. Other registry entries remain explicit capability receipts until an authorized handler is wired for their external or state-changing behavior.

## Recommended production checks

Before connecting a WhatsApp account, run `yarn test` and `yarn test:syntax`, verify that `config.env` and session material are excluded from Git, configure a strong API key if API mode is enabled, and place public endpoints behind TLS and an access-control layer. For long-lived Baileys sessions, monitor reconnect and authentication-state behavior rather than assuming that a process manager alone guarantees session durability. Do not expose a dashboard password or session string in issue reports, logs, screenshots, or chat messages.


## Local-first MoE specialist

Dēmonyx includes a transparent local-first mixture-of-experts router. Run `.dx moe <request>` to classify a request into a local expert such as moderation, utility, security, productivity, knowledge, media, developer, or community. The router uses the checked-in `models/demonyx-moe.json` artifact and bounded in-memory context; ordinary routing does not require an external AI provider or API key.

The model is intentionally a **small local gating model**, not a claim of a full neural language model. Its reproducible offline trainer learns keyword weights from `data/moe-training.jsonl`. Run `yarn train:moe` to regenerate the artifact and `yarn evaluate:moe` to measure routing accuracy. External AI can remain an optional future fallback for requests that need generation rather than local classification.

## Expanded specialist catalog

The registry preserves the original Dēmonyx command names and aliases and adds more than 10,000 namespaced capabilities across automation, knowledge, communication, workflow, content, monitoring, integration, data, community, and research. Use `.dx count`, `.dx categories`, or `.dx search <term>` to explore the catalog. All generated capabilities remain safe receipts until an explicitly authorized handler is bound; registry size alone never grants permission to mutate groups, accounts, files, or external services.


## SaveSo quick capture

Use `.saveso <text>` to save a personal note or item locally. Saved items are scoped to the sender or chat identity and are stored atomically in `data/saveso.json`, which is excluded from Git. Use `.saveso list`, `.saveso get <id>`, `.saveso search <term>`, and `.saveso delete <id>` to manage them. The store enforces bounded text and item limits and never exposes another owner’s saved content through the command interface.


## Automatic per-user logical sessions

Dēmonyx now creates a logical session automatically for each sender or chat identity on first use. It refreshes the session during normal activity, rotates it after idle or absolute expiry, and supports `.dx session`, `.dx session rotate`, and `.dx session logout`. The logical session ID is opaque, bounded, and stored separately from WhatsApp authentication.

The configured `SESSION_ID` remains the stable Baileys authentication lookup key for the bot’s WhatsApp account. Logical-session rotation never changes `SESSION_ID`, disconnects WhatsApp, or creates a new WhatsApp account. A separate WhatsApp account still requires explicit QR or pairing and should not be auto-created for arbitrary bot users. SaveSo remains scoped to stable sender or chat identity so a logical rotation does not hide a user’s saved items.


Logical-session rotation also gives the local MoE router a fresh bounded context window, while SaveSo continues to use the stable sender or chat owner key. This keeps transient conversational context isolated across rotations without making saved items disappear.


For safety, `.dx session` displays only a short session fingerprint. The complete logical token stays in the protected session store and is never intended for sharing or manual configuration.
