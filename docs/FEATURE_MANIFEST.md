# Dēmonyx feature manifest

| Area | Current state |
| --- | --- |
| Existing bot | The Levanter-derived WhatsApp bot system remains preserved, including its established plugins, API, media, localization, database, and deployment surface. |
| Local MoE | Eight expert gates use a checked-in offline training artifact and do not require an external AI provider for routing. |
| Specialist registry | More than 11,000 command definitions are available, with stable legacy names plus new namespaced capabilities. |
| SaveSo | Owner-scoped `.saveso` persistence supports atomic save, list, search, retrieval, and deletion. |
| Safety and operations | Existing telemetry, rate limiting, queue serialization, webhook verification, and configuration validation remain available. |
| Reproducible checks | `yarn train:moe`, `yarn evaluate:moe`, `yarn test`, and `yarn test:syntax` are the intended validation commands. |


The intended release gate is: registry size greater than 11,000, eight local expert gates, offline trainer and evaluator present, SaveSo owner isolation covered, and all legacy bot paths retained.
