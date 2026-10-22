import importlib.util
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location('audit', Path(__file__).resolve().parents[2] / 'scripts/check_npm_audit.py')
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)


class AuditPolicy(unittest.TestCase):
    def fixture(self):
        return ({'auditReportVersion': 2, 'vulnerabilities': {
            'sprintf-js': {'severity': 'moderate', 'nodes': ['node_modules/sprintf-js'],
                          'via': [{'url': audit.ALLOWED, 'dependency': 'sprintf-js', 'severity': 'moderate'}]}
        }}, {'packages': {'node_modules/sprintf-js': {'dev': True}}})

    def test_clean_and_existing_build_issue(self):
        report, lock = self.fixture()
        self.assertEqual(audit.problems(report, lock), [])
        report['vulnerabilities'] = {}
        self.assertEqual(audit.problems(report, lock), [])

    def test_new_advisory_even_in_allowed_package(self):
        report, lock = self.fixture()
        report['vulnerabilities']['sprintf-js']['via'][0]['url'] = 'https://github.com/advisories/NEW'
        self.assertTrue(audit.problems(report, lock))

    def test_higher_severity_or_production_is_blocked(self):
        for change in ('severity', 'production'):
            report, lock = self.fixture()
            if change == 'severity':
                report['vulnerabilities']['sprintf-js']['severity'] = 'high'
            else:
                lock['packages']['node_modules/sprintf-js']['dev'] = False
            self.assertTrue(audit.problems(report, lock))

    def test_failure_and_missing_nodes_are_blocked(self):
        self.assertTrue(audit.problems({'error': 'network'}, {}))
        report, lock = self.fixture()
        report['vulnerabilities']['sprintf-js']['nodes'] = []
        self.assertTrue(audit.problems(report, lock))
