from pathlib import Path
import subprocess
root=Path('/tmp/heimdall-post-audit')
exam=(root/'zero/examen.yaml').read_text().replace('peso: 0','peso: 1')
aula=(root/'zero/aula.yaml').read_text()
for name,e,a in [('multiple-documents',exam+'\n---\nesto_no_es_un_examen: true\n',aula),('duplicate-student-id',exam,aula.replace('id: fake','id: initial\n    id: replaced'))]:
 p=root/name;p.mkdir(exist_ok=True);(p/'examen.yaml').write_text(e);(p/'aula.yaml').write_text(a)
 check=subprocess.run(['/tmp/heimdall-audit-engine','check',str(p)],capture_output=True,text=True)
 run=subprocess.run(['/tmp/heimdall-audit-engine','run','--var='+str(p/'var'),str(p)],capture_output=True,text=True)
 print(name,'check_exit',check.returncode,'run_exit',run.returncode,'stderr',check.stderr.strip())
 if name=='duplicate-student-id':print('student_used', 'replaced' if 'replaced' in run.stdout else run.stdout)
