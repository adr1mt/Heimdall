import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useReportDelivery } from '../src/renderer/src/stores/report-delivery'

const sendReports = vi.fn()
const setItem = vi.fn()
beforeEach(() => {
  vi.stubGlobal('window', { heimdall: { sendReports } })
  vi.stubGlobal('localStorage', { setItem })
  sendReports.mockReset()
  setItem.mockReset()
  useReportDelivery.setState({ receipts: {}, sending: false })
})
const delivered = (id: string, ok: boolean) => ({ student_id: id, name: id, delivered: ok })

describe('shared delivery receipts', () => {
  it('sends the exact selected HTML and prevents double clicks across row and bulk actions', async () => {
    let finish!: (value: unknown) => void
    sendReports.mockImplementation(() => new Promise((resolve) => { finish = resolve }))
    const first = useReportDelivery.getState().send('R1', '/artifact', 'informe-x.html', { a: 'own page' }, true)
    await expect(useReportDelivery.getState().send('R1', '/artifact', 'informe-x.html', { b: 'page' })).rejects.toThrow('en curso')
    expect(sendReports).toHaveBeenCalledExactlyOnceWith('/artifact', 'informe-x.html', { a: 'own page' })
    finish({ file: 'informe-x.html', students: [delivered('a', true)] })
    await first
    expect(useReportDelivery.getState()).toMatchObject({ sending: false, receipts: { R1: ['a'] } })
    await expect(useReportDelivery.getState().send('R1', '/artifact', 'informe-x.html', { a: 'own page' }, true)).rejects.toThrow('ya se ha enviado')
    expect(setItem).toHaveBeenCalled()
  })
  it('records only successful recipients, recognizes bulk sends in rows and allows explicit bulk resend or a new correction', async () => {
    sendReports.mockResolvedValue({ file: 'informe-x.html', students: [delivered('a', true), delivered('b', false)] })
    await useReportDelivery.getState().send('R1', '/a', 'informe-x.html', { a: 'A', b: 'B' })
    expect(useReportDelivery.getState().receipts.R1).toEqual(['a'])
    await expect(useReportDelivery.getState().send('R1', '/a', 'informe-x.html', { a: 'A' }, true)).rejects.toThrow('ya se ha enviado')
    await useReportDelivery.getState().send('R1', '/a', 'informe-x.html', { a: 'A' })
    await useReportDelivery.getState().send('R2', '/b', 'informe-x.html', { a: 'A' }, true)
    expect(sendReports).toHaveBeenCalledTimes(3)
  })
  it('failed sending unlocks the controls without creating a receipt; failed persistence remains visible', async () => {
    sendReports.mockRejectedValueOnce(new Error('sin conexión'))
    await expect(useReportDelivery.getState().send('R1', '/a', 'informe-x.html', { a: 'A' }, true)).rejects.toThrow('sin conexión')
    expect(useReportDelivery.getState()).toMatchObject({ sending: false, receipts: {} })
    sendReports.mockResolvedValue({ file: 'informe-x.html', students: [delivered('a', true)] })
    setItem.mockImplementation(() => { throw new Error('disco lleno') })
    await expect(useReportDelivery.getState().send('R1', '/a', 'informe-x.html', { a: 'A' }, true)).rejects.toThrow('no se pudo guardar')
    expect(useReportDelivery.getState()).toMatchObject({ sending: false, receipts: { R1: ['a'] } })
  })
})

it('restores successful deliveries after reopening the renderer', async () => {
  vi.stubGlobal('localStorage', { getItem: () => JSON.stringify({ R1: ['a'] }), setItem })
  vi.resetModules()
  const reopened = (await import('../src/renderer/src/stores/report-delivery')).useReportDelivery
  expect(reopened.getState().receipts.R1).toEqual(['a'])
  await expect(reopened.getState().send('R1', '/a', 'informe-x.html', { a: 'A' }, true)).rejects.toThrow('ya se ha enviado')
})

it('does not mistake old per-exam deliveries for delivery of informe.html', async () => {
  vi.stubGlobal('localStorage', { getItem: (key: string) => key === 'heimdall-report-deliveries' ? JSON.stringify({ R1: ['a'] }) : null, setItem })
  vi.resetModules()
  const upgraded = (await import('../src/renderer/src/stores/report-delivery')).useReportDelivery
  expect(upgraded.getState().receipts).toEqual({})
  sendReports.mockResolvedValue({ file: 'informe.html', students: [delivered('a', true)] })
  await upgraded.getState().send('R1', '/a', 'informe.html', { a: 'own page' }, true)
  expect(sendReports).toHaveBeenCalledWith('/a', 'informe.html', { a: 'own page' })
  expect(upgraded.getState().receipts.R1).toEqual(['a'])
})
