from pathlib import Path
import json,subprocess
root=Path('/tmp/heimdall-repair/boundaries');root.mkdir(parents=True,exist_ok=True)
engine='/mnt/datos/Applications/Claude/Heimdall/bin/heimdall'
for utf in (False,True):
 for size in (65535,65536,65537):
  p=root/f'value-{utf}-{size}';p.mkdir(exist_ok=True)
  value=('é'*(size//2)+'x'*(size%2)) if utf else 'x'*size
  (p/'examen.yaml').write_text('examen: Ficticio\nversion: 1\nhosts: []\ngrupos:\n  - grupo: G\n    comprobaciones:\n      - id: c\n        valor: "${alumno.answer}"\n        contiene: x\n')
  (p/'aula.yaml').write_text('aula: Ficticia\nversion: 1\nalumnos:\n  - id: fake\n    nombre: Ficticio\n    answer: '+json.dumps(value)+'\n')
  r=subprocess.run([engine,'run','--secrets=env','--var='+str(p/'var'),str(p)],capture_output=True,text=True)
  assert r.returncode==(2 if size>65536 else 0),r.stderr
  if size<=65536:
   read=subprocess.run([engine,'session',str(p/'var/latest.json')],capture_output=True,text=True)
   assert read.returncode==0,read.stderr
  else: assert not (p/'var').exists()
  print('utf8',utf,'bytes',size,'exit',r.returncode,'readable' if size<=65536 else 'no_result_written')
