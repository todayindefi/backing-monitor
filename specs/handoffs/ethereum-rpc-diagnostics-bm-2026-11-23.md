# Ethereum RPC investigation — November 23, 2026

**No new RPC signup/key is needed for the tested reads now. Existing configured Alchemy and dRPC work.** Public dRPC also works for the selected historical state calls.

This is a new user-authorized technical diagnostic, separate from closed bounded report collections.31RPC attempts under64cap, including one rejected incomplete-URL probe; seven valid endpoints representing fewer independent operators. No user-wallet/from calls, signatures, transactions, disabled TLS validation, IP/proxy rotation, provider config/credential changes or recurring collector execution.

## Verified capability and causes

| Provider | Result |
|---|---|
| PublicNode, both aliases | chainId and old block headers work. Historical eth_call returns403 with an explicit archive-personal-token requirement. The two hostnames are one provider, not independent fallback coverage. |
| Existing configured Alchemy | Historical calls at both selected Syrup blocks succeed; totalAssets matches the earlier public packets.10-block logs work;1000-block logs receive the free-tier10-block limit. |
| Existing configured dRPC | Both historical state reads succeed;10-block logs work;1000-block logs receive the free-plan100-block limit. |
| Public dRPC, eth.drpc.org | Same successful historical state and10-block log probes; same100-block free limit. Not independent from configured dRPC. |
| LlamaRPC | Even chainId returns525. This is an origin TLS-handshake issue, not evidence that the user needs another key. |
| 1RPC's tested public endpoint | Returns410/discontinued; not a recommended fallback. |

All returned headers agree for blocks26476102/26476110. Alchemy and dRPC independently reproduced the two public totalAssets values. This is a narrow technical proof of historical access, **not complete native/financial replication**, source assurance or a new risk assessment. Prior packets/grades were not changed.

One initial configured-dRPC diagnostic incorrectly extracted the static prefix of an interpolated URL. That invalid-input400 was rejected; the correctly resolved actual configured endpoint succeeded. No false claim of a broken configured dRPC service is retained.

## Local BM repair

Updated only the existing BM syrup-redemption reader:
- Replace failing Llama fallback with the tested public dRPC endpoint.
- Support an explicit ETHEREUM_RPC_URL deployment-environment override without reading sibling credentials.
- Export only RPC origin provenance, stripping URL path/query/userinfo before public metadata.
- Use conservative known chunks: Alchemy10, dRPC100, otherwise existing1000.
- Retain an8-request/18-second event-scan budget; a partial scan reports scan_budget_exhausted and actual coverage, not a full-window no-event claim.

Five Python tests pass, including secret-URL redaction and partial-scan semantics; the existing JS redemption consumer tests pass. No production collector was run, no schedules modified and no provider credential written/rotated. Existing observation files and other repositories remain untouched. These changes are saved uncommitted.

## What is needed from the user

Nothing new for current historical contract checks. Existing keys and method-aware routing suffice. Do not paste keys into chat.

A paid upgrade to an **existing** account is optional if long event backfills must fit very small request/time budgets. For the earlier25,839-block range, a100-block cap means259chunks, while10blocks means2,584chunks. That backfill was not run here and would exceed the old finite budgets. Keep current partial-history gaps unless separately completed within authorized limits. A new account is not the first fix.

Alchemy's [official explanation](https://support.alchemy.com/articles/1883074130-why-do-i-see-a-free-tier-error-when-calling-eth-getlogs-with-a-large-block-range) confirms plan-dependent log limits; paid plans raise limits but do not remove every bound. Cloudflare's [525 documentation](https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-5xx-errors/error-525/) identifies the origin SSL handshake. Numeric10/100limits above are the responses observed on these actual configured/public endpoints, not guarantees for every plan.

## Existing-owner integration note

Canonical PegTracker/RiskAnalyst RPC consumers should use their existing configured archive-capable endpoints for historical reads and provider-aware bounded log chunks. Rotating the same oversized log request through all free providers will not cure a range cap. Do not reopen a no-auth/closed financial commission merely because this diagnostic used the existing keys under the user's new authorization.

Any shared transport patch belongs to its existing repository owner; no sibling code or global configuration was edited by BM. Preserve last-good data, original clocks, unknown/partial status and credential redaction in errors/metadata. Do not turn a timeout/unsupported range into a zero balance or a zero-event full-history assertion.

Sanitized capability/call-count/fix receipt: specs/reviews/rpc-diagnostics-2026-11-23/capabilities.json. Raw HTTP responses and keyed URLs are not released.
