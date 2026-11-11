// @ts-check

const Settings = require('@overleaf/settings')
const { callbackifyAll } = require('@overleaf/promise-utils')
const projectHistoryKeys = Settings.redis?.project_history?.key_schema
const rclient = require('@overleaf/redis-wrapper').createClient(
  Settings.redis.project_history
)
const logger = require('@overleaf/logger')
const metrics = require('./Metrics')
const { docIsTooLarge, stringFileDataContentIsTooLarge } = require('./Limits')
const { addTrackedDeletesToContent, extractOriginOrSource } = require('./Utils')
const HistoryConversions = require('./HistoryConversions')
const OError = require('@overleaf/o-error')

/**
 * @import { Ranges } from './types'
 * @import { StringFileRawData } from 'overleaf-editor-core/lib/types'
 */

const ProjectHistoryRedisManager = {
  // Internal retryable enqueue. Only the server's durable project receipt supplies
  // the event payload; callers cannot replace its version, path or timestamp.
  async queueReviewedDeletion(projectId, docId, operationId) {
    if (![projectId, docId].every(id => typeof id === 'string' && /^[a-f0-9]{24}$/.test(id)) ||
        typeof operationId !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(operationId)) {
      throw new OError('Invalid reviewed deletion identity')
    }
    const { db, ObjectId } = require('./mongodb')
    const reservation = await db.documentDeletionReservations.findOne({
      _id: `${projectId}:${docId}`, projectId, docId, operationId,
      state: { $in: ['committing', 'committed'] },
    }, { readPreference: 'primary' })
    const project = await db.projects.findOne({ _id: new ObjectId(projectId) }, {
      projection: { [`deletionReceipts.${operationId}`]: 1 }, readPreference: 'primary',
    })
    const receipt = project?.deletionReceipts?.[operationId]
    if (!reservation || !receipt || receipt.operationId !== operationId || receipt.docId !== docId ||
        receipt.path !== reservation.path || receipt.userId !== reservation.userId ||
        receipt.expectedVersion !== reservation.expectedVersion || receipt.baseHash !== reservation.baseHash ||
        !Number.isSafeInteger(receipt.projectVersion) || receipt.projectVersion < 1 ||
        typeof receipt.projectHistoryId !== 'string' || !receipt.projectHistoryId ||
        !(receipt.removedAt instanceof Date) || !Number.isFinite(receipt.removedAt.getTime())) {
      throw new OError('Reviewed deletion history receipt conflicts')
    }
    if (reservation.source !== undefined) throw new OError('Unknown deletion history source')
    return ProjectHistoryRedisManager.queueOps(projectId, JSON.stringify({
      deletionOperationId: operationId, doc: docId, pathname: receipt.path,
      new_pathname: '', version: `${receipt.projectVersion}.0`,
      projectHistoryId: receipt.projectHistoryId,
      meta: { user_id: receipt.userId, ts: receipt.removedAt, source: 'writing-assist', type: 'external' },
    }))
  },

  // Only the durable server outbox supplies creation history bytes. No caller payload.


  // The durable outbox, not an HTTP body, supplies the entire ordered group.


  async queueOps(projectId, ...ops) {
    // Record metric for ops pushed onto queue
    for (const op of ops) {
      metrics.summary('redis.projectHistoryOps', op.length, { status: 'push' })
    }

    // Make sure that this MULTI operation only operates on project
    // specific keys, i.e. keys that have the project id in curly braces.
    // The curly braces identify a hash key for Redis and ensures that
    // the MULTI's operations are all done on the same node in a
    // cluster environment.
    const multi = rclient.multi()
    // Push the ops onto the project history queue
    multi.rpush(
      projectHistoryKeys.projectHistoryOps({ project_id: projectId }),
      ...ops
    )
    // To record the age of the oldest op on the queue set a timestamp if not
    // already present (SETNX).
    multi.setnx(
      projectHistoryKeys.projectHistoryFirstOpTimestamp({
        project_id: projectId,
      }),
      Date.now()
    )
    const result = await multi.exec()
    return result[0]
  },

  async queueRenameEntity(
    projectId,
    projectHistoryId,
    entityType,
    entityId,
    userId,
    projectUpdate,
    originOrSource
  ) {
    projectUpdate = {
      pathname: projectUpdate.pathname,
      new_pathname: projectUpdate.newPathname,
      meta: {
        user_id: userId,
        ts: new Date(),
      },
      version: projectUpdate.version,
      projectHistoryId,
    }
    projectUpdate[entityType] = entityId

    const { origin, source } = extractOriginOrSource(originOrSource)

    if (origin != null) {
      projectUpdate.meta.origin = origin
      if (origin.kind !== 'editor') {
        projectUpdate.meta.type = 'external'
      }
    } else if (source != null) {
      projectUpdate.meta.source = source
      if (source !== 'editor') {
        projectUpdate.meta.type = 'external'
      }
    }

    logger.debug(
      { projectId, projectUpdate },
      'queue rename operation to project-history'
    )
    const jsonUpdate = JSON.stringify(projectUpdate)

    return await ProjectHistoryRedisManager.queueOps(projectId, jsonUpdate)
  },

  async queueAddEntity(
    projectId,
    projectHistoryId,
    entityType,
    entityId,
    userId,
    projectUpdate,
    originOrSource
  ) {
    let docLines = projectUpdate.docLines
    let ranges
    if (projectUpdate.historyRangesSupport && projectUpdate.ranges) {
      docLines = addTrackedDeletesToContent(
        docLines,
        projectUpdate.ranges.changes ?? []
      )
      ranges = HistoryConversions.toHistoryRanges(projectUpdate.ranges)
    }

    projectUpdate = {
      pathname: projectUpdate.pathname,
      docLines,
      url: projectUpdate.url,
      meta: {
        user_id: userId,
        ts: new Date(),
      },
      version: projectUpdate.version,
      hash: projectUpdate.hash,
      metadata: projectUpdate.metadata,
      projectHistoryId,
      createdBlob: projectUpdate.createdBlob ?? false,
    }
    if (ranges) {
      projectUpdate.ranges = ranges
    }
    projectUpdate[entityType] = entityId

    const { origin, source } = extractOriginOrSource(originOrSource)

    if (origin != null) {
      projectUpdate.meta.origin = origin
      if (origin.kind !== 'editor') {
        projectUpdate.meta.type = 'external'
      }
    } else if (source != null) {
      projectUpdate.meta.source = source
      if (source !== 'editor') {
        projectUpdate.meta.type = 'external'
      }
    }

    logger.debug(
      { projectId, projectUpdate },
      'queue add operation to project-history'
    )
    const jsonUpdate = JSON.stringify(projectUpdate)

    return await ProjectHistoryRedisManager.queueOps(projectId, jsonUpdate)
  },

  async queueResyncProjectStructure(
    projectId,
    projectHistoryId,
    docs,
    files,
    opts
  ) {
    logger.debug({ projectId, docs, files }, 'queue project structure resync')
    const projectUpdate = {
      resyncProjectStructure: { docs, files },
      projectHistoryId,
      meta: {
        ts: new Date(),
      },
    }
    if (opts.resyncProjectStructureOnly) {
      projectUpdate.resyncProjectStructureOnly = opts.resyncProjectStructureOnly
    }
    const jsonUpdate = JSON.stringify(projectUpdate)
    return await ProjectHistoryRedisManager.queueOps(projectId, jsonUpdate)
  },

  /**
   * Add a resync doc update to the project-history queue
   *
   * @param {string} projectId
   * @param {string} projectHistoryId
   * @param {string} docId
   * @param {string[] | StringFileRawData} lines
   * @param {Ranges} ranges
   * @param {string[]} resolvedCommentIds
   * @param {number} version
   * @param {string} pathname
   * @param {boolean} historyRangesSupport
   * @return {Promise<number>} the number of ops added
   */
  async queueResyncDocContent(
    projectId,
    projectHistoryId,
    docId,
    lines,
    ranges,
    resolvedCommentIds,
    version,
    pathname,
    historyRangesSupport
  ) {
    logger.debug(
      { projectId, docId, lines, version, pathname },
      'queue doc content resync'
    )

    const projectUpdate = {
      resyncDocContent: { version },
      projectHistoryId,
      path: pathname,
      doc: docId,
      meta: {
        ts: new Date(),
      },
    }

    let content = ''
    if (Array.isArray(lines)) {
      content = lines.join('\n')
      if (historyRangesSupport) {
        content = addTrackedDeletesToContent(content, ranges.changes ?? [])
        projectUpdate.resyncDocContent.ranges =
          HistoryConversions.toHistoryRanges(ranges)
        projectUpdate.resyncDocContent.resolvedCommentIds = resolvedCommentIds
      }
    } else {
      content = lines.content
      projectUpdate.resyncDocContent.historyOTRanges = {
        comments: lines.comments,
        trackedChanges: lines.trackedChanges,
      }
    }
    projectUpdate.resyncDocContent.content = content

    const jsonUpdate = JSON.stringify(projectUpdate)
    // Do an optimised size check on the docLines using the serialised
    // project update length as an upper bound
    const sizeBound = jsonUpdate.length
    if (Array.isArray(lines)) {
      if (docIsTooLarge(sizeBound, lines, Settings.max_doc_length)) {
        throw new OError(
          'blocking resync doc content insert into project history queue: doc is too large',
          { projectId, docId, docSize: sizeBound }
        )
      }
    } else if (
      stringFileDataContentIsTooLarge(lines, Settings.max_doc_length)
    ) {
      throw new OError(
        'blocking resync doc content insert into project history queue: doc is too large',
        { projectId, docId, docSize: sizeBound }
      )
    }
    return await ProjectHistoryRedisManager.queueOps(projectId, jsonUpdate)
  },
}

module.exports = {
  ...callbackifyAll(ProjectHistoryRedisManager),
  promises: ProjectHistoryRedisManager,
}
