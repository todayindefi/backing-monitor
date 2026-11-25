# Ethereum syrupUSDC production selector

The normal BM sync already invokes `tools/copy_syrup_backing.py`. For Ethereum syrupUSDC only, that step reads `.private-reviews/syrupusdc-native-route/selector.json`. Mode `vaulttracker` reads `/home/danger/VaultTracker/data/runtime/syrupusdc-native/feed/current.json` directly through the VaultTracker client, without cron environment changes. Mode `legacy` takes precedence over a scratch environment override. An absent selector defaults to legacy in the normal refresh environment. Rejected VaultTracker inputs fall back visibly to the qualified legacy projection.

The selector applies to the separately dated native total assets, share supply, one-share conversion and separate conversion samples. PegTracker remains the source for the book aliases and ratios at its own pin. Cash, credit, losses, queue, market, family feed, syrupUSDT and legacy history retain their readers.

## Coordinated enable and rollback

After both consumers agree to enable, run from the BM checkout:

```bash
dir=.private-reviews/syrupusdc-native-route
mkdir -p "$dir"
next=$(mktemp "$dir/.selector.XXXXXX")
printf '%s\n' '{"source":"vaulttracker"}' > "$next" && mv -f "$next" "$dir/selector.json"
```

The next normal sync reads the selector. For rollback, set the persistent mode explicitly:

```bash
dir=.private-reviews/syrupusdc-native-route
mkdir -p "$dir"
next=$(mktemp "$dir/.selector.XXXXXX")
printf '%s\n' '{"source":"legacy"}' > "$next" && mv -f "$next" "$dir/selector.json"
```

After either change, verify the next normal refresh and its served payload. On enable, verify the exact VaultTracker generation and unchanged specialist fields plus desktop/mobile. On rollback, verify the native panel is absent and the legacy fields render. For scratch rehearsal set `BM_SYRUPUSDC_SELECTOR_FILE` to a scratch selector and run the normal copy with a scratch destination named `syrupusdc_backing.json`.

Scratch verification selected runtime generation `27826cb9a6b0b69ca447e1ece139b85df3f1a7df1b900f38f8c32072f7247bc4`, block 26,492,344 at 12:57:59 UTC and three conversion samples. All other projected fields compared equal. Invalid mode and persistent legacy rollback each restored the default legacy bytes. No live selector or payload was changed.
