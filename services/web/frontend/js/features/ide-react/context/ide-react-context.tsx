import React, {
  createContext,
  useContext,
  useState,
  FC,
  useMemo,
  useEffect,
  useCallback,
} from 'react'
import { ReactScopeValueStore } from '@/features/ide-react/scope-value-store/react-scope-value-store'
import { IdeProvider } from '@/shared/context/ide-context'
import {
  createIdeEventEmitter,
  IdeEventEmitter,
} from '@/features/ide-react/create-ide-event-emitter'
import { JoinProjectPayload } from '@/features/ide-react/connection/join-project-payload'
import { useConnectionContext } from '@/features/ide-react/context/connection-context'
import { postJSON } from '@/infrastructure/fetch-json'
import { ReactScopeEventEmitter } from '@/features/ide-react/scope-event-emitter/react-scope-event-emitter'
import getMeta from '@/utils/meta'
import { type PermissionsLevel } from '@/features/ide-react/types/permissions'
import { useProjectContext } from '@/shared/context/project-context'
import { ProjectMetadata } from '@/shared/context/types/project-metadata'

const LOADED_AT = new Date()

type IdeReactContextValue = {
  projectId: string
  eventEmitter: IdeEventEmitter
  startedFreeTrial: boolean
  setStartedFreeTrial: React.Dispatch<
    React.SetStateAction<IdeReactContextValue['startedFreeTrial']>
  >
  reportError: (error: any, meta?: Record<string, any>) => void
  projectJoined: boolean
  permissionsLevel: PermissionsLevel
  hasProjectWriteAccess?: boolean
  setPermissionsLevel: (permissionsLevel: PermissionsLevel) => void
  setOutOfSync: (value: boolean) => void
}

export const IdeReactContext = createContext<IdeReactContextValue | undefined>(
  undefined
)

export const IdeReactProvider: FC<React.PropsWithChildren> = ({ children }) => {
  const projectId = getMeta('ol-project_id')
  const [eventEmitter] = useState(createIdeEventEmitter)
  const [permissionsLevel, setPermissionsLevel] =
    useState<PermissionsLevel>('readOnly')
  const [outOfSync, setOutOfSync] = useState(false)
  const [gitPrepareBusy, setGitPrepareBusy] = useState(false)
  const [gitLocalBusy, setGitLocalBusy] = useState(false)
  const [gitRemoteBusy, setGitRemoteBusy] = useState(false)
  const [scopeEventEmitter] = useState(
    () => new ReactScopeEventEmitter(eventEmitter)
  )
  const [unstableStore] = useState(() => {
    const store = new ReactScopeValueStore()
    // Add dummy editor.ready key for Writefull, that relies on this calling
    // back once after watching it
    store.set('editor.ready', undefined)
    return store
  })
  const [startedFreeTrial, setStartedFreeTrial] = useState(false)
  const release = getMeta('ol-ExposedSettings')?.sentryRelease ?? null

  // Set to true only after project:joined has fired and all its listeners have
  // been called
  const [projectJoined, setProjectJoined] = useState(false)

  const { socket, getSocketDebuggingInfo, connectionState } = useConnectionContext()
  useEffect(() => {
    let expiry: ReturnType<typeof setTimeout> | undefined
    const preparing = (event: Event) => setGitPrepareBusy((event as CustomEvent<{ busy: boolean }>).detail.busy)
    const local = (event: Event) => setGitLocalBusy((event as CustomEvent<{ busy: boolean }>).detail.busy)
    const remote = (value: { busy: boolean; ttlMs?: number }) => {
      clearTimeout(expiry)
      setGitRemoteBusy(value.busy === true)
      if (value.busy) expiry = setTimeout(() => setGitRemoteBusy(false), Math.min(300000, value.ttlMs || 300000))
    }
    const disconnected = () => { clearTimeout(expiry); setGitRemoteBusy(false) }
    window.addEventListener('native-git-prepare-write-state', preparing)
    window.addEventListener('native-git-local-write-state', local)
    const repositoryChanged = () => window.dispatchEvent(new Event('native-git-command-completed'))
    socket.on('nativeGitRepositoryChanged', repositoryChanged)
    socket.on('reconnect', repositoryChanged)
    socket.on('nativeGitWriteState', remote)
    socket.on('disconnect', disconnected)
    return () => {
      clearTimeout(expiry)
      window.removeEventListener('native-git-prepare-write-state', preparing)
      window.removeEventListener('native-git-local-write-state', local)
      socket.removeListener('nativeGitRepositoryChanged', repositoryChanged)
      socket.removeListener('reconnect', repositoryChanged)
      socket.removeListener('nativeGitWriteState', remote)
      socket.removeListener('disconnect', disconnected)
    }
  }, [socket])
  const { joinProject, project } = useProjectContext()
  const spellCheckLanguage = project?.spellCheckLanguage

  const reportError = useCallback(
    (error: any, meta?: Record<string, any>) => {
      const metadata = {
        ...meta,
        user_id: getMeta('ol-user_id'),
        project_id: projectId,
        client_now: new Date(),
        performance_now: performance.now(),
        release,
        client_load: LOADED_AT,
        spellCheckLanguage,
        ...getSocketDebuggingInfo(),
      }

      const errorObj: Record<string, any> = {}
      if (typeof error === 'object') {
        for (const key of Object.getOwnPropertyNames(error)) {
          errorObj[key] = error[key]
        }
      } else if (typeof error === 'string') {
        errorObj.message = error
      }
      return postJSON('/error/client', {
        body: {
          error: errorObj,
          meta: metadata,
        },
      })
    },
    [release, projectId, getSocketDebuggingInfo, spellCheckLanguage]
  )

  // Populate scope values when joining project, then fire project:joined event
  useEffect(() => {
    function handleJoinProjectResponse({
      project: {
        rootDoc_id: rootDocId,
        publicAccesLevel: publicAccessLevel,
        ..._project
      },
      permissionsLevel,
    }: JoinProjectPayload) {
      const project = { ..._project, rootDocId, publicAccessLevel }

      // Cast the project from the payload as ProjectMetadata to ensure it has
      // the correct type for the context. It must be close enough because the
      // data structure hasn't changed and it worked previously. This type
      // coercion was previously sidestepped by adding the project to the scope
      // store, which does not enforce types.
      joinProject(project as unknown as ProjectMetadata)

      setPermissionsLevel(permissionsLevel)
      eventEmitter.emit('project:joined', { project, permissionsLevel })
      setProjectJoined(true)
    }

    socket.on('joinProjectResponse', handleJoinProjectResponse)

    return () => {
      socket.removeListener('joinProjectResponse', handleJoinProjectResponse)
    }
  }, [socket, eventEmitter, joinProject])

  const ide = useMemo(() => {
    return {
      _id: projectId,
      socket,
      reportError,
    }
  }, [projectId, socket, reportError])

  const value = useMemo(
    () => ({
      eventEmitter,
      startedFreeTrial,
      setStartedFreeTrial,
      // Tool visibility follows actual access, not transient Git write locks.
      hasProjectWriteAccess: !outOfSync && !connectionState.forceDisconnected && ['owner', 'readAndWrite'].includes(permissionsLevel),
      permissionsLevel: outOfSync || gitLocalBusy || gitRemoteBusy || gitPrepareBusy ? 'readOnly' : permissionsLevel,
      setPermissionsLevel,
      setOutOfSync,
      projectId,
      reportError,
      projectJoined,
    }),
    [
      eventEmitter,
      outOfSync,
      connectionState.forceDisconnected,
      gitPrepareBusy,
      gitLocalBusy,
      gitRemoteBusy,
      permissionsLevel,
      projectId,
      projectJoined,
      reportError,
      startedFreeTrial,
    ]
  )

  return (
    <IdeReactContext.Provider value={value}>
      <IdeProvider
        ide={ide}
        scopeEventEmitter={scopeEventEmitter}
        unstableStore={unstableStore}
      >
        {children}
      </IdeProvider>
    </IdeReactContext.Provider>
  )
}

export function useIdeReactContext(): IdeReactContextValue {
  const context = useContext(IdeReactContext)

  if (!context) {
    throw new Error(
      'useIdeReactContext is only available inside IdeReactProvider'
    )
  }

  return context
}
