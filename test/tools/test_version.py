import json
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest


class VersionGate(unittest.TestCase):
    def test_checks_both_lock_versions_and_propagates_failure(self):
        script = Path(__file__).resolve().parents[1] / 'version.sh'
        with tempfile.TemporaryDirectory(prefix='heimdall-version-') as temporary:
            root = Path(temporary)
            for name in ('test', 'gui', 'bin'):
                (root / name).mkdir()
            shutil.copyfile(script, root / 'test/version.sh')
            (root / 'VERSION').write_text('1.0.1\n')
            (root / 'gui/package.json').write_text('{"version": "1.0.1"}\n')
            binary = root / 'bin/heimdall'
            binary.write_text('#!/bin/sh\necho "heimdall 1.0.1"\n')
            binary.chmod(0o700)
            for top, package, expected in [('1.0.1', '1.0.1', 0), ('1.0.0', '1.0.1', 1), ('1.0.1', '1.0.0', 1)]:
                (root / 'gui/package-lock.json').write_text(json.dumps({'version': top, 'packages': {'': {'version': package}}}))
                result = subprocess.run(['bash', str(root / 'test/version.sh')], capture_output=True, text=True, timeout=5)
                self.assertEqual(result.returncode, expected, result.stdout + result.stderr)
