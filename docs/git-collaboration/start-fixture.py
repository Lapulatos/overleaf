"""Start only task-owned branch collaboration acceptance services (port 18082)."""
from pathlib import Path
import subprocess, secrets, json
root = Path(__file__).resolve().parents[2]
image = 'overleaf-git-collaboration:20261111-p2'
name = 'overleaf-git-collaboration-web'
redis = 'overleaf-git-collaboration-redis'
network = 'overleaf-agent-acceptance_default'
# Existing instances and their volumes are never restarted or reused.
names = subprocess.check_output(['docker','ps','-a','--format','{{.Names}}'],text=True).splitlines()
if name in names:
    raise SystemExit('Fixture already exists; inspect and reuse it instead of replacing it')
if redis not in names:
    subprocess.run(['docker','run','-d','--name',redis,'--network',network,'--cpus','0.5','--memory','256m','redis:6.2'],check=True)
args = ['docker','run','-d','--name',name,'--platform','linux/amd64','--network',network,
        '--cpus','2','--memory','4g','-p','127.0.0.1:18082:80',
        '-v','overleaf-git-collaboration-data:/var/lib/overleaf',
        '-v',str(root/'docs/git-collaboration/fixture-settings.cjs')+':/etc/overleaf/workspace-fixture.cjs:ro']
values = {
 'OVERLEAF_CONFIG':'/etc/overleaf/workspace-fixture.cjs',
 'OVERLEAF_MONGO_URL':'mongodb://overleaf-agent-acceptance-mongo-1/prism_git_collaboration_20261111',
 'OVERLEAF_REDIS_HOST':redis,'REDIS_HOST':redis,
 'OVERLEAF_SITE_URL':'http://127.0.0.1:18082','OVERLEAF_APP_NAME':'Branch collaboration acceptance',
 'OVERLEAF_SESSION_SECRET':secrets.token_hex(32),'OVERLEAF_NATIVE_GIT_ENABLED':'true',
 'OVERLEAF_NATIVE_GIT_CREDENTIAL_KEY':secrets.token_hex(32),
 'EMAIL_CONFIRMATION_DISABLED':'true','DOCKER_RUNNER':'false','SANDBOXED_COMPILES':'false',
}
for key,value in values.items(): args += ['-e',key+'='+value]
subprocess.run(args+[image],check=True,stdout=subprocess.DEVNULL)
print(json.dumps({'container':name,'url':'http://127.0.0.1:18082','database':'prism_git_collaboration_20261111'}))
