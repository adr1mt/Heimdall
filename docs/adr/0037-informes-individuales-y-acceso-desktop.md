# ADR-0037 · Informes individuales y consulta desde Ubuntu Desktop

- Estado: **aceptada** · 2026-10-27 · T213
- Amplía ADR-0031; conserva su transporte, privacidad, validación y formato.

## Decisión

El conjunto de claves de `reports` selecciona los destinatarios de `deliver`.
Solo se conectará a esos alumnos y solo ellos aparecerán en la respuesta.
El documento ya exige un conjunto no vacío de identificadores de esta
corrección, no excluidos. Enviar todos mantiene el comportamiento existente.
No se añade otro subcomando, bandera, servicio ni dependencia.

La fila y el envío general comparten bloqueo durante la entrega y registro
local de los destinatarios confirmados por el motor para cada corrección.
El registro contiene identificadores, sin notas, HTML ni contraseñas, y
conserva las últimas 100 correcciones. Se muestra como enviado para esa
corrección; otra corrección permite un nuevo envío. Reenviar los ya enviados
se hace mediante el envío general con confirmación explícita. Un reintento
tras entrega parcial selecciona únicamente los destinatarios fallidos.

El HTML es autónomo y conserva su diseño al copiarlo. El acceso preferido
es **Archivos → Otras ubicaciones → SFTP**, con la cuenta SSH propia del
alumno; copia el HTML a Descargas y lo abre con Firefox en Ubuntu Desktop.
La guía conserva SCP como alternativa. No se publican informes ni se abre un
servidor HTTP, puertos o enlaces compartidos. No se instala nada en Server.

## Privacidad y límites

Cada entrega conserva la comprobación del PLAN y de la identidad SSH de la
corrección. El archivo sigue siendo privado (`0600`, ADR-0033), del usuario
SSH y contiene solo el informe de ese alumno. El acceso posterior exige las
credenciales existentes de esa cuenta. Quien tenga credenciales de otra
máquina o privilegios de administración puede leer sus archivos: no se
promete aislamiento adicional al de SSH. Para impedirlo entre alumnos, sus
cuentas o máquinas deben tener credenciales de acceso propias; una contraseña
común conocida por toda la clase no proporciona ese aislamiento.

No se introduce una conexión SFTP en el motor: la realiza el gestor de
archivos de Ubuntu Desktop sobre el servidor SSH existente. Copiar no altera
el HTML, su formato ni la nota; la entrega original sigue disponible.
