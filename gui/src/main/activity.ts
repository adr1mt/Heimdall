// The correction owns the network from the moment its start is accepted.
const listeners = new Set<() => void>()
const settledListeners = new Set<() => void>()

export function onCorrectionStarting(listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export function correctionStarting(): void {
  for (const listener of listeners) listener()
}

export function onCorrectionSettled(listener: () => void): () => void {
  settledListeners.add(listener)
  return () => { settledListeners.delete(listener) }
}

export function correctionSettled(): void {
  // Let synchronous transitions finish, including stopping one exam to start another.
  queueMicrotask(() => {
    for (const listener of settledListeners) listener()
  })
}
