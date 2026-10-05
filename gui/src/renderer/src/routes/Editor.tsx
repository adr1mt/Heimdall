import { useEffect, useState } from 'react'
import { Check as CheckIcon, Code2, FileText, Pencil, Plus, Trash2 } from 'lucide-react'
import {
  Badge,
  Button,
  Card,
  CardContent,
  ConfirmDialog,
  Input,
  SectionTitle,
  Spinner,
  ViewHeader
} from '@/components/ui'
import { useApp, noticeFrom } from '@/stores/app'
import { useClasses, groupById } from '@/stores/classes'
import {
  ASSERTIONS,
  allChecks,
  checkCount,
  checkProblem,
  commandLine,
  emptyCheck,
  emptyExam,
  examYaml,
  readCommandLine,
  readExam,
  totalWeight,
  type AssertionKind,
  type Check,
  type Exam
} from '../../../shared/exam'
import { t } from '@/i18n/es'

/**
 * Exámenes: the exam of the open project, written from a form (T109).
 *
 * There is ONE exam. The form changes it and the YAML view shows the same
 * object written out; typing in the YAML reads it back into the form. Two
 * models would drift and one of them would quietly win.
 *
 * Nothing here decides whether the exam is any good: `heimdall check` does,
 * with the class it will be corrected with, and its message —file and line—
 * is what goes on screen. The file is only written once the engine accepted
 * it, so a broken exam never replaces one that worked.
 */
export default function EditorView() {
  const project = useApp((s) => s.project)
  const classId = useApp((s) => s.classId)
  const setNotice = useApp((s) => s.setNotice)
  const setView = useApp((s) => s.setView)

  const groups = useClasses((s) => s.groups)
  const classesLoaded = useClasses((s) => s.loaded)
  const loadClasses = useClasses((s) => s.load)
  useEffect(() => {
    if (!classesLoaded) void loadClasses()
  }, [classesLoaded, loadClasses])
  const group = groupById(groups, classId)

  const draft = useApp(s => s.editorDraft)
  const setDraft = useApp(s => s.setEditorDraft)
  const parsed = draft ? readExam(draft.text) : null
  const problem = parsed && 'problem' in parsed ? parsed.problem : null
  const exam = parsed && 'exam' in parsed ? parsed.exam : draft?.formExam ?? (project && draft ? emptyExam(project.name) : null)
  const yamlView = !!draft && (draft.yamlView || (!!problem && !draft.formExam))
  const setYamlView = (next: boolean): void => {
    if (draft && (!problem || next)) setDraft({ ...draft, yamlView: next, formExam: undefined })
  }
  const [editing, setEditing] = useState<{ group: number; check: number | null } | null>(null)
  const [removingGroup, setRemovingGroup] = useState<number | null>(null)
  const [verdict, setVerdict] = useState<{ ok: boolean; message: string } | null>(null)
  const [checking, setChecking] = useState(false)

  useEffect(() => {
    if (!project) return
    if (useApp.getState().editorDraft?.path === project.examPath) return
    let current = true
    window.heimdall
      .readExam(project.examPath)
      .then((yaml) => {
        if (!current) return
        const read = readExam(yaml)
        setDraft({ path: project.examPath, text: yaml, savedText: yaml, yamlView: 'problem' in read })
        // An exam the model cannot read is not replaced by an empty one
        // behind the teacher's back: the YAML is opened and it is said why.
        if ('problem' in read) {
          setNotice(`${t.editor.readFailed}: ${read.problem}`)
        }
      })
      .catch((error) => setNotice(noticeFrom(t.editor.readFailed, error)))
    return () => {
      current = false
    }
  }, [project, setNotice, setDraft])

  function change(next: Exam): void {
    if (!draft) return
    setDraft({ ...draft, text: examYaml(next), formExam: next })
    // The engine's last word is about the exam that was checked, not this one.
    setVerdict(null)
  }

  async function save(): Promise<void> {
    if (!exam || !project || !draft || problem || checking) return
    if (!group) {
      setVerdict({ ok: false, message: t.editor.needClass })
      return
    }
    const yaml = draft.text
    setChecking(true)
    try {
      const answer = await window.heimdall.validateExam({
        examPath: project.examPath,
        classId: group.id,
        yaml
      })
      if (useApp.getState().editorDraft?.text !== yaml || useApp.getState().project?.examPath !== project.examPath) return
      setVerdict(answer)
      if (!answer.ok) return
      await window.heimdall.writeExam(project.examPath, yaml)
      setDraft({ ...draft, savedText: yaml })
      setNotice(t.editor.saved)
    } catch (error) {
      setNotice(noticeFrom(t.editor.saveFailed, error))
    } finally {
      setChecking(false)
    }
  }

  if (!project || !exam) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner />
      </div>
    )
  }

  if (editing) {
    const target = exam.grupos[editing.group]
    const check =
      editing.check === null ? emptyCheck(exam.hosts[0] ?? '') : target.comprobaciones[editing.check]
    return (
      <CheckEditor
        exam={exam}
        check={check}
        onCancel={() => setEditing(null)}
        onSave={(next) => {
          const comprobaciones =
            editing.check === null
              ? [...target.comprobaciones, next]
              : target.comprobaciones.map((other, i) => (i === editing.check ? next : other))
          change({
            ...exam,
            grupos: exam.grupos.map((g, i) =>
              i === editing.group ? { ...g, comprobaciones } : g
            )
          })
          setEditing(null)
        }}
      />
    )
  }

  return (
    <div className="flex h-full flex-col">
      <ViewHeader
        title={t.editor.titleOf(exam.examen.trim() || project?.name || '')}
        meta={
          <Badge variant="secondary">{problem ? t.editor.draftInvalid : t.editor.summary(checkCount(exam), totalWeight(exam))}</Badge>
        }
        actions={
          <Button variant="outline" size="sm" disabled={(!!problem && yamlView) || checking} onClick={() => setYamlView(!yamlView)}>
            {yamlView ? <FileText className="h-4 w-4" /> : <Code2 className="h-4 w-4" />}
            {yamlView ? t.editor.formView : t.editor.yamlView}
          </Button>
        }
      />

      <fieldset disabled={checking} className="min-h-0 flex-1 space-y-5 overflow-auto p-6">
        {yamlView ? (
          <YamlView text={draft?.text ?? ''} problem={problem} disabled={checking} onChange={(text) => { if (draft) setDraft({ ...draft, text, formExam: undefined }); setVerdict(null); setNotice(null) }} />
        ) : (
          <>
            {/* Que la pantalla se llame «Exámenes» y enseñe uno solo no se
                entiende: aquí se dice cuál es y que es el que se corrige
                (T122). */}
            <p className="max-w-3xl text-sm text-muted-foreground">{t.editor.hint}</p>

            <div className="grid max-w-3xl gap-3 md:grid-cols-2">
              <Field label={t.editor.examName}>
                <Input
                  value={exam.examen}
                  onChange={(e) => change({ ...exam, examen: e.target.value })}
                />
              </Field>
              <Field label={t.editor.hosts} hint={t.editor.hostsHint}>
                <Input
                  value={exam.hosts.join(', ')}
                  placeholder="host1"
                  onChange={(e) =>
                    change({
                      ...exam,
                      hosts: e.target.value
                        .split(',')
                        .map((host) => host.trim())
                        .filter(Boolean)
                    })
                  }
                />
              </Field>
              <Field label={`${t.editor.defaults}: ${t.editor.defaultWeight}`}>
                <Input
                  value={exam.porDefecto.peso}
                  placeholder="1"
                  onChange={(e) =>
                    change({ ...exam, porDefecto: { ...exam.porDefecto, peso: e.target.value } })
                  }
                />
              </Field>
              <Field label={`${t.editor.defaults}: ${t.editor.defaultTimeout}`}>
                <Input
                  value={exam.porDefecto.timeout}
                  placeholder="20s"
                  onChange={(e) =>
                    change({ ...exam, porDefecto: { ...exam.porDefecto, timeout: e.target.value } })
                  }
                />
              </Field>
            </div>

            <SectionTitle
              actions={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    change({ ...exam, grupos: [...exam.grupos, { grupo: '', comprobaciones: [] }] })
                  }
                >
                  <Plus className="h-4 w-4" />
                  {t.editor.addGroup}
                </Button>
              }
            >
              {t.editor.groups}
            </SectionTitle>

            {exam.grupos.length === 0 ? (
              <Card>
                <CardContent className="pt-5 text-sm text-muted-foreground">
                  {t.editor.noGroups}
                </CardContent>
              </Card>
            ) : (
              exam.grupos.map((group, index) => (
                <Card key={index}>
                  <CardContent className="space-y-3 pt-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Input
                        aria-label={t.editor.groupName}
                        placeholder={t.editor.groupPlaceholder}
                        value={group.grupo}
                        className="max-w-xs"
                        onChange={(e) =>
                          change({
                            ...exam,
                            grupos: exam.grupos.map((g, i) =>
                              i === index ? { ...g, grupo: e.target.value } : g
                            )
                          })
                        }
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditing({ group: index, check: null })}
                      >
                        <Plus className="h-4 w-4" />
                        {t.editor.addCheck}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={t.editor.removeGroup(group.grupo)}
                        title={t.editor.removeGroup(group.grupo)}
                        className="ml-auto"
                        onClick={() => setRemovingGroup(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    {group.comprobaciones.map((check, checkIndex) => (
                      <div
                        key={checkIndex}
                        className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-2 text-sm"
                      >
                        <span className="font-mono text-dense text-muted-foreground">{check.id}</span>
                        <span className="min-w-0 flex-1 truncate">{check.descripcion}</span>
                        <Badge variant="secondary">{check.peso.trim() || exam.porDefecto.peso || '1'}</Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditing({ group: index, check: checkIndex })}
                        >
                          <Pencil className="h-4 w-4" />
                          {t.editor.editCheck}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={t.editor.removeCheck}
                          title={t.editor.removeCheck}
                          onClick={() =>
                            change({
                              ...exam,
                              grupos: exam.grupos.map((g, i) =>
                                i === index
                                  ? {
                                    ...g,
                                    comprobaciones: g.comprobaciones.filter(
                                      (_, c) => c !== checkIndex
                                    )
                                  }
                                  : g
                              )
                            })
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ))
            )}
          </>
        )}
      </fieldset>

      <ConfirmDialog
        open={removingGroup !== null && !!exam.grupos[removingGroup] && !problem}
        title={
          removingGroup === null ? '' : t.editor.removeGroupTitle(exam.grupos[removingGroup]?.grupo ?? '')
        }
        confirmLabel={t.classes.remove}
        destructive
        onCancel={() => setRemovingGroup(null)}
        onConfirm={() => {
          if (removingGroup === null) return
          change({ ...exam, grupos: exam.grupos.filter((_, i) => i !== removingGroup) })
          setRemovingGroup(null)
        }}
      >
        {t.editor.removeGroupBody}
      </ConfirmDialog>

      {/* Lo que dice el motor, tal cual, con su fichero y su línea. El examen
          no se escribe hasta que lo acepta. */}
      <div className="shrink-0 space-y-2 border-t border-border p-4">
        {problem && !yamlView && <p role="alert" className="text-xs text-warning-strong">{problem}</p>}
        <div className="flex flex-wrap items-center gap-3">
          <Button disabled={checking || !!problem} onClick={() => void save()}>
            {checking ? <Spinner className="h-4 w-4" /> : <CheckIcon className="h-4 w-4" />}
            {checking ? t.editor.checking : t.editor.save}
          </Button>
          {!group && (
            <button
              type="button"
              onClick={() => setView('correct')}
              className="text-xs text-warning-strong underline-offset-2 hover:underline"
            >
              {t.editor.needClass}
            </button>
          )}
        </div>
        {verdict && (
          <div
            role="alert"
            className={
              verdict.ok
                ? 'text-xs text-success-strong'
                : 'space-y-1 rounded-md bg-destructive/10 p-3 text-xs text-destructive-strong'
            }
          >
            {verdict.ok ? (
              t.editor.valid
            ) : (
              <>
                <p className="font-medium">{t.editor.invalid}</p>
                <pre className="whitespace-pre-wrap break-words font-mono">{verdict.message}</pre>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function Field({
  label,
  hint,
  children
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <label className="block space-y-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
      {hint && <span className="block text-micro text-muted-foreground">{hint}</span>}
    </label>
  )
}

/**
 * The same exam, as the file the engine reads.
 *
 * Typing here reads the exam back, so the form shows what was written. YAML
 * that cannot be read yet —halfway through a line— leaves the exam exactly as
 * it was and says so: nothing the teacher typed is thrown away silently.
 */
function YamlView({ text, problem, disabled, onChange }: { text: string; problem: string | null; disabled: boolean; onChange: (text: string) => void }) {
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">{t.editor.yamlHint}</p>
      <textarea
        aria-label={t.editor.yamlView}
        value={text}
        spellCheck={false}
        disabled={disabled}
        aria-invalid={!!problem}
        onChange={(e) => onChange(e.target.value)}
        className="h-[60vh] w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-dense focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      {problem && (
        <div role="alert" className="space-y-1 rounded-md bg-warning/10 p-3 text-xs text-warning-strong">
          <p className="font-medium">{t.editor.yamlBroken}</p>
          <pre className="whitespace-pre-wrap break-words font-mono">{problem}</pre>
        </div>
      )}
    </div>
  )
}

/**
 * One check, in a form.
 *
 * The command is typed as a line and kept as a vector of arguments: the
 * vector is what the engine gets and what makes injection impossible, but
 * nobody types a YAML list by hand. Nothing here is ever interpreted — a `;`
 * is one more argument, because there is no shell.
 */
function CheckEditor({
  exam,
  check,
  onSave,
  onCancel
}: {
  exam: Exam
  check: Check
  onSave: (check: Check) => void
  onCancel: () => void
}) {
  const [draft, setDraft] = useState<Check>(check)
  // Which of the two shapes this check has. It is kept here and not deduced
  // from the draft, because a check that is being written is empty in both
  // and the form would flip under the teacher's hands.
  const [byCommand, setByCommand] = useState(check.valor.trim() === '')
  const others = allChecks(exam).filter((other) => other !== check)
  const problem = checkProblem(draft, exam, others)

  return (
    <div className="flex h-full flex-col">
      <ViewHeader title={draft.id.trim() || t.editor.newCheck} />
      <div className="min-h-0 flex-1 space-y-4 overflow-auto p-6">
        <div className="grid max-w-3xl gap-3 md:grid-cols-2">
          <Field label={t.editor.checkId} hint={t.editor.checkIdHint}>
            <Input value={draft.id} onChange={(e) => setDraft({ ...draft, id: e.target.value })} />
          </Field>
          <Field label={t.editor.checkDescription}>
            <Input
              value={draft.descripcion}
              placeholder={t.editor.checkDescriptionPlaceholder}
              onChange={(e) => setDraft({ ...draft, descripcion: e.target.value })}
            />
          </Field>
        </div>

        <fieldset className="max-w-3xl space-y-2">
          <legend className="text-xs text-muted-foreground">{t.editor.where}</legend>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              checked={byCommand}
              onChange={() => {
                setByCommand(true)
                setDraft({ ...draft, valor: '', en: draft.en || (exam.hosts[0] ?? '') })
              }}
            />
            {t.editor.onHost}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              checked={!byCommand}
              onChange={() => {
                setByCommand(false)
                setDraft({ ...draft, cmd: [], en: '' })
              }}
            />
            {t.editor.onValue}
          </label>
        </fieldset>

        {byCommand ? (
          <div className="grid max-w-3xl gap-3 md:grid-cols-[10rem_1fr]">
            <Field label={t.editor.host}>
              <select
                value={draft.en}
                onChange={(e) => setDraft({ ...draft, en: e.target.value })}
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">—</option>
                {exam.hosts.map((host) => (
                  <option key={host} value={host}>
                    {host}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t.editor.command} hint={t.editor.commandHint}>
              <Input
                value={commandLine(draft.cmd)}
                placeholder={t.editor.commandPlaceholder}
                className="font-mono"
                onChange={(e) => setDraft({ ...draft, cmd: readCommandLine(e.target.value) })}
              />
            </Field>
          </div>
        ) : (
          <div className="max-w-3xl">
            <Field label={t.editor.value} hint={t.editor.valueHint}>
              <Input
                value={draft.valor}
                placeholder="${alumno.p1}"
                className="font-mono"
                onChange={(e) => setDraft({ ...draft, valor: e.target.value })}
              />
            </Field>
          </div>
        )}

        <div className="grid max-w-3xl gap-3 md:grid-cols-2">
          <Field label={t.editor.assertion}>
            <select
              value={draft.assertion.kind}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  assertion: { ...draft.assertion, kind: e.target.value as AssertionKind }
                })
              }
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {ASSERTIONS.map((kind) => (
                <option key={kind} value={kind}>
                  {t.editor.assertionName[kind]}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t.editor.expected}>
            <Input
              value={draft.assertion.value}
              className="font-mono"
              onChange={(e) =>
                setDraft({ ...draft, assertion: { ...draft.assertion, value: e.target.value } })
              }
            />
          </Field>
          {draft.assertion.kind === 'cerca_de' && (
            <>
              <Field label={t.editor.anchor}>
                <Input
                  value={draft.assertion.anchor ?? ''}
                  className="font-mono"
                  onChange={(e) =>
                    setDraft({ ...draft, assertion: { ...draft.assertion, anchor: e.target.value } })
                  }
                />
              </Field>
              <Field label={t.editor.lines}>
                <Input
                  value={draft.assertion.lines ?? ''}
                  placeholder="5"
                  onChange={(e) =>
                    setDraft({ ...draft, assertion: { ...draft.assertion, lines: e.target.value } })
                  }
                />
              </Field>
            </>
          )}
          <Field label={t.editor.weight} hint={t.editor.weightHint}>
            <Input
              value={draft.peso}
              placeholder={exam.porDefecto.peso || '1'}
              onChange={(e) => setDraft({ ...draft, peso: e.target.value })}
            />
          </Field>
          {byCommand && (
            <Field label={t.editor.timeout} hint={t.editor.timeoutHint}>
              <Input
                value={draft.timeout}
                placeholder={exam.porDefecto.timeout || '20s'}
                onChange={(e) => setDraft({ ...draft, timeout: e.target.value })}
              />
            </Field>
          )}
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
