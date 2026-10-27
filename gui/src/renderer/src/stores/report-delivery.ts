import { create } from 'zustand'
import type { Delivery } from '../../../shared/types'

// Old receipts refer to per-exam file names and must not block the new name.
const STORAGE_KEY = 'heimdall-report-deliveries-informe-html'
type Receipts = Record<string, string[]>
function readReceipts(): Receipts {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
    return Object.fromEntries(Object.entries(value).filter(([, ids]) => Array.isArray(ids) && ids.every((id) => typeof id === 'string')))
  } catch { return {} }
}
interface DeliveryState {
  receipts: Receipts
  sending: boolean
  send: (runId: string, path: string, file: string, reports: Record<string, string>, individual?: boolean) => Promise<Delivery>
}

/** Shared by row actions, bulk delivery and navigation. Receipts contain no grades. */
export const useReportDelivery = create<DeliveryState>((set, get) => ({
  receipts: readReceipts(),
  sending: false,
  send: async (runId, path, file, reports, individual = false) => {
    if (get().sending) throw new Error('Ya hay un envío en curso. Espera a que termine.')
    if (individual && Object.keys(reports).some((id) => get().receipts[runId]?.includes(id))) {
      throw new Error('Este informe ya se ha enviado. Puedes reenviarlo con el envío general, tras confirmarlo.')
    }
    set({ sending: true })
    try {
      const delivery = await window.heimdall.sendReports(path, file, reports)
      const sent = delivery.students.filter((student) => student.delivered).map((student) => student.student_id)
      const receipts = { ...get().receipts }
      delete receipts[runId]
      receipts[runId] = [...new Set([...(get().receipts[runId] ?? []), ...sent])]
      const recent = Object.fromEntries(Object.entries(receipts).slice(-100))
      set({ receipts: recent })
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(recent)) }
      catch { throw new Error('El envío ha terminado, pero no se pudo guardar su registro. Comprueba la entrega antes de reenviar al volver a abrir Heimdall.') }
      return delivery
    } finally { set({ sending: false }) }
  }
}))
