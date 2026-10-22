#!/usr/bin/env python3
"""Reject new npm advisories; allow one documented build-only moderate issue."""
import json
import sys
from pathlib import Path

ALLOWED = 'https://github.com/advisories/GHSA-hp3w-g68c-fv3c'
BUILD_CHAIN = {'sprintf-js', 'roarr', 'global-agent', '@electron/get', 'app-builder-lib',
               'dmg-builder', 'electron-builder', 'electron-builder-squirrel-windows'}


def problems(report, lock):
    if report.get('error') or report.get('auditReportVersion') != 2 or not isinstance(report.get('vulnerabilities'), dict):
        return ['Informe npm incompleto o consulta fallida.']
    packages = lock['packages']
    vulnerabilities = report['vulnerabilities']

    def allowed(name):
        queue, seen, known = [name], set(), False
        while queue:
            current = queue.pop()
            if current in seen:
                continue
            seen.add(current)
            if current not in BUILD_CHAIN or current not in vulnerabilities:
                return False
            item = vulnerabilities[current]
            nodes, via = item.get('nodes', []), item.get('via', [])
            if (item.get('severity') not in ('low', 'moderate') or not nodes or not via
                    or any(packages.get(node, {}).get('dev') is not True for node in nodes)):
                return False
            for edge in via:
                if isinstance(edge, str):
                    queue.append(edge)
                elif (edge.get('url') == ALLOWED and edge.get('dependency') == 'sprintf-js'
                      and edge.get('severity') in ('low', 'moderate')):
                    known = True
                else:
                    return False
        return known

    return [f'{name}: aviso nuevo, más grave o presente fuera de construcción.'
            for name in vulnerabilities if not allowed(name)]


if __name__ == '__main__':
    try:
        report = json.loads(Path(sys.argv[1]).read_text())
        lock = json.loads(Path(sys.argv[2]).read_text())
        failures = problems(report, lock)
    except (OSError, ValueError, KeyError, IndexError, TypeError) as error:
        raise SystemExit(f'No se pudo verificar npm audit: {error}')
    if failures:
        raise SystemExit('\n'.join(failures))
    print(f"npm audit: {len(report['vulnerabilities'])} avisos admitidos exclusivamente de build ({ALLOWED}).")
