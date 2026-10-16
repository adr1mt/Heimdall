# El actualizador en sesiones cortas · prueba real (2026-10-16)

Commit `80ad962`, rama `fix/actualizador-sesiones-cortas`. Sin publicar nada:
AppImage construido desde la rama con la versión forzada a 0.9.9, contra el
feed real de GitHub, donde la última publicada es la 1.0.0.

```bash
make build && cd gui && npm run dist -- -c.extraMetadata.version=0.9.9
E=/tmp/heimdall-e2e   # perfil aislado: no toca ~/.config/heimdall-gui
cp gui/dist/Heimdall-0.9.9.AppImage $E/app/Heimdall.AppImage
XDG_CONFIG_HOME=$E/config $E/app/Heimdall.AppImage --no-sandbox
wmctrl -x -c heimdall-gui   # cierre normal de la ventana
```

## Resultado

| Paso | Observado |
|---|---|
| AppImage de prueba 0.9.9 | `dfc6383b…c52a`, 155 102 575 bytes |
| Comprobación y descarga (155 MB) | terminadas en menos de un minuto tras abrir |
| Registro en disco | `$E/config/heimdall-gui/logs/actualizacion.log` |
| Al cerrar | AppImage sustituido; salida 0; `updates/` vacío |
| AppImage resultante | `ac94d0c8…bd4b7`, igual al digest publicado de la 1.0.0 |
| Reapertura | la 1.0.0 abre su ventana y se cierra con normalidad |

Registro completo:

```
2026-10-16T13:44:55.126Z descargada la versión 1.0.0; se instalará al cerrar
2026-10-16T13:45:03.345Z instalada la versión 1.0.0
```

## Límites

- La descarga fue rápida: el corte por descarga parada y el tope de 30 minutos
  solo están cubiertos por los tests (`gui/tests/update-download.test.ts`).
- No se probó una corrección ni el modo examen durante la descarga en el
  AppImage real; sigue cubierto por `gui/tests/updater.test.ts`.
- La 1.0.0 instalada conserva el actualizador viejo: el arreglo llega a las
  aulas a partir de la primera versión que lo incluya.
