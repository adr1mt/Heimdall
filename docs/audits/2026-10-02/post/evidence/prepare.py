import pathlib,json,subprocess
root=pathlib.Path('/tmp/heimdall-post-audit')
def fixture(name, checks, answer='yes'):
 p=root/name;p.mkdir(exist_ok=True)
 (p/'examen.yaml').write_text('examen: Auditoria ficticia\nversion: 1\nhosts: []\ngrupos:\n  - grupo: G\n    comprobaciones:\n'+checks)
 (p/'aula.yaml').write_text('aula: Ficticia\nversion: 1\nalumnos:\n  - id: fake\n    nombre: Ficticio\n    respuesta: '+json.dumps(answer)+'\n')
 r=subprocess.run(['/tmp/heimdall-audit-engine','check',str(p)],capture_output=True,text=True)
 s=subprocess.run(['/tmp/heimdall-audit-engine','run','--var='+str(p/'var'),str(p)],capture_output=True,text=True)
 print(name, 'check_exit',r.returncode,'run_exit',s.returncode)
fixture('zero','      - id: c\n        peso: 0\n        valor: yes\n        igual_a: yes\n')
fixture('longvalue','      - id: c\n        peso: 1\n        valor: "${alumno.respuesta}"\n        contiene: yes\n','yes'+'a'*65536)
fixture('rounding','      - id: a\n        peso: 1\n        valor: yes\n        igual_a: yes\n      - id: b\n        peso: 1e-100\n        valor: no\n        igual_a: yes\n')
p=root/'retry';p.mkdir(exist_ok=True)
(p/'examen.yaml').write_text('''examen: Reintento ficticio
version: 1
hosts: [host1]
grupos:
  - grupo: G
    comprobaciones:
      - id: fail
        en: host1
        cmd: ["false"]
        exit_code: 0
      - id: pending
        en: host1
        timeout: 100ms
        cmd: ["sleep", "1"]
        exit_code: 0
''')
(p/'aula.yaml').write_text('''aula: Ficticia
version: 1
comun:
  hosts:
    host1:
      puerto: 2201
      usuario: alumno
      password_ref: "${AULA_PASSWORD}"
alumnos:
  - id: fake
    nombre: Ficticio
    hosts:
      host1: {ip: "127.1.2.3"}
''')
