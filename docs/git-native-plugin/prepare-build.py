"""Stage only native Git integration files over the verified removal image."""
from pathlib import Path
import hashlib, json, shutil
repo = Path(__file__).resolve().parents[2]
context = repo / 'plan/native-git-context'
context.mkdir(parents=True, exist_ok=True)
paths = [
 'services/web/frontend/js/features/source-editor/extensions/writing-assist/conversation-panel.tsx',
 'services/web/frontend/js/features/source-editor/extensions/writing-assist/composer-context.tsx',
 'services/web/app/src/Features/WritingAssist/WritingAssistAgentService.mjs',
 'services/web/app/src/Features/WritingAssist/WritingAssistAgentController.mjs',
 'services/web/app/src/Features/NativeGit',
 'services/web/app/src/models/Project.mjs',
 'services/web/app/src/Features/Collaborators/CollaboratorsGetter.mjs',
 'services/web/app/src/Features/Authorization/AuthorizationManager.mjs',
 'services/web/app/src/Features/Project/ProjectGetter.mjs',
 'services/web/app/src/Features/Project/ProjectEditorHandler.mjs',
 'services/web/frontend/js/features/ide-react/editor',
 'services/web/frontend/js/features/ide-react/context/editor-manager-context.tsx',
 'services/web/frontend/js/shared/context/types/project-metadata.tsx',
 'services/web/app/src/Features/Editor/EditorRealTimeController.mjs',
 'services/web/app/src/Features/Editor/EditorHttpController.mjs',
 'services/web/app/src/Features/ThirdPartyDataStore/TpdsUpdateSender.mjs',
 'services/web/frontend/js/features/source-control',
 'services/web/app/src/router.mjs',
 'services/web/app/src/Features/Project/ProjectController.mjs',
 'services/web/app/src/Features/Project/ProjectEntityUpdateHandler.mjs',
 'services/web/app/src/Features/DocumentUpdater/DocumentUpdaterHandler.mjs',
 'services/web/app/views/project/editor/_meta.pug',
 'services/web/frontend/js/utils/meta.ts',
 'services/web/frontend/js/features/ide-react/components/rail/rail.tsx',
 'services/web/frontend/js/features/ide-react/components/editor/editor-panel.tsx',
 'services/web/frontend/js/features/ide-react/context/rail-context.tsx',
 'services/web/frontend/js/features/ide-react/context/ide-react-context.tsx',
 'services/web/config/settings.defaults.js',
 'services/web/package.json',
 'services/document-updater/app.js',
 'services/document-updater/app/js/RedisManager.js',
 'services/document-updater/app/js/RealTimeRedisManager.js',
 'services/document-updater/app/js/UpdateManager.js',
 'services/real-time/app/js/DocumentUpdaterManager.js',
 'services/real-time/app/js/WebsocketController.js',
 'services/real-time/app/js/Router.js',
 'libraries/redis-wrapper/ProjectWriteGate.js',
 'libraries/redis-wrapper/WorkspaceEpochGate.js',
 'libraries/redis-wrapper/WorkspacePrepareGate.js',
 'libraries/redis-wrapper/package.json',
 'services/agent/package.json', 'server-ce/test/package.json',
 'package.json', 'yarn.lock',
]
# r27 already contains the verified production dependencies. Reuse them only
# while dependency inputs remain exactly the same; upgrades need a new base.
baseline_path = repo / 'docs/git-native-plugin/runtime-dependency-baseline.json'
if baseline_path.exists():
 for dependency, expected in json.loads(baseline_path.read_text()).items():
  if hashlib.sha256((repo / dependency).read_bytes()).hexdigest() != expected:
   raise RuntimeError(f'Production dependency base must be updated: {dependency}')
manifest = {}
for entry in paths:
 source = repo / entry
 files = sorted(source.rglob('*')) if source.is_dir() else [source]
 for file in files:
  if not file.is_file(): continue
  relative = file.relative_to(repo)
  destination = context / relative
  destination.parent.mkdir(parents=True, exist_ok=True)
  shutil.copyfile(file, destination)
  manifest[str(relative)] = hashlib.sha256(file.read_bytes()).hexdigest()
(context / 'Dockerfile').write_text('''FROM overleaf-agent-acceptance:20261109-native-git-base AS dependencies
COPY package.json yarn.lock /overleaf/
COPY libraries/redis-wrapper/package.json /overleaf/libraries/redis-wrapper/package.json
COPY services/web/package.json /overleaf/services/web/package.json
COPY services/agent/package.json /overleaf/services/agent/package.json
COPY server-ce/test/package.json /overleaf/server-ce/test/package.json
WORKDIR /overleaf/services/web
RUN --mount=type=cache,target=/root/.cache --mount=type=tmpfs,target=/tmp CYPRESS_INSTALL_BINARY=0 YARN_ENABLE_GLOBAL_CACHE=false YARN_ENABLE_MIRROR=false YARN_TASK_POOL_CONCURRENCY=1 YARN_NETWORK_CONCURRENCY=2 YARN_HTTP_TIMEOUT=60000 YARN_HTTP_RETRY=1 NODE_OPTIONS=--max-old-space-size=512 YARN_CACHE_FOLDER=/tmp/.yarn-cache yarn install --immutable
FROM dependencies AS frontend_build
COPY libraries/ /overleaf/libraries/
COPY services/ /overleaf/services/
COPY server-ce/ /overleaf/server-ce/
RUN --mount=type=cache,target=/overleaf/services/web/node_modules/.cache,id=server-ce-webpack-cache --mount=type=tmpfs,target=/tmp CYPRESS_INSTALL_BINARY=0 YARN_ENABLE_GLOBAL_CACHE=false YARN_ENABLE_MIRROR=false YARN_TASK_POOL_CONCURRENCY=1 YARN_NETWORK_CONCURRENCY=2 NODE_OPTIONS=--max-old-space-size=1536 YARN_CACHE_FOLDER=/tmp/.yarn-cache yarn run webpack:production
FROM overleaf-agent-acceptance:20261110-native-git-candidate-r27 AS application
COPY libraries/ /overleaf/libraries/
COPY services/ /overleaf/services/
COPY server-ce/ /overleaf/server-ce/
COPY --from=frontend_build /overleaf/services/web/public/ /overleaf/services/web/public/
WORKDIR /overleaf
''')
(repo / 'docs/git-native-plugin/build-manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
print(f'Staged {len(manifest)} files at {context}')
