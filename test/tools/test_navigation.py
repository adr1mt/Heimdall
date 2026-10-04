import contextlib
import io
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]


def load(name):
    spec = importlib.util.spec_from_file_location(name, ROOT / 'scripts' / f'{name}.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


tasks = load('tasks')
links = load('check_doc_links')


class TaskLookupTests(unittest.TestCase):
    def test_pending_order_and_unfinished_dependencies(self):
        fixture = [
            {'id': 'T003', 'status': 'READY', 'priority': 'P2', 'depends_on': ['T001', 'T099']},
            {'id': 'T001', 'status': 'DONE', 'priority': 'P0'},
            {'id': 'T004', 'status': 'BLOCKED', 'priority': 'P0', 'depends_on': ['T002']},
            {'id': 'T002', 'status': 'DROPPED', 'priority': 'P0'},
            {'id': 'T005', 'status': 'IN_PROGRESS', 'priority': 'P2', 'depends_on': []},
        ]
        result = tasks.pending(fixture)
        self.assertEqual([item['id'] for item in result], ['T004', 'T003', 'T005'])
        self.assertEqual(result[0]['waiting_on'], ['T002'])
        self.assertEqual(result[1]['waiting_on'], ['T099'])
        self.assertNotIn('waiting_on', fixture[0])

    def test_cli_from_another_directory_preserves_task_and_rejects_unknown(self):
        command = [sys.executable, '-B', str(ROOT / 'scripts/tasks.py')]
        with tempfile.TemporaryDirectory() as folder:
            result = subprocess.run(command + ['T160'], cwd=folder, capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            canonical = json.loads((ROOT / 'docs/project/TASKS.json').read_text())['tasks']
            self.assertEqual(json.loads(result.stdout), next(t for t in canonical if t['id'] == 'T160'))
            missing = subprocess.run(command + ['UNKNOWN'], cwd=folder, capture_output=True, text=True)
            self.assertEqual(missing.returncode, 2)
            self.assertIn('tarea desconocida', missing.stderr)


class DocumentationLinkTests(unittest.TestCase):
    def test_targets_and_diagnostics(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / 'file with spaces.md').write_text('exists')
            (root / 'images').mkdir()
            (root / 'images/logo.png').touch()
            doc = root / 'README.md'
            doc.write_text('''[ok](<file with spaces.md>)
[ok](file%20with%20spaces.md#heading)
![ok](images/logo.png "Title")
[reference]: images/logo.png
<img src="images/logo.png">
[remote](https://example.org/missing)
[anchor](#heading)
`[ignored](missing-inline)`
~~~markdown
[ignored](missing-fenced)
~~~
[broken](missing.md)
[reference-broken]: missing-ref.md
<img src="missing-image.png">
[absolute](/tmp/local-only.md)
[outside](../outside.md)
''')
            errors = links.broken_links(doc, root)
            self.assertEqual(len(errors), 5, errors)
            self.assertIn('README.md:12: missing.md', errors)
            self.assertIn('README.md:13: missing-ref.md', errors)
            self.assertIn('README.md:14: missing-image.png', errors)

    def test_command_fails_on_broken_link_and_passes_after_repair(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / 'README.md').write_text('[target](target.md)')
            with patch.object(links, 'ROOT', root), contextlib.redirect_stdout(io.StringIO()):
                with self.assertRaises(SystemExit) as failure:
                    links.main()
                self.assertEqual(failure.exception.code, 1)
                (root / 'target.md').touch()
                links.main()

    def test_scope_excludes_historical_evidence_but_includes_new_design_docs(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            for name in ['README.md', 'docs/design/new.md', 'docs/research/old.md',
                         'docs/audits/old.md', 'docs/releases/old.md',
                         'docs/retrospectives/old.md', 'docs/project/DECISIONS.md']:
                path = root / name
                path.parent.mkdir(parents=True, exist_ok=True)
                path.touch()
            self.assertEqual({str(p.relative_to(root)) for p in links.documents(root)},
                             {'README.md', 'docs/design/new.md'})


if __name__ == '__main__':
    unittest.main()
