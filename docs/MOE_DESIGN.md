# Local-first MoE design

Dēmonyx uses a transparent mixture-of-experts gate before any optional external AI fallback. The gate tokenizes a request, scores each expert against learned keyword features, reports the winning expert and confidence, and keeps only bounded recent session context. The implementation is dependency-free and runs inside the bot process.

The checked-in artifact is produced from `data/moe-training.jsonl` by `scripts/train-local-moe.js`. The current corpus covers moderation, utility, security, productivity, knowledge, media, developer, and community workflows. `scripts/evaluate-local-moe.js` measures labeled routing accuracy and fails below the configured acceptance threshold.

This is a local routing model, not a general-purpose language model. It reduces unnecessary external AI calls for classification and workflow selection, but it does not replace provider-backed generation, translation, image understanding, or complex reasoning. Those capabilities remain optional and should be invoked only after authorization, rate limiting, input validation, and a clear fallback decision.

The design intentionally favors inspectability over opaque weights. Operators can review the model JSON, edit or extend the training corpus, retrain offline, compare evaluation output, and roll back the artifact without changing the existing WhatsApp client or plugin architecture.


The command registry expansion deliberately keeps the original `dx-<verb>-<object>` names and their existing aliases. New commands use `dx-<category>-<verb>-<object>` namespaces, so the catalog grows without shadowing or renaming established commands.
