import { useEffect, useState } from 'react'
import { ClipboardPaste, Copy, Pencil, Plus, Trash2, Users } from 'lucide-react'
import {
  Button,
  Card,
  CardContent,
  ConfirmDialog,
  Input,
  SectionTitle,
  ViewHeader
} from '@/components/ui'
import { useApp, noticeFrom } from '@/stores/app'
import { useClasses } from '@/stores/classes'
import {
  columnProblem,
  duplicateOf,
  emptyStudent,
  problemWith,
  type ClassGroup,
  type ClassStudent
} from '../../../shared/classes'
import { duplicatesIn, readPaste, studentsOf } from '../../../shared/paste'
import { cn } from '@/lib/utils'
import { t } from '@/i18n/es'

/**
 * The classes of the course: the groups the teacher writes down once and
 * reuses in every exam (ADR-0021).
 *
 * Nothing here computes a grade and nothing here is a password. It is an
 * address book: who each student is and how the correction reaches their
 * machine.
 */
export default function ClassesView() {
  const { groups, problem, loaded, load, save } = useClasses()
  const setNotice = useApp((s) => s.setNotice)
  const classId = useApp((s) => s.classId)
  const setClassId = useApp((s) => s.setClassId)

  /** The class being edited, as a draft. Null when nobody is editing. */
  const [draft, setDraft] = useState<ClassGroup | null>(null)
  const [removing, setRemoving] = useState<ClassGroup | null>(null)

  useEffect(() => {
    if (!loaded) void load()
  }, [loaded, load])

  async function commit(next: ClassGroup[], after?: () => void): Promise<void> {
    try {
      await save(next)
      after?.()
    } catch (error) {
      setNotice(noticeFrom(t.classes.saveFailed, error))
    }
  }

  function startNew(): void {
    setDraft({ id: crypto.randomUUID(), name: '', columns: [], students: [emptyStudent()] })
  }

  async function duplicate(group: ClassGroup): Promise<void> {
    await commit([...groups, duplicateOf(group, groups, crypto.randomUUID())])
  }

  async function remove(group: ClassGroup): Promise<void> {
    setRemoving(null)
    await commit(
      groups.filter((other) => other.id !== group.id),
      () => {
        // The chosen class cannot stay chosen once it is gone.
        if (classId === group.id) setClassId(null)
        setNotice(t.classes.removed(group.name))
      }
    )
  }

  if (draft) {
    return (
      <ClassEditor
        draft={draft}
        others={groups}
        onChange={setDraft}
        onCancel={() => setDraft(null)}
        onSave={(group) => {
          const next = groups.some((other) => other.id === group.id)
            ? groups.map((other) => (other.id === group.id ? group : other))
            : [...groups, group]
          void commit(next, () => {
            setDraft(null)
            setNotice(t.classes.saved)
          })
        }}
      />
    )
  }

  return (
    <div className="flex h-full flex-col">
      <ViewHeader
        title={t.classes.title}
        actions={
          <Button size="sm" disabled={!!problem} onClick={startNew}>
            <Plus className="h-4 w-4" />
            {t.classes.create}
          </Button>
        }
      />
      <div className="min-h-0 flex-1 space-y-4 overflow-auto p-6">
        <p className="max-w-3xl text-sm text-muted-foreground">{t.classes.hint}</p>

        {/* Un fichero ilegible no se sustituye por una lista vacía: se dice
            qué pasó y no se guarda nada encima (ADR-0021 §5). */}
        {problem && (
          <div role="alert" className="space-y-1 rounded-md bg-destructive/10 p-4 text-sm text-destructive-strong">
            <p className="font-medium">{t.classes.loadFailed}</p>
            <p className="text-xs">{problem}</p>
            <p className="text-xs">{t.classes.blocked}</p>
          </div>
        )}

        {groups.length === 0 && !problem ? (
          <Card>
            <CardContent className="space-y-1 pt-5 text-sm">
              <p>{t.classes.empty}</p>
              <p className="text-xs text-muted-foreground">{t.classes.emptyHint}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {groups.map((group) => (
              <div
                key={group.id}
                className="flex flex-wrap items-center gap-3 rounded-md border border-border p-3"
              >
                <Users className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-name font-semibold">{group.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.classes.count(group.students.length)}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setDraft(group)}>
                  <Pencil className="h-4 w-4" />
                  {t.classes.edit}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => void duplicate(group)}>
                  <Copy className="h-4 w-4" />
                  {t.classes.duplicate}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setRemoving(group)}>
                  <Trash2 className="h-4 w-4" />
                  {t.classes.remove}
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={removing !== null}
        title={removing ? t.classes.removeTitle(removing.name) : ''}
        confirmLabel={t.classes.remove}
        destructive
        onConfirm={() => removing && void remove(removing)}
        onCancel={() => setRemoving(null)}
      >
        {t.classes.removeBody}
      </ConfirmDialog>
    </div>
  )
}

/**
 * One class, student by student.
 *
 * It refuses to save what would break later: a repeated identifier, a student
 * with no machine or no user. Telling the teacher now costs a second; finding
 * out mid-exam, with the class already at the machines, costs the exam.
 */
function ClassEditor({
  draft,
  others,
  onChange,
  onCancel,
  onSave
}: {
  draft: ClassGroup
  others: ClassGroup[]
  onChange: (group: ClassGroup) => void
  onCancel: () => void
  onSave: (group: ClassGroup) => void
}) {
  const problem = problemWith(draft, others)
  const [addingColumn, setAddingColumn] = useState(false)
  const [removingColumn, setRemovingColumn] = useState<string | null>(null)
  const [pasting, setPasting] = useState(false)

  function setStudent(index: number, patch: Partial<ClassStudent>): void {
    onChange({
      ...draft,
      students: draft.students.map((student, i) => (i === index ? { ...student, ...patch } : student))
    })
  }

  return (
    <div className="flex h-full flex-col">
      <ViewHeader title={draft.name.trim() || t.classes.newName} />
      <div className="min-h-0 flex-1 space-y-4 overflow-auto p-6">
        <label className="block max-w-md space-y-1">
          <span className="text-xs text-muted-foreground">{t.classes.nameLabel}</span>
          <Input
            value={draft.name}
            placeholder={t.classes.namePlaceholder}
            onChange={(e) => onChange({ ...draft, name: e.target.value })}
          />
        </label>

        <SectionTitle
          hint={t.classes.noPasswords}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setAddingColumn(true)}>
                <Plus className="h-4 w-4" />
                {t.classes.addColumn}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setPasting(true)}>
                <ClipboardPaste className="h-4 w-4" />
                {t.classes.paste}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onChange({ ...draft, students: [...draft.students, emptyStudent()] })}
              >
                <Plus className="h-4 w-4" />
                {t.classes.addStudent}
              </Button>
            </div>
          }
        >
          {t.classes.students}
        </SectionTitle>

        {/* Una columna propia se declara en la clase, no se deduce de los
            alumnos: una que todos tengan vacía tiene que seguir en pantalla o
            nadie puede rellenarla. */}
        {addingColumn && (
          <ColumnAdder
            columns={draft.columns}
            onCancel={() => setAddingColumn(false)}
            onAdd={(name) => {
              onChange({ ...draft, columns: [...draft.columns, name] })
              setAddingColumn(false)
            }}
          />
        )}

        {/* Apuntar a veintiséis alumnos a mano son ciento cincuenta campos.
            La lista ya existe en el registro o en Moodle: se pega, se enseña
            entera y solo entonces se guarda (T116). */}
        {pasting && (
          <StudentPaster
            draft={draft}
            onCancel={() => setPasting(false)}
            onAdd={(students, columns) => {
              onChange({
                ...draft,
                columns: [...draft.columns, ...columns],
                students: [
                  // Una clase nueva empieza con una fila vacía en pantalla;
                  // pegar sobre ella la dejaría ahí, incompleta y bloqueando
                  // el guardado.
                  ...draft.students.filter((student) => student.id.trim() !== ''),
                  ...students
                ]
              })
              setPasting(false)
            }}
          />
        )}

        {/* Identificador y nombre se quedan fijos al desplazar: con nueve
            columnas propias, al llegar a la última se estaban tecleando
            números sin saber de quién eran (T117). */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-max border-separate border-spacing-x-2 border-spacing-y-1">
            <thead>
              <tr className="text-left text-micro uppercase tracking-[0.09em] text-muted-foreground">
                <th className={cn('font-normal', STICKY_ID)}>{t.classes.col.id}</th>
                <th className={cn('font-normal', STICKY_NAME)}>{t.classes.col.name}</th>
                <th className="font-normal">{t.classes.col.contact}</th>
                <th className="font-normal">{t.classes.col.host}</th>
                <th className="font-normal" title={t.classes.portHint}>
                  {t.classes.col.port}
                </th>
                <th className="font-normal">{t.classes.col.user}</th>
                {draft.columns.map((column) => (
                  <th key={column} className="font-normal">
                    <span className="flex items-center gap-1">
                      <span className="font-mono normal-case tracking-normal">{column}</span>
                      <button
                        type="button"
                        aria-label={t.classes.removeColumn(column)}
                        title={t.classes.removeColumn(column)}
                        onClick={() => setRemovingColumn(column)}
                        className="rounded p-0.5 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </span>
                  </th>
                ))}
                <th />
              </tr>
            </thead>
            <tbody>
              {draft.students.map((student, index) => (
                <tr key={index}>
                  <td className={cn('w-28', STICKY_ID)}>
                    <Input
                      aria-label={t.classes.col.id}
                      value={student.id}
                      onChange={(e) => setStudent(index, { id: e.target.value })}
                    />
                  </td>
                  <td className={cn('w-44', STICKY_NAME)}>
                    <Input
                      aria-label={t.classes.col.name}
                      value={student.name}
                      onChange={(e) => setStudent(index, { name: e.target.value })}
                    />
                  </td>
                  <td className="w-40">
                    <Input
                      aria-label={t.classes.col.contact}
                      value={student.contact}
                      onChange={(e) => setStudent(index, { contact: e.target.value })}
                    />
                  </td>
                  <td className="w-32">
                    <Input
                      aria-label={t.classes.col.host}
                      value={student.host}
                      onChange={(e) => setStudent(index, { host: e.target.value })}
                    />
                  </td>
                  <td className="w-20">
                    <Input
                      aria-label={t.classes.col.port}
                      placeholder="22"
                      value={student.port}
                      onChange={(e) => setStudent(index, { port: e.target.value })}
                    />
                  </td>
                  <td className="w-28">
                    <Input
                      aria-label={t.classes.col.user}
                      value={student.user}
                      onChange={(e) => setStudent(index, { user: e.target.value })}
                    />
                  </td>
                  {draft.columns.map((column) => (
                    <td key={column} className="w-36">
                      <Input
                        aria-label={column}
                        value={student.fields[column] ?? ''}
                        onChange={(e) =>
                          setStudent(index, {
                            fields: { ...student.fields, [column]: e.target.value }
                          })
                        }
                      />
                    </td>
                  ))}
                  <td>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={t.classes.removeStudent}
                      title={t.classes.removeStudent}
                      onClick={() =>
                        onChange({ ...draft, students: draft.students.filter((_, i) => i !== index) })
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmDialog
        open={removingColumn !== null}
        title={removingColumn ? t.classes.removeColumnTitle(removingColumn) : ''}
        confirmLabel={t.classes.remove}
        destructive
        onConfirm={() => {
          if (!removingColumn) return
          onChange({
            ...draft,
            columns: draft.columns.filter((column) => column !== removingColumn),
            students: draft.students.map((student) => {
              const fields = { ...student.fields }
              delete fields[removingColumn]
              return { ...student, fields }
            })
          })
          setRemovingColumn(null)
        }}
        onCancel={() => setRemovingColumn(null)}
      >
        {t.classes.removeColumnBody}
      </ConfirmDialog>

      <div className="flex shrink-0 flex-wrap items-center gap-3 border-t border-border p-4">
        <Button disabled={problem !== null} onClick={() => onSave(draft)}>
          {t.classes.save}
        </Button>
        <Button variant="outline" onClick={onCancel}>
          {t.classes.cancel}
        </Button>
        {problem && <span className="text-xs text-warning-strong">{problem}</span>}
      </div>
    </div>
  )
}

/**
 * Una columna propia, por su nombre.
 *
 * El nombre viaja al aula como clave del alumno y de ahí lo alcanza
 * `${alumno.NOMBRE}` en el examen, así que se comprueba al teclearlo: un
 * nombre que no vale como clave rompería el examen a mitad de corrección.
 */
function ColumnAdder({
  columns,
  onAdd,
  onCancel
}: {
  columns: string[]
  onAdd: (name: string) => void
  onCancel: () => void
}) {
  const [name, setName] = useState('')
  const problem = name.trim() === '' ? null : columnProblem(name, columns)

  return (
    <div className="space-y-2 rounded-md border border-border p-3">
      <p className="text-xs text-muted-foreground">{t.classes.columnHint}</p>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          autoFocus
          aria-label={t.classes.columnName}
          placeholder={t.classes.columnPlaceholder}
          value={name}
          className="max-w-xs"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') onCancel()
            if (e.key === 'Enter' && !problem && name.trim()) onAdd(name.trim())
          }}
        />
        <Button size="sm" disabled={!name.trim() || problem !== null} onClick={() => onAdd(name.trim())}>
          {t.classes.columnAdd}
        </Button>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          {t.classes.cancel}
        </Button>
      </div>
      {problem && <p className="text-xs text-warning-strong">{problem}</p>}
    </div>
  )
}

/**
 * Las dos columnas que dicen de quién es la fila, fijas a la izquierda.
 *
 * El fondo es obligatorio: sin él, lo que se desplaza por debajo se lee a
 * través de la celda fija. El desplazamiento es el de la tabla —`w-28` más el
 * espaciado de la primera columna—, así que el hueco entre las dos se ve
 * igual parado que desplazado.
 */
const STICKY_ID = 'sticky left-0 z-20 bg-background'
const STICKY_NAME = 'sticky left-[120px] z-20 bg-background'

/**
 * Pegar a los alumnos desde una hoja de cálculo.
 *
 * Todo se enseña antes de guardar nada: qué alumno sale de cada fila, cuál
 * está incompleta y por qué, y cuántos entran de verdad. Una fila a la que le
 * falta algo se señala en rojo y se queda fuera; nadie acaba con medio alumno
 * guardado (T116).
 *
 * Una contraseña pegada no se lee nunca, se llame como se llame: una clase es
 * una agenda y ahí no entra ningún secreto (ADR-0009).
 */
function StudentPaster({
  draft,
  onAdd,
  onCancel
}: {
  draft: ClassGroup
  onAdd: (students: ClassStudent[], columns: string[]) => void
  onCancel: () => void
}) {
  const [text, setText] = useState('')
  const paste = readPaste(text, draft.columns)
  const students = studentsOf(paste, draft.students)
  const incomplete = paste.rows.filter((row) => row.missing.length > 0).length
  const repeated = duplicatesIn(paste, draft.students)

  return (
    <div className="space-y-3 rounded-md border border-border p-3">
      <SectionTitle hint={t.classes.pasteHint}>{t.classes.pasteTitle}</SectionTitle>

      <textarea
        autoFocus
        aria-label={t.classes.pasteLabel}
        placeholder={t.classes.pastePlaceholder}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onCancel()
        }}
        className="h-32 w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-dense focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />

      {paste.warnings.map((warning) => (
        <p key={warning} className="text-xs text-warning-strong">
          {warning}
        </p>
      ))}

      {paste.rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t.classes.pasteNothing}</p>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">{t.classes.pastePreview}</p>
          <div className="max-h-64 overflow-auto rounded-md border border-border">
            <table className="w-full text-dense">
              <tbody>
                {paste.rows.map((row, index) => (
                  <tr
                    key={index}
                    className={cn(
                      'border-b border-border/60 last:border-0',
                      row.missing.length > 0 && 'bg-destructive/10 text-destructive-strong'
                    )}
                  >
                    <td className="px-2 py-1 font-mono">{row.student.id || '—'}</td>
                    <td className="px-2 py-1">{row.student.name || '—'}</td>
                    <td className="px-2 py-1 font-mono">{row.student.host || '—'}</td>
                    <td className="px-2 py-1 font-mono">{row.student.user || '—'}</td>
                    <td className="px-2 py-1 text-xs">
                      {row.missing.length > 0 ? t.classes.pasteMissing(row.missing) : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {incomplete > 0 && (
            <p className="text-xs text-warning-strong">{t.classes.pasteIncomplete(incomplete)}</p>
          )}
          {repeated > 0 && (
            <p className="text-xs text-warning-strong">{t.classes.pasteDuplicates(repeated)}</p>
          )}
          {paste.newColumns.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {t.classes.pasteNewColumns(paste.newColumns)}
            </p>
          )}
          {students.length === 0 && (
            <p className="text-xs text-warning-strong">{t.classes.pasteNoneUsable}</p>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          disabled={students.length === 0}
          onClick={() => onAdd(students, paste.newColumns)}
        >
          {t.classes.pasteAdd(students.length)}
        </Button>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          {t.classes.cancel}
        </Button>
      </div>
    </div>
  )
}
