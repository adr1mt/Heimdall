import { lazy, Suspense, useEffect, useState } from 'react'
import { History, Save, ShieldCheck } from 'lucide-react'
import { Button, Spinner, ViewHeader } from '@/components/ui'
import { useApp, noticeFrom } from '@/stores/app'
import { readExam } from '../../../shared/exam'
import { t } from '@/i18n/es'

const YamlEditor = lazy(() => import('@/components/YamlEditor'))

/** Edit the source verbatim; the engine still validates before any write. */
export default function EditorView() {
  const project = useApp((s) => s.project)
  const draft = useApp((s) => s.editorDraft)
  const setDraft = useApp((s) => s.setEditorDraft)
  const setNotice = useApp((s) => s.setNotice)
  const [checking, setChecking] = useState(false)
  const [verdict, setVerdict] = useState<{ ok: boolean; message: string } | null>(null)
  useEffect(() => {
    if (!project || useApp.getState().editorDraft?.path === project.examPath) return
    let current = true
    window.heimdall
      .readExam(project.examPath)
      .then((text) => {
        if (current) setDraft({ path: project.examPath, text, savedText: text })
      })
      .catch((error) => {
        if (current) setNotice(noticeFrom(t.editor.readFailed, error))
      })
    return () => {
      current = false
    }
  }, [project, setDraft, setNotice])

  async function validate(write: boolean): Promise<void> {
    if (!project || !draft || checking) return
    const yaml = draft.text
    setChecking(true)
    try {
      const answer = await window.heimdall.validateExam({
        examPath: project.examPath,
        yaml
      })
      if (
        useApp.getState().editorDraft?.text !== yaml ||
        useApp.getState().project?.examPath !== project.examPath
      )
        return
      setVerdict(answer)
      if (write && answer.ok) {
        await window.heimdall.writeExam(project.examPath, yaml)
        setDraft({ ...draft, savedText: yaml })
        setVerdict({ ok: true, message: `Examen guardado. ${t.editor.validationScope}` })
      }
    } catch (error) {
      setNotice(noticeFrom(t.editor.saveFailed, error))
    } finally {
      setChecking(false)
    }
  }

  async function recover(): Promise<void> {
    if (!project || !draft || checking || draft.text !== draft.savedText) return
    setChecking(true)
    try {
      const text = await window.heimdall.recoverExam(project.examPath)
      if (text !== null && useApp.getState().project?.examPath === project.examPath && useApp.getState().editorDraft?.text === draft.text) {
        setDraft({ ...draft, text })
        setVerdict({ ok: true, message: t.sourceCopies.examDraft })
      }
    } catch (error) {
      setNotice(noticeFrom(t.sourceCopies.examFailed, error))
    } finally {
      setChecking(false)
    }
  }

  if (!project || !draft || draft.path !== project.examPath)
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner />
      </div>
    )
  const parsed = readExam(draft.text)
  const name = 'exam' in parsed ? parsed.exam.examen : project.name
  const dirty = draft.text !== draft.savedText
  return (
    <div className="flex h-full flex-col">
      <ViewHeader
        title={t.editor.titleOf(name)}
        meta={<span className="text-xs text-muted-foreground">examen.yaml</span>}
        actions={
          <>
            {dirty && <span className="text-xs text-warning-strong">Sin guardar</span>}
            <Button size="sm" variant="outline" disabled={checking || dirty}
              title={dirty ? t.sourceCopies.dirty : t.sourceCopies.asDraft}
              onClick={() => void recover()}>
              <History className="h-4 w-4" />{t.sourceCopies.recover}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={checking}
              onClick={() => void validate(false)}
            >
              <ShieldCheck className="h-4 w-4" />
              Validar
            </Button>
            <Button
              size="sm"
              disabled={checking || !dirty}
              title="Ctrl+S"
              onClick={() => void validate(true)}
            >
              {checking ? <Spinner /> : <Save className="h-4 w-4" />}Guardar
            </Button>
          </>
        }
      />
      <div className="min-h-0 flex-1">
        <Suspense
          fallback={
            <div className="p-6">
              <Spinner /> Cargando editor…
            </div>
          }
        >
          <YamlEditor
            text={draft.text}
            disabled={checking}
            onSave={() => void validate(true)}
            onChange={(text) => {
              setDraft({ ...draft, text })
              setVerdict(null)
            }}
          />
        </Suspense>
      </div>
      {verdict && (
        <div
          role="status"
          className={`max-h-40 shrink-0 overflow-auto border-t border-border p-3 text-sm ${verdict.ok ? 'text-success-strong' : 'text-destructive-strong'}`}
        >
          <pre className="whitespace-pre-wrap wrap-break-word font-mono">
            {verdict.ok ? verdict.message || 'El examen es válido.' : verdict.message}
          </pre>
        </div>
      )}
      <div className="flex shrink-0 justify-between border-t border-border px-4 py-2 text-xs text-muted-foreground">
        <span>YAML · 2 espacios · Ctrl+F buscar · Ctrl+S guardar · {t.editor.validationScope}</span>
        <button className="hover:text-foreground" onClick={() => useApp.getState().setView('help')}>
          Ayuda del examen
        </button>
      </div>
    </div>
  )
}
