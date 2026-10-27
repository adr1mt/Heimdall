/** The same HTML stays on the student's server; Desktop only copies and opens it. */
export function ReportAccessHelp({ file }: { file?: string }) {
  return (
    <details className="text-sm">
      <summary className="cursor-pointer rounded py-1 font-medium focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring">Abrir el informe en Ubuntu Desktop</summary>
      <ol className="mt-2 list-decimal space-y-2 pl-5">
        <li>En Ubuntu Desktop abre <strong>Archivos → Otras ubicaciones → Conectar al servidor</strong>.</li>
        <li>Escribe <code>sftp://USUARIO@SERVIDOR:PUERTO</code>, usando los mismos datos que en tu conexión SSH. Introduce tu contraseña cuando la pida.</li>
        <li>Entra en tu carpeta personal y copia <code>{file ?? 'informe-<examen>.html'}</code> a Descargas de Ubuntu Desktop.</li>
        <li>Abre la copia con Firefox. Conserva la nota y todo el formato; no necesitas instalar nada en Ubuntu Server.</li>
      </ol>
      <p className="mt-2 text-xs text-muted-foreground">Usa tu propia cuenta y máquina. El informe solo contiene tus resultados y se entrega como archivo privado. Si SSH funciona mediante un salto o túnel, usa ese mismo acceso para copiarlo.</p>
    </details>
  )
}
