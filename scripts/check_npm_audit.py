#!/usr/bin/env python3
"""Reject every known npm vulnerability and deprecated locked dependency."""
import json
import sys
from pathlib import Path


def problems(report, lock):
    if (report.get('error') or report.get('auditReportVersion') != 2
            or not isinstance(report.get('vulnerabilities'), dict)
            or not isinstance(report.get('metadata', {}).get('vulnerabilities'), dict)
            or not isinstance(lock.get('packages'), dict) or '' not in lock['packages']):
        return ['Informe npm o lock incompleto; la consulta debe completarse.']
    failures = [f'{name}: vulnerabilidad conocida ({item.get("severity", "sin gravedad")}).'
                for name, item in report['vulnerabilities'].items()]
    counts = report['metadata']['vulnerabilities']
    if any(type(counts.get(key)) is not int or counts[key] < 0
           for key in ('info', 'low', 'moderate', 'high', 'critical', 'total')):
        failures.append('Recuento de vulnerabilidades incompleto.')
    elif any(counts.values()) and not failures:
        failures.append('El resumen declara vulnerabilidades sin detalle.')
    for node, item in lock['packages'].items():
        if node and not item.get('inBundle') and (not item.get('resolved') or not item.get('integrity')):
            failures.append(f'{node}: faltan origen o huella de integridad en el lock.')
        if item.get('deprecated'):
            failures.append(f'{node}: dependencia deprecated: {item["deprecated"]}')
    return failures


if __name__ == '__main__':
    try:
        report = json.loads(Path(sys.argv[1]).read_text())
        lock = json.loads(Path(sys.argv[2]).read_text())
        failures = problems(report, lock)
    except (OSError, ValueError, KeyError, IndexError, TypeError, AttributeError) as error:
        raise SystemExit(f'No se pudo verificar npm audit: {error}')
    if failures:
        raise SystemExit('\n'.join(failures))
    print('npm audit: cero vulnerabilidades y cero dependencias deprecated; sin excepciones.')
