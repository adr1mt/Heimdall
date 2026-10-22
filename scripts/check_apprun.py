#!/usr/bin/env python3
"""Exercise the generated AppRun's argument policy with disposable stubs."""
import os
from pathlib import Path
import subprocess
import sys
import tempfile

source = Path(sys.argv[1]).read_bytes()
for available, explicit in [(True, False), (False, False), (True, True), (False, True)]:
    with tempfile.TemporaryDirectory(prefix='heimdall-apprun-') as temporary:
        root = Path(temporary)
        launcher = root / 'AppRun'
        launcher.write_bytes(source)
        launcher.chmod(0o700)
        unshare = root / 'unshare'
        unshare.write_text('#!/bin/sh\nexit ' + ('0' if available else '1') + '\n')
        unshare.chmod(0o700)
        binary = root / 'heimdall-gui'
        binary.write_text('#!/bin/sh\nprintf "%s\\n" "$@"\n')
        binary.chmod(0o700)
        args = (['--no-sandbox'] if explicit else []) + ['--user-data-dir=/fictional/profile']
        env = dict(os.environ, APPDIR=str(root), PATH=str(root)+':/usr/bin:/bin')
        result = subprocess.run(['bash', str(launcher), *args], env=env, text=True,
                                capture_output=True, check=True, timeout=5)
        expected = (['--no-sandbox'] if explicit or not available else []) + ['--user-data-dir=/fictional/profile']
        if result.stdout.splitlines() != expected:
            raise SystemExit(f'AppRun arguments differ: {result.stdout!r}; expected {expected}')
print('AppRun: user namespaces available/unavailable and explicit fallback verified.')
