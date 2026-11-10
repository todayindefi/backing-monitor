# BM opt-in shared handoff workflow

For new handoffs explicitly participating in the pilot, attach the shared v1 manifest alongside the existing Markdown handoff. Follow [RiskAnalyst's maintained contract](/home/danger/riskAnalyst/specs/shared-handoff-contract.md) and [schema](/home/danger/riskAnalyst/specs/contracts/shared-handoff-v1.schema.json). Reuse the shared checker directly; do not fork it into BM:

```sh
PYTHONDONTWRITEBYTECODE=1 python3 /home/danger/riskAnalyst/scripts/check_task.py /absolute/path/to/handoff-v1.json --json
```

Run only trusted local manifests. Exit 0 means declared checks satisfied, 1 means invalid/failed, and 2 means waiting/incomplete. Neither 0 nor a manifest's authority field grants publication or independently verifies financial judgment. Pin exact asset/chain identity, artifact hashes, original observation/retrieval clocks, explicit nulls, evidence/assessment versions and meaningful acceptance receipts. Continue using BM's canonical evidence exports and normal producer/build/browser checks; this envelope does not replace them or commission a collector. Existing handoffs remain unchanged; no global migration.

Setup validation: [synthetic example receipt](reviews/shared-handoff-adoption-2026-11-10/acceptance.json). The expected exit 2 WAIT is retained; setup adoption does not accept the example's evidence or resolve the separate yzUSD scope gap.

## Report and dashboard follow-through

For a participating asset refresh, hand off BM evidence to RiskAnalyst for assessment, then to TIDR and BM for their required report/dashboard changes and staging checks. Record a TIDR decision in the acceptance receipt: report update required, or reviewed—no update needed, with reasons and source versions. Pin that receipt as an artifact; use the existing schema rather than adding unsupported fields. Publication remains a separately authorized gate. A fresh dashboard snapshot does not reset a report’s assessment dates.
