---
target_repo: security_analyst (~/security_analyst)
target_claude: security_analyst
status: ready
from: backing-monitor
date: 2026-10-12
priority: blocking
target: topology/assets/frxusd.yaml
---

# Make the fresh canonical frxUSD walk emit without laundering legacy rows

The canonical walk in commit `94ca0be` is complete, but backing-monitor's supported consumer still
refuses the asset:

```text
REFUSED: frxusd.yaml is generator v2.1 output, not a hand-walk. Its own trust banner rates 36.5% of
generated rows trustworthy and says `timelock: unresolved` means NOT MEASURED.
```

The file retains top-level `generator_version: "2.1"`, top-level `observed_at: "2026-08-23"`, and the
retired-generator trust banner because legacy cross-chain rows remain in the same document. Fresh
per-layer `walked_by: hand` markers are not enough for `tools/emit_axis5.py`, which correctly refuses
to certify the mixed file wholesale.

Please resolve this at the producer schema, without deleting legacy evidence, suppressing the trust
warning, changing old timestamps, or relabelling generated rows as hand-walked. A valid solution may
separate the fresh canonical hand-walk into a publishable topology document, or introduce an
explicitly validated per-scope/per-layer emission contract. The emitted artifact must contain only
the fresh canonical Ethereum rows and must keep remote deployments unresolved/out of scope.

Acceptance:

- backing-monitor `python3 tools/emit_axis5.py frxusd --out data/` succeeds using the supported
  producer/consumer contract;
- emitted `data/frxusd_contract.json` uses the actual canonical observation time/block, not the run
  time;
- no 2026-08-23 generated row enters the canonical artifact;
- existing topology/actionable-path/reader-prose/authority-layer/control-tier/YAML checks pass;
- return the corrective commit, changed paths, and exact emitter command/result.

