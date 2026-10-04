#!/usr/bin/env python3
"""Real engine with a full stdout pipe that is never drained (T167)."""

import array
import fcntl
import json
import signal
import subprocess
import tempfile
import termios
import time
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
BIN = ROOT / "bin/heimdall"


def project(parent):
    folder = parent / "exam"
    folder.mkdir(parents=True)
    exam = "examen: Prueba de tuberia\nversion: 1\nhosts: []\ngrupos:\n  - grupo: G\n    comprobaciones:\n"
    for index in range(20):
        exam += f"      - id: c{index}\n        descripcion: C\n        valor: \"${{alumno.respuesta}}\"\n        contiene: x\n"
    (folder / "examen.yaml").write_text(exam)
    classroom = "aula: Prueba de tuberia\nversion: 1\nalumnos:\n"
    for index in range(100):
        classroom += f'  - id: ficticio{index}\n    nombre: Ficticio {index}\n    respuesta: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"\n'
    (folder / "aula.yaml").write_text(classroom)
    return folder


def pipe_bytes(pipe):
    pending = array.array("i", [0])
    fcntl.ioctl(pipe.fileno(), termios.FIONREAD, pending, True)
    return pending[0]


def exercise(parent, cancel):
    folder = project(parent)
    child = subprocess.Popen(
        [str(BIN), "run", "--events=ndjson", f"--var={folder / 'var'}", str(folder)],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    try:
        capacity = fcntl.fcntl(child.stdout.fileno(), fcntl.F_GETPIPE_SZ)
        deadline = time.monotonic() + 5
        while pipe_bytes(child.stdout) < capacity - 4096 and time.monotonic() < deadline:
            if child.poll() is not None:
                raise AssertionError("engine exited before saturating stdout")
            time.sleep(0.005)
        pending = pipe_bytes(child.stdout)
        assert pending >= capacity - 4096, f"stdout pipe did not saturate: {pending}/{capacity}"
        if cancel:
            assert child.poll() is None, "run finished before SIGINT"
            child.send_signal(signal.SIGINT)
        try:
            code = child.wait(timeout=10)
        except subprocess.TimeoutExpired as error:
            raise AssertionError("engine blocked on unread stdout") from error
        assert code == (4 if cancel else 0), f"unexpected exit code: {code}"
        artifacts = list((folder / "var").glob("run-*.json"))
        assert len(artifacts) == 1, f"expected one canonical artifact: {artifacts}"
        result = json.loads(artifacts[0].read_text())
        assert result["status"] == ("CANCELLED" if cancel else "COMPLETE")
        assert len(result["students"]) == 100
        assert result["plan"]["check_count"] == 20
        assert any(w["code"] == "PROGRESS_LOST" for w in result.get("warnings", [])), "lost progress was not recorded"
        if not cancel:
            assert all(student["score"]["final_score"] == 100 for student in result["students"])
        assert "aviso" in child.stderr.read().decode(), "lost progress was not reported"
        print(f"{'cancel' if cancel else 'normal'}: full pipe, exit {code}, canonical result saved")
    finally:
        if child.poll() is None:
            child.kill()
            child.wait()
        child.stdout.close()
        child.stderr.close()


def main():
    with tempfile.TemporaryDirectory(prefix="heimdall-progress-pipe-") as temporary:
        exercise(Path(temporary) / "cancel", True)
        exercise(Path(temporary) / "normal", False)


if __name__ == "__main__":
    main()
