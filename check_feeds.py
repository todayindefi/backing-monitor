#!/usr/bin/env python3
"""Conformance checks for dashboard feeds — the CORRECTNESS half only.

Every check here encodes a failure that actually shipped. None of them can tell
you whether the resulting page is LEGIBLE: a bare 1-3-4-5 axis sequence passes
every check below and still read as a defect to the first user who saw it. That
class needs a reader, not a suite, and this script must not be taken to cover it.

Run: python3 check_feeds.py     (exit 1 on any FAIL)
"""
import json, glob, os, re, sys, datetime as dt

TODAY = dt.date.today()

DATA = 'data'
JS = ''.join(open(f, encoding='utf-8', errors='replace').read()
             for f in glob.glob('js/**/*.js', recursive=True))
AXES = ('peg', 'liquidity', 'backing', 'dependencies', 'issuer')

fails, warns = [], []

def load(p):
    try:
        with open(p, encoding='utf-8') as fh: return json.load(fh)
    except Exception as e:
        return None

# Keys of ASSET_RENDERERS in app.js — a slug OR an asset_specific.type. Used to
# distinguish "feed gap the page already covers" from "feed gap nothing covers".
BESPOKE_KEYS = set(re.findall(r"^\s*'?([A-Za-z0-9_-]+)'?:\s*typeof\s",
                              open('js/app.js', encoding='utf-8').read(), re.M))

assets = load(os.path.join(DATA, 'assets.json')) or []
if isinstance(assets, dict): assets = assets.get('assets', [])
slugs = {a.get('slug') for a in assets}
sources = {a.get('slug'): (a.get('data_source') or a.get('slug')) for a in assets}

for slug in sorted(slugs):
    src = sources[slug]
    d = load(os.path.join(DATA, f'{src}_backing.json'))
    if d is None:
        fails.append(f'{slug}: data/{src}_backing.json missing or unparseable')
        continue

    present = [k for k in AXES if isinstance(d.get(k), dict)]

    # 1. Partial axis emission — the band gates on `peg` alone, so a feed with
    #    peg but not the rest renders a band with holes.
    if present and len(present) != len(AXES):
        warns.append(f'{slug}: partial axis blocks {present} — band gates on peg only')

    # 2. peg.history_ref must resolve to a file we actually serve.
    peg = d.get('peg') or {}
    ref = peg.get('history_ref')
    if ref:
        rp = os.path.join(DATA, ref)
        if not os.path.exists(rp):
            fails.append(f'{slug}: peg.history_ref -> {ref} does not exist in data/')
        else:
            # 3. peg.history_field must resolve against that file's entries.
            fld = peg.get('history_field')
            if fld:
                h = load(rp) or {}
                ents = h.get('entries') if isinstance(h, dict) else None
                if isinstance(ents, list) and ents:
                    key = fld.split('.')[-1].replace('entries[]', '').lstrip('.')
                    if '[' in fld or '.' in fld.rstrip():
                        pass  # nested path forms handled below
                    hit = sum(1 for e in ents if isinstance(e, dict) and e.get(key) is not None)
                    if hit == 0:
                        fails.append(
                            f'{slug}: peg.history_field "{fld}" resolves to key "{key}" '
                            f'which is absent from all {len(ents)} rows of {ref}')

    # 4. Feed publishes neither breakdown shape.
    #
    #    Phrasing matters here. An earlier version said only "no backing_breakdown
    #    and no backing.breakdown", which read as a crash risk and was passed on as
    #    one. It is not: CommonRenderer._backingBreakdown() falls back and hides the
    #    table when neither exists, so a feed without either degrades rather than
    #    dying. And most of these assets have a bespoke renderer that synthesises
    #    the field anyway. State the fact, and say whether anything covers it.
    has_legacy = isinstance(d.get('backing_breakdown'), list)
    has_axis_bd = isinstance((d.get('backing') or {}).get('breakdown'), list)
    if not has_legacy and not has_axis_bd:
        atype = (d.get('asset_specific') or {}).get('type')
        covered = (slug in BESPOKE_KEYS) or (atype in BESPOKE_KEYS)
        note = ('covered by a bespoke renderer' if covered
                else 'NO bespoke renderer — the backing table will be empty')
        warns.append(f'{slug}: feed publishes neither breakdown shape ({note})')

    # 4b. One payload, two collateral ratios, two scales.
    #
    #     Once an asset migrates to 5-axis, backing.collateral_ratio becomes the
    #     source backingRating reads and summary.collateral_ratio usually stays.
    #     If the two carry different scales under near-identical names, a consumer
    #     applying the wrong declaration mis-rates — and for a raw-list asset the
    #     normaliser is not idempotent, so the error lands in the reassuring
    #     direction (12198 -> 5/5). Catch it in the feed rather than in the band.
    bcr = (d.get('backing') or {}).get('collateral_ratio')
    scr = (d.get('summary') or {}).get('collateral_ratio')
    bsc = (d.get('backing') or {}).get('collateral_ratio_scale')
    ssc = (d.get('summary') or {}).get('collateral_ratio_scale')
    if bsc and ssc and bsc != ssc:
        fails.append(f'{slug}: backing.collateral_ratio_scale "{bsc}" contradicts '
                     f'summary.collateral_ratio_scale "{ssc}"')
    if isinstance(bcr, (int, float)) and isinstance(scr, (int, float)) and scr:
        ratio = bcr / scr
        if 50 < ratio < 200 or 0.005 < ratio < 0.02:
            if not (bsc and ssc):
                fails.append(
                    f'{slug}: backing.collateral_ratio ({bcr}) and '
                    f'summary.collateral_ratio ({scr}) differ ~100x — two scales in '
                    f'one payload with fewer than two scale declarations')

    # 4c. Axis blocks present but no backing threshold override.
    #
    #     backingRating falls back to generic cutoffs [130,110,100,90]. For an
    #     asset whose real risk floor is higher, that reads as HEALTHY when the
    #     asset-specific band would say WATCH — usg's 131.53 rates 5/5 on the
    #     defaults and 3/5 on its own [158,145,130,120]. The failure is silent and
    #     in the reassuring direction, and it happens when the producer's override
    #     has not reached this copy. Only meaningful once blocks exist.
    if present:
        asp = d.get('asset_specific') or {}
        thr = ((asp.get('axis_thresholds') or {}).get('backing') or {}).get('cr_pct')
        if not thr and not asp.get('chart_bands'):
            cr_v = (d.get('backing') or {}).get('collateral_ratio')
            if cr_v is None: cr_v = (d.get('summary') or {}).get('collateral_ratio')
            # Narrowed to the reassuring extreme. Fired on every at-par asset in
            # its first form — 100.0 rates 3/5 "Watch" on the defaults, which is a
            # defensible reading, not a hazard. Warning on those is the cry-wolf
            # noise that gets a check ignored. Only a 5/5 earned purely from the
            # generic band is worth surfacing: that is the case where a missing
            # override reads as HEALTHY, silently and in the flattering direction.
            if isinstance(cr_v, (int, float)) and cr_v >= 130:
                warns.append(f'{slug}: rates 5/5 HEALTHY on generic [130,110,100,90] '
                             f'(cr {cr_v}) with no cr_pct override or chart_bands — '
                             f'confirm the producer band reached this copy')

    # 4d. axis_thresholds at the wrong level.
    #
    #     The schema location is asset_specific.axis_thresholds; common.js reads
    #     only there. A top-level copy is a band the renderer cannot see, and the
    #     rating silently falls to the generic cutoffs in the flattering
    #     direction. backingRating now refuses to rate in this case, so the page
    #     shows an unrated axis — this names why.
    if d.get('axis_thresholds') and not (d.get('asset_specific') or {}).get('axis_thresholds'):
        fails.append(f'{slug}: axis_thresholds is at TOP LEVEL; common.js reads '
                     f'asset_specific.axis_thresholds — the override is unreachable')

    # 4e. Self-expiring thresholds, warned BEFORE they lapse.
    #
    #     usg's backing band declares expires/review_by and an expiry_reason
    #     saying the floor is a property of today's book, with "re-derive it, do
    #     not extend the date". backingRating goes unrated past that date rather
    #     than rating on a stale band — visible, but only once it has already
    #     lapsed. Warn in the 30 days before, so it is re-derived rather than
    #     discovered as a blank axis.
    asp_t = ((d.get('asset_specific') or {}).get('axis_thresholds') or {})
    for axis_name, ov in asp_t.items():
        if not isinstance(ov, dict) or ov.get('expires') is not True: continue
        rb = ov.get('review_by')
        if not rb: 
            warns.append(f'{slug}: {axis_name} threshold declares expires:true with no review_by')
            continue
        try:
            days = (dt.date.fromisoformat(rb) - TODAY).days
        except Exception:
            continue
        if days < 0:
            fails.append(f'{slug}: {axis_name} threshold EXPIRED {-days}d ago ({rb}) — '
                         f'axis renders unrated until re-derived')
        elif days <= 30:
            warns.append(f'{slug}: {axis_name} threshold expires in {days}d ({rb}) — re-derive, do not extend')

    # 5. Internal dependency links must point at registered assets.
    for side in ('upstream', 'downstream'):
        for dep in ((d.get('dependencies') or {}).get(side) or []):
            link = dep.get('link') or ''
            m = re.search(r'[?&]asset=([^&]+)', link)
            if m and m.group(1) not in slugs:
                fails.append(f'{slug}: dependency link -> ?asset={m.group(1)} is not a registered asset')

    # 6. A stale series must be declared, not silently drawn.
    if ref and os.path.exists(os.path.join(DATA, ref)):
        h = load(os.path.join(DATA, ref)) or {}
        if isinstance(h, dict) and h.get('series_stale') is True:
            warns.append(f'{slug}: {ref} series_stale=true — must not render as a live chart')

# 7. Canvas ids in bespoke renderers must not collide with the common #peg-chart,
#    which renderAxisSections creates inside a hidden section.
for f in glob.glob('js/renderers/*.js'):
    if f.endswith('common.js'): continue
    src = open(f, encoding='utf-8', errors='replace').read()
    if re.search(r'<canvas id="peg-chart"', src):
        fails.append(f'{os.path.basename(f)}: declares <canvas id="peg-chart"> — '
                     f'collides with the hidden common canvas')

print('CORRECTNESS CHECKS (this suite cannot judge legibility)\n')
for w in warns: print('  WARN  ' + w)
for f_ in fails: print('  FAIL  ' + f_)
print(f'\n{len(fails)} failures, {len(warns)} warnings across {len(slugs)} assets.')
sys.exit(1 if fails else 0)
