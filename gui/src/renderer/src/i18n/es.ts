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
    pending:
      'Corregir desde aquí llega con la siguiente entrega. Hoy la aplicación comprueba que el motor está instalado y recuerda los dos ficheros con los que vas a trabajar.'
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
