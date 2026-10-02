from pathlib import Path
import json,subprocess
p=Path('/tmp/heimdall-repair/large-real');p.mkdir(parents=True,exist_ok=True)
checks=''.join(f'      - id: c{i}\n        valor: "${{alumno.respuesta}}"\n        contiene: yes\n' for i in range(20))
(p/'examen.yaml').write_text('examen: Grande ficticio\nversion: 1\nhosts: []\ngrupos:\n  - grupo: G\n    comprobaciones:\n'+checks)
answer=json.dumps('yes'+'\x01'*19997)
(p/'aula.yaml').write_text('aula: Ficticia\nversion: 1\nalumnos:\n'+''.join(f'  - id: s{i}\n    nombre: Ficticio {i}\n    respuesta: {answer}\n' for i in range(30)))
r=subprocess.run(['/mnt/datos/Applications/Claude/Heimdall/bin/heimdall','run','--var='+str(p/'var'),str(p)],capture_output=True,text=True,timeout=90)
print('run_exit',r.returncode,'stderr',r.stderr)
path=p/'var/latest.json';run=json.loads(path.read_text())
print('artifact_bytes',path.stat().st_size,'students',len(run['students']),'checks',run['plan']['check_count'],'all_complete',all(s['score']['status']=='COMPLETE' for s in run['students']))

assert r.returncode==0
assert path.stat().st_size<=64*1024*1024
assert all(s['score']['final_score']==100 for s in run['students'])
