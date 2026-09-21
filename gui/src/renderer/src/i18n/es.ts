// Every string the teacher reads, in one place. The application is used in
// Spanish in the classroom; interface text is not scattered across the views.
export const t = {
  app: {
    name: 'Heimdall',
    tagline: 'Evaluación de prácticas por SSH'
  },
  nav: {
    home: 'Inicio',
    classes: 'Clases',
    exams: 'Exámenes',
    results: 'Resultados',
    analytics: 'Analíticas',
    history: 'Histórico',
    settings: 'Ajustes',
    help: 'Ayuda',
    // A section that is not built yet stays in sight, disabled: the menu is
    // the same one in every version and no entry appears out of nowhere.
    soon: (label: string) => `«${label}» todavía no está. Llega en una versión próxima.`,
    soonBadge: 'pronto'
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
    retryTitle: 'Reintento preparado',
    retryBody: (checks: number, students: number) =>
      `Se van a repetir ${checks} comprobaciones de ${students} alumnos. El resto de la clase no se toca.`,
    retryStart: 'Repetir lo que falta',
    retryCancel: 'Cancelar el reintento',
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
  results: {
    title: 'Resultados',
    empty: 'Aquí aparecerán las notas en cuanto termine una corrección.',
    plan: (students: number, checks: number, weight: number) =>
      `${students} alumnos · ${checks} comprobaciones · ${weight} de peso total`,
    warnings: 'Avisos de la ejecución',
    filterText: 'Buscar alumno o comprobación…',
    filterAll: 'Todo',
    filterCause: 'Causa técnica',
    noMatches: 'Ningún resultado con esos filtros.',
    clear: 'Quitar filtros',
    provisional: 'provisional',
    noGrade: 'sin nota',
    checkTitle: 'La comprobación',
    weight: 'Peso',
    command: 'Comando ejecutado',
    assertion: 'Qué se esperaba',
    expected: 'Esperado',
    found: 'Encontrado',
    where: 'Dónde',
    notFound: 'no se encontró',
    exit: 'Código de salida',
    duration: 'Duración',
    attempts: 'Intentos',
    machine: 'Máquina',
    stdout: 'Salida',
    stderr: 'Errores',
    emptyStream: 'sin salida',
    noExecution: 'El comando no llegó a ejecutarse.',
    noAssertion: 'No hubo ejecución completa que comparar.',
    pick: 'Elige una comprobación de la matriz para verla en detalle.',
    previous: 'El intento anterior',
    // Cabecera de clase: los tres números que se leen antes que nada.
    kpiPassed: 'Aprobados',
    kpiPassedHint: (graded: number, students: number) =>
      `${graded} de ${students} alumnos con nota final`,
    kpiAverage: 'Nota media',
    kpiAverageHint: (mark: number) => `Aprobado a partir de ${mark} sobre 100`,
    kpiAttention: 'Requieren atención',
    kpiAttentionHint: 'Avería técnica primero, después quien va por debajo',
    kpiNoGrades: 'Todavía sin ninguna nota final',
    modeList: 'Lista',
    modeMatrix: 'Matriz',
    // Lista densa: una fila por alumno.
    colStudent: 'Alumno',
    colPassed: 'Superadas',
    colScore: 'Nota',
    colState: 'Estado',
    passedOf: (pass: number, total: number) => `${pass}/${total}`,
    openDetail: 'Ver sus comprobaciones',
    closeDetail: 'Cerrar',
    // Matriz.
    matrixCheck: 'Comprobación',
    matrixScore: 'Nota',
    matrixWeight: (weight: number) => `×${weight}`,
    legendPass: 'superada',
    legendFail: 'fallada',
    legendUnevaluated: 'sin evaluar',
    legendMissing: 'sin dato'
  },
  export: {
    button: 'Exportar notas…',
    title: '¿Exportar las notas?',
    yes: 'Guardar el fichero',
    hint:
      'Se guarda una hoja con el nombre de cada alumno, su identificador de Moodle si el aula lo trae, y su nota. Quien no tenga nota final sale sin nota y con el motivo. No sale nada de lo que escribieron las máquinas.',
    scale: (label: string) => `Escala: ${label}. Se cambia en Ajustes.`,
    saved: (path: string) => `Notas guardadas en ${path}`,
    cancelled: 'No se ha guardado nada.',
    failed: 'No se pudieron guardar las notas'
  },
  chain: {
    title: 'La nota de toda la cadena',
    hint:
      'Esta corrección repite otra anterior. Leyéndolas juntas, quien completó lo que faltaba en una segunda vuelta tiene ya su nota final. No se toca ni se reescribe ninguna corrección: es una lectura, y la nota la cierra el motor.',
    show: 'Ver la nota de toda la cadena',
    reload: 'Volver a leer la cadena',
    loading: 'Leyendo las correcciones anteriores…',
    failed: 'No se pudo leer la cadena',
    refused: (why: string) =>
      `Estas correcciones no se pueden leer juntas, así que no se enseña ninguna nota de la cadena: ${why}`,
    closed: (closed: number, open: number) =>
      `${closed} alumnos con nota final · ${open} todavía sin nota`,
    attempts: 'Antes de eso',
    noEvidence:
      'La ejecución y la salida de la máquina están en la corrección de la que sale este resultado; se abre desde el Histórico.',
    export: 'Exportar las notas de la cadena…',
    exportTitle: '¿Exportar las notas de la cadena?',
    exportHint:
      'Se guarda una hoja igual que la de una corrección suelta, con la nota que el motor cierra leyendo todas juntas. Quien siga sin nota final sale sin nota y con el motivo.'
  },
  pending: {
    title: 'Qué ha quedado sin comprobar',
    hint:
      'Quedaron comprobaciones sin evaluar. Mientras falte alguna con peso, ese alumno no tiene nota final. Puedes dejarlo así y resolverlo más tarde, o repetir solo lo que no se pudo comprobar.',
    checks: (missing: number, total: number) => `${missing} de ${total} comprobaciones sin evaluar`,
    weight: (missing: number, total: number) => `${missing} de ${total} de peso sin evaluar`,
    leave: 'Dejarlo pendiente',
    left: 'Queda pendiente. La corrección no se ha tocado.',
    retry: (checks: number, students: number) =>
      `Repetir lo que falta (${checks} comprobaciones de ${students} alumnos)`,
    confirmTitle: '¿Repetir lo que no se pudo comprobar?',
    confirmBody:
      'Se repiten solo las comprobaciones sin evaluar. Lo que salió bien y lo que salió mal no se vuelve a intentar, y esta corrección se conserva tal cual: el reintento se guarda aparte.',
    confirmYes: 'Repetir'
  },
  history: {
    title: 'Histórico',
    hint: 'Las correcciones guardadas de este examen. Abrir una no toca ninguna máquina.',
    needExam: 'Elige un examen en Inicio y aquí aparecerán sus correcciones anteriores.',
    empty: 'Este examen todavía no tiene ninguna corrección guardada.',
    refresh: 'Actualizar',
    openOther: 'Abrir otro resultado…',
    open: 'Abrir',
    busy: 'Hay una corrección en marcha; se puede mirar el histórico cuando termine.',
    loading: 'Buscando correcciones…',
    unreadable: 'No se puede abrir',
    // The same four states as a run, in the two or three words a row has room
    // for. The whole sentence is on Resultados, where there is space for it.
    status: {
      COMPLETE: 'Clase entera',
      PARTIAL: 'Con alumnos sin evaluar',
      CANCELLED: 'Detenida',
      INVALID_CONFIG: 'Configuración no válida'
    },
    retryOf: (runId: string) => `Reintento de la corrección ${runId}`,
    counts: (students: number, checks: number) =>
      `${students} alumnos · ${checks} comprobaciones`,
    capped: (max: number) =>
      `Se muestran las ${max} correcciones más recientes. Las anteriores siguen en la carpeta y se pueden abrir a mano.`
  },
  settings: {
    title: 'Ajustes',
    engineSection: 'Motor de corrección',
    scaleSection: 'Escala de las notas',
    scaleHint:
      'Con qué escala se escriben las notas al exportarlas. La corrección guardada no cambia: el motor siempre calcula sobre 100 y la conversión es solo para la hoja que te llevas.',
    scaleExample: (example: string) => `Un 87 sobre 100 se exporta como ${example}.`,
    passSection: 'Marca de aprobado',
    passHint:
      'Desde qué nota, sobre las 100 que publica el motor, se cuenta a un alumno como aprobado. Solo afecta a lo que resume la pantalla: ninguna nota cambia.',
    passLabel: 'Aprobado a partir de',
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
  projector: {
    on: 'Modo proyector',
    off: 'Salir del proyector',
    hintOn: 'Las direcciones de las máquinas están tapadas.',
    hintOff: 'Tapa las direcciones de las máquinas y agranda la letra.',
    masked: 'máquina tapada'
  },
  exam: {
    title: 'Modo examen',
    hint:
      'Corrige la clase una y otra vez mientras dura la práctica. Nunca hay dos correcciones a la vez: cada vuelta empieza cuando termina la anterior.',
    start: 'Empezar el examen',
    stop: 'Terminar el examen',
    everyMinutes: (minutes: number) => `Cada ${minutes} min`,
    running: (passes: number, minutes: number) =>
      `${passes === 1 ? '1 vuelta' : `${passes} vueltas`}, cada ${minutes} min.`,
    correcting: 'Corrigiendo ahora.',
    nextIn: (seconds: number) =>
      seconds >= 60
        ? `Siguiente vuelta en ${Math.ceil(seconds / 60)} min.`
        : `Siguiente vuelta en ${seconds} s.`
  },
  session: {
    title: 'La nota del examen',
    hint:
      'Cada alumno se queda con su mejor vuelta entera. Una vuelta que no llegó a evaluarlo del todo no le baja la nota, y quien ya lo tiene todo bien deja de ser corregido. La nota la cierra el motor leyendo las vueltas; aquí solo se enseña.',
    loading: 'Leyendo las vueltas del examen…',
    reload: 'Volver a leer las vueltas',
    refused: (why: string) =>
      `Estas vueltas no se pueden leer como una sesión, así que no se enseña ninguna nota: ${why}`,
    tally: (graded: number, finished: number, open: number) =>
      `${graded} alumnos con nota · ${finished} han terminado · ${open} todavía sin nota`,
    rounds: 'Lo que dijo cada vuelta',
    export: 'Exportar las notas del examen…',
    exportTitle: '¿Exportar las notas del examen?',
    exportHint:
      'Se guarda la nota con la que se queda cada alumno y de qué vuelta sale. Quien no tenga ninguna vuelta entera sale sin nota y con el motivo.'
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
