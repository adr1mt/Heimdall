import importlib.util
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location('audit', Path(__file__).resolve().parents[2] / 'scripts/check_npm_audit.py')
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)


class AuditPolicy(unittest.TestCase):
    def fixture(self):
        return ({'auditReportVersion': 2, 'vulnerabilities': {}, 'metadata': {'vulnerabilities': {
            key: 0 for key in ('info', 'low', 'moderate', 'high', 'critical', 'total')
        }}}, {'packages': {'': {}, 'node_modules/example': {'dev': True, 'resolved': 'https://registry.npmjs.org/example/-/example-1.0.0.tgz', 'integrity': 'sha512-fixture'}}})

    def test_clean_complete_report_passes(self):
        report, lock = self.fixture()
        self.assertEqual(audit.problems(report, lock), [])

    def test_every_severity_including_old_build_exception_is_blocked(self):
        for severity in ('info', 'low', 'moderate', 'high', 'critical'):
            for dev in (True, False):
                with self.subTest(severity=severity, dev=dev):
                    report, lock = self.fixture()
                    report['vulnerabilities']['sprintf-js'] = {'severity': severity,
                        'via': [{'url': 'https://github.com/advisories/GHSA-hp3w-g68c-fv3c'}]}
                    lock['packages']['node_modules/example']['dev'] = dev
                    self.assertTrue(audit.problems(report, lock))

    def test_deprecated_dependencies_are_blocked_even_without_advisories(self):
        report, lock = self.fixture()
        lock['packages']['node_modules/example']['deprecated'] = 'No longer supported'
        self.assertTrue(audit.problems(report, lock))

    def test_network_failure_incomplete_or_inconsistent_reports_are_blocked(self):
        report, lock = self.fixture()
        for invalid in ({'error': 'network'}, {}, {'auditReportVersion': 2, 'vulnerabilities': {}}):
            self.assertTrue(audit.problems(invalid, lock))
        self.assertTrue(audit.problems(report, {}))
        report['metadata']['vulnerabilities']['total'] = 1
        self.assertTrue(audit.problems(report, lock))
        report['metadata']['vulnerabilities']['total'] = 0
        report['metadata']['vulnerabilities']['high'] = 1
        self.assertTrue(audit.problems(report, lock))
        report['metadata']['vulnerabilities'] = {'total': 0}
        self.assertTrue(audit.problems(report, lock))

    def test_lock_without_provenance_is_blocked(self):
        for field in ('resolved', 'integrity'):
            report, lock = self.fixture()
            del lock['packages']['node_modules/example'][field]
            self.assertTrue(audit.problems(report, lock))
