import { FileText, Users } from 'lucide-react'
import { Button, Card, CardContent, CardHeader, CardTitle, ViewHeader } from '@/components/ui'
import { useApp, noticeFrom } from '@/stores/app'
import { t } from '@/i18n/es'

export default function HomeView() {
  const examPath = useApp((s) => s.examPath)
  const classPath = useApp((s) => s.classPath)
  const setExamPath = useApp((s) => s.setExamPath)
  const setClassPath = useApp((s) => s.setClassPath)
  const setNotice = useApp((s) => s.setNotice)

  async function pick(kind: 'exam' | 'class'): Promise<void> {
    try {
      const picked = await window.heimdall.pickFile(kind)
      if (!picked) return
      if (kind === 'exam') setExamPath(picked)
      else setClassPath(picked)
    } catch (error) {
      setNotice(noticeFrom('No se pudo abrir el fichero', error))
    }
  }

  return (
    <div className="flex h-full flex-col">
      <ViewHeader title={t.home.title} />
      <div className="min-h-0 flex-1 space-y-4 overflow-auto p-6">
        <div className="grid gap-4 md:grid-cols-2">
          <FileCard
            icon={<FileText className="h-4 w-4" />}
            title={t.home.exam}
            hint={t.home.examHint}
            path={examPath}
            onPick={() => void pick('exam')}
          />
          <FileCard
            icon={<Users className="h-4 w-4" />}
            title={t.home.classroom}
            hint={t.home.classHint}
            path={classPath}
            onPick={() => void pick('class')}
          />
        </div>
        <p className="max-w-3xl text-sm text-muted-foreground">{t.home.pending}</p>
      </div>
    </div>
  )
}

function FileCard({
  icon,
  title,
  hint,
  path,
  onPick
}: {
  icon: React.ReactNode
  title: string
  hint: string
  path: string | null
  onPick: () => void
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">{hint}</p>
        <p className="truncate font-mono text-dense" title={path ?? undefined}>
          {path ?? <span className="text-muted-foreground">{t.home.none}</span>}
        </p>
        <Button variant="outline" size="sm" onClick={onPick}>
          {t.home.choose}
        </Button>
      </CardContent>
    </Card>
  )
}
