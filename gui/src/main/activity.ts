// The correction owns the network from the moment its start is accepted.
const listeners = new Set<() => void>()

export function onCorrectionStarting(listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export function correctionStarting(): void {
  for (const listener of listeners) listener()
}
