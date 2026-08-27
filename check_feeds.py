#!/usr/bin/env python3
"""Conformance checks for dashboard feeds — the CORRECTNESS half only.

Every check here encodes a failure that actually shipped. None of them can tell
you whether the resulting page is LEGIBLE: a bare 1-3-4-5 axis sequence passes
every check below and still read as a defect to the first user who saw it. That
class needs a reader, not a suite, and this script must not be taken to cover it.

Run: python3 check_feeds.py     (exit 1 on any FAIL)
"""
import json, glob, os, re, sys

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

    # 4. Generic-path assets need a breakdown the common renderer can read.
    #    (bespoke renderers synthesise or hide it; generic ones crash without it)
    has_legacy = isinstance(d.get('backing_breakdown'), list)
    has_axis_bd = isinstance((d.get('backing') or {}).get('breakdown'), list)
    if not has_legacy and not has_axis_bd:
        warns.append(f'{slug}: no backing_breakdown and no backing.breakdown')

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
