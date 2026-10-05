#!/usr/bin/env python3
"""T175: paired Kea measurement against the existing two RA2 containers.

Needs make build, make lab-ra2, Go, Node and GUI node_modules.
No credentials from the real classroom; SSH passwords enter via stdin.
Keeps only raw measurements and SSH counting evidence in the output folder.
"""
import argparse
import json
import os
from pathlib import Path
import re
import shutil
import statistics
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
SECRET_LINE = json.dumps({'schema': 1, 'secrets': {'AULA_PASSWORD': 'HEIMDALL_SECRET_RA2_TEST'}})


def academic(run):
    return [(s['student_id'], s['score'], [(c['check_id'], c['weight'], c['status'], c['cause'], c['assertion']) for c in s['checks']]) for s in run['students']]


def measure(work, name, shared, helper):
    project = work / name
    project.mkdir()
    exam = (ROOT / 'testdata/shared-files/examen.yaml').read_text()
    if not shared:
        exam = exam.replace('fichero: "/etc/kea/kea-dhcp4.conf"', 'cmd: ["cat", "--", "/etc/kea/kea-dhcp4.conf"]')
    (project / 'examen.yaml').write_text(exam)
    shutil.copy(ROOT / 'testdata/shared-files/aula.yaml', project / 'aula.yaml')
    timefile = project / 'time.txt'
    completed = subprocess.run(['/usr/bin/time', '-f', '%e %M', '-o', str(timefile), str(ROOT / 'bin/heimdall'), 'run', '--secrets=stdin', '--concurrency=16', '--host-concurrency=4', '--var=' + str(project / 'var'), str(project)], input=SECRET_LINE, text=True, capture_output=True, timeout=120)
    if completed.returncode:
        raise RuntimeError(f'{name}: engine exit {completed.returncode}: {completed.stderr}')
    seconds, rss_kib = timefile.read_text().split()
    artifacts = [p for p in (project / 'var').glob('run-*.json') if 'partial' not in p.name]
    if len(artifacts) != 1:
        raise RuntimeError(f'{name}: expected one completed artifact')
    artifact = artifacts[0]
    run = json.loads(artifact.read_text())
    if run['status'] != 'COMPLETE' or len(run['students']) != 30 or any(len(s['checks']) != 15 or any(c['status'] != 'PASS' for c in s['checks']) for s in run['students']):
        raise RuntimeError(f'{name}: lost or failed checks')
    gui = subprocess.run(['node', str(helper), str(project)], text=True, capture_output=True, timeout=30)
    if gui.returncode:
        raise RuntimeError(f'{name}: GUI metrics failed: {gui.stderr}')
    metrics = {'variant': 'shared' if shared else 'commands', 'seconds': float(seconds), 'rss_kib': int(rss_kib), 'artifact_bytes': artifact.stat().st_size, **json.loads(gui.stdout)}
    return metrics, academic(run)


def summary(samples):
    result = {}
    for variant in ('commands', 'shared'):
        rows = [row for row in samples if row['variant'] == variant]
        result[variant] = {key: {'median': statistics.median(row[key] for row in rows), 'min': min(row[key] for row in rows), 'max': max(row[key] for row in rows)} for key in ('seconds', 'rss_kib', 'artifact_bytes', 'read_ms', 'create_backup_ms', 'rescan_backups_ms')}
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out', type=Path, required=True)
    args = parser.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)
    env = dict(os.environ)
    env.setdefault('GOCACHE', '/tmp/heimdall-plan-go-cache')
    with tempfile.TemporaryDirectory(prefix='heimdall-file-performance-') as temporary:
        work = Path(temporary)
        helper = work / 'gui-metrics.mjs'
        subprocess.run([str(ROOT / 'gui/node_modules/.bin/esbuild'), 'scripts/shared-files-metrics.ts', '--bundle', '--platform=node', '--format=esm', '--outfile=' + str(helper)], cwd=ROOT / 'gui', check=True)
        count = subprocess.run(['go', 'test', '-count=1', '-tags=integration', './internal/engine', '-run', '^TestKeaSharedFileReadsAgainstSSH$', '-v'], cwd=ROOT, env=env, capture_output=True, text=True, check=True, timeout=120)
        (args.out / 'ssh-counts.txt').write_text(count.stdout)
        transport = {}
        for shared, calls, content_bytes in re.findall(r'shared=(false|true) actual_reads=(\d+) received_content_bytes=(\d+)', count.stdout):
            transport['shared' if shared == 'true' else 'commands'] = {'actual_reads': int(calls), 'received_content_bytes': int(content_bytes)}
        if set(transport) != {'shared', 'commands'}:
            raise RuntimeError('SSH counting evidence missing')
        samples = []
        for pair in range(-2, 10):
            order = [False, True] if pair % 2 == 0 else [True, False]
            results = []
            for shared in order:
                row, conclusions = measure(work, f'pair{pair}-{int(shared)}', shared, helper)
                row['pair'] = pair
                results.append(conclusions)
                if pair >= 0:
                    samples.append(row)
                print(json.dumps({'warmup': pair < 0, **row}), flush=True)
            if results[0] != results[1]:
                raise RuntimeError(f'Academic conclusions differ in pair {pair}')
        report = {'configuration': {'students': 30, 'checks_per_student': 15, 'containers': 2, 'concurrency': 16, 'host_concurrency': 4, 'warmup_pairs': 2, 'measured_pairs': 10, 'transport_metrics_source': 'separate instrumented SSH sample with the same stable fixture; content bytes exclude SSH overhead'}, 'transport': transport, 'samples': samples, 'summary': summary(samples)}
        (args.out / 'measurements.json').write_text(json.dumps(report, indent=2) + '\n')
        print(json.dumps(report['summary'], indent=2), flush=True)


if __name__ == '__main__':
    main()
