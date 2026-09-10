#!/usr/bin/env python3
"""Emit axis 5 (Contract & Admin) from security_analyst's topology YAML.

⚠️ A GENERATOR, NOT A VENDORED COPY. security_analyst's README invariant 1 is
"no stored copies of derivable state — read fresh, cache nothing", written after
a hand-maintained position table overstated exposure ~11x for eleven days
because its largest row was an EXITED position. Their axis-5 evidence is subject
to the same rule, so this reads their file on every sync and writes a serving
copy into data/. The serving copy is regenerated, never edited, never a source.

⚠️ `as_of` IS THE WALK'S observed_at, NEVER THIS SCRIPT'S RUN TIME. If it
stamped the build, a three-week-old walk would render as fresh on every sync and
the page could not distinguish a current measurement from a re-serialised old
one. Their header states the rule for their own file: "a laundered date is worse
than a stale one." generated_at is emitted separately and is NOT the axis clock.

⚠️ NOTHING HERE IS AUTHORED. The headline is DERIVED from the layer rows so it
follows the YAML when the YAML changes; `unmeasured[]` and the header comment
block are carried VERBATIM. Two reasons: their prose already credits whose walk
each claim is (the MINTER_ROLE finding is riskAnalyst's, not theirs, and saying
otherwise is laundering), and a summary written here would silently stop
matching the source it claims to render.

Usage: tools/emit_axis5.py <slug> [--out DIR]
"""
import json, os, sys, datetime as yamldt
import re
import yaml

TOPOLOGY_DIR = '/home/danger/security_analyst/topology/assets'

# ⚠️ NO HAND-TYPED SLUG LIST. This was `{'reusd_re': 'reusd-re.yaml'}` and it
# served exactly one asset while FIFTEEN registered assets had a walk on disk.
# I warned security_analyst that a new file "lands and renders nothing" without a
# line here, then left the list at one entry — the failure I predicted, in my own
# file. The filename is derivable (underscored slug -> dashed basename); deriving
# it removes the class.
#
# ⚠️ BUT THE LIST WAS DOING TWO JOBS AND ONLY ONE WAS ACCIDENTAL. It was also a
# PUBLICATION GATE. Deriving the name without replacing the gate would
# auto-publish anything dropped in that directory. So the gate is now two
# explicit conditions, both structural and both read from the file itself:
#
#   1. The slug is REGISTERED in data/assets.json — the dashboard's own registry
#      of what it shows, which is already the gate transport uses.
#   2. The walk is HAND-WALKED, i.e. it declares no `generator_version`.
#
# ⚠️ CONDITION 2 IS NOT OPTIONAL AND IT EXCLUDES MOST OF THEM. Ten of the fifteen
# registered walks are v1.7 GENERATOR output, and security_analyst's own banner
# on those files says only 42 of 115 rows — 36.5% — are trustworthy, that
# `timelock: unresolved` means NOT MEASURED rather than "no timelock", and that
# `m` is a key-slot count rather than a threshold. Publishing those as axis-5
# facts would render unmeasured authority as measured, which is worse than the
# "Not assessed" they currently show. Their own trust statement is the gate.
REQUIRE_HAND_WALK = True

# ⚠️ READ FROM git HEAD, NOT THE WORKING TREE — security_analyst's proposal,
# 2026-09-07, and it fixes a false assumption on THEIR side that this script
# created. They built four validators run by tools/check-all.sh, whose header
# says "Run BEFORE staging, not after" — a design that assumes git is the
# chokepoint, so that gating at commit time gates publication.
#
# This script read the working tree, so WRITING a file published it. Commit and
# push were irrelevant, and usdm.yaml went public while still uncommitted while
# they held a push believing that protected something. Three sets of files
# published unreviewed in one day on that path.
#
# Reading from HEAD adds no check here. It makes COMMIT the publish trigger,
# which puts their four existing validators back on the live path, and makes
# "uncommitted" mean "unpublished" — which is what everyone already assumed.
#
# ⚠️ NECESSARY, NOT SUFFICIENT. Someone can still commit without running
# check-all.sh and it publishes. The pre-commit hook that closes that is theirs
# to build; this is one half of two.
SECURITY_ANALYST_REPO = '/home/danger/security_analyst'


def _rel(fn):
    return f'topology/assets/{fn}'


def source_text(fn):
    """The walk as COMMITTED. Returns (text, uncommitted_diff: bool).

    ⚠️ Raises when the file is not in HEAD — an uncommitted walk is an
    UNPUBLISHED one, and emitting nothing is the point, not a failure.
    """
    import subprocess
    r = subprocess.run(['git', '-C', SECURITY_ANALYST_REPO, 'show', f'HEAD:{_rel(fn)}'],
                       capture_output=True, text=True)
    if r.returncode != 0:
        raise SystemExit(
            f'NOT COMMITTED: {_rel(fn)} is not in HEAD of {SECURITY_ANALYST_REPO}. '
            f'Publication is triggered by COMMIT, so an uncommitted walk is '
            f'deliberately not published. Commit it there to publish.')
    head = r.stdout
    # ⚠️ THE COUNTERWEIGHT. This change moves the failure from "publishes work
    # nobody reviewed" to "finished work sits unpublished and nobody notices" —
    # the silent direction, which has bitten this repo before (Ethena until
    # 4975b2368; the one-asset loop at sync_and_push.sh:91). So SAY when the
    # working tree has moved ahead of what we are publishing.
    disk = os.path.join(TOPOLOGY_DIR, fn)
    diverged = os.path.exists(disk) and open(disk, encoding='utf-8').read() != head
    return head, diverged


def header_notes(path):  # `path` is now the file TEXT, read from HEAD
    """The leading comment block, verbatim minus the '# '.

    ⚠️ Read rather than skipped: the YAML's structured rows do NOT carry the
    two findings that most change how the axis reads — that the 48h delay has
    NO FLOOR (getMinDelay is 172800 but MINIMUM_DELAY/MIN_DELAY both revert, so
    it is reducible), and that chain coverage is a same-address-absence bound
    rather than "Ethereum only". Both live in the comments. Dropping them would
    render the reassuring half of the walk and discard its limits.
    """
    out, seen_key = [], False
    for line in path.splitlines(True):
        if not line.startswith('#'):
            if line.strip() and not line.startswith(' '):
                seen_key = True
            if seen_key:
                break
            continue
        out.append(line[1:].rstrip().lstrip(' '))
    while out and not out[-1]:
        out.pop()
    return out


def _duration_seconds(t):
    """Order durations by LENGTH, not by string. '4h' must precede '24h', and
    '7d' must follow '72h' \u2014 lexical order gets both wrong."""
    m = re.match(r'^\s*([0-9]+(?:\.[0-9]+)?)\s*([smhdw])\s*$', str(t).lower())
    if not m:
        return float('inf')          # unparseable sorts last, never silently first
    n = float(m.group(1))
    return n * {'s': 1, 'm': 60, 'h': 3600, 'd': 86400, 'w': 604800}[m.group(2)]


def _join_durations(vals):
    """De-duplicated, shortest first, Oxford-free: '4h, 24h, 72h and 7d'."""
    uniq = sorted(set(str(v).strip() for v in vals if str(v).strip()),
                  key=_duration_seconds)
    if not uniq:
        return ''
    if len(uniq) == 1:
        return uniq[0]
    return ', '.join(uniq[:-1]) + ' and ' + uniq[-1]


def derive_headline(layers):
    """Structural, so it follows the file. Never a stored sentence.

    ⚠️ THREE BUCKETS, NOT TWO. This folded `unresolved` in with `none` and then
    said "has NO established delay — timelock: unresolved", asserting an ADVERSE
    finding about a layer nobody measured. It was masked only by FILE ORDER —
    undelayed[0] happened to land on a genuine `none` row — so it was order luck,
    not correctness, and both syrup pools carry `unresolved` on contract-upgrade.

    `unresolved` is not `none` in EITHER direction: rendering it blank turns an
    unknown into a clean bill, and rendering it as "no delay" turns an unknown
    into an adverse finding. The dashboard's own §4 rule says exactly this and
    the derivation had drifted from it.
    """
    delayed, undelayed, unmeasured = [], [], []
    # ⚠️ PATH DELAYS, COLLECTED SEPARATELY — see the `undelayed` branch below for why.
    path_delays = []
    for l in layers or []:
        tl = str(l.get('timelock', '')).strip()
        keys = ', '.join(l.get('keys') or []) or l.get('authority_layer', '?')
        row = (tl, keys, l.get('authority_layer'))
        for p in (l.get('paths') or []):
            pt = str(p.get('timelock', '')).strip()
            if pt and pt.lower() not in ('none', 'unresolved'):
                path_delays.append(pt)
        if tl.lower() == 'unresolved':
            unmeasured.append(row)
        elif tl and tl.lower() not in ('none', 'None'.lower()):
            delayed.append(row)
        else:
            undelayed.append((tl or 'none', keys, l.get('authority_layer')))

    # Named in its own clause — never merged into the delayed or undelayed claim.
    tail = ''
    if unmeasured:
        names = ', '.join(f'{u[2]} ({u[1]})' for u in unmeasured)
        tail = (f" ⚠️ {len(unmeasured)} layer{'s' if len(unmeasured) > 1 else ''} "
                f"NOT MEASURED: {names} — an unknown delay, not an absent one.")

    if delayed and undelayed:
        d, u = delayed[0], undelayed[0]
        return (f"A {d[0]} timelock covers {d[2]} ({d[1]}). "
                f"{u[2]} ({u[1]}) has NO established delay — timelock: none. "
                f"The delay protects the code and not the supply." + tail)
    if delayed and not undelayed:
        return (f"All MEASURED authority sits behind a {delayed[0][0]} timelock." + tail)
    if undelayed:
        # ⚠️ "NO TIMELOCK ESTABLISHED ON ANY LAYER" WAS FLATLY FALSE ON TWO ASSETS.
        #
        # A layer's `timelock` summarises to `none` as soon as ONE of its paths is
        # undelayed. So a layer holding a measured ladder — apyUSD's role map runs
        # 0s / 4h / 24h / 72h / 7d — summarises to `none`, and when EVERY layer does
        # that, this branch announced that nothing on the asset is delayed at all.
        # apyUSD's own paths carried 4h, 24h, 72h and 7d while its headline denied
        # every one of them; USDe's carried 24h.
        #
        # ⚠️ SAME DEFECT AS THE crvUSD "five keys can mint" CLAIM, one artifact over.
        # That one came from printing a layer summary and not per-path `reach`; the
        # renderer grew `_divergentPathRows` to fix the TABLE, and this derivation
        # kept reading the collapsed value. Fixing the table did not fix the sentence
        # above it.
        #
        # The adverse fact stays first and stays unhedged — no layer is fully
        # delayed, and that is the finding. What changes is that the delays which DO
        # exist are named, together with the reason they are not protection: they sit
        # on other paths and do not bound the undelayed one.
        if path_delays:
            names = _join_durations(path_delays)
            return ("No authority layer is fully delayed \u2014 every measured layer contains at "
                    "least one path with no established delay. Delays of " + names + " are "
                    "measured on OTHER paths inside those same layers, and do not bound the "
                    "undelayed ones." + tail)
        return ("No timelock established on any measured authority layer." + tail)
    # Nothing measured at all — assert nothing in either direction.
    return ("No authority layer on this asset has a measured delay."
            + (tail or ' The rows present are unmeasured.'))


def registered_slugs(repo_root):
    """Underscored slugs from the dashboard's own registry."""
    with open(os.path.join(repo_root, 'data/assets.json'), encoding='utf-8') as fh:
        return [a['slug'].replace('-', '_') for a in json.load(fh)]


def emit(slug):
    # underscored slug -> dashed yaml basename, the convention both repos use
    fn = slug.replace('_', '-') + '.yaml'
    path = os.path.join(TOPOLOGY_DIR, fn)
    if not os.path.exists(path):
        raise SystemExit(f'MISSING: {path} — emit nothing rather than a stale copy')
    # ⚠️ Publication trigger is COMMIT, not write. See SECURITY_ANALYST_REPO above.
    path, diverged = source_text(fn)
    if diverged:
        print(f'  ⚠️ {fn}: working tree has UNCOMMITTED changes that are NOT being '
              f'published — publishing the committed version. Commit there to publish them.',
              file=sys.stderr)
    doc = yaml.safe_load(path) or {}

    # ⚠️ Gate 2. Refuse generator output; see REQUIRE_HAND_WALK above.
    if REQUIRE_HAND_WALK and doc.get('generator_version'):
        raise SystemExit(
            f'REFUSED: {fn} is generator v{doc["generator_version"]} output, not a hand-walk. '
            f'Its own trust banner rates 36.5% of generated rows trustworthy and says '
            f'`timelock: unresolved` means NOT MEASURED. Axis 5 stays "Not assessed".')

    observed = doc.get('observed_at')
    if not observed:
        raise SystemExit(f'{path} declares no observed_at — refusing to stamp a run time in its place')

    layers = doc.get('layers') or []
    return {
        'schema_version': 'contract/1',
        'asset': slug,
        'producer': 'security_analyst',
        # ⚠️ the WALK's date, not this run's
        'as_of': str(observed),
        'generated_at': yamldt.datetime.now(yamldt.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
        'contract': {
            'headline': derive_headline(layers),
            'headline_basis': 'Derived from the layer rows below, not authored here, '
                              'so it changes when the walk changes.',
            # ⚠️ `method` is DERIVED, and the note that used to sit here was a fixed
            # sentence about reUSD's file history ("replaced a v1.7 generator
            # row..."). True of reUSD, FALSE of USG, which never had a generator
            # row at all. A per-asset provenance claim hardcoded in a shared
            # emitter ships one asset's history onto every other asset's page.
            # The file's own header is already carried verbatim in walk_notes.
            'method': 'hand-walk',
            'observed_at': str(observed),
            'source_file': f'security_analyst/topology/assets/{fn}',
            'layers': layers,
            # verbatim — carries its own attribution
            'unresolved': doc.get('unmeasured') or [],
            # ⚠️ CROSS-ASSET, CARRIED PER-ASSET. The fact — one timelock, one
            # implementation and one 3-of-5 Safe behind BOTH Re tranches — cannot
            # be stated by either page alone, but it needs no cross-asset
            # renderer: each file names the other side, the same shape
            # riskAnalyst used for issuer_score_shared_with.
            #
            # ⚠️ ADDRESSES ONLY, NO CONCLUSION. security_analyst deliberately
            # dropped the prose note I drafted, on the same line they drew over
            # `findings[]`: a sentence like "the subordination is not protected by
            # separate control" is JUDGEMENT and belongs to riskAnalyst. The four
            # rows carry it structurally; the renderer must not supply the
            # sentence either.
            'authority_shared_with': doc.get('authority_shared_with') or [],
            # ⚠️ `review` describes the MEASUREMENT, never the asset — who wrote
            # the walk, who checked it, and how far the check went. That is why
            # the producer could publish it where a prose `findings[]` was
            # refused: "four claims re-measured" is an observation; "therefore
            # this is safe" would be judgement and stays riskAnalyst's.
            #
            # ⚠️ It exists because ONE OF THESE WALKS WAS PEER-AUTHORED and
            # published for a day while I reported, from a check that had exactly
            # one possible output, that all five were the producer's own. The bound
            # goes on the FACE for the same reason the finding does.
            'review': doc.get('review') or None,
            'walk_notes': header_notes(path),
        },
    }


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    out_dir = None
    if '--out' in sys.argv:
        out_dir = sys.argv[sys.argv.index('--out') + 1]
    if not args:
        raise SystemExit(__doc__)
    payload = emit(args[0])
    text = json.dumps(payload, indent=2, ensure_ascii=False) + '\n'
    if out_dir:
        dest = os.path.join(out_dir, f'{args[0]}_contract.json')
        open(dest, 'w', encoding='utf-8').write(text)
        c = payload['contract']
        print(f'{dest}: as_of={payload["as_of"]} layers={len(c["layers"])} '
              f'unresolved={len(c["unresolved"])} walk_notes={len(c["walk_notes"])}')
    else:
        sys.stdout.write(text)


if __name__ == '__main__':
    main()
