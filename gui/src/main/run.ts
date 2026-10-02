import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { basename, dirname, join } from 'node:path'
import { parseEvent, type EngineEvent } from '../shared/events'

/** The exam file the engine looks for inside the directory it is given. */
const EXAM_FILE = 'examen.yaml'

/** The version of the one-line JSON document the engine reads from stdin. */
const SECRETS_SCHEMA = 1

/**
 * Longest line accepted from the stream. The contract's events are small and
 * carry no output from a student's machine, so anything past this is a broken
 * engine and not a long run: the line is dropped instead of growing this
 * process without bound.
 */
const MAX_LINE = 1 << 20

/** How much of stderr is kept to explain a failure. Not a log. */
const MAX_STDERR = 8 << 10

/** What the engine is asked to evaluate. */
export interface RunTarget {
  /** Directory handed to `heimdall run`. */
  dir: string
  /** Classroom file name inside it, for --cname. */
  className: string
  /** Previous artifact to repeat, for --retry. Absent in a normal run. */
  retryFrom?: string
  /**
   * Artifacts of the earlier rounds of this exam session, oldest first, for
   * --session. The engine reads them and leaves out whoever already finished
   * (ADR-0020); this process only passes the names along.
   */
  sessionRounds?: string[]
}

/**
 * The folder the engine is handed, out of the exam the teacher opened. The
 * engine takes a directory, not a path, and the exam has a fixed name inside
 * it. Anything else is told here, in Spanish, before a single machine is
 * touched.
 *
 * The classroom is not asked for: it is written into this same folder from
 * the chosen class, before the run (ADR-0022).
 */
export function projectDirOf(examPath: string): string {
  if (basename(examPath) !== EXAM_FILE) {
    throw new Error(`El examen tiene que llamarse «${EXAM_FILE}»; has elegido «${basename(examPath)}».`)
  }
  return dirname(examPath)
}

/**
 * The argument vector. No shell, ever, and no secret in it: a password in argv
 * is readable with `ps` by any user of the machine (ADR-0009).
 */
export function runArgs(target: RunTarget): string[] {
  const args = [
    'run',
    '--secrets=stdin',
    '--events=ndjson',
    `--var=${join(target.dir, 'var')}`,
    `--cname=${target.className}`
  ]
  // The engine picks what gets repeated, out of the artifact it is given: the
  // interface never sends a list of checks (ADR-0018).
  if (target.retryFrom) args.push(`--retry=${target.retryFrom}`)
  // One flag per round, oldest first. The order is the order they ran and it
  // is not sorted here: getting it wrong would make «de qué vuelta sale» a
  // lie (ADR-0020 §5).
  for (const round of target.sessionRounds ?? []) args.push(`--session=${round}`)
  args.push(target.dir)
  return args
}

/** The one-line document the engine reads from stdin. */
export function secretsLine(secrets: Record<string, string>): string {
  return `${JSON.stringify({ schema: SECRETS_SCHEMA, secrets })}\n`
}

/**
 * Splits a byte stream into lines. The stream arrives in chunks that have
 * nothing to do with line boundaries, and half an event is not an event.
 */
export class LineSplitter {
  private buffer = ''
  private overflowed = false

  push(chunk: string, onLine: (line: string) => void): void {
    this.buffer += chunk
    let index = this.buffer.indexOf('\n')
    while (index >= 0) {
      const line = this.buffer.slice(0, index)
      this.buffer = this.buffer.slice(index + 1)
      if (!this.overflowed) onLine(line)
      this.overflowed = false
      index = this.buffer.indexOf('\n')
    }
    if (this.buffer.length > MAX_LINE) {
      // Drop the runaway line and everything until the next newline.
      this.buffer = ''
      this.overflowed = true
    }
  }

  /** The last line, when the engine ended without a final newline. */
  flush(onLine: (line: string) => void): void {
    if (this.buffer && !this.overflowed) onLine(this.buffer)
    this.buffer = ''
    this.overflowed = false
  }
}

export interface RunCallbacks {
  onEvent: (event: EngineEvent) => void
  /** The process is gone. `stderr` is the tail the engine wrote, if any. */
  onClose: (exitCode: number | null, stderr: string) => void
}

/**
 * One engine process. It exists while a correction is running and it is the
 * only thing in the application that knows a password, for as long as it takes
 * to write one line into the engine's stdin.
 */
export class RunSession {
  private child: ChildProcessWithoutNullStreams
  private stderr = ''
  private cancelled = false

  constructor(enginePath: string, target: RunTarget, secrets: Record<string, string>, cb: RunCallbacks) {
    this.child = spawn(enginePath, runArgs(target), {
      cwd: target.dir,
      stdio: ['pipe', 'pipe', 'pipe']
    })

    // The secrets leave this process here and nowhere else: one line into the
    // engine's stdin, and the pipe is closed straight away.
    this.child.stdin.on('error', () => {
      // A engine that died before reading loses the line; the exit code and
      // stderr already explain it and there is nothing to add.
    })
    this.child.stdin.end(secretsLine(secrets))

    const stream = new LineSplitter()
    this.child.stdout.setEncoding('utf-8')
    this.child.stdout.on('data', (chunk: string) => {
      stream.push(chunk, (line) => {
        const event = parseEvent(line)
        if (event) cb.onEvent(event)
      })
    })

    this.child.stderr.setEncoding('utf-8')
    this.child.stderr.on('data', (chunk: string) => {
      if (this.stderr.length < MAX_STDERR) this.stderr += chunk
    })

    let finished=false
    const finish = (code: number | null): void => {
      if(finished) return
      finished=true
      stream.flush((line) => {
        const event = parseEvent(line)
        if (event) cb.onEvent(event)
      })
      cb.onClose(code, this.stderr.slice(0, MAX_STDERR))
    }

    this.child.on('error', (error) => {
      this.stderr = `${error.message}\n${this.stderr}`
      finish(null)
    })
    this.child.on('close', (code) => finish(code))
  }

  /**
   * Stops the run the way the engine expects: the same signal Ctrl-C sends, so
   * it cancels, writes the partial artifact and exits with 4. Killing it
   * outright would throw away everything already corrected.
   */
  cancel(): void {
    if (this.cancelled) return
    this.cancelled = true
    this.child.kill('SIGINT')
  }
}
