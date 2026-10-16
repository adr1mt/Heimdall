import * as monaco from 'monaco-editor/esm/vs/editor/editor.api'
import { loader } from '@monaco-editor/react'
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import { conf, language } from 'monaco-editor/esm/vs/basic-languages/yaml/yaml'

// Bundle the editor and its worker locally: no CDN or network access.
self.MonacoEnvironment = { getWorker: () => new editorWorker() }
monaco.languages.register({ id: 'yaml' })
monaco.languages.setLanguageConfiguration('yaml', conf)
monaco.languages.setMonarchTokensProvider('yaml', language)
loader.config({ monaco })
