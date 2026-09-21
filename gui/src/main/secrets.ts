/** The ${MAYUSCULAS} form of a reference (ADR-0009). */
const REF = /\$\{([A-Z][A-Z0-9_]*)\}/g

/**
 * Names of the credentials a classroom file asks for, in the order they first
 * appear. It is a reading of the file, not a decision: the engine is the one
 * that validates the references and refuses a literal password, and a name
 * missed here ends in a clear configuration error instead of a wrong grade.
 */
export function secretRefsIn(text: string): string[] {
  const names: string[] = []
  for (const match of text.matchAll(REF)) {
    if (!names.includes(match[1])) names.push(match[1])
  }
  return names
}
