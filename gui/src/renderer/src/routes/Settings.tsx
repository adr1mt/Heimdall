import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import {
  Button,
  ConfirmDialog,
  Input,
  SectionTitle,
  Segmented,
  SegmentedItem,
  ViewHeader
} from '@/components/ui'
import { useApp, noticeFrom } from '@/stores/app'
import { SCALES, scaleOf, toScale, type ScaleId } from '@/lib/scale'
import { t } from '@/i18n/es'

export default function SettingsView() {
  const engine = useApp((s) => s.engine)
  const scale = useApp((s) => s.scale)
  const setScale = useApp((s) => s.setScale)
  const passMark = useApp((s) => s.passMark)
  const setPassMark = useApp((s) => s.setPassMark)
  const setEngine = useApp((s) => s.setEngine)
  const setNotice = useApp((s) => s.setNotice)
  const [path, setPath] = useState('')
  const [saving, setSaving] = useState(false)
  // Whether this computer remembers the classroom password (ADR-0023). Only
  // whether: the value has no business on this screen.
  const [hasPassword, setHasPassword] = useState(false)
  const [confirmForget, setConfirmForget] = useState(false)

  useEffect(() => {
    window.heimdall
      .getEnginePath()
      .then(setPath)
      .catch((error) => setNotice(noticeFrom('No se pudo leer la ruta del motor', error)))
  }, [setNotice])

  useEffect(() => {
    window.heimdall
      .rememberedPassword()
      .then((saved) => setHasPassword(saved !== ''))
      .catch(() => setHasPassword(false))
  }, [])

  async function forget(): Promise<void> {
    setConfirmForget(false)
    try {
      await window.heimdall.forgetPassword()
      setHasPassword(false)
    } catch (error) {
      setNotice(noticeFrom('No se pudo olvidar la contraseña', error))
    }
  }

  async function save(): Promise<void> {
    setSaving(true)
    try {
      setEngine(await window.heimdall.setEnginePath(path))
    } catch (error) {
      setNotice(noticeFrom('No se pudo guardar la ruta del motor', error))
    } finally {
      setSaving(false)
    }
  }

  async function locate(): Promise<void> {
    try {
      const picked = await window.heimdall.pickFile('engine')
      if (picked) setPath(picked)
    } catch (error) {
      setNotice(noticeFrom('No se pudo abrir el fichero', error))
    }
  }

  return (
    <div className="flex h-full flex-col">
      <ViewHeader title={t.settings.title} />
      <div className="min-h-0 flex-1 space-y-8 overflow-auto p-6">
        <section className="max-w-2xl">
          <SectionTitle hint={t.engine.pathHint}>{t.settings.engineSection}</SectionTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={path}
              aria-label={t.engine.path}
              onChange={(e) => setPath(e.target.value)}
              className="w-80 font-mono text-dense"
            />
            <Button variant="outline" onClick={() => void locate()}>
              {t.engine.locate}
            </Button>
            <Button onClick={() => void save()} disabled={saving || !path.trim()}>
              {t.engine.save}
            </Button>
          </div>
          {engine && (
            <p
              className={
                engine.found
                  ? 'mt-3 flex items-center gap-2 text-sm text-success-strong'
                  : 'mt-3 flex items-center gap-2 text-sm text-destructive-strong'
              }
            >
              {engine.found ? (
                <CheckCircle2 className="h-4 w-4 shrink-0" />
              ) : (
                <AlertTriangle className="h-4 w-4 shrink-0" />
              )}
              {engine.found ? `${t.engine.ready} · ${engine.version}` : engine.problem}
            </p>
          )}
        </section>

        {/* The scale is the teacher's: it decides how a grade is written down
            when it leaves the application, and nothing else. */}
        <section className="max-w-2xl">
          <SectionTitle hint={t.settings.scaleHint}>{t.settings.scaleSection}</SectionTitle>
          <Segmented>
            {Object.values(SCALES).map((option) => (
              <SegmentedItem
                key={option.id}
                active={scale === option.id}
                onClick={() => setScale(option.id as ScaleId)}
              >
                {option.label}
              </SegmentedItem>
            ))}
          </Segmented>
          <p className="mt-2 text-xs text-muted-foreground">
            {t.settings.scaleExample(toScale(87, scaleOf(scale, passMark)))}
          </p>
        </section>

        {/* La marca de aprobado no cambia nada de lo que calculó el motor:
            dice desde qué punto se cuenta a un alumno como aprobado y, con
            eso, dónde cae el aprobado dentro de la escala del profesor. */}
        <section className="max-w-2xl">
          <SectionTitle hint={t.settings.passHint}>{t.settings.passSection}</SectionTitle>
          <label className="flex items-center gap-3">
            <span className="text-sm">{t.settings.passLabel}</span>
            <Input
              type="number"
              min={1}
              max={99}
              value={passMark}
              aria-label={t.settings.passLabel}
              onChange={(e) => setPassMark(Number(e.target.value))}
              className="w-24 tabular-nums"
            />
            <span className="text-sm text-muted-foreground">/ 100</span>
          </label>
          <p className="mt-2 text-xs text-muted-foreground">
            {t.settings.passExample(toScale(passMark, scaleOf(scale, passMark)))}
          </p>
        </section>

        {/* La contraseña de las máquinas se escribe una vez y se guarda
            cifrada. Aquí solo se puede olvidar (ADR-0023). */}
        <section className="max-w-2xl">
          <SectionTitle hint={t.settings.passwordHint}>{t.settings.passwordSection}</SectionTitle>
          <p className="text-sm text-muted-foreground">
            {hasPassword ? t.settings.passwordSaved : t.settings.passwordNone}
          </p>
          <Button
            variant="outline"
            className="mt-3"
            disabled={!hasPassword}
            onClick={() => setConfirmForget(true)}
          >
            {t.settings.passwordForget}
          </Button>
        </section>

        <section className="max-w-2xl">
          <SectionTitle>{t.settings.aboutSection}</SectionTitle>
          <p className="text-sm text-muted-foreground">{t.settings.about}</p>
          <p className="mt-2 text-xs text-muted-foreground">{t.settings.author}</p>
        </section>
      </div>

      <ConfirmDialog
        open={confirmForget}
        title={t.settings.passwordConfirmTitle}
        confirmLabel={t.settings.passwordConfirmYes}
        destructive
        onConfirm={() => void forget()}
        onCancel={() => setConfirmForget(false)}
      >
        {t.settings.passwordConfirmBody}
      </ConfirmDialog>
    </div>
  )
}
