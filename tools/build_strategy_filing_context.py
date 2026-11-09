"""Publish only the owner review matching the normal Strategy filing identity."""
import datetime
import hashlib
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parents[1]
REVIEWS = pathlib.Path('/home/danger/riskAnalyst/data/reviews')


def build(base=None, reviews=REVIEWS):
    if base is None:
        base = json.loads((ROOT / 'data/strc_backing.json').read_text())
    filing = ((base.get('mstr_view') or {}).get('digital_credit_framework') or {}).get('filing_update') or {}
    date, accession = filing.get('filing_date'), filing.get('accession')
    if filing.get('status') != 'available' or not isinstance(date, str) or not re.fullmatch(r'\d{4}-\d{2}-\d{2}', date):
        raise ValueError('Normal producer filing identity unavailable')
    datetime.date.fromisoformat(date)
    if not isinstance(accession, str) or not re.fullmatch(r'\d{10}-\d{2}-\d{6}', accession):
        raise ValueError('Normal producer accession unavailable')
    source = pathlib.Path(reviews) / ('strategy-8k-' + date) / 'results.json'
    raw = source.read_bytes()
    r = json.loads(raw)
    if r.get('accession') != accession or r.get('filing_date') != date or r.get('balances_as_of') != filing.get('balances_as_of'):
        raise ValueError('Owner review does not match normal filing accession/date/balance period')
    if not isinstance(r.get('score_decision'), str) or not r['score_decision'].strip():
        raise ValueError('Current owner judgment unavailable')
    scopes = r.get('downstream_scope')
    if not isinstance(scopes, dict) or any(not isinstance(k, str) or not isinstance(v, str) for k, v in scopes.items()):
        raise ValueError('Current owner dependency scope unavailable')
    return {
        'status': 'available', 'source_owner': 'riskAnalyst', 'accession': accession,
        'filing_date': date, 'balances_as_of': r['balances_as_of'],
        'interpretation': r['score_decision'], 'downstream_scope': scopes,
        'scores_and_full_dates_unchanged': (True if r.get('scores_changed') is False and r.get('full_verification_dates_changed') is False else False if r.get('scores_changed') is True or r.get('full_verification_dates_changed') is True else None),
        'review_version': r.get('assessment_version'), 'review_date_local': r.get('assessment_date_local'),
        'source_review_sha256': hashlib.sha256(raw).hexdigest(),
        'financial_observations': {k: r.get(k) for k in (
            'cash_change_usd', 'reported_cash_allocation_usd',
            'cash_allocation_vs_balance_residual_usd', 'btc_difference_status')},
        'generated_at': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    }


def emit(root=ROOT, reviews=REVIEWS):
    try:
        base = json.loads((root / 'data/strc_backing.json').read_text())
        d = build(base, reviews)
    except (OSError, KeyError, ValueError, TypeError):
        d = {'status': 'unavailable', 'source_owner': 'riskAnalyst',
             'reason': 'Matching owner review unavailable; no older judgment or scope substituted',
             'generated_at': datetime.datetime.now(datetime.timezone.utc).isoformat()}
    p = root / 'data/strategy_filing_context.json'
    tmp = p.with_suffix('.tmp')
    tmp.write_text(json.dumps(d, indent=2) + '\n')
    tmp.replace(p)
    return d


if __name__ == '__main__':
    emit()
