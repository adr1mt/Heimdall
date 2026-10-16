import type { ReactNode } from 'react'
import { ViewHeader } from '@/components/ui'

const sections = [
  ['inicio', 'Flujo rápido'],
  ['proyectos', 'Proyectos'],
  ['yaml', 'Editor YAML'],
  ['clases', 'Clases y alumnos'],
  ['conexion', 'Usuario y contraseña'],
  ['corregir', 'Corregir'],
  ['examen', 'Modo examen'],
  ['resultados', 'Resultados'],
  ['analiticas', 'Analíticas'],
  ['historico', 'Histórico y copias'],
  ['notas', 'Escala de notas'],
  ['moodle', 'Exportar a Moodle'],
  ['problemas', 'Problemas frecuentes']
] as const
const example = `examen: "Servicios de red"
version: 1
hosts: [host1]
por_defecto: { peso: 1, timeout: 20s }
grupos:
  - grupo: "DNS"
    comprobaciones:
      - id: dns-activo
        descripcion: "El servicio DNS está activo"
        en: host1
        peso: 2
        cmd: ["systemctl", "is-active", "named"]
        igual_a: "active"`

export default function HelpView() {
  return (
    <div className="flex h-full flex-col">
      <ViewHeader title="Manual de ayuda" />
      <div className="flex min-h-0 flex-1">
        <nav
          aria-label="Índice de ayuda"
          className="w-48 shrink-0 space-y-1 overflow-auto border-r border-border p-3"
        >
          {sections.map(([id, title]) => (
            <a
              key={id}
              href={`#help-${id}`}
              onClick={(event) => {
                event.preventDefault()
                document.getElementById(`help-${id}`)?.scrollIntoView({ block: 'start' })
              }}
              className="block rounded px-2 py-2 text-xs text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {title}
            </a>
          ))}
        </nav>
        <div className="min-w-0 flex-1 space-y-8 overflow-auto p-6">
          <div className="max-w-3xl">
            <h2 className="mb-2 text-xl font-semibold">Preparar, corregir y consultar las notas</h2>
            <p className="text-sm text-muted-foreground">
              Heimdall comprueba las máquinas del alumnado por SSH. El examen define qué se
              comprueba; la clase contiene los alumnos y sus direcciones.
            </p>
          </div>
          <Block id="inicio" title="Flujo rápido">
            <ol className="list-decimal space-y-2 pl-5">
              <li>
                Abre la carpeta del examen en <strong>Inicio</strong>, o crea una nueva.
              </li>
              <li>
                Prepara los alumnos en <strong>Clases</strong> y elige la clase en{' '}
                <strong>Corregir</strong>.
              </li>
              <li>
                En <strong>El examen</strong>, pega o edita el YAML. Valida y guarda.
              </li>
              <li>
                Vuelve a <strong>Corregir</strong>, comprueba examen y clase y pulsa
                Corregir.
              </li>
              <li>
                Consulta <strong>Resultados</strong> en lista o matriz y exporta las notas.
              </li>
            </ol>
          </Block>
          <Block id="proyectos" title="Proyectos">
            <p>
              Un proyecto es una carpeta con un fichero <code>examen.yaml</code>. Puedes abrir una
              carpeta existente o crear una nueva con un examen inicial. Las correcciones quedan en
              la carpeta del proyecto y se consultan desde Histórico.
            </p>
            <p>
              La clase se guarda aparte y se reutiliza con distintos exámenes. No hace falta
              preparar a mano el fichero de aula: Heimdall lo genera al corregir.
            </p>
          </Block>
          <Block id="yaml" title="Editor YAML">
            <p>
              Puedes escribir el examen o pegarlo completo, también si lo has preparado con ayuda de
              IA. Revisa siempre los comandos y las expectativas antes de corregir. El editor tiene
              colores, números de línea, búsqueda (Ctrl+F), deshacer (Ctrl+Z) y guardar (Ctrl+S).
            </p>
            <p>
              Los <strong>grupos</strong> organizan las comprobaciones. Cada comprobación tiene un
              identificador único y un <strong>peso</strong>; puedes fijar un peso común y cambiarlo
              en las que lo necesiten. Guarda el identificador estable cuando reintentes una
              corrección.
            </p>
            <pre className="overflow-x-auto rounded-md border border-border bg-secondary/40 p-4 font-mono text-xs leading-relaxed">
              {example}
            </pre>
            <p>
              El ejemplo supone que el servicio de DNS se llama <code>named</code>. Adáptalo al
              sistema de tu aula. Los comandos son listas de argumentos: no admiten tuberías ni
              operadores de shell. Usa espacios para indentar, no tabuladores.
            </p>
            <p>
              <strong>Validar</strong> comprueba el examen con la clase elegida.{' '}
              <strong>Guardar</strong> lo valida antes de escribirlo. Si hay un error, se muestra el
              motivo y se conserva el fichero anterior. Los comentarios y el texto se guardan tal
              como los escribes. Al salir con cambios sin guardar, la aplicación te avisa.
            </p>
          </Block>
          <Block id="clases" title="Clases y alumnos">
            <p>
              Crea un grupo y añade el identificador, nombre, correo o ID de Moodle y dirección de
              cada alumno. El identificador debe ser único en la clase. Puedes pegar una lista desde
              una hoja de cálculo; la vista previa indica las filas incompletas antes de añadirlas.
            </p>
            <p>
              El puerto SSH habitual es <strong>22</strong>. Activa «Puertos SSH» solo si necesitas
              otro; los puertos personalizados existentes se muestran al editar. Las columnas
              adicionales sirven para datos del examen, como el subdominio de cada alumno. En YAML
              se usan con <code>{'${alumno.subdominio}'}</code>.
            </p>
          </Block>
          <Block id="conexion" title="Usuario y contraseña">
            <p>
              En la clase puedes escribir un usuario común y pulsar «Aplicar a todos». Si alguna
              máquina usa otro usuario, activa «Usuario por alumno». Los cambios se guardan al
              guardar la clase.
            </p>
            <p>
              La contraseña de las máquinas se escribe en la clase, junto al usuario común, y se
              guarda tal cual. Corregir la usa sin preguntar. No se escribe en el YAML del examen
              ni en los resultados.
            </p>
          </Block>
          <Block id="corregir" title="Corregir">
            <p>
              Comprueba el examen, la clase y la lista de alumnos antes de pulsar Corregir. La barra
              muestra el progreso. Puedes cambiar de sección mientras trabaja: la corrección
              continúa. Detener pide confirmación y conserva lo que se haya podido evaluar.
            </p>
          </Block>
          <Block id="examen" title="Modo examen">
            <p>
              El recuadro de modo examen permite reevaluar toda la clase automáticamente. Elige un
              intervalo y pulsa «Iniciar modo examen». El intervalo se cuenta desde el final de cada
              pasada; las correcciones no se solapan. El mínimo es cinco minutos.
            </p>
            <p>
              La sesión conserva la mejor nota completa de cada alumno. Una ronda incompleta
              posterior no convierte esa nota en cero. Si no existe ninguna ronda completa, la nota
              sigue siendo provisional. «Detener modo examen» detiene las siguientes rondas; para
              detener una corrección en curso usa también Detener.
            </p>
          </Block>
          <Block id="resultados" title="Resultados">
            <p>
              <strong className="text-success-strong">Verde: aprobado.</strong>{' '}
              <strong className="text-destructive-strong">Rojo: suspenso.</strong>{' '}
              <strong className="text-warning-strong">
                Ámbar: falta evaluar o hay una incidencia técnica.
              </strong>{' '}
              Una nota provisional nunca se presenta como definitiva.
            </p>
            <p>
              La lista muestra cada alumno con su nota. La matriz cruza alumnos y comprobaciones.
              Pulsa un alumno o una celda para ver el detalle; abre una comprobación para consultar
              qué se esperaba y qué devolvió la máquina. Los filtros están en «Filtros y estados».
            </p>
            <p>
              Si una máquina no responde, se indica la causa y no se inventa un cero. Los reintentos
              de comprobaciones sin evaluar siguen disponibles. El modo proyector agranda la
              información y oculta las herramientas de exportación; pulsa Escape para salir.
            </p>
          </Block>
          <Block id="analiticas" title="Analíticas">
            <p>
              La atención prioritaria sitúa primero los problemas técnicos y después las notas
              bajas. Los gráficos muestran las comprobaciones más falladas, la distribución de
              puntuaciones y el éxito por grupo. Las notas incompletas no entran como ceros en la
              distribución ni en la media.
            </p>
          </Block>
          <Block id="historico" title="Histórico y copias">
            <p>
              Abre una corrección guardada sin conectarte de nuevo a las máquinas. Las copias de
              seguridad permiten recuperar notas cuando se pierde el original. Conservan notas y
              procedencia, pero no las salidas de los comandos. Se guardan las cincuenta
              correcciones más recientes según la política de retención de sus cadenas.
            </p>
          </Block>
          <Block id="notas" title="Escala de notas">
            <p>
              El motor puntúa de 0 a 100. En Ajustes puedes mostrar las notas sobre 10 o sobre 100 y
              elegir la marca de aprobado. Por defecto, 70 puntos equivalen a 5 sobre 10. La vista
              previa enseña varias conversiones antes de exportar. El resultado original no se
              modifica.
            </p>
          </Block>
          <Block id="moodle" title="Exportar a Moodle">
            <p>
              Desde Resultados, pulsa «Exportar a Moodle…» y comprueba el resumen antes de guardar
              el CSV. El correo o identificador debe coincidir con el que usa Moodle. Una nota no
              definitiva se deja vacía, nunca se exporta como un cero. El menú de más opciones
              permite exportar las notas en el formato general.
            </p>
          </Block>
          <Block id="problemas" title="Problemas frecuentes">
            <dl className="space-y-3">
              <div>
                <dt className="font-medium">No puedo guardar el examen</dt>
                <dd>
                  Elige una clase en Corregir y revisa el mensaje de validación. No cierres el
                  borrador si aún necesitas corregirlo.
                </dd>
              </div>
              <div>
                <dt className="font-medium">No se conecta con un alumno</dt>
                <dd>
                  Comprueba su dirección, que SSH esté activo y el usuario y contraseña. Usa Puertos
                  SSH si no escucha en el puerto 22.
                </dd>
              </div>
              <div>
                <dt className="font-medium">La nota aparece provisional</dt>
                <dd>
                  Quedan comprobaciones sin evaluar. Consulta la causa y reintenta cuando se
                  resuelva; no equivale a un suspenso.
                </dd>
              </div>
              <div>
                <dt className="font-medium">No aparecen resultados</dt>
                <dd>
                  Consulta el aviso de la corrección o abre una ejecución guardada desde Histórico.
                  Una pantalla sin resultados no significa que todos hayan obtenido cero.
                </dd>
              </div>
            </dl>
          </Block>
        </div>
      </div>
    </div>
  )
}
function Block({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={`help-${id}`} className="max-w-3xl scroll-mt-4 space-y-3">
      <h2 className="text-base font-semibold">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  )
}
