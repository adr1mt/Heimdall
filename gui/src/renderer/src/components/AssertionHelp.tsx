/** The current exam syntax. Keep examples aligned with internal/assert. */
export function AssertionHelp() {
  const assertions = [
    ['igual_a', 'La salida completa coincide con el texto esperado. Ignora espacios y saltos de línea al principio y al final, pero conserva los espacios interiores.', 'igual_a: "active"'],
    ['contiene', 'El texto aparece en cualquier parte de la salida. Distingue mayúsculas y minúsculas.', 'contiene: "192.168.1.10"'],
    ['no_contiene', 'El texto no aparece. Requiere una ejecución completa y código de salida 0; una máquina que no responde no demuestra ausencia.', 'no_contiene: "PermitRootLogin yes"'],
    ['exit_code', 'Comprueba el código de salida del comando, no su texto. El 0 suele indicar éxito. No se puede usar con valor:.', 'cmd: ["test", "-f", "/etc/hosts"]\nexit_code: 0'],
    ['cerca_de', 'Busca texto en la línea que contiene el ancla y en las siguientes líneas indicadas. Con lineas: 0 solo busca en la misma línea. Prueba todas las apariciones del ancla.', 'cerca_de:\n  ancla: "pools"\n  lineas: 3\n  contiene: "192.168.1.10"']
  ]
  return <div className="space-y-4 text-sm">
    <p>Las <strong>aserciones</strong> indican qué debe cumplir cada comprobación. Elige exactamente una por comprobación. Las claves actuales se escriben en minúsculas y en español, salvo <code>exit_code</code>.</p>
    {assertions.map(([name, description, example]) => <section key={name} className="space-y-1">
      <h3 className="font-mono font-semibold">{name}</h3>
      <p className="text-muted-foreground">{description}</p>
      <pre className="overflow-x-auto rounded bg-muted p-3 text-xs"><code>{example}</code></pre>
    </section>)}
    <p>Las comparaciones de texto usan la salida estándar del comando (stdout), no sus mensajes de error. Buscan texto literal, sin expresiones regulares. También puedes comparar un campo con <code>valor: "{'${alumno.respuesta}'}"</code> y una aserción de texto.</p>
    <p>Escribe <code>cmd</code> como lista de argumentos; no admite tuberías de shell. Si no hay evidencia suficiente por un problema técnico, la comprobación queda sin evaluar.</p>
    <p>Zoom: <kbd>Ctrl + +</kbd> para ampliar, <kbd>Ctrl + -</kbd> para reducir y <kbd>Ctrl + 0</kbd> para volver al 100 %. También funciona mientras escribes en el editor.</p>
  </div>
}
