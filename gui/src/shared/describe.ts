/**
 * The names the teacher gave an exam and a classroom, as the screen reads
 * them. A path is what a computer needs; a name is what the teacher chose.
 *
 * Null everywhere is «could not be read»: the engine is the one that
 * validates both files and says what is wrong with them.
 */
export interface ExamDescription {
  name: string | null
  checks: number | null
}

export interface ClassDescription {
  name: string | null
  students: number | null
}

export interface Description {
  exam: ExamDescription | null
  classroom: ClassDescription | null
}
