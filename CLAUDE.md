# Evalon

Motor de evaluación de prácticas de sistemas y redes por SSH, sucesor de
[Teuton](https://github.com/teuton-software/teuton). Go, binario único, examen
declarativo en YAML, resultado canónico en JSON. La GUI existente
([teuton-gui](https://github.com/adr1mt/teuton-gui)) se **adapta**, no se
reescribe.

El nombre `Evalon` es provisional (D-7).

## Documentación autoritativa

| Necesitas… | Lee |
|---|---|
| Arquitectura vigente | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| Decisiones cerradas | [docs/adr/](docs/adr/) |
| Fases del producto | [docs/ROADMAP.md](docs/ROADMAP.md) |
| Backlog ejecutable | [docs/project/TASKS.json](docs/project/TASKS.json) |
| Estado entre sesiones | [docs/project/PROGRESS.md](docs/project/PROGRESS.md) |
| Reglas de ejecución | [.claude/rules/](.claude/rules/) |
| Especificaciones de detalle | [docs/design/](docs/design/) |
| Evidencia del sistema viejo | [docs/research/](docs/research/) |

Prioridad ante contradicciones: **ADR aceptado > `docs/design/` > `docs/research/`**.
`docs/research/` es histórico: no se reaudita Teuton salvo que una tarea lo pida.

## Principios no negociables

1. Integridad de la nota.
2. Ningún error silencioso.
3. Un error técnico nunca es un fallo académico.
4. Ningún alumno puede bloquear o abortar la evaluación de los demás.
5. Ningún comando puede bloquear indefinidamente una evaluación.
6. El denominador se fija en el PLAN, antes de tocar ninguna máquina.
7. Todos los alumnos reciben las mismas comprobaciones y los mismos pesos.
8. Los secretos no aparecen en informes, logs, `argv` ni artefactos.
9. Simplicidad antes que sofisticación.
10. Ninguna funcionalidad hipotética sin un caso de uso demostrado.
11. Tests y evidencia antes de dar una tarea por terminada.
12. El modelo canónico es la fuente de verdad; la compatibilidad con Teuton es
    un adaptador temporal.

## Empezar una sesión

1. `pwd` y `git status`; `git log --oneline -5`.
2. Lee este fichero, `docs/project/PROGRESS.md` y `docs/project/TASKS.json`.
3. Lee los ADR y las reglas que cite la tarea elegida. Nada más.
4. Smoke test mínimo: `make check` cuando exista el módulo Go.

## Seleccionar la tarea

La tarea `READY` de mayor prioridad (`P0` > `P1` > `P2`) con todas sus
`depends_on` en `DONE`. A igualdad, el `id` menor. **Una tarea por sesión.**

Si la tarea resulta más grande de lo previsto: divídela en `TASKS.json` antes de
implementarla, y termina una parte coherente.

## Terminar una sesión

1. Ejecuta los tests de la tarea y la suite rápida.
2. Revisa `git diff`.
3. Marca `DONE` solo si se cumplen **todos** sus `acceptance`.
4. Pasa a `READY` las tareas cuyas dependencias hayan quedado satisfechas.
5. Actualiza `PROGRESS.md` (≤ 60 líneas) y `DECISIONS.md` si hubo decisión.
6. Nuevo ADR si cambió una decisión arquitectónica. Nunca edites un ADR
   aceptado en silencio.
7. Commit local descriptivo (conventional commits, en inglés). Sin push, sin
   tags, sin tocar remotos.

## Comandos

El módulo Go todavía no existe (T001). Cuando exista:

```bash
make check    # go vet + go test ./... (rápidos, sin red)
make test     # + tests de integración SSH (requiere el laboratorio podman)
make build    # binario en bin/evalon
make lab      # levanta el laboratorio SSH de pruebas
```

## Idioma

Documentación y claves del YAML de examen: español. Código, comentarios,
nombres de campo JSON y commits: inglés.
