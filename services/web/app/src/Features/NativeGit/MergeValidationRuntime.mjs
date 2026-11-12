import Path from 'node:path'
import { MergeValidationService } from './MergeValidationService.mjs'
import { snapshotIdentity } from './MergeDraftService.mjs'
import ProjectGetter from '../Project/ProjectGetter.mjs'
import ClsiManager from '../Compile/ClsiManager.mjs'
import CompileManager from '../Compile/CompileManager.mjs'

export function mergeValidationRuntime(c, drafts, projectId) {
  const readIdentity = async (snapshot) => {
    const settings = await ProjectGetter.promises.getProject(projectId, { rootDoc_id: 1, compiler: 1, imageName: 1 })
    const repo = await c.workspace.current(await c.store.read())
    return { commit: await repo.head(), documents: snapshotIdentity(snapshot || await c.project.read()),
      epoch: await c.epoch.read(), rootDocId: String(settings.rootDoc_id || ''), compiler: settings.compiler, imageName: settings.imageName }
  }
  return new MergeValidationService({ drafts, root: Path.join(c.root, 'merge-validations'), readIdentity,
    capture: async () => c.project.transaction(async tx => {
      const before = await readIdentity(await tx.read())
      const limits = await CompileManager.promises.getProjectCompileLimits(projectId)
      const request = await ClsiManager.promises.buildDocumentConversionRequest(projectId)
      await tx.assertActive()
      const after = await readIdentity(await tx.read())
      if (JSON.stringify(before) !== JSON.stringify(after)) throw Object.assign(Error('Paper changed during validation capture; retry'), { status: 409 })
      request.compile.options = { ...request.compile.options, ...limits, syncType: 'full', check: 'error', stopOnFirstError: true }
      return { identity: after, request, limits }
    }, { prepare: true, epoch: await c.epoch.read() }),
    compile: (id, captured) => ClsiManager.promises.sendExternalRequest(id, captured.request, captured.limits),
  })
}
