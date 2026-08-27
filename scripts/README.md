# Dēmonyx local model scripts

Run `yarn train:moe` to train `models/demonyx-moe.json` from `data/moe-training.jsonl` without external AI calls. Run `yarn evaluate:moe` to measure routing accuracy on that corpus. The model is a transparent local keyword-gated mixture-of-experts router, not a general-purpose neural language model.
