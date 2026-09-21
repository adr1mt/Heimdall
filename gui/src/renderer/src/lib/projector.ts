/**
 * Projector mode: what can be shown on the classroom screen.
 *
 * The results screen carries the address of every machine, the command that
 * was sent to it —which contains that address—, the output the machine
 * printed and the technical reason of a check that could not run, which names
 * the machine it could not reach. Projected in front of the class, that hands
 * whoever is looking the way into a classmate's machine, and it says whose
 * machine each row is.
 *
 * Names are NOT touched. The teacher chose to correct a named class and needs
 * the names to talk to the class; what gets covered is the machine, which is
 * what the teacher never chose to project.
 *
 * Secrets are not covered here because there are none to cover: the artifact
 * is born without them (ADR-0009) and a password can never reach a command.
 */

/** An address, with the port when it carries one: `127.1.2.3` or `127.1.2.3:2299`. */
const IPV4 = /\b\d{1,3}(?:\.\d{1,3}){3}(?::\d{1,5})?\b/g
const HIDDEN_ADDRESS = '•••.•••.•••.•••'
const HIDDEN = '••••••'

/** Shortest literal worth replacing: below this it would eat innocent text. */
const MIN_LITERAL = 3

/**
 * Covers machine data in a line of text. `literals` are the host names and
 * addresses the artifact itself names, so a machine called `alu1.aula` is
 * covered too and not only the numeric form.
 */
export function maskMachines(text: string, literals: string[]): string {
  let out = text
  for (const literal of literals) out = out.split(literal).join(HIDDEN)
  return out.replace(IPV4, HIDDEN_ADDRESS)
}

/** A whole field that is machine data: covered outright. */
export function maskField(value: string): string {
  return value ? HIDDEN : value
}

/**
 * The literals to cover, longest first: if one host name contains another,
 * the long one goes first and no half name is left showing.
 */
export function machineLiterals(values: (string | undefined)[]): string[] {
  const out = new Set<string>()
  for (const value of values) {
    if (typeof value === 'string' && value.length >= MIN_LITERAL) out.add(value)
  }
  return [...out].sort((a, b) => b.length - a.length)
}

/**
 * The masking function in force. Off the projector it is the identity, so
 * callers pay nothing and need not ask whether the mode is on: the output of
 * one student's machine reaches 64 kB and it is shown line by line.
 */
export function maskerFor(on: boolean, literals: string[]): (text: string) => string {
  if (!on) return (text) => text
  return (text) => maskMachines(text, literals)
}
