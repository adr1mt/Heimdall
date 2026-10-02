from pathlib import Path
import subprocess
root=Path('/tmp/heimdall-repair')
root.mkdir(parents=True,exist_ok=True)
exam='examen: Ficticio\nversion: 1\nhosts: []\ngrupos:\n  - grupo: G\n    comprobaciones:\n      - id: c\n        peso: 1\n        valor: yes\n        igual_a: yes\n'
aula='aula: Ficticia\nversion: 1\nalumnos:\n  - id: fake\n    nombre: Ficticio\n'
for name,e,a in [('multiple-documents',exam+'\n---\nesto_no_es_un_examen: true\n',aula),('duplicate-student-id',exam,aula.replace('id: fake','id: initial\n    id: replaced'))]:
 p=Path('/tmp/heimdall-repair')/name;p.mkdir(exist_ok=True);(p/'examen.yaml').write_text(e);(p/'aula.yaml').write_text(a)
 check=subprocess.run(['/mnt/datos/Applications/Claude/Heimdall/bin/heimdall','check',str(p)],capture_output=True,text=True)
 run=subprocess.run(['/mnt/datos/Applications/Claude/Heimdall/bin/heimdall','run','--var='+str(p/'var'),str(p)],capture_output=True,text=True)
 assert check.returncode==run.returncode==2
 assert not (p/'var').exists()
 print(name,'check_exit',check.returncode,'run_exit',run.returncode,'stderr',check.stderr.strip())
 if name=='duplicate-student-id':print('student_used', 'replaced' if 'replaced' in run.stdout else run.stdout)
