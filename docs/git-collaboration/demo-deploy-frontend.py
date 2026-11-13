"""Deploy the verified demo checker frontend only to the isolated instance."""
from pathlib import Path
import hashlib, io, re, subprocess, tarfile, argparse
root=Path(__file__).resolve().parents[2]
stage=Path('/tmp/native-git-r28-local-build/services/web/public')
container='overleaf-git-collaboration-web'
parser=argparse.ArgumentParser()
parser.add_argument('--build-log',default='docs/git-collaboration/demo-checker-ui-build.log')
parser.add_argument('--port', choices=['18081', '18082'], default='18082')
args=parser.parse_args()
container = 'overleaf-git-collaboration-web' if args.port == '18082' else 'overleaf-deletion-acceptance-candidate-web-1'
log=(root/args.build_log).read_text()
assert re.search(r'compiled (?:successfully|with \d+ warnings?) in \d+ ms',log)
assert not re.search(r'compiled with.*errors?',log)
ports=subprocess.check_output(['docker','port',container,'80'],text=True).strip()
assert ports=='127.0.0.1:'+args.port,ports
existing=set(subprocess.check_output(['docker','exec',container,'find','/overleaf/services/web/public','-type','f'],text=True).splitlines())
files={str(p.relative_to(stage)):p for p in stage.rglob('*') if p.is_file() and not p.name.endswith('.map') and (p.name=='manifest.json' or '/overleaf/services/web/public/'+str(p.relative_to(stage)) not in existing)}
assert 'manifest.json' in files
assert sum(p.stat().st_size for p in files.values())<100*1024*1024
buf=io.BytesIO()
with tarfile.open(fileobj=buf,mode='w') as archive:
 for name,p in files.items():archive.add(p,arcname=name)
subprocess.run(['docker','exec','-i',container,'tar','-xf','-','-C','/overleaf/services/web/public'],input=buf.getvalue(),check=True)
for name,p in files.items():
 actual=subprocess.check_output(['docker','exec',container,'sha256sum','/overleaf/services/web/public/'+name],text=True).split()[0]
 assert actual==hashlib.sha256(p.read_bytes()).hexdigest(),name
subprocess.run(['docker','exec',container,'sv','-w','30','restart','/etc/service/web-overleaf','/etc/service/web-api-overleaf'],check=True)
print('Frontend deployed and hash verified:',len(files),'files; instance'+args.port+' only')
