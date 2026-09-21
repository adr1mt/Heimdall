import { useEffect, useState } from 'react'
import { Copy, Pencil, Plus, Trash2, Users } from 'lucide-react'
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
  duplicateOf,
  emptyStudent,
  problemWith,
  type ClassGroup,
  type ClassStudent
} from '../../../shared/classes'
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
    setDraft({ id: crypto.randomUUID(), name: '', students: [emptyStudent()] })
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
            <Button
              variant="outline"
              size="sm"
              onClick={() => onChange({ ...draft, students: [...draft.students, emptyStudent()] })}
            >
              <Plus className="h-4 w-4" />
              {t.classes.addStudent}
            </Button>
          }
        >
          {t.classes.students}
        </SectionTitle>

        <div className="space-y-2">
          <div className="hidden gap-2 px-1 text-micro uppercase tracking-[0.09em] text-muted-foreground lg:grid lg:grid-cols-[8rem_1fr_1fr_10rem_8rem_2rem]">
            <span>{t.classes.col.id}</span>
            <span>{t.classes.col.name}</span>
            <span>{t.classes.col.contact}</span>
            <span>{t.classes.col.host}</span>
            <span>{t.classes.col.user}</span>
            <span />
          </div>
          {draft.students.map((student, index) => (
            <div
              key={index}
              className="grid gap-2 rounded-md border border-border p-2 lg:grid-cols-[8rem_1fr_1fr_10rem_8rem_2rem] lg:border-0 lg:p-1"
            >
              <Input
                aria-label={t.classes.col.id}
                placeholder={t.classes.col.id}
                value={student.id}
                onChange={(e) => setStudent(index, { id: e.target.value })}
              />
              <Input
                aria-label={t.classes.col.name}
                placeholder={t.classes.col.name}
                value={student.name}
                onChange={(e) => setStudent(index, { name: e.target.value })}
              />
              <Input
                aria-label={t.classes.col.contact}
                placeholder={t.classes.col.contact}
                value={student.contact}
                onChange={(e) => setStudent(index, { contact: e.target.value })}
              />
              <Input
                aria-label={t.classes.col.host}
                placeholder={t.classes.col.host}
                value={student.host}
                onChange={(e) => setStudent(index, { host: e.target.value })}
              />
              <Input
                aria-label={t.classes.col.user}
                placeholder={t.classes.col.user}
                value={student.user}
                onChange={(e) => setStudent(index, { user: e.target.value })}
              />
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
            </div>
          ))}
        </div>
      </div>

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
