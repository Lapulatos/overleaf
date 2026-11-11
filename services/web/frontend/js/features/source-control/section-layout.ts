// The fourth panel absorbs space only when all three sections are collapsed.
export function sectionLayout(layout: number[], index: number, expandedSize: number | null, collapsedSize: number) {
  const next = [...layout]
  const others = [0, 1, 2].filter(i => i !== index && next[i] > collapsedSize + 0.1)
  if (expandedSize === null) {
    const freed = next[index] - collapsedSize
    next[index] = collapsedSize
    next[others.at(-1) ?? 3] += freed
  } else {
    const minimum = Math.max(12, collapsedSize + 2)
    const available = next[3] + others.reduce((sum, i) => sum + Math.max(0, next[i] - minimum), 0)
    const wanted = others.length ? Math.max(minimum, expandedSize) : next[index] + available
    let needed = Math.min(available, wanted - next[index])
    const growth = needed
    const fromSpacer = Math.min(next[3], needed)
    next[3] -= fromSpacer
    needed -= fromSpacer
    for (const i of others.reverse()) {
      const take = Math.min(needed, Math.max(0, next[i] - minimum))
      next[i] -= take
      needed -= take
    }
    next[index] += growth
  }
  const active = [0, 1, 2].filter(i => next[i] > collapsedSize + 0.1)
  if (active.length) {
    next[active.at(-1)!] += next[3]
    next[3] = 0
  }
  return next
}
