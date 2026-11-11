import { WritingAssistConversation } from '../../models/WritingAssistConversation.mjs'

export const conversationStore = {
  async create(conversation) {
    await WritingAssistConversation.create({
      ...conversation,
      _id: conversation.id,
    })
  },
  async find(id, userId, projectId) {
    const value = await WritingAssistConversation.findOne({
      _id: id,
      userId,
      projectId,
    })
      .lean()
      .exec()
    return value && { ...value, id: value._id }
  },
  async list(userId, projectId, limit) {
    const values = await WritingAssistConversation.find(
      { userId, projectId },
      { title: 1, updatedAt: 1, activeTaskId: 1, parent: 1 }
    )
      .sort({ updatedAt: -1, _id: -1 })
      .limit(limit)
      .lean()
      .exec()
    return values.map((value) => ({ ...value, id: value._id }))
  },
  async claim(id, revision, turn) {
    const result = await WritingAssistConversation.updateOne(
      { _id: id, revision, activeTaskId: null },
      {
        $push: { turns: turn },
        $set: { activeTaskId: turn.taskId, updatedAt: new Date() },
        $inc: { revision: 1 },
      }
    ).exec()
    return result.modifiedCount === 1
  },
  async settle(id, taskId, fields, revision) {
    // A late result for an earlier turn may update its review statuses, but must
    // never clear a newer active turn. Both changes are one atomic update.
    await WritingAssistConversation.updateOne(
      {
        _id: id,
        ...(revision === undefined ? {} : { revision }),
        turns: {
          $elemMatch: {
            taskId,
            status: { $in: ['submitting', 'running', fields.status] },
          },
        },
      },
      [
        {
          $set: {
            turns: {
              $map: {
                input: '$turns',
                as: 'turn',
                in: {
                  $cond: [
                    { $eq: ['$$turn.taskId', { $literal: taskId }] },
                    { $mergeObjects: ['$$turn', { $literal: fields }] },
                    '$$turn',
                  ],
                },
              },
            },
            activeTaskId: {
              $cond: [
                { $eq: ['$activeTaskId', { $literal: taskId }] },
                null,
                '$activeTaskId',
              ],
            },
            updatedAt: new Date(),
            revision: { $add: ['$revision', 1] },
          },
        },
      ]
    ).exec()
  },
}
