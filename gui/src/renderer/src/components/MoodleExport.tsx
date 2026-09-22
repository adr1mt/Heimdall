import { useState } from 'react'
import { GraduationCap } from 'lucide-react'
import { Button, ConfirmDialog } from '@/components/ui'
import { moodleCsv, moodleCsvName, moodleRows, moodleSummary, scaleOf } from '@/lib/export'
import { noticeFrom, useApp } from '@/stores/app'
import { t } from '@/i18n/es'

/**
 * The grades on their way to Moodle.
 *
 * The same button for a single correction, a chain and an exam session: all
 * three already say a student's grade with the same rules, so all three hand
 * over the same three fields and none of them can send Moodle a number the
 * others would not (ADR-0019, ADR-0020).
 */
export function MoodleExportButton({
  rows,
  at
}: {
  /** The students, as every export already describes them. */
  rows: { name: string; moodleId: string; grade: string }[]
  /** When the grades were closed, for the file's name. */
  at: string
}) {
  const scaleId = useApp((s) => s.scale)
  const setNotice = useApp((s) => s.setNotice)
  const [confirm, setConfirm] = useState(false)
  const scale = scaleOf(scaleId)
  const going = moodleRows(rows)

  async function save(): Promise<void> {
    setConfirm(false)
    try {
      const path = await window.heimdall.saveCsv(moodleCsvName(at), moodleCsv(going))
      setNotice(path ? t.moodle.saved(path) : t.export.cancelled)
    } catch (error) {
      setNotice(noticeFrom(t.moodle.failed, error))
    }
  }

  return (
    <div>
      <Button variant="outline" size="sm" onClick={() => setConfirm(true)}>
        <GraduationCap className="h-4 w-4" />
        {t.moodle.button}
      </Button>
      <ConfirmDialog
        open={confirm}
        title={t.moodle.title}
        confirmLabel={t.export.yes}
        onConfirm={() => void save()}
        onCancel={() => setConfirm(false)}
      >
        <span className="space-y-2 block">
          <span className="block">{moodleSummary(rows, scale)}</span>
          <span className="block">{t.moodle.hint}</span>
          {/* Nadie se queda fuera en silencio: si falta algún correo, se dice
              aquí y se dice dónde se arregla. */}
          {going.length < rows.length && (
            <span className="block text-xs text-muted-foreground">{t.moodle.noEmail}</span>
          )}
          <span className="block text-xs text-muted-foreground">{t.export.scale(scale.label)}</span>
        </span>
      </ConfirmDialog>
    </div>
  )
}
