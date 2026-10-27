"""Run each criterion in its own process, exactly as an SSH command does."""
from pathlib import Path
import subprocess
import sys
import yaml

source = Path('/work/internal/probe/ra1.py').read_text()
exam = yaml.safe_load(Path('/work/exams/ra1-dhcp-kea/examen.yaml').read_text())
failed = []
for group in exam['grupos']:
    for c in group['comprobaciones']:
        name = c['id']
        p = subprocess.run(['python3', '-I', '-c', source, name, 'enp1s0', 'enp2s0', '192.168.236.60'],
                           capture_output=True, text=True, timeout=20)
        print(name, p.stdout.strip(), p.returncode, p.stderr.strip()[:500], flush=True)
        if p.returncode or p.stdout.strip() != 'OK':
            failed.append(name)
print('TOTAL', 31 - len(failed), '/ 31', flush=True)
sys.exit(bool(failed))
