# BM shared-handoff pilot setup

BM opts in for new explicitly participating handoffs. Maintained implementation: `/home/danger/riskAnalyst/scripts/check_task.py`; maintained contract/schema remain in RiskAnalyst. No local checker/schema fork, financial refresh, scores, report changes, jobs, publication or global migration.

Instruction: `specs/shared-handoff-contract.md`. The opt-in note was moved out of the pre-existing untracked Mezo/evidence draft so committing this setup does not bundle unrelated work. `acceptance.json` pins the exact contract, synthetic manifest, checker and schema hashes, command, dependency version, parsed result and exit code. Source bytes were unchanged before/after execution.

```sh
PYTHONDONTWRITEBYTECODE=1 python3 /home/danger/riskAnalyst/scripts/check_task.py /home/danger/riskAnalyst/examples/handoffs/example-request.json --json
```

Actual and expected exit: **2 WAIT**. Structure, declared artifact hash, component and chain comparisons pass. Evidence acceptance and requested workflow remain pending. The disclosed unavailable loan-performance field is a GAP, not zero delinquency. This synthetic example is not financial evidence. Setup adoption is accepted; no real evidence acceptance or yzUSD scope closure follows. No dashboard deployment performed.
