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
    correct: 'Corregir',
    results: 'Resultados',
    analytics: 'Analíticas',
    history: 'Histórico',
    settings: 'Ajustes',
    help: 'Ayuda',
    // A section that is not built yet stays in sight, disabled: the menu is
    // the same one in every version and no entry appears out of nowhere.
    soon: (label: string) => `«${label}» todavía no está. Llega en una versión próxima.`,
    soonBadge: 'pronto',
    // Una sección que es de un examen concreto no se puede abrir sin examen:
    // no hay nada que corregir, ni resultados, ni histórico.
    needProject: (label: string) => `«${label}» es de un examen. Abre uno en Inicio.`
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
  // Inicio es la lista de proyectos: abrir, crear y los de siempre. Un
  // proyecto es una carpeta con su examen dentro; el profesor no elige
  // ficheros y no ve rutas.
  home: {
    title: 'Inicio',
    subtitle: 'Un proyecto es una carpeta con su examen dentro.',
    recent: 'Tus exámenes',
    open: 'Abrir…',
    create: 'Nuevo…',
    noRecent: 'Todavía no has abierto ningún examen. Abre una carpeta o crea uno nuevo.',
    removeRecent: 'Quitar de la lista',
    removeHint: 'Solo se quita de esta lista. La carpeta y sus notas no se tocan.',
    opening: 'Abriendo…',
    missing: 'No se pudo abrir',
    // El nombre es lo que el profesor escribió en el examen. Lo lee Corregir,
    // que enseña el examen abierto.
    unnamed: 'Sin nombre en el fichero',
    examMeta: (checks: number) =>
      checks === 1 ? '1 comprobación' : `${checks} comprobaciones`,
    inProgress: 'Hay una corrección en marcha',
    inProgressBody:
      'Si abres otro examen ahora se detendrá la corrección de la clase actual y el modo examen. Las notas ya guardadas se conservan.',
    inProgressConfirm: 'Abrir de todas formas'
  },

  // Corregir: el examen ya abierto, la clase elegida y el botón. Es la
  // pantalla que se usa con la clase delante.
  correct: {
    title: 'Corregir',
    hint: 'El examen abierto se corrige con la clase que elijas. No hace falta ningún fichero más.',
    exam: 'Examen',
    examNone: 'No hay ningún examen abierto.',
    goHome: 'Abrir un examen',
    classroom: 'Clase',
    classNone: 'Sin clase elegida',
    classPick: 'Elegir clase…',
    classGone: 'La clase elegida ya no existe.',
    classEmpty: 'Todavía no hay ninguna clase. Se crean en «Clases».',
    goToClasses: 'Ir a Clases',
    action: 'Acción'
  },
  // Exámenes: el editor. Una comprobación se escribe en un formulario, nunca
  // en un editor de texto; la vista YAML es el mismo examen, para quien lo
  // prefiera. Quien decide si el examen vale es el motor.
  editor: {
    title: 'Exámenes',
    hint: 'Lo que se comprueba en cada máquina y cuánto pesa cada comprobación.',
    examName: 'Nombre del examen',
    hosts: 'Máquinas del examen',
    hostsHint: 'Los nombres que usa el examen: host1, host2. La dirección de cada alumno sale de la clase.',
    defaults: 'Por defecto',
    defaultWeight: 'Peso',
    defaultTimeout: 'Tiempo máximo',
    summary: (checks: number, weight: number) =>
      `${checks === 1 ? '1 comprobación' : `${checks} comprobaciones`} · ${weight} de peso total`,
    groups: 'Grupos de comprobaciones',
    addGroup: 'Añadir grupo',
    groupName: 'Nombre del grupo',
    groupPlaceholder: 'Red y DHCP',
    removeGroup: (name: string) => `Quitar el grupo «${name}»`,
    removeGroupTitle: (name: string) => `¿Quitar el grupo «${name}»?`,
    removeGroupBody: 'Se quitan también sus comprobaciones. Las correcciones ya guardadas no se tocan.',
    noGroups: 'Este examen todavía no tiene ninguna comprobación.',
    addCheck: 'Añadir comprobación',
    removeCheck: 'Quitar esta comprobación',
    editCheck: 'Editar',
    newCheck: 'Comprobación nueva',
    checkId: 'Identificador',
    checkIdHint: 'Lo que compara dos correcciones del mismo examen. No se cambia a mitad de curso.',
    checkDescription: 'Qué se comprueba',
    checkDescriptionPlaceholder: 'El servicio kea-dhcp4 está activo',
    where: 'Dónde',
    onHost: 'En una máquina, con un comando',
    onValue: 'Sobre un dato del alumno, sin comando',
    host: 'Máquina',
    command: 'Comando',
    commandHint:
      'El comando y sus argumentos, separados por espacios. No hay intérprete: un ; o un | son un argumento más. Entre comillas lo que lleve espacios.',
    commandPlaceholder: 'systemctl is-active kea-dhcp4-server',
    value: 'Dato del alumno',
    valueHint: 'De la clase, por ejemplo ${alumno.p1}.',
    assertion: 'Qué se espera',
    expected: 'Valor esperado',
    anchor: 'Línea de anclaje',
    lines: 'Líneas después',
    weight: 'Peso',
    weightHint: 'Vacío es el peso por defecto del examen.',
    timeout: 'Tiempo máximo',
    timeoutHint: 'Vacío es el del examen. Se escribe 20s, 2m o 1h.',
    yamlView: 'Ver el YAML',
    formView: 'Volver al formulario',
    yamlHint: 'El mismo examen, en el fichero que lee el motor. Lo que cambies aquí vuelve al formulario.',
    yamlBroken: 'Este YAML no se puede leer, así que el formulario se queda como estaba:',
    save: 'Guardar el examen',
    saved: 'Examen guardado.',
    checking: 'Comprobando con el motor…',
    valid: 'El motor acepta el examen.',
    invalid: 'El motor no acepta el examen',
    needClass:
      'Elige una clase en «Corregir» antes de guardar: media validación de un examen es sobre la clase con la que se corrige.',
    readFailed: 'No se pudo leer el examen',
    saveFailed: 'No se pudo guardar el examen',
    assertionName: {
      contiene: 'La salida contiene',
      igual_a: 'La salida es exactamente',
      no_contiene: 'La salida NO contiene',
      exit_code: 'El comando termina con el código',
      cerca_de: 'Cerca de una línea, aparece'
    }
  },
  // Analíticas: a quién atender primero y qué está fallando al grupo entero.
  // No calcula ninguna nota: cuenta sobre las que publicó el motor.
  analytics: {
    title: 'Analíticas',
    hint: 'De la corrección que tienes abierta en Resultados. Ninguna nota se recalcula aquí.',
    none: 'Todavía no hay ninguna corrección abierta.',
    noneHint: 'Corrige una clase, o abre una corrección del histórico.',
    distribution: 'Cómo va el grupo',
    band: (from: number, to: number) => `${from}–${to === 101 ? 100 : to - 1}`,
    ungraded: (students: number) =>
      students === 1 ? '1 alumno sin nota' : `${students} alumnos sin nota`,
    ungradedHint: 'Su máquina no respondió a todo. No cuentan como un cero.',
    attention: 'A quién atender primero',
    attentionNone: 'Nadie necesita que vayas: todos aprueban y ninguna máquina ha fallado.',
    broken: 'Problema técnico',
    failing: 'Va por debajo',
    unevaluated: (checks: number) =>
      checks === 1 ? '1 comprobación sin hacer' : `${checks} comprobaciones sin hacer`,
    noScore: 'Sin nota',
    failingChecks: 'Qué se le está atragantando al grupo',
    failingNone: 'Ninguna comprobación se le ha atragantado al grupo.',
    failedBy: (failed: number, evaluated: number) => `La fallan ${failed} de ${evaluated}`,
    couldNot: (students: number) =>
      students === 1
        ? 'No se pudo comprobar en 1 alumno'
        : `No se pudo comprobar en ${students} alumnos`
  },
  classes: {
    title: 'Clases',
    hint: 'Los grupos del curso. Se apuntan una vez y se reutilizan en cada examen.',
    empty: 'Todavía no hay ninguna clase.',
    emptyHint: 'Crea la primera con los alumnos del grupo: identificador, nombre, contacto, máquina y usuario.',
    create: 'Nueva clase',
    newName: 'Clase sin nombre',
    edit: 'Editar',
    duplicate: 'Duplicar',
    remove: 'Eliminar',
    save: 'Guardar',
    cancel: 'Cancelar',
    saved: 'Clase guardada.',
    removed: (name: string) => `Se ha eliminado «${name}».`,
    removeTitle: (name: string) => `¿Eliminar «${name}»?`,
    removeBody:
      'Se borra la lista de alumnos de esta clase. Las correcciones ya guardadas y sus notas no se tocan.',
    nameLabel: 'Nombre de la clase',
    namePlaceholder: '2SMX A',
    students: 'Alumnos',
    addStudent: 'Añadir alumno',
    removeStudent: 'Quitar este alumno',
    count: (students: number) => (students === 1 ? '1 alumno' : `${students} alumnos`),
    // Nunca una contraseña: aquí se guarda a quién se conecta, no con qué.
    noPasswords: 'Aquí no se guarda ninguna contraseña: se teclean al corregir y no se escriben en ningún sitio.',
    col: {
      id: 'Identificador',
      name: 'Nombre y apellidos',
      contact: 'Correo o Moodle',
      host: 'Máquina',
      port: 'Puerto',
      user: 'Usuario'
    },
    portHint: 'Vacío es el puerto de siempre, el 22.',
    // Columnas propias: lo que el examen pide y no es la máquina.
    addColumn: 'Añadir columna',
    columnName: 'Nombre de la columna',
    columnPlaceholder: 'subdominio',
    columnHint:
      'Para lo que el examen pida de cada alumno y no sea su máquina: un subdominio, un puerto asignado. En el examen se escribe ${alumno.NOMBRE}.',
    removeColumn: (name: string) => `Quitar la columna «${name}»`,
    removeColumnTitle: (name: string) => `¿Quitar la columna «${name}»?`,
    removeColumnBody: 'Se borra lo que cada alumno tuviera en ella.',
    columnAdd: 'Añadir',
    // Pegar desde una hoja de cálculo: la lista ya existe en el registro o en
    // Moodle, así que se pega y se enseña antes de guardar nada.
    paste: 'Pegar alumnos',
    pasteTitle: 'Pegar desde una hoja de cálculo',
    pasteHint:
      'Copia las filas del grupo y pégalas aquí. El orden de las columnas es el de la tabla: identificador, nombre, correo, máquina, puerto y usuario. Si pegas la fila de títulos, se leen por su nombre.',
    pastePlaceholder: 'alu1\tAlumna Uno\talu1@instituto\t10.0.0.1\t\talumno',
    pasteLabel: 'Filas pegadas',
    pastePreview: 'Esto es lo que se va a añadir',
    pasteNothing: 'Todavía no has pegado nada.',
    pasteNoneUsable: 'Ninguna fila está completa. No se añade nada.',
    pasteAdd: (students: number) =>
      students === 1 ? 'Añadir 1 alumno' : `Añadir ${students} alumnos`,
    pasteIncomplete: (rows: number) =>
      rows === 1
        ? '1 fila está incompleta y no se añadirá.'
        : `${rows} filas están incompletas y no se añadirán.`,
    pasteDuplicates: (rows: number) =>
      rows === 1
        ? '1 fila repite un identificador que ya está y no se añadirá.'
        : `${rows} filas repiten identificadores que ya están y no se añadirán.`,
    pasteNewColumns: (columns: string[]) =>
      `Se añadirán como columnas propias: ${columns.join(', ')}.`,
    pasteMissing: (missing: string[]) => `Falta: ${missing.join(', ')}.`,
    pasteAdded: (students: number) =>
      students === 1 ? 'Se ha añadido 1 alumno.' : `Se han añadido ${students} alumnos.`,
    loadFailed: 'No se pudieron leer las clases',
    saveFailed: 'No se pudo guardar la clase',
    blocked: 'Mientras el fichero de clases no se pueda leer, no se guarda nada.'
  },
  credentials: {
    title: 'Credenciales',
    hint:
      'Se nombran las contraseñas, nunca se guardan: el valor lo pones aquí y no se escribe en ningún sitio.',
    none: 'Esta clase no pide ninguna contraseña.',
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
    needExam: 'Abre un examen en Inicio.',
    needClass: 'Elige la clase que vas a corregir.',
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
    // Plegado: lo técnico se anuncia en un renglón y se abre a voluntad.
    warningsFolded: (count: number) =>
      count === 1 ? '1 aviso técnico' : `${count} avisos técnicos`,
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
      'Se guarda una hoja con el nombre de cada alumno, su identificador de Moodle si la clase lo trae, y su nota. Quien no tenga nota final sale sin nota y con el motivo. No sale nada de lo que escribieron las máquinas.',
    scale: (label: string) => `Escala: ${label}. Se cambia en Ajustes.`,
    saved: (path: string) => `Notas guardadas en ${path}`,
    cancelled: 'No se ha guardado nada.',
    failed: 'No se pudieron guardar las notas'
  },
  chain: {
    title: 'La nota de toda la cadena',
    folded: 'Esta corrección repite otra anterior',
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
    folded: (students: number) =>
      students === 1
        ? '1 alumno con algo sin comprobar'
        : `${students} alumnos con algo sin comprobar`,
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
  // Las copias de seguridad de las notas. Viven fuera de la carpeta del
  // examen, así que borrar esa carpeta no se lleva las notas por delante.
  backups: {
    title: 'Copias de seguridad',
    hint:
      'Después de cada corrección, Heimdall guarda las notas fuera de la carpeta del examen. La copia lleva la nota de cada alumno; no lleva la salida de las máquinas ni ninguna contraseña.',
    empty: 'Todavía no hay ninguna copia. Se hace sola al terminar la primera corrección.',
    loading: 'Buscando copias…',
    restore: 'Restaurar las notas',
    restoring: 'Restaurando…',
    onDisk: 'Ya está en la carpeta',
    missing: 'Solo queda la copia',
    counts: (students: number) => `${students} alumnos`,
    // Restaurar solo puede añadir correcciones: la que ya está en la carpeta
    // se queda como está, con su detalle entero.
    done: (restored: number, kept: number) =>
      restored === 0
        ? `No hacía falta restaurar nada: las ${kept} correcciones ya estaban en la carpeta.`
        : `Se han recuperado ${restored} correcciones. ${kept === 0 ? 'Ninguna nota guardada se ha tocado.' : `Las otras ${kept} ya estaban y no se han tocado.`}`,
    capped: (max: number) => `Se guardan las ${max} correcciones más recientes.`
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
    filesSection: 'El examen y la clase',
    files:
      'El examen dice qué se comprueba. La clase dice a quién: quién es cada alumno y cómo se llega a su máquina. Las contraseñas no se guardan en ninguno de los dos; se teclean al corregir.'
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
    // Lo que se mira mientras dura el examen, en cinco datos y sin desplegar
    // nada: en qué vuelta va, cuánto falta para la siguiente, quién sigue
    // dentro, quién ha terminado y por dónde va la vuelta de ahora.
    roundLabel: 'Vuelta',
    nextLabel: 'Siguiente',
    activeLabel: 'Activos',
    finishedLabel: 'Finalizados',
    progressLabel: 'Progreso',
    nowCorrecting: 'ahora',
    ofMinutes: (minutes: number) => `cada ${minutes} min`
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
