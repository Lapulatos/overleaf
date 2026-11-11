/** Combine stored documents with current edits; never expose deleted document ranges. */
export async function loadNativeCommentRanges(projectId, { stored, live, docIds }) {
  const persisted = await stored(projectId)
  const current = await live(projectId)
  const ids = await docIds(projectId)
  const ranges = new Map(persisted.map(doc => [String(doc._id), doc.ranges]))
  for (const doc of current) ranges.set(String(doc.id), doc.ranges)
  return ids.map(id => ({
    id: String(id),
    ranges: ranges.get(String(id)) ?? { comments: [], changes: [] },
  }))
}
