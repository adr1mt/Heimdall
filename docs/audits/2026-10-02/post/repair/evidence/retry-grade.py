from pathlib import Path
import json,subprocess,uuid
p=Path('/tmp/heimdall-repair/retry-grade');p.mkdir(parents=True,exist_ok=True)
flag='/tmp/heimdall-audit-'+uuid.uuid4().hex
(p/'examen.yaml').write_text('examen: Reintento ficticio\nversion: 1\nhosts: [host1]\ngrupos:\n  - grupo: G\n    comprobaciones:\n      - id: academic\n        en: host1\n        cmd: '+json.dumps(['test','-e',flag])+'\n        exit_code: 0\n      - id: technical\n        en: host1\n        timeout: 100ms\n        cmd: '+json.dumps(['sh','-c','if test -e '+flag+'; then exit 0; else sleep 1; fi'])+'\n        exit_code: 0\n')
(p/'aula.yaml').write_text('aula: Ficticia\nversion: 1\ncomun:\n  hosts:\n    host1:\n      puerto: 2201\n      usuario: alumno\n      password_ref: "${AULA_PASSWORD}"\nalumnos:\n  - id: fake\n    nombre: Ficticio\n    hosts:\n      host1: {ip: "127.1.2.3"}\n')
prev=None
try:
 for i in range(4):
  if i==3:subprocess.run(['podman','exec','--user','alumno','alu1','touch',flag],check=True,capture_output=True)
  args=['/mnt/datos/Applications/Claude/Heimdall/bin/heimdall','run','--secrets=stdin','--var='+str(p/'var')]
  if prev:args.append('--retry='+str(prev))
  args.append(str(p))
  r=subprocess.run(args,input=json.dumps({'schema':1,'secrets':{'AULA_PASSWORD':'HEIMDALL_SECRET_TEST_12345'}})+'\n',capture_output=True,text=True,timeout=20)
  if r.returncode not in (0,3):raise RuntimeError(r.stderr)
  path=r.stdout.split('Artefacto: ')[-1].strip();prev=Path(path);run=json.loads(prev.read_text())
  print('round',i+1,'checks',[(c['check_id'],c['status'],c['cause'],c['execution'] is not None) for c in run['students'][0]['checks']])
 r=subprocess.run(['/mnt/datos/Applications/Claude/Heimdall/bin/heimdall','consolidate',str(prev)],capture_output=True,text=True)
 assert r.returncode==0 and json.loads(r.stdout)['students'][0]['score']['final_score']==50
 print('consolidated_exit',r.returncode,'final_score',50)
 extra=subprocess.run(['/mnt/datos/Applications/Claude/Heimdall/bin/heimdall','run','--retry='+str(prev),'--var='+str(p/'var'),str(p)],capture_output=True,text=True)
 assert extra.returncode==2
 print('closed_chain_retry_exit',extra.returncode)
finally:
 subprocess.run(['podman','exec','--user','alumno','alu1','rm','-f',flag],capture_output=True)
