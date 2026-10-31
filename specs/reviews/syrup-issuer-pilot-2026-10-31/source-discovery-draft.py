#!/usr/bin/env python3
"""DEFERRED REFERENCE DRAFT. Not scheduled or consumed by the dashboard.
Future issuer producer should own discovery; governance comes from govAnalyst."""
import argparse
import hashlib
import json
import os
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
import xml.etree.ElementTree as ET
from urllib.parse import urlsplit
import requests

ROOT = Path(__file__).resolve().parents[3]
SOURCES = [
    ('Maple blog', 'https://maple.finance/insights/rss.xml'),
    ('Governance forum', 'https://community.maple.finance/latest.rss'),
]


def normalize_url(url):
    p = urlsplit(url)
    if p.scheme != 'https' or p.hostname not in ('maple.finance', 'community.maple.finance'):
        raise ValueError('Unexpected source URL')
    return 'https://' + p.hostname + p.path.rstrip('/')


def parse_feed(content):
    root = ET.fromstring(content)
    if root.tag != 'rss':
        raise ValueError('Expected RSS feed')
    rows = []
    for item in root.findall('./channel/item'):
        url = normalize_url(item.findtext('link') or '')
        date = item.findtext('pubDate')
        published = parsedate_to_datetime(date).astimezone(timezone.utc).isoformat() if date else None
        rows.append({'url': url, 'title': (item.findtext('title') or '')[:500], 'published_at': published})
    return rows


def refresh(data, now, get=requests.get):
    if data.get('last_attempt_at'):
        previous = datetime.fromisoformat(data['last_attempt_at'].replace('Z', '+00:00'))
        if (now - previous).total_seconds() < 86400:
            return data, False
    stamp = now.isoformat().replace('+00:00', 'Z')
    known = {i['url']: i for i in data.get('discovered_items', [])}
    curated = {normalize_url(s['url']) for e in data['events'] for s in e['sources']}
    old = {s['url']: s for s in data.get('source_checks', [])}
    checks = []
    for label, url in SOURCES:
        check = {'label': label, 'url': url, 'attempted_at': stamp, 'status': 'unavailable', 'last_success_at': old.get(url, {}).get('last_success_at')}
        try:
            response = get(url, timeout=15, headers={'User-Agent': 'BackingMonitor-SyrupSourceCheck/1.0'})
            response.raise_for_status()
            rows = parse_feed(response.content)
            check.update(status='ok', last_success_at=stamp, item_count=len(rows), sha256=hashlib.sha256(response.content).hexdigest())
            baseline = not old.get(url, {}).get('last_success_at')
            for row in rows:
                if row['url'] not in known:
                    known[row['url']] = {**row, 'source': label, 'first_seen_at': stamp,
                        'review_status': 'linked_to_reviewed_event' if row['url'] in curated else ('baseline_unreviewed' if baseline else 'awaiting_review')}
        except (requests.RequestException, ET.ParseError, ValueError, TypeError, OverflowError):
            pass
        checks.append(check)
    data.update(last_attempt_at=stamp, source_checks=checks, discovered_items=list(known.values()))
    return data, True


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--path', type=Path, default=Path(__file__).with_name('issuer-updates-draft.json'))
    args = parser.parse_args()
    data = json.loads(args.path.read_text())
    data, changed = refresh(data, datetime.now(timezone.utc))
    if changed:
        tmp = args.path.with_name(args.path.name + f'.{os.getpid()}.tmp')
        tmp.write_text(json.dumps(data, indent=2) + '\n')
        os.replace(tmp, args.path)
    print('Syrup issuer source discovery: ' + ('checked' if changed else 'daily interval not due'))

if __name__ == '__main__':
    main()
