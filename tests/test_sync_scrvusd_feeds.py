import importlib.util
import json
from pathlib import Path
from types import SimpleNamespace
import pytest

spec=importlib.util.spec_from_file_location('scrvusd_transport',Path(__file__).resolve().parents[1]/'tools/sync_scrvusd_feeds.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)


@pytest.fixture
def setup(tmp_path,monkeypatch):
    repo=tmp_path/'site';(repo/'data').mkdir(parents=True)
    producer=tmp_path/'producer';producer.mkdir()
    monkeypatch.setattr(m,'REPO',repo);monkeypatch.setattr(m,'PRODUCER',producer)
    base={'asset_slug':'scrvusd','timestamp':'2026-10-17T09:00:00Z','publication_status':'candidate',
          'backing':{'collateral_ratio':None},'asset_specific':{'scrvusd':{'schema_version':'scrvusd-detail/1',
          'identity':{'asset':'0xf939E0A03FB07F59A73314E73794Be0E57ac1b4E'}}}}
    docs={'backing':base,'backing_history':{'asset':'scrvusd','entries':[]},'backing_last_attempt':{'status':'ok'}}
    for name,doc in docs.items():(producer/f'scrvusd_{name}.json').write_text(json.dumps(doc))
    monkeypatch.setattr(m.subprocess,'run',lambda *args,**kwargs:SimpleNamespace(stdout=json.dumps({'asset':'scrvusd','as_of':'2026-10-17T08:21:47Z','publication_status':'candidate'})))
    return repo,producer,base


def test_unregistered_asset_cannot_publish(setup):
    repo,_,_=setup;(repo/'data/assets.json').write_text('[]')
    with pytest.raises(SystemExit):m.main()
    assert not (repo/'data/scrvusd_backing.json').exists()


def test_transport_preserves_measurement_clock_and_candidate_provenance(setup):
    repo,_,base=setup;(repo/'data/assets.json').write_text('[{"slug":"scrvusd","published":true}]')
    m.main();d=json.loads((repo/'data/scrvusd_backing.json').read_text())
    assert d['timestamp']==base['timestamp']
    assert d['source_publication_status']=='candidate'
    assert d['publication_status']=='published'
    assert d['backing']['collateral_ratio'] is None
    assert len(list((repo/'data').glob('scrvusd_*.json')))==7
    issuer=json.loads((repo/'data/scrvusd_issuer.json').read_text())['issuer']
    assert issuer['report_url_status']=='published'
    assert issuer['report_url']=='https://tidresearch.com/reports/scrvusd/'


@pytest.mark.parametrize('corrupt',[{'backing':{'collateral_ratio':100}},{'asset_slug':'usdm'}])
def test_invalid_candidate_does_not_replace_any_serving_file(setup,corrupt):
    repo,producer,base=setup;(repo/'data/assets.json').write_text('[{"slug":"scrvusd","published":true}]')
    dest=repo/'data/scrvusd_backing.json';dest.write_text('original serving snapshot')
    (producer/'scrvusd_backing.json').write_text(json.dumps({**base,**corrupt}))
    with pytest.raises(ValueError):m.main()
    assert dest.read_text()=='original serving snapshot'
    assert not (repo/'data/scrvusd_issuer.json').exists()
