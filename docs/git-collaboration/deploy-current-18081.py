"""Promote application code/assets, preserving the 18081 database and volumes."""
from pathlib import Path
import subprocess as sp, json, hashlib, tarfile, io
root=Path(__file__).resolve().parents[2]
source='overleaf-git-collaboration-web';target='overleaf-deletion-acceptance-candidate-web-1'
assert sp.check_output(['docker','port',target,'80'],text=True).strip()=='127.0.0.1:18081'
# Application-only archive; no database, credentials, runtime config or node_modules.
paths=sp.check_output(['docker','exec',source,'sh','-c','cd /overleaf && find services -maxdepth 2 -type d -name app'],text=True).splitlines()+['libraries','services/web/modules','services/web/config/settings.defaults.js']
backup=root/'docs/git-collaboration/18081-before-ui-redesign.tar'
if not backup.exists():
 with backup.open('wb') as out:sp.run(['docker','exec',target,'tar','--exclude=node_modules','-cf','-','-C','/overleaf',*paths],stdout=out,check=True)
archive=sp.check_output(['docker','exec',source,'tar','--exclude=node_modules','-cf','-','-C','/overleaf',*paths])
sp.run(['docker','exec','-i',target,'tar','-xf','-','-C','/overleaf'],input=archive,check=True)
stage=Path('/tmp/native-git-r28-local-build/services/web/public')
manifest=json.loads((stage/'manifest.json').read_text())
existing=set(sp.check_output(['docker','exec',target,'find','/overleaf/services/web/public','-type','f'],text=True).splitlines())
files={str(p.relative_to(stage)):p for p in stage.rglob('*') if p.is_file() and not p.name.endswith('.map') and (p.name=='manifest.json' or '/overleaf/services/web/public/'+str(p.relative_to(stage)) not in existing)}
# Keep all current asset paths so lazy-loaded chunks remain available.
buffer=io.BytesIO()
with tarfile.open(fileobj=buffer,mode='w') as tar:
 for name,p in files.items():tar.add(p,arcname=name)
sp.run(['docker','exec','-i',target,'tar','-xf','-','-C','/overleaf/services/web/public'],input=buffer.getvalue(),check=True)
for name,p in files.items():
 actual=sp.check_output(['docker','exec',target,'sha256sum','/overleaf/services/web/public/'+name],text=True).split()[0]
 assert actual==hashlib.sha256(p.read_bytes()).hexdigest(),name
print('18081 code and',len(files),'assets copied and verified; database, mounts and credentials preserved')
