# Notas de versión

Una entrada por versión publicada, en el idioma del profesor. El detalle
técnico está en el historial de commits y en
[PROGRESS.md](project/PROGRESS.md).

El número es uno solo para todo el producto: lo dice el fichero `VERSION` de
la raíz, el motor se sella con él al compilar y la aplicación lo lleva en su
paquete. `test/version.sh` comprueba que no se separan.

## 1.0.0 — 22-10-2026

Primera versión estable. Sustituye a las publicaciones anteriores (0.9.1,
0.9.2 y la primera 1.0.0), que se retiran.

- El AppImage se abre con doble clic en Ubuntu 22.04, 24.04 y 26.04 sin
  instalar nada: ya no pide libfuse2 y, donde el sistema no deja usar el
  aislamiento de Chromium, arranca sin él.
- Los exámenes se escriben en YAML con un editor que funciona sin conexión.
- Comprobaciones con `sudo: true`: leen ficheros que solo puede leer root
  (por ejemplo, la configuración de Kea en Ubuntu 26.04) con la contraseña de
  la clase, sin escribirla en el examen. Si sudo no la acepta, el alumno sale
  sin evaluar, nunca suspendido.
- En Resultados la nota es lo primero: grande, con el color de aprobado o
  suspenso. Detalle por alumno, analíticas y ayuda con índice.
- Cada clase guarda la contraseña de sus máquinas: no se pide al corregir.
- «Enviar informes…» deja a cada alumno su informe en su carpeta personal,
  solo con lo suyo, y dice a quién le ha llegado y por qué no a los demás.
- El AppImage se actualiza solo; el `.deb` se actualiza instalando el nuevo.

Queda pendiente corregir con ella un examen real de aula de principio a fin.
