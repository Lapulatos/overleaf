import WorkspaceTaskNotice from '@/features/source-control/workspace-task-notice'
import { gitApi } from '@/features/source-control/api'
import { accumulateLocalRecovery, saveLocalRecovery, type RecoveryDocument } from '../editor/local-recovery'
import LocalRecoveryCopies from '../components/modals/local-recovery-copies'
import { bindGitPresence } from '@/features/source-control/git-presence'
import { publishGitPresence, onGitViewingIntent } from '@/features/source-control/git-presence-state'
import { flushSync } from 'react-dom'
import { useProjectContext } from '@/shared/context/project-context'
import { bindWorkspaceEpochChange } from '../editor/workspace-epoch'
import { bindWorkspacePreparation } from '../editor/workspace-preparation'
import {
  createContext,
  FC,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { sendMB } from '@/infrastructure/event-tracking'
import { OpenDocuments } from '@/features/ide-react/editor/open-documents'
import EditorWatchdogManager from '@/features/ide-react/connection/editor-watchdog-manager'
import { useIdeReactContext } from '@/features/ide-react/context/ide-react-context'
import { useConnectionContext } from '@/features/ide-react/context/connection-context'
import { debugConsole } from '@/utils/debugging'
import { joinCurrentDocument } from '@/features/ide-react/editor/join-current-document'
import { DocumentContainer } from '@/features/ide-react/editor/document-container'
import { useLayoutContext } from '@/shared/context/layout-context'
import { useUserContext } from '@/shared/context/user-context'
import { GotoLineOptions } from '@/features/ide-react/types/goto-line-options'
import { Doc } from '../../../../../types/doc'
import { useFileTreeData } from '@/shared/context/file-tree-data-context'
import {
  findDocEntityById,
  findFileRefEntityById,
} from '@/features/ide-react/util/find-doc-entity-by-id'
import useScopeEventEmitter from '@/shared/hooks/use-scope-event-emitter'
import { useModalsContext } from '@/features/ide-react/context/modals-context'
import { useTranslation } from 'react-i18next'
import customLocalStorage from '@/infrastructure/local-storage'
import useEventListener from '@/shared/hooks/use-event-listener'
import { EditorType } from '@/features/ide-react/editor/types/editor-type'
import { DocId } from '../../../../../types/project-settings'
import { Update } from '@/features/history/services/types/update'
import { useDebugDiffTracker } from '../hooks/use-debug-diff-tracker'
import { convertFileRefToBinaryFile } from '@/features/ide-react/util/file-view'
import { useEditorOpenDocContext } from '@/features/ide-react/context/editor-open-doc-context'
import { useEditorPropertiesContext } from '@/features/ide-react/context/editor-properties-context'

export interface GotoOffsetOptions {
  gotoOffset: number
}

interface OpenDocOptions
  extends Partial<GotoLineOptions>, Partial<GotoOffsetOptions> {
  gotoOffset?: number
  forceReopen?: boolean
  keepCurrentView?: boolean
}

export type EditorManager = {
  getEditorType: () => EditorType | null
  getCurrentDocValue: () => string | null
  getCurrentDocumentId: () => DocId | null
  setIgnoringExternalUpdates: (value: boolean) => void
  openDocWithId: (
    docId: string,
    options?: OpenDocOptions
  ) => Promise<Doc | undefined>
  openDoc: (document: Doc, options?: OpenDocOptions) => Promise<Doc | undefined>
  openDocs: OpenDocuments
  openFileWithId: (fileId: string) => void
  openInitialDoc: (docId?: string) => Promise<Doc | undefined>
  isLoading: boolean
  jumpToLine: (options: GotoLineOptions) => void
  debugTimers: React.MutableRefObject<Record<string, number>>
}

function hasGotoLine(options: OpenDocOptions): options is GotoLineOptions {
  return typeof options.gotoLine === 'number'
}

function hasGotoOffset(options: OpenDocOptions): options is GotoOffsetOptions {
  return typeof options.gotoOffset === 'number'
}

export const EditorManagerContext = createContext<EditorManager | undefined>(
  undefined
)

export const EditorManagerProvider: FC<React.PropsWithChildren> = ({
  children,
}) => {
  const { t } = useTranslation()
  const { reportError, eventEmitter, projectId, setOutOfSync } =
    useIdeReactContext()
  const { socket, closeConnection, connectionState, reconnectWorkspace } = useConnectionContext()
  const { view, setView, setOpenFile } = useLayoutContext()
  const { showGenericMessageModal, genericModalVisible, showOutOfSyncModal } =
    useModalsContext()
  const { id: userId } = useUserContext()
  const {
    showVisual,
    opening,
    setOpening,
    errorState,
    setErrorState,
    setTrackChanges,
    wantTrackChanges,
  } = useEditorPropertiesContext()
  const {
    currentDocumentId,
    setCurrentDocumentId,
    setOpenDocName,
    currentDocument,
    setCurrentDocument,
  } = useEditorOpenDocContext()

  const wantTrackChangesRef = useRef(wantTrackChanges)
  useEffect(() => {
    wantTrackChangesRef.current = wantTrackChanges
  }, [wantTrackChanges])

  const goToLineEmitter = useScopeEventEmitter('editor:gotoLine')

  const { fileTreeData } = useFileTreeData()

  const [ignoringExternalUpdates, setIgnoringExternalUpdates] = useState(false)

  const { createDebugDiff, debugTimers } = useDebugDiffTracker(
    projectId,
    currentDocument
  )

  const [globalEditorWatchdogManager] = useState(
    () =>
      new EditorWatchdogManager({
        onTimeoutHandler: (meta: Record<string, any>) => {
          let diffSize: number | null = null
          createDebugDiff()
            .then(calculatedDiffSize => {
              diffSize = calculatedDiffSize
            })
            .finally(() => {
              sendMB('losing-edits', {
                ...meta,
                diffSize,
                timers: debugTimers.current,
              })
              reportError('losing-edits', {
                ...meta,
                diffSize,
                timers: debugTimers.current,
              })
            })
        },
      })
  )

  // Store the most recent document error and consume it in an effect, which
  // prevents circular dependencies in useCallbacks
  const [docError, setDocError] = useState<{
    doc: Doc
    document: DocumentContainer
    error: Error | string
    meta?: Record<string, any>
    editorContent?: string
    recoveryNotice?: string
  } | null>(null)

  const [docTooLongErrorShown, setDocTooLongErrorShown] = useState(false)

  useEffect(() => {
    if (!genericModalVisible) {
      setDocTooLongErrorShown(false)
    }
  }, [genericModalVisible])

  const [openDocs] = useState(
    () => new OpenDocuments(socket, globalEditorWatchdogManager, eventEmitter)
  )

  useEffect(() => {
    openDocs.updateDocumentNames(docId => findDocEntityById(fileTreeData, docId)?.name)
  }, [openDocs, fileTreeData])

  const { project } = useProjectContext()
  const workspaceEpoch = project?.gitWorkspaceEpoch
  const preparedEpoch = useRef<number>()
  const epochTransition = useRef<{ epoch: number; docId: string | null; recover(): void; timer: ReturnType<typeof setTimeout>; opening?: boolean }>()
  const taskApi = useMemo(() => gitApi(projectId), [projectId])
  const [recoveryRevision, setRecoveryRevision] = useState(0)
  const pendingRecovery = useRef<ReturnType<typeof accumulateLocalRecovery>>()
  const preserveRecovery = useCallback((content: string, documents: RecoveryDocument[] = openDocs.snapshotForRecovery()) => {
    if (!workspaceEpoch || !userId) return { content, notice: undefined }
    const retained = accumulateLocalRecovery(pendingRecovery.current, { userId, workspaceId: projectId, epoch: workspaceEpoch, content, documents })
    pendingRecovery.current = retained
    try {
      saveLocalRecovery(localStorage, retained)
      setRecoveryRevision(value => value + 1)
      return { content: retained.content, notice: 'A local recovery copy was saved in this browser. You can open it after reloading using Local recovery copies.' }
    } catch {
      return { content: retained.content, notice: 'A local recovery copy could not be saved. Copy or download the text below before reloading or closing this page.' }
    }
  }, [userId, projectId, workspaceEpoch, openDocs])
  useEffect(() => {
    if (!workspaceEpoch || connectionState.forceDisconnected) return
    return bindGitPresence({ socket,
      publish: snapshot => publishGitPresence(projectId, snapshot),
      onIntent: listener => onGitViewingIntent(projectId, listener),
    })
  }, [socket, projectId, workspaceEpoch, connectionState.forceDisconnected])
  useEffect(() => bindWorkspacePreparation({
    socket, projectId, epoch: workspaceEpoch, documents: openDocs,
    onAcknowledged: epoch => { preparedEpoch.current = epoch },
    setBusy: busy => {
      const notify = () => window.dispatchEvent(new CustomEvent('native-git-prepare-write-state', { detail: { busy } }))
      if (busy) flushSync(notify)
      else notify()
    },
  }), [socket, projectId, workspaceEpoch, openDocs])

  const archivedWorkspace = useRef(false)
  useEffect(() => { archivedWorkspace.current = false }, [projectId])
  useEffect(() => {
    const blocked = (value: { projectId?: string; logicalProjectId?: string }, deleting = false) => {
      if (value.projectId !== projectId || !/^[a-f0-9]{24}$/.test(value.logicalProjectId || '')) return
      archivedWorkspace.current = true
      if (epochTransition.current) clearTimeout(epochTransition.current.timer)
      epochTransition.current = undefined
      const documents = openDocs.snapshotForRecovery()
      const retained = preserveRecovery(JSON.stringify({ documents }, null, 2), documents)
      flushSync(() => setOutOfSync(true))
      closeConnection('out-of-sync'); setOpening(false)
      showGenericMessageModal(deleting ? 'Project deletion started' : 'Branch archived', <>
        <p>{deleting ? 'The owner has started deleting this paper project. Editing is stopped. The owner can resume the operation or restore its retained backup from the recovery vault.' : 'This branch is archived. Its documents, comments and history are retained. The project owner can restore it from Branch workspaces.'}</p>
        <p>{retained.notice}</p>
        {deleting && <button type="button" className="btn btn-default" onClick={() => {
          const url = URL.createObjectURL(new Blob([retained.content], { type: 'application/json;charset=utf-8' }))
          const link = document.createElement('a'); link.href = url; link.download = 'local-recovery.json'; link.click()
          setTimeout(() => URL.revokeObjectURL(url), 1000)
        }}>Download local text</button>}
        {' '}<a href={deleting ? '/git-recovery' : `/project/${value.logicalProjectId}`}>{deleting ? 'Open your recovery vault' : 'Return to the paper project'}</a>
      </>)
    }
    const archived = (value: { projectId?: string; logicalProjectId?: string }) => blocked(value)
    const deleting = (value: { projectId?: string; logicalProjectId?: string }) => blocked(value, true)
    socket.on('nativeGitWorkspaceArchived', archived)
    socket.on('nativeGitProjectDeleting', deleting)
    return () => { socket.removeListener('nativeGitWorkspaceArchived', archived); socket.removeListener('nativeGitProjectDeleting', deleting) }
  }, [socket, projectId, openDocs, preserveRecovery, setOutOfSync, closeConnection, setOpening, showGenericMessageModal])

  useEffect(() => bindWorkspaceEpochChange({
    socket, projectId, epoch: workspaceEpoch,
    freeze: () => flushSync(() => setOutOfSync(true)),
    recover: nextEpoch => {
      if (archivedWorkspace.current) return
      const documents = openDocs.snapshotForRecovery()
      const text = documents.length === 1 ? documents[0].content : JSON.stringify({ documents }, null, 2)
      const recover = () => {
        if (epochTransition.current) clearTimeout(epochTransition.current.timer)
        epochTransition.current = undefined
        const recovery = preserveRecovery(text, documents)
        closeConnection('out-of-sync')
        setErrorState(true)
        showOutOfSyncModal(recovery.content, recovery.notice)
      }
      // Only an actively paused and acknowledged clean client may discard its
      // old OT instances. Every other case retains the existing recovery flow.
      if (!workspaceEpoch || preparedEpoch.current !== workspaceEpoch || nextEpoch !== (workspaceEpoch || 0) + 1 ||
          openDocs.hasUnsavedChanges() || epochTransition.current) { recover(); return }
      try {
        openDocs.clearSavedDocumentsForEpochTransition()
        setCurrentDocument(null)
        setOpening(true)
        epochTransition.current = { epoch: nextEpoch, docId: currentDocumentId, recover,
          timer: setTimeout(recover, 30000) }
        reconnectWorkspace()
      } catch { recover() }
    },
  }), [socket, projectId, workspaceEpoch, openDocs, setOutOfSync, closeConnection, setErrorState, showOutOfSyncModal, preserveRecovery, reconnectWorkspace, currentDocumentId, setCurrentDocument, setOpening])

  const currentDocumentIdStorageKey = `doc.open_id.${projectId}`

  // Persist the open document ID to local storage
  useEffect(() => {
    if (currentDocumentId) {
      customLocalStorage.setItem(currentDocumentIdStorageKey, currentDocumentId)
    }
  }, [currentDocumentId, currentDocumentIdStorageKey])

  const editorOpenDocEpochRef = useRef(0)

  const getEditorType = useCallback((): EditorType | null => {
    if (!currentDocument) {
      return null
    }

    return showVisual ? 'cm6-rich-text' : 'cm6'
  }, [currentDocument, showVisual])

  const getCurrentDocValue = useCallback(() => {
    return currentDocument?.getSnapshot() ?? null
  }, [currentDocument])

  const getCurrentDocumentId = useCallback(
    () => currentDocumentId,
    [currentDocumentId]
  )

  const jumpToLine = useCallback(
    (options: GotoLineOptions) => {
      goToLineEmitter(options)
    },
    [goToLineEmitter]
  )

  const attachErrorHandlerToDocument = useCallback(
    (doc: Doc, document: DocumentContainer) => {
      document.on(
        'error',
        (
          error: Error | string,
          meta?: Record<string, any>,
          editorContent?: string
        ) => {
          // Persist synchronously before DocumentContainer cleanup and React's
          // batched error state can replace a previous document's failure.
          const content = editorContent ?? document.getSnapshot() ?? ''
          const recoveryDocuments = openDocs.snapshotForRecovery().filter(item => item.docId !== document.doc_id)
          recoveryDocuments.push({ docId: document.doc_id, name: document.docName || '',
            version: document.doc?.getVersion() ?? null, epoch: document.doc?.workspaceEpoch ?? null, content })
          const recovery = preserveRecovery(content, recoveryDocuments)
          setDocError({ doc, document, error, meta, editorContent: recovery.content, recoveryNotice: recovery.notice })
        }
      )
    },
    [openDocs, preserveRecovery]
  )

  const ignoringExternalUpdatesRef = useRef<boolean>(ignoringExternalUpdates)
  useEffect(() => {
    ignoringExternalUpdatesRef.current = ignoringExternalUpdates
  }, [ignoringExternalUpdates])

  const bindToDocumentEvents = useCallback(
    (doc: Doc, document: DocumentContainer) => {
      attachErrorHandlerToDocument(doc, document)

      document.on('externalUpdate', (update: Update) => {
        if (ignoringExternalUpdatesRef.current) {
          return
        }
        if (
          update.meta.type === 'external' &&
          update.meta.source === 'git-bridge'
        ) {
          return
        }
        if (
          update.meta.origin?.kind === 'file-restore' ||
          update.meta.origin?.kind === 'project-restore'
        ) {
          return
        }
        showGenericMessageModal(
          t('document_updated_externally'),
          t('document_updated_externally_detail')
        )
      })
    },
    [attachErrorHandlerToDocument, showGenericMessageModal, t]
  )

  const syncTimeoutRef = useRef<number | null>(null)

  const syncTrackChangesState = useCallback(
    (doc: DocumentContainer) => {
      if (!doc) {
        return
      }

      if (syncTimeoutRef.current) {
        window.clearTimeout(syncTimeoutRef.current)
        syncTimeoutRef.current = null
      }

      const want = wantTrackChangesRef.current
      const have = doc.getTrackingChanges()
      if (want === have) {
        setTrackChanges(want)
        return
      }

      const tryToggle = () => {
        const saved = doc.getInflightOp() == null && doc.getPendingOp() == null
        if (saved) {
          doc.setTrackChangesUserId(want ? userId : null)
          setTrackChanges(want)
        } else {
          syncTimeoutRef.current = window.setTimeout(tryToggle, 100)
        }
      }

      tryToggle()
    },
    [setTrackChanges, userId]
  )

  const doOpenNewDocument = useCallback(
    (doc: Doc): Promise<DocumentContainer> => {
      debugConsole.log('[doOpenNewDocument] Opening...')
      const newDocument = openDocs.getDocument(doc._id)
      if (!newDocument) {
        debugConsole.error(`No open document with ID '${doc._id}' found`)
        return Promise.reject(new Error('no open document found'))
      }
      newDocument.docName = doc.name
      const preJoinEpoch = ++editorOpenDocEpochRef.current
      return joinCurrentDocument(
        newDocument,
        () => editorOpenDocEpochRef.current === preJoinEpoch,
        () => bindToDocumentEvents(doc, newDocument)
      )
    },
    [bindToDocumentEvents, openDocs]
  )

  const openNewDocument = useCallback(
    async (doc: Doc): Promise<DocumentContainer> => {
      // Leave the current document
      //  - when we are opening a different new one, to avoid race conditions
      //     between leaving and joining the same document
      //  - when the current one has pending ops that need flushing, to avoid
      //     race conditions from cleanup
      const currentDocumentId = currentDocument?.doc_id
      const hasBufferedOps = currentDocument && currentDocument.hasBufferedOps()
      const changingDoc = currentDocument && currentDocumentId !== doc._id
      if (changingDoc || hasBufferedOps) {
        debugConsole.log('[openNewDocument] Leaving existing open doc...')

        // Do not trigger any UI changes from remote operations
        currentDocument.off()

        // Keep listening for out-of-sync and similar errors.
        attachErrorHandlerToDocument(doc, currentDocument)

        // Teardown the Document -> ShareJsDoc -> sharejs doc
        // By the time this completes, the Document instance is no longer
        //  registered in OpenDocuments and doOpenNewDocument can start
        //  from scratch -- read: no corrupted internal state.
        const preLeaveEpoch = ++editorOpenDocEpochRef.current

        try {
          await currentDocument.leaveAndCleanUpPromise()
        } catch (error) {
          debugConsole.log(
            `[openNewDocument] error leaving doc ${currentDocumentId}`,
            error
          )
          throw error
        }

        if (editorOpenDocEpochRef.current !== preLeaveEpoch) {
          debugConsole.log(
            `[openNewDocument] editorOpenDocEpoch mismatch ${editorOpenDocEpochRef.current} vs ${preLeaveEpoch}`
          )
          throw new Error('another document was loaded')
        }
      }
      return doOpenNewDocument(doc)
    },
    [attachErrorHandlerToDocument, doOpenNewDocument, currentDocument]
  )

  const currentDocumentIdRef = useRef(currentDocumentId)
  useEffect(() => {
    currentDocumentIdRef.current = currentDocumentId
  }, [currentDocumentId])

  const openDoc = useCallback(
    async (doc: Doc, options: OpenDocOptions = {}) => {
      debugConsole.log(`[openDoc] Opening ${doc._id}`)

      const { promise, resolve, reject } = Promise.withResolvers<Doc>()

      if (view === 'editor') {
        // store position of previous doc before switching docs
        eventEmitter.emit('store-doc-position')
      }

      if (!options.keepCurrentView) {
        setView('editor')
      }

      const done = (isNewDoc: boolean) => {
        window.dispatchEvent(
          new CustomEvent('doc:after-opened', {
            detail: { isNewDoc, docId: doc._id },
          })
        )
        window.dispatchEvent(
          new CustomEvent('entity:opened', {
            detail: doc._id,
          })
        )
        if (hasGotoLine(options)) {
          const jump = () => jumpToLine(options)

          if (isNewDoc) {
            // Jump to the line after a stored scroll position has been restored
            window.addEventListener('editor:scroll-position-restored', jump, {
              once: true,
            })
          } else {
            // Jump directly to the line
            jump()
          }
        } else if (hasGotoOffset(options)) {
          const jump = () => {
            eventEmitter.emit('editor:gotoOffset', options)
          }

          if (isNewDoc) {
            // Jump to the offset after a stored scroll position has been restored
            window.addEventListener('editor:scroll-position-restored', jump, {
              once: true,
            })
          } else {
            // Jump directly to the offset
            jump()
          }
        }

        resolve(doc)
      }

      // If we already have the document open, or are opening the document, we can return at this point.
      // Note: only use forceReopen:true to override this when the document is
      // out of sync and needs to be reloaded from the server.
      if (doc._id === currentDocumentIdRef.current && !options.forceReopen) {
        done(false)
        return
      }

      // We're now either opening a new document or reloading a broken one.
      currentDocumentIdRef.current = doc._id as DocId
      setCurrentDocumentId(doc._id as DocId)
      setOpenDocName(doc.name)
      setOpening(true)

      try {
        const document = await openNewDocument(doc)
        syncTrackChangesState(document)
        setOpening(false)
        setCurrentDocument(document)
        done(true)
      } catch (error: any) {
        if (error?.message === 'another document was loaded') {
          debugConsole.log(
            `[openDoc] another document was loaded while ${doc._id} was loading`
          )
          return
        }
        debugConsole.error('Error opening document', error)
        showGenericMessageModal(
          t('error_opening_document'),
          t('error_opening_document_detail')
        )
        reject(error)
      }

      return promise
    },
    [
      eventEmitter,
      jumpToLine,
      openNewDocument,
      setCurrentDocument,
      setCurrentDocumentId,
      setOpenDocName,
      setOpening,
      setView,
      showGenericMessageModal,
      syncTrackChangesState,
      t,
      view,
    ]
  )

  const openDocWithId = useCallback(
    async (docId: string, options: OpenDocOptions = {}) => {
      const doc = findDocEntityById(fileTreeData, docId)
      if (!doc) {
        return
      }
      return await openDoc(doc, options)
    },
    [fileTreeData, openDoc]
  )

  useEffect(() => {
    const transition = epochTransition.current
    if (!transition || transition.opening || workspaceEpoch !== transition.epoch ||
        connectionState.readyState !== WebSocket.OPEN) return
    transition.opening = true
    void (async () => {
      try {
        const docId = transition.docId || project?.rootDocId
        if (docId) {
          const opened = await openDocWithId(docId, { forceReopen: true, keepCurrentView: true })
          if (!opened) throw new Error('Document changed during workspace transition')
        }
        if (epochTransition.current !== transition) return
        clearTimeout(transition.timer)
        epochTransition.current = undefined
        setOutOfSync(false); setErrorState(false); setOpening(false)
      } catch { if (epochTransition.current === transition) transition.recover() }
    })()
  }, [workspaceEpoch, connectionState.readyState, openDocWithId, project?.rootDocId, setOutOfSync, setErrorState, setOpening])

  const openFileWithId = useCallback(
    (fileRefId: string) => {
      const fileRef = findFileRefEntityById(fileTreeData, fileRefId)
      if (!fileRef) {
        return
      }
      setOpenFile(convertFileRefToBinaryFile(fileRef))
      window.dispatchEvent(
        new CustomEvent('entity:opened', {
          detail: fileRef._id,
        })
      )
    },
    [fileTreeData, setOpenFile]
  )

  const openInitialDoc = useCallback(
    async (fallbackDocId?: string) => {
      const docId =
        customLocalStorage.getItem(currentDocumentIdStorageKey) || fallbackDocId
      if (docId) {
        return await openDocWithId(docId)
      }
    },
    [currentDocumentIdStorageKey, openDocWithId]
  )

  useEffect(() => {
    if (docError) {
      const { doc, document, error, meta } = docError
      let { editorContent } = docError
      const message = typeof error === 'string' ? error : (error?.message ?? '')

      // Clear document error so that it's only handled once
      setDocError(null)

      if (message.includes('maxDocLength')) {
        openDoc(doc, { forceReopen: true })
        const hasTrackedDeletes =
          document.ranges != null &&
          document.ranges.changes.some(change => 'd' in change.op)
        const explanation = hasTrackedDeletes
          ? `${t('document_too_long_detail')} ${t('document_too_long_tracked_deletes')}`
          : t('document_too_long_detail')

        showGenericMessageModal(t('document_too_long'), explanation)
        setDocTooLongErrorShown(true)
      } else if (/too many comments or tracked changes/.test(message)) {
        showGenericMessageModal(
          t('too_many_comments_or_tracked_changes'),
          t('too_many_comments_or_tracked_changes_detail')
        )
      } else if (!docTooLongErrorShown) {
        // Do not allow this doc to open another error modal.
        document.off('error')

        // Preserve the sharejs contents before the teardown.
        // eslint-disable-next-line no-unused-vars
        editorContent =
          typeof editorContent === 'string'
            ? editorContent
            : document.getSnapshot()

        const recoveryNotice = docError.recoveryNotice

        // Tear down the ShareJsDoc.
        if (document.doc) document.doc.clearInflightAndPendingOps()

        // Do not re-join after re-connecting.
        document.leaveAndCleanUp()

        closeConnection('out-of-sync')
        reportError(error, meta)

        // Tell the user about the error state.
        setErrorState(true)
        // Ensure that the editor is locked
        setOutOfSync(true)
        // Display the "out of sync" modal
        showOutOfSyncModal(editorContent || '', recoveryNotice)

        // Do not forceReopen the document.
        return
      }

      const handleProjectJoined = () => {
        return openDoc(doc, { forceReopen: true })
      }

      eventEmitter.once('project:joined', handleProjectJoined)

      return () => {
        eventEmitter.off('project:joined', handleProjectJoined)
      }
    }
  }, [
    closeConnection,
    docError,
    docTooLongErrorShown,
    eventEmitter,
    openDoc,
    reportError,
    setErrorState,
    showGenericMessageModal,
    showOutOfSyncModal,
    preserveRecovery,
    setOutOfSync,
    t,
  ])

  useEventListener(
    'editor:insert-symbol',
    useCallback(() => {
      sendMB('symbol-palette-insert')
    }, [])
  )

  useEventListener(
    'blur',
    useCallback(() => {
      openDocs.flushAll()
    }, [openDocs])
  )

  // Flush changes before disconnecting
  useEffect(() => {
    if (connectionState.forceDisconnected) {
      openDocs.flushAll()
    }
  }, [connectionState.forceDisconnected, openDocs])

  // Watch for changes in wantTrackChanges
  const previousWantTrackChangesRef = useRef(wantTrackChanges)
  useEffect(() => {
    if (
      currentDocument &&
      wantTrackChanges !== previousWantTrackChangesRef.current
    ) {
      previousWantTrackChangesRef.current = wantTrackChanges
      syncTrackChangesState(currentDocument)
    }
  }, [currentDocument, syncTrackChangesState, wantTrackChanges])

  const isLoading = Boolean(
    (!currentDocument || opening) && !errorState && currentDocumentId
  )

  const value: EditorManager = useMemo(
    () => ({
      getEditorType,
      getCurrentDocValue,
      getCurrentDocumentId,
      setIgnoringExternalUpdates,
      openDocWithId,
      openDoc,
      openDocs,
      isLoading,
      openFileWithId,
      openInitialDoc,
      jumpToLine,
      debugTimers,
    }),
    [
      getEditorType,
      getCurrentDocValue,
      getCurrentDocumentId,
      setIgnoringExternalUpdates,
      openDocWithId,
      openDoc,
      openDocs,
      openFileWithId,
      openInitialDoc,
      isLoading,
      jumpToLine,
      debugTimers,
    ]
  )

  return (
    <EditorManagerContext.Provider value={value}>
      {children}
      {workspaceEpoch !== undefined && <WorkspaceTaskNotice api={taskApi} canApply={project?.gitWorkspacePrepareEnabled === true} />}
      <LocalRecoveryCopies userId={userId} workspaceId={projectId} revision={recoveryRevision} />
    </EditorManagerContext.Provider>
  )
}

export function useEditorManagerContext(): EditorManager {
  const context = useContext(EditorManagerContext)

  if (!context) {
    throw new Error(
      'useEditorManagerContext is only available inside EditorManagerProvider'
    )
  }

  return context
}
