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
import yaml

TOPOLOGY_DIR = '/home/danger/security_analyst/topology/assets'
SLUG_TO_FILE = {'reusd_re': 'reusd-re.yaml'}


def header_notes(path):
    """The leading comment block, verbatim minus the '# '.

    ⚠️ Read rather than skipped: the YAML's structured rows do NOT carry the
    two findings that most change how the axis reads — that the 48h delay has
    NO FLOOR (getMinDelay is 172800 but MINIMUM_DELAY/MIN_DELAY both revert, so
    it is reducible), and that chain coverage is a same-address-absence bound
    rather than "Ethereum only". Both live in the comments. Dropping them would
    render the reassuring half of the walk and discard its limits.
    """
    out, seen_key = [], False
    for line in open(path, encoding='utf-8'):
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


def derive_headline(layers):
    """Structural, so it follows the file. Never a stored sentence."""
    delayed, undelayed = [], []
    for l in layers or []:
        tl = str(l.get('timelock', '')).strip()
        keys = ', '.join(l.get('keys') or []) or l.get('authority_layer', '?')
        if tl and tl not in ('none', 'unresolved', 'None'):
            delayed.append((tl, keys, l.get('authority_layer')))
        else:
            undelayed.append((tl or 'none', keys, l.get('authority_layer')))
    if delayed and undelayed:
        d = delayed[0]
        u = undelayed[0]
        return (f"A {d[0]} timelock covers {d[2]} ({d[1]}). "
                f"{u[2]} ({u[1]}) has NO established delay — timelock: {u[0]}. "
                f"The delay protects the code and not the supply.")
    if delayed:
        return f"All measured authority sits behind a {delayed[0][0]} timelock."
    return "No timelock established on any measured authority layer."


def emit(slug):
    fn = SLUG_TO_FILE.get(slug)
    if not fn:
        raise SystemExit(f'no topology file mapped for slug {slug!r}')
    path = os.path.join(TOPOLOGY_DIR, fn)
    if not os.path.exists(path):
        raise SystemExit(f'MISSING: {path} — emit nothing rather than a stale copy')
    doc = yaml.safe_load(open(path, encoding='utf-8')) or {}

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
            'method': 'hand-walk',
            'method_note': 'Replaced a v1.7 generator row that read topology: unknown, m: 4, '
                           'timelock: unresolved. security_analyst\'s generator is iced; on their '
                           'own coverage audit only 36.5% of generated rows were trustworthy.',
            'observed_at': str(observed),
            'source_file': f'security_analyst/topology/assets/{fn}',
            'layers': layers,
            # verbatim — carries its own attribution, including that MINTER_ROLE
            # is riskAnalyst's walk and not security_analyst's
            'unresolved': doc.get('unmeasured') or [],
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
