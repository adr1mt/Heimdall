import { SectionTitle, ViewHeader } from '@/components/ui'
import { t } from '@/i18n/es'

export default function HelpView() {
  return (
    <div className="flex h-full flex-col">
      <ViewHeader title={t.help.title} />
      <div className="min-h-0 flex-1 space-y-8 overflow-auto p-6">
        <Block title={t.help.whatSection} body={t.help.what} />
        <Block title={t.help.errorsSection} body={t.help.errors} />
        <Block title={t.help.filesSection} body={t.help.files} />
      </div>
    </div>
  )
}

function Block({ title, body }: { title: string; body: string }) {
  return (
    <section className="max-w-3xl">
      <SectionTitle>{title}</SectionTitle>
      <p className="text-sm text-muted-foreground">{body}</p>
    </section>
  )
}
