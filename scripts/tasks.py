#!/usr/bin/env python3
"""Read the canonical backlog without printing its entire history."""
import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def pending(tasks):
    by_id = {task['id']: task for task in tasks}
    result = []
    for task in tasks:
        if task['status'] in ('DONE', 'DROPPED'):
            continue
        waiting = [dep for dep in task.get('depends_on', [])
                   if by_id.get(dep, {}).get('status') != 'DONE']
        result.append({**task, 'waiting_on': waiting})
    return sorted(result, key=lambda task: ({'P0': 0, 'P1': 1, 'P2': 2}[task['priority']], task['id']))


def main():
    parser = argparse.ArgumentParser(description='Consultar docs/project/TASKS.json sin modificarlo.')
    parser.add_argument('task', nargs='?', help='ID de tarea; sin ID muestra pendientes.')
    parser.add_argument('--json', action='store_true', help='Salida JSON para otras herramientas.')
    args = parser.parse_args()
    tasks = json.loads((ROOT / 'docs/project/TASKS.json').read_text())['tasks']
    if args.task:
        task = next((task for task in tasks if task['id'] == args.task), None)
        if task is None:
            parser.error(f'tarea desconocida: {args.task}')
        print(json.dumps(task, ensure_ascii=False, indent=2))
        return
    tasks = pending(tasks)
    if args.json:
        print(json.dumps(tasks, ensure_ascii=False, indent=2))
        return
    for task in tasks:
        deps = ', '.join(task['depends_on']) or 'ninguna'
        waiting = ', '.join(task['waiting_on']) or 'ninguna'
        print(f"{task['id']} {task['priority']} {task['status']} · {task['title']}")
        print(f"  Dependencias: {deps}; pendientes: {waiting}")
    if not tasks:
        print('No hay tareas pendientes.')


if __name__ == '__main__':
    main()
