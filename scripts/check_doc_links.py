#!/usr/bin/env python3
"""Check local file targets in maintained Markdown, without network access.

Historical research, audits, releases, retrospectives and DECISIONS are excluded:
they contain machine-local evidence and snapshots of earlier layouts.
"""
import re
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]


def documents(root):
    files = set(root.glob('*.md'))
    for folder in ('.claude/rules', 'docs/design', 'docs/adr'):
        files.update((root / folder).rglob('*.md'))
    files.update((root / 'docs').glob('*.md'))
    files.update((root / 'docs/reviews').rglob('*.md'))
    files.update(path for path in (root / 'docs/project').rglob('*.md')
                 if path.name != 'DECISIONS.md')
    for path in ('gui/README.md', 'test/README.md', 'testdata/artifacts/README.md'):
        if (root / path).exists():
            files.add(root / path)
    return sorted(files)


def targets(text):
    # Skip code while retaining line positions for useful diagnostics.
    fenced = False
    fence = ''
    for number, line in enumerate(text.splitlines(), 1):
        marker = re.match(r'^\s*(`{3,}|~{3,})', line)
        if marker:
            if not fenced:
                fenced, fence = True, marker[1][0]
            elif marker[1][0] == fence:
                fenced = False
            continue
        if fenced:
            continue
        line = re.sub(r'`+[^`]*`+', '', line)
        patterns = (
            r'!?\[[^\]]*\]\(\s*(<[^>]+>|[^\s)]+)(?:\s+["\'][^\n]*["\'])?\s*\)',
            r'^\s*\[[^\]]+\]:\s*(<[^>]+>|\S+)',
            r'(?:href|src)=["\']([^"\']+)["\']',
        )
        for pattern in patterns:
            for match in re.finditer(pattern, line):
                yield number, match[1].strip('<>')


def broken_links(path, root):
    errors = []
    for number, target in targets(path.read_text()):
        url = urlsplit(target)
        if url.scheme or url.netloc or not url.path:
            continue
        file = Path(unquote(url.path))
        # Absolute machine paths cannot resolve in a fresh checkout.
        resolved = (path.parent / file).resolve()
        if file.is_absolute() or not resolved.is_relative_to(root.resolve()) or not resolved.exists():
            errors.append(f'{path.relative_to(root)}:{number}: {target}')
    return errors


def main():
    files = documents(ROOT)
    errors = [error for path in files for error in broken_links(path, ROOT)]
    if errors:
        print('Enlaces locales rotos:')
        print('\n'.join(errors))
        raise SystemExit(1)
    print(f'Enlaces locales correctos en {len(files)} documentos mantenidos (sin comprobar anclas).')


if __name__ == '__main__':
    main()
