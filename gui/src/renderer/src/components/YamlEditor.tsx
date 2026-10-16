import { useRef } from 'react'
import Editor from '@monaco-editor/react'
import { useApp } from '@/stores/app'
import '../monaco-setup'

export default function YamlEditor({
  text,
  disabled,
  onChange,
  onSave
}: {
  text: string
  disabled: boolean
  onChange: (value: string) => void
  onSave: () => void
}) {
  const theme = useApp((s) => s.theme)
  const save = useRef(onSave)
  save.current = onSave
  return (
    <Editor
      language="yaml"
      value={text}
      theme={theme === 'dark' ? 'vs-dark' : 'light'}
      onChange={(value) => onChange(value ?? '')}
      onMount={(editor, monaco) => {
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => save.current())
      }}
      options={{
        ariaLabel: 'Editor YAML del examen',
        readOnly: disabled,
        fontSize: 14,
        fontFamily: 'ui-monospace, monospace',
        tabSize: 2,
        insertSpaces: true,
        automaticLayout: true,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        padding: { top: 16 },
        lineNumbersMinChars: 3,
        wordWrap: 'on',
        renderWhitespace: 'selection',
        bracketPairColorization: { enabled: true }
      }}
    />
  )
}
