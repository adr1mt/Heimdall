import * as monaco from 'monaco-editor/editor/editor.api.js'
import { loader } from '@monaco-editor/react'
import editorWorker from 'monaco-editor/editor/editor.worker.js?worker'
import 'monaco-editor/languages/definitions/yaml/register.js'

// Bundle the editor and its worker locally: no CDN or network access.
self.MonacoEnvironment = { getWorker: () => new editorWorker() }
loader.config({ monaco })
