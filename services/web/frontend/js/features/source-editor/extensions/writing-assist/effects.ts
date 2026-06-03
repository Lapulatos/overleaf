import { StateEffect } from '@codemirror/state'
import type { Issue } from './types'

/**
 * Effect that replaces the current set of writing-assist issues (and thus the
 * rendered decorations). Lives in its own module so both `decorations.ts`
 * (which owns the StateField) and `apply.ts` (which clears decorations on
 * apply) can import it without a circular dependency.
 */
export const setIssuesEffect = StateEffect.define<Issue[]>()

/**
 * Effect that forces the hover card to close immediately (used on apply, so the
 * card vanishes the instant the user accepts a fix rather than after the grace
 * timer). The hover StateField in `tooltip.ts` listens for it.
 */
export const closeHoverEffect = StateEffect.define<null>()

/**
 * Effect that removes the decoration covering a document range, used on apply
 * to drop just the fixed underline while leaving every other underline in place
 * (no full clear → no flicker). The decoration field maps the other marks
 * through the same change so they keep their positions.
 */
export const removeRangeEffect = StateEffect.define<{ from: number; to: number }>()

/**
 * Effect requesting an immediate writing check of the current viewport, fired
 * by the manual "check now" button in the progress overlay. The main view
 * plugin (index.ts) listens for it and runs its check(), bypassing the debounce
 * so a user-triggered check (e.g. to retry after a failure) feels instant.
 */
export const requestCheckEffect = StateEffect.define<null>()

/**
 * Effect requesting cancellation of an in-progress writing check, fired by the
 * "stop" button in the progress overlay when checking is active. The main view
 * plugin (index.ts) listens for it and calls checker.cancel().
 */
export const cancelCheckEffect = StateEffect.define<null>()

/**
 * Effect recording a LOCAL dismiss: suppress writing-assist issues within the
 * given document range (a sentence span) at this position only — without adding
 * anything to the Dismiss Notes. The localDismissField (local-dismiss.ts) holds
 * these ranges and maps them through edits, dropping a range when the text it
 * covers actually changes, so the suggestion can reappear after the sentence is
 * edited. The same sentence elsewhere in the document is unaffected.
 */
export const addLocalDismissEffect = StateEffect.define<{ from: number; to: number }>()
