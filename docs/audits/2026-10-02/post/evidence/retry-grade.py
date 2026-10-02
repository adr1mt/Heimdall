from pathlib import Path
import json,subprocess,uuid
p=Path('/tmp/heimdall-post-audit/retry-grade');p.mkdir(exist_ok=True)
flag='/tmp/heimdall-audit-'+uuid.uuid4().hex
(p/'examen.yaml').write_text('examen: Reintento ficticio\nversion: 1\nhosts: [host1]\ngrupos:\n  - grupo: G\n    comprobaciones:\n      - id: academic\n        en: host1\n        cmd: '+json.dumps(['test','-e',flag])+'\n        exit_code: 0\n      - id: technical\n        en: host1\n        timeout: 100ms\n        cmd: '+json.dumps(['sh','-c','if test -e '+flag+'; then exit 0; else sleep 1; fi'])+'\n        exit_code: 0\n')
(p/'aula.yaml').write_text(Path('/tmp/heimdall-post-audit/retry/aula.yaml').read_text())
prev=None
try:
 for i in range(3):
  if i==2:subprocess.run(['podman','exec','--user','alumno','alu1','touch',flag],check=True,capture_output=True)
  args=['/tmp/heimdall-audit-engine','run','--secrets=stdin','--var='+str(p/'var')]
  if prev:args.append('--retry='+str(prev))
  args.append(str(p))
  r=subprocess.run(args,input=json.dumps({'schema':1,'secrets':{'AULA_PASSWORD':'HEIMDALL_SECRET_TEST_12345'}})+'\n',capture_output=True,text=True,timeout=20)
  if r.returncode not in (0,3):raise RuntimeError(r.stderr)
  path=r.stdout.split('Artefacto: ')[-1].strip();prev=Path(path);run=json.loads(prev.read_text())
  print('round',i+1,'checks',[(c['check_id'],c['status'],c['cause'],c['execution'] is not None) for c in run['students'][0]['checks']])
 r=subprocess.run(['/tmp/heimdall-audit-engine','consolidate',str(prev)],capture_output=True,text=True)
 print('consolidated_exit',r.returncode,'final_score',json.loads(r.stdout)['students'][0]['score']['final_score'],'expected_if_original_FAIL_preserved',50)
finally:
 subprocess.run(['podman','exec','--user','alumno','alu1','rm','-f',flag],capture_output=True)
