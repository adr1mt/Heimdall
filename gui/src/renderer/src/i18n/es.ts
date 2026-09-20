// Every string the teacher reads, in one place. The application is used in
// Spanish in the classroom; interface text is not scattered across the views.
export const t = {
  app: {
    name: 'Heimdall',
    tagline: 'Evaluación de prácticas por SSH'
  },
  nav: {
    home: 'Inicio',
    settings: 'Ajustes',
    help: 'Ayuda'
  },
  engine: {
    ready: 'Motor listo',
    missing: 'Motor no encontrado',
    checking: 'Buscando el motor…',
    path: 'Ruta del motor',
    pathHint:
      'Programa que hace la corrección. Si está en el PATH del sistema basta con su nombre.',
    locate: 'Buscar…',
    save: 'Guardar y comprobar',
    saved: 'Ruta guardada.'
  },
  home: {
    title: 'Inicio',
    exam: 'Examen',
    examHint: 'Qué se comprueba en cada máquina y cuánto pesa cada comprobación.',
    classroom: 'Aula',
    classHint: 'Quién es cada alumno y cómo se llega a su máquina.',
    choose: 'Elegir…',
    none: 'Sin elegir',
    sameFolder: 'El examen tiene que llamarse «examen.yaml» y el aula estar en su misma carpeta.'
  },
  credentials: {
    title: 'Credenciales',
    hint:
      'El aula solo nombra las contraseñas; los valores los pones aquí y no se guardan en ningún sitio.',
    none: 'Este aula no pide ninguna contraseña.',
    placeholder: 'Contraseña'
  },
  run: {
    start: 'Corregir',
    again: 'Corregir otra vez',
    cancel: 'Detener',
    cancelling: 'Deteniendo…',
    confirmTitle: '¿Detener la corrección?',
    confirmBody:
      'Se guardará lo corregido hasta ahora. Lo que quede sin comprobar aparecerá sin evaluar, no suspenso.',
    confirmYes: 'Detener',
    starting: 'Arrancando el motor…',
    progress: (done: number, total: number) => `${done} de ${total} comprobaciones`,
    needEngine: 'Primero hay que indicar dónde está el motor, en Ajustes.',
    needFiles: 'Elige el examen y el aula.',
    needSecrets: 'Faltan contraseñas por escribir.',
    classTitle: 'La clase',
    excluded: 'Excluido',
    waiting: 'En espera',
    inProgress: 'Corrigiendo',
    artifact: 'Resultado guardado en',
    resultsPending: 'Las notas, alumno a alumno, llegan con la siguiente entrega.',
    status: {
      COMPLETE: 'Corregida la clase entera.',
      PARTIAL: 'Corrección terminada con alumnos sin evaluar del todo.',
      CANCELLED: 'Corrección detenida; queda guardado lo hecho hasta ahora.',
      INVALID_CONFIG: 'La configuración no es válida; no se ha tocado ninguna máquina.'
    },
    student: {
      OK: 'Evaluado',
      PARTIAL: 'Parcial',
      NOT_EVALUATED: 'Sin evaluar',
      EXCLUDED: 'Excluido'
    },
    counts: (pass: number, fail: number, unevaluated: number) =>
      `${pass} bien · ${fail} mal · ${unevaluated} sin evaluar`
  },
  settings: {
    title: 'Ajustes',
    engineSection: 'Motor de corrección',
    aboutSection: 'Acerca de',
    about:
      'Heimdall corrige prácticas de sistemas y redes conectándose por SSH a las máquinas del alumnado.',
    author: 'Adrià Muñoz · Institut El Puig'
  },
  help: {
    title: 'Ayuda',
    whatSection: 'Qué hace Heimdall',
    what:
      'Se conecta a la máquina de cada alumno, ejecuta las comprobaciones del examen y calcula la nota con los pesos que fija el examen. Todos los alumnos reciben las mismas comprobaciones y los mismos pesos.',
    errorsSection: 'Cuando algo falla',
    errors:
      'Un problema técnico —máquina apagada, red caída, credenciales que no valen— nunca se convierte en un suspenso: esa comprobación queda sin evaluar y se dice por qué.',
    filesSection: 'Los dos ficheros',
    files:
      'El examen dice qué se comprueba. El aula dice a quién se comprueba. Las contraseñas no se escriben en el aula: solo va una referencia al nombre de la variable que las lleva.'
  },
  theme: {
    toLight: 'Tema claro',
    toDark: 'Tema oscuro'
  },
  errors: {
    viewTitle: 'Esta vista no se pudo mostrar',
    appTitle: 'La aplicación no se pudo mostrar',
    retry: 'Reintentar',
    backHome: 'Volver a Inicio',
    dismiss: 'Cerrar aviso'
  }
} as const
