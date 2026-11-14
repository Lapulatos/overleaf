import React, { useEffect, useState } from 'react'
import withErrorBoundary from '../../../infrastructure/error-boundary'
import { useProjectContext } from '../../../shared/context/project-context'
import { useFileTreeData } from '../../../shared/context/file-tree-data-context'
import FileTreeContext from './file-tree-context'
import FileTreeDraggablePreviewLayer from './file-tree-draggable-preview-layer'
import FileTreeFolderList from './file-tree-folder-list'
import FileTreeToolbar from './file-tree-toolbar'
import FileTreeModalDelete from './modals/file-tree-modal-delete'
import FileTreeModalCreateFolder from './modals/file-tree-modal-create-folder'
import FileTreeModalError from './modals/file-tree-modal-error'
import FileTreeContextMenu from './file-tree-context-menu'
import FileTreeError from './file-tree-error'
import { useDroppable } from '../contexts/file-tree-draggable'
import { useFileTreeSocketListener } from '../hooks/file-tree-socket-listener'
import FileTreeModalCreateFile from './modals/file-tree-modal-create-file'
import FileTreeInner from './file-tree-inner'
import { useDragLayer } from 'react-dnd'
import classnames from 'classnames'
import { useFileTreeSelectable } from '../contexts/file-tree-selectable'
import { findInTree } from '../util/find-in-tree'
import { PROJECT_ENTITIES_MIME } from '@/features/source-editor/extensions/writing-assist/composer-mentions'
import { pathInFolder } from '@/features/file-tree/util/path'
import { FileTreeFindResult } from '@/features/ide-react/types/file-tree'

const FileTreeRoot = React.memo<{
  onSelect: () => void
  onDelete: () => void
  onInit: () => void
  isConnected: boolean
  setRefProviderEnabled: () => void
  setStartedFreeTrial: () => void
  refProviders: Record<string, boolean>
}>(function FileTreeRoot({
  refProviders,
  setRefProviderEnabled,
  setStartedFreeTrial,
  onSelect,
  onInit,
  onDelete,
  isConnected,
}) {
  const [fileTreeContainer, setFileTreeContainer] =
    useState<HTMLDivElement | null>(null)
  const { projectId } = useProjectContext()
  const { fileTreeData } = useFileTreeData()
  const isReady = Boolean(projectId && fileTreeData)


  useEffect(() => {
    if (isReady) onInit()
  }, [isReady, onInit])
  if (!isReady) return null

  return (
    <div
      className="file-tree"
      data-testid="file-tree"
      ref={setFileTreeContainer}
    >
      {fileTreeContainer && (
        <FileTreeContext
          refProviders={refProviders}
          setRefProviderEnabled={setRefProviderEnabled}
          setStartedFreeTrial={setStartedFreeTrial}
          onSelect={onSelect}
          fileTreeContainer={fileTreeContainer}
        >
          {isConnected ? null : <div className="disconnected-overlay" />}
          <ProjectReferenceDragData fileTreeContainer={fileTreeContainer} />
          <FileTreeToolbar />
          <FileTreeContextMenu />
          <FileTreeInner>
            <FileTreeRootFolder onDelete={onDelete} />
          </FileTreeInner>
          <FileTreeModalDelete />
          <FileTreeModalCreateFile />
          <FileTreeModalCreateFolder />
          <FileTreeModalError />
        </FileTreeContext>
      )}
    </div>
  )
})

function ProjectReferenceDragData({fileTreeContainer}:{fileTreeContainer:HTMLDivElement}) {
  const { projectId } = useProjectContext()
  const { fileTreeData } = useFileTreeData()
  const { selectedEntityIds, isRootFolderSelected } = useFileTreeSelectable()
  useEffect(() => {
    if (fileTreeContainer) {
      const listener = (event: DragEvent) => {
        if (event.dataTransfer) {
          // store the dragged entity in dataTransfer
          const target = (event.target as HTMLElement).closest<HTMLElement>('[data-file-id]')
          if (!target) return
          const { dataset } = target
          if (dataset.fileId) {
            const ids = !isRootFolderSelected && selectedEntityIds.has(dataset.fileId)
              ? [...selectedEntityIds] : [dataset.fileId]
            const items = ids.flatMap(id => {
              const path = pathInFolder(fileTreeData, id)
              const entity = findInTree(fileTreeData, id)
              return path && entity ? [{path, kind: entity.type === 'folder' ? 'folder' : 'file'}] : []
            })
            event.dataTransfer.setData(PROJECT_ENTITIES_MIME, JSON.stringify({projectId, items}))
          }
          if (
            dataset.fileId &&
            dataset.fileType &&
            dataset.fileType !== 'folder'
          ) {
            event.dataTransfer.setData(
              'application/x-overleaf-file-id',
              dataset.fileId
            )

            const filePath = pathInFolder(fileTreeData, dataset.fileId)
            if (filePath) {
              event.dataTransfer.setData(
                'application/x-overleaf-file-path',
                filePath
              )
            }
          }
        }
      }

      fileTreeContainer.addEventListener('dragstart', listener)

      return () => {
        fileTreeContainer.removeEventListener('dragstart', listener)
      }
    }
  }, [fileTreeContainer, fileTreeData, projectId, selectedEntityIds, isRootFolderSelected])

  return null
}

function FileTreeRootFolder({
  onDelete,
}: {
  onDelete: (entity: FileTreeFindResult, isFileRestore?: boolean) => void
}) {
  useFileTreeSocketListener(onDelete)
  const { fileTreeData } = useFileTreeData()

  const { isOver, dropRef } = useDroppable(fileTreeData._id)

  const dragLayer = useDragLayer(monitor => ({
    isDragging: monitor.isDragging(),
    item: monitor.getItem(),
    clientOffset: monitor.getClientOffset(),
  }))

  return (
    <>
      <FileTreeDraggablePreviewLayer isOver={isOver} {...dragLayer} />
      <FileTreeFolderList
        folders={fileTreeData.folders}
        docs={fileTreeData.docs}
        files={fileTreeData.fileRefs}
        classes={{
          root: classnames('file-tree-list', {
            'file-tree-dragging': dragLayer.isDragging,
          }),
        }}
        dropRef={dropRef}
        dataTestId="file-tree-list-root"
      />
    </>
  )
}

export default withErrorBoundary(FileTreeRoot, FileTreeError)
