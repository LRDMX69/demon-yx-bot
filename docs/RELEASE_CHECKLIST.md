# Dēmonyx release checklist

Before merging the local-first MoE and expanded specialist catalog:

1. Run `yarn train:moe` to regenerate `models/demonyx-moe.json` from `data/moe-training.jsonl`.
2. Run `yarn evaluate:moe` and confirm routing accuracy is at least 75%.
3. Run `yarn test` and `yarn test:syntax`.
4. Confirm legacy commands such as `.dx audit-access` and `.dx moderation-scan-links` still resolve.
5. Confirm `.dx count` reports more than 11,000 registered commands.
6. Confirm `.dx moe <request>` routes locally without an external API key.
7. Confirm `.saveso <text>` persists only under the sender or chat identity and that `data/saveso.json` remains ignored.
8. Review the final diff for credentials, session state, and unintended deletion of upstream files.

The current declarative expansion is expected to produce 11,406 registered commands: 1,200 legacy profile commands, 10,200 extended commands, and 6 system commands.

The release is additive: keep `main` intact, review the enhancement branch diff, and verify the generated model artifact against the offline corpus before merging.
