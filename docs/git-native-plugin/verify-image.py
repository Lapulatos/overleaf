import json, hashlib, subprocess, sys
from pathlib import Path
root=Path(__file__).resolve().parents[2]
docs=root/'docs/git-native-plugin'
tag=sys.argv[1] if len(sys.argv)>1 else 'overleaf-agent-acceptance:20261109-native-git-candidate'
manifest=json.loads((docs/'build-manifest.json').read_text())
# Production focus legitimately rewrites package manifests and lockfile in image.
manifest={p:h for p,h in manifest.items() if not p.endswith('package.json') and p!='yarn.lock'}
protected=json.loads((root/'docs/git-plugin-removal/protected-files.json').read_text())
for p in protected:
 if p not in manifest and Path(p).suffix in ['.mjs','.js','.ts','.tsx','.css','.json']:
  manifest[p]=hashlib.sha256((root/p).read_bytes()).hexdigest()
script="""const fs=require('fs'),c=require('crypto');const files=JSON.parse(process.argv[1]);for(const [p,h] of Object.entries(files)){if(c.createHash('sha256').update(fs.readFileSync('/overleaf/'+p)).digest('hex')!==h)throw Error('Source mismatch: '+p)}for(const p of ['services/web/app/src/Features/GitSync','services/web/frontend/js/features/git-sync'])if(fs.existsSync('/overleaf/'+p))throw Error('Legacy implementation present');const git=require('/overleaf/node_modules/simple-git');if(typeof git.simpleGit!=='function')throw Error('Missing native Git adapter');console.log('Verified '+Object.keys(files).length+' source files and native adapter')"""
subprocess.run(['docker','run','--rm','--platform','linux/amd64','--network','none','--entrypoint','node',tag,'-e',script,json.dumps(manifest)],check=True)
(docs/'image-verification.json').write_text(json.dumps({'tag':tag,'imageId':subprocess.check_output(['docker','image','inspect',tag,'--format','{{.Id}}'],text=True).strip(),'verifiedFiles':len(manifest)},indent=2)+'\n')
