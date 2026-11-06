import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('emitter', Path(__file__).parents[1] / 'tools/emit_axis5.py')
emitter = importlib.util.module_from_spec(spec)
spec.loader.exec_module(emitter)


class AcceptedReleaseTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        (self.root / 'config').mkdir()
        self.payload = {'schema_version':'contract/1', 'asset':'reusd_re',
                        'producer':'security_analyst', 'as_of':'2026-11-06T10:19:59Z',
                        'contract':{'layers':[], 'unresolved':['not enumerated']}}
        self.save(self.payload)

    def save(self, payload):
        self.source = self.root / 'selected.json'
        self.source.write_text(json.dumps(payload))
        self.selection = {'releases':{'reusd_re':{'path':'selected.json',
            'sha256':hashlib.sha256(self.source.read_bytes()).hexdigest()}}}
        self.config = self.root / 'config/axis5_release_selection.json'
        self.config.write_text(json.dumps(self.selection))

    def test_preserves_original_clock_and_gaps(self):
        self.assertEqual(emitter.accepted_contract('reusd_re', self.root), self.payload)
        self.assertIsNone(emitter.accepted_contract('unselected', self.root))

    def test_missing_or_changed_selected_source_cannot_restore_old_walk(self):
        self.source.write_text('{}')
        with self.assertRaisesRegex(SystemExit, 'hash mismatch'):
            emitter.accepted_contract('reusd_re', self.root)
        self.source.unlink()
        with self.assertRaisesRegex(SystemExit, 'unavailable'):
            emitter.accepted_contract('reusd_re', self.root)

    def test_wrong_identity_is_refused_even_with_valid_hash(self):
        self.save({**self.payload,'asset':'other'})
        with self.assertRaisesRegex(SystemExit,'identity/schema/clock'):
            emitter.accepted_contract('reusd_re', self.root)

    def test_source_escape_is_refused(self):
        self.selection['releases']['reusd_re']['path'] = '../outside.json'
        self.config.write_text(json.dumps(self.selection))
        with self.assertRaisesRegex(SystemExit,'outside repository'):
            emitter.accepted_contract('reusd_re', self.root)
