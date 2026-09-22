/**
 * The teacher's scale: how the engine's 0-100 is written down for a human.
 *
 * It lives on its own because everything reads it —the screen, the reports,
 * the projector— and none of them should have to pull in the exporter to
 * write a number. The engine publishes 0-100 and never the teacher's scale
 * (architecture.md §8); nothing here is ever saved back into a correction.
 */

/**
 * The pass mark, over the 0-100 the engine publishes.
 *
 * It is not only what the summary counts as passed: it is where the half of
 * the teacher's scale falls. Getting 70 of the weight right is a 5, and that
 * is the mark this school works with.
 */
export const DEFAULT_PASS_MARK = 70

/** A mark outside 1-99 cannot anchor a scale: it would leave no room on a side. */
export function markOf(passMark: number): number {
  if (!Number.isFinite(passMark)) return DEFAULT_PASS_MARK
  return Math.min(99, Math.max(1, Math.round(passMark)))
}

export type ScaleId = 'ten' | 'hundred'

/** A scale the teacher marks in. */
export interface Scale {
  id: ScaleId
  /** What it is called on screen. */
  label: string
  /** The top mark. */
  max: number
  /** Decimals the mark is written with. */
  decimals: number
  /**
   * Where the half of this scale falls, over the 0-100 the engine publishes.
   *
   * It belongs to the scale and not to the screen that reads it: «0 a 10 with
   * the 5 at 70» is one thing, and splitting it in two invites a report and a
   * dashboard that disagree about the same student.
   */
  passMark: number
}

/**
 * The two scales in use. There is no free-form scale: an arbitrary maximum
 * invites a conversion nobody can check afterwards, and these are the two the
 * marks are actually recorded in.
 */
export const SCALES: Record<ScaleId, Scale> = {
  ten: { id: 'ten', label: '0 a 10', max: 10, decimals: 1, passMark: DEFAULT_PASS_MARK },
  hundred: { id: 'hundred', label: '0 a 100', max: 100, decimals: 0, passMark: DEFAULT_PASS_MARK }
}

export const DEFAULT_SCALE: ScaleId = 'ten'

export function scaleOf(id: string | null | undefined, passMark = DEFAULT_PASS_MARK): Scale {
  const base = id === 'hundred' ? SCALES.hundred : SCALES.ten
  return { ...base, passMark: markOf(passMark) }
}

/**
 * The engine's 0-100 in the teacher's scale, written as it is marked.
 *
 * A straight line would put the pass mark wherever the arithmetic left it: at
 * 70 points it would write a 7, and a 7 is not what a teacher hands back for
 * scraping a pass. So the conversion is two segments through (0, 0),
 * (passMark, max/2) and (100, max): the pass mark is always the middle of the
 * scale, wherever the teacher moves it.
 *
 * The engine's number never changes. This is how it is written down, and
 * nothing here is ever saved back into a correction.
 */
export function toScale(score100: number, scale: Scale): string {
  const mark = markOf(scale.passMark)
  const half = scale.max / 2
  const raw =
    score100 <= mark
      ? (score100 / mark) * half
      : half + ((score100 - mark) / (100 - mark)) * half
  const value = Math.min(scale.max, Math.max(0, raw))
  return value.toFixed(scale.decimals).replace('.', ',')
}
