import type { HeimdallApi } from '../shared/types'

declare global {
  interface Window {
    heimdall: HeimdallApi
  }
}

export {}
