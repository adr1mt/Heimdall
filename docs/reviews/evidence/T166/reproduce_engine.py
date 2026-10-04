#!/usr/bin/env python3
"""Synthetic audit probes; no SSH, credentials or real student data."""
import json
import signal
import subprocess
import tempfile
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
BIN = ROOT / 'bin/heimdall'
WORK = Path(tempfile.mkdtemp(prefix='heimdall-audit-engine-'))

def project(name, students, checks, size):
    folder = WORK / name
    folder.mkdir()
    exam = 'examen: Auditoria sintetica\nversion: 1\nhosts: []\ngrupos:\n  - grupo: G\n    comprobaciones:\n'
    for i in range(checks):
        exam += f'      - id: c{i}\n        descripcion: C\n        valor: "${{alumno.respuesta}}"\n        contiene: x\n'
    (folder / 'examen.yaml').write_text(exam)
    aula = 'aula: Auditoria sintetica\nversion: 1\nalumnos:\n'
    for i in range(students):
        aula += f'  - id: ficticio{i}\n    nombre: Ficticio {i}\n    respuesta: "' + 'x' * size + '"\n'
    (folder / 'aula.yaml').write_text(aula)
    return folder

for n, size in [(30, 32), (30, 65536), (100, 65536)]:
    folder = project(f'n{n}-s{size}', n, 20, size)
    metrics = folder / 'time.txt'
    p = subprocess.run(['/usr/bin/time', '-f', '%e %M', '-o', str(metrics), str(BIN), 'run', f'--var={folder}/var', str(folder)], capture_output=True, timeout=120)
    files = list((folder/'var').glob('run-*.json'))
    print(json.dumps({'case':folder.name,'exit':p.returncode,'seconds_rss_kib':metrics.read_text().strip(),'artifact_bytes':sum(f.stat().st_size for f in files),'stderr':p.stderr.decode()[:500]}), flush=True)

folder = project('unread-progress', 100, 20, 32)
child = subprocess.Popen([str(BIN), 'run', '--events=ndjson', f'--var={folder}/var', str(folder)], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
time.sleep(2)
child.send_signal(signal.SIGINT)
try:
    child.wait(timeout=3)
    stuck = False
except subprocess.TimeoutExpired:
    stuck = True
# Release the consumer to prove the blocked pipe, preserving the eventual result.
out, err = child.communicate(timeout=10)
print(json.dumps({'case':'unread-progress','still_alive_3s_after_sigint':stuck,'exit_after_draining':child.returncode,'events_bytes':len(out),'final_artifacts':len(list((folder/'var').glob('run-*.json'))),'stderr':err.decode()[:500]}), flush=True)
print(json.dumps({'temporary_work':str(WORK)}), flush=True)
