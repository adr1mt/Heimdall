/**
 * The name the teacher gave an exam, as the screen reads it. A path is what a
 * computer needs; a name is what the teacher chose.
 *
 * Null is «could not be read»: the engine is the one that validates the file
 * and says what is wrong with it.
 */
export interface ExamDescription {
  name: string | null
  checks: number | null
}

export interface Description {
  exam: ExamDescription | null
}
