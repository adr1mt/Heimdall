import { useEffect, useState } from 'react'
import { ArrowRight, FileText, FolderOpen } from 'lucide-react'
import { Button, Card, CardContent, ViewHeader } from '@/components/ui'
import { useApp, noticeFrom } from '@/stores/app'
import type { Description } from '../../../shared/describe'
import { t } from '@/i18n/es'

/**
 * Inicio: the exam that is open.
 *
 * Correcting lives in «Corregir», with the class: the same exam is corrected
 * with 2SMX C and with 2SMX D, so it belongs to neither. Until T108 turns
 * this into the list of projects, the exam is still opened as a file.
 */
export default function HomeView() {
  const examPath = useApp((s) => s.examPath)
  const setExamPath = useApp((s) => s.setExamPath)
  const setNotice = useApp((s) => s.setNotice)
  const setView = useApp((s) => s.setView)

  /** What the chosen exam is called, for the screen. */
  const [described, setDescribed] = useState<Description>({ exam: null })

  useEffect(() => {
    if (!examPath) {
      setDescribed({ exam: null })
      return
    }
    let current = true
    window.heimdall
      .describe({ examPath })
      .then((description) => {
        if (current) setDescribed(description)
      })
      // A name is for reading: if it cannot be read the path is still there,
      // and the file's real error arrives whole when the engine reads it.
      .catch(() => {
        if (current) setDescribed({ exam: null })
      })
    return () => {
      current = false
    }
  }, [examPath])

  async function pick(): Promise<void> {
    try {
      const picked = await window.heimdall.pickFile('exam')
      if (picked) setExamPath(picked)
    } catch (error) {
      setNotice(noticeFrom('No se pudo abrir el fichero', error))
    }
  }

  return (
    <div className="flex h-full flex-col">
      <ViewHeader title={t.home.title} />
      <div className="min-h-0 flex-1 space-y-5 overflow-auto p-6">
        <PickCard
          icon={<FileText className="h-4 w-4" />}
          title={t.home.exam}
          name={described.exam?.name ?? null}
          meta={described.exam?.checks == null ? null : t.home.examMeta(described.exam.checks)}
          path={examPath}
          onPick={() => void pick()}
        />
        <p className="text-xs text-muted-foreground">{t.home.examFile}</p>

        {examPath && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">{t.home.nextStep}</p>
            <Button onClick={() => setView('correct')}>
              <ArrowRight className="h-4 w-4" />
              {t.home.goToCorrect}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * The exam, by its name.
 *
 * The name comes from the file itself —what the teacher called the exam—
 * because that is what they recognise; the path is what the computer needs
 * and it waits inside «detalles avanzados», where it is still one click away
 * when something has to be looked at on disk.
 */
function PickCard({
  icon,
  title,
  name,
  meta,
  path,
  onPick
}: {
  icon: React.ReactNode
  title: string
  name: string | null
  meta: string | null
  path: string | null
  onPick: () => void
}) {
  const setNotice = useApp((s) => s.setNotice)

  async function openFolder(): Promise<void> {
    if (!path) return
    try {
      await window.heimdall.openFolder(path)
    } catch (error) {
      setNotice(noticeFrom(t.home.folderFailed, error))
    }
  }

  return (
    <Card>
      <CardContent className="space-y-2 pt-5">
        <div className="flex items-center gap-2 text-micro uppercase tracking-[0.09em] text-muted-foreground">
          {icon}
          {title}
        </div>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-name font-semibold">
              {path ? (name ?? t.home.unnamed) : <span className="text-muted-foreground">{t.home.none}</span>}
            </p>
            {path && meta && <p className="text-xs text-muted-foreground">{meta}</p>}
          </div>
          <Button variant="outline" size="sm" onClick={onPick}>
            {path ? t.home.change : t.home.choose}
          </Button>
        </div>
        {path && (
          <details>
            <summary className="cursor-pointer text-xs text-muted-foreground">
              {t.home.advanced}
            </summary>
            <p className="mt-1 break-all font-mono text-dense text-muted-foreground">{path}</p>
            <Button variant="ghost" size="sm" className="mt-1" onClick={() => void openFolder()}>
              <FolderOpen className="h-4 w-4" />
              {t.home.openFolder}
            </Button>
          </details>
        )}
      </CardContent>
    </Card>
  )
}
