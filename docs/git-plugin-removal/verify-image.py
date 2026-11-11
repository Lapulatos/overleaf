import json,hashlib,subprocess,pathlib
root=pathlib.Path(__file__).resolve().parents[2]
tag='overleaf-agent-acceptance:20261109-without-git'
files=[p for p in json.loads((root/'docs/git-plugin-removal/changed-files.json').read_text()) if '/test/' not in p]
script='''const fs=require('fs'),crypto=require('crypto');const files=JSON.parse(process.argv[1]);for(const [p,h] of Object.entries(files)){if(crypto.createHash('sha256').update(fs.readFileSync('/overleaf/'+p)).digest('hex')!==h)throw Error(p)}for(const p of ['services/web/app/src/Features/GitSync','services/web/frontend/js/features/git-sync','services/document-updater/app/js/ReviewedWriteController.js'])if(fs.existsSync('/overleaf/'+p))throw Error('Git source still present: '+p);console.log('Verified '+Object.keys(files).length+' source files');'''
manifest={p:hashlib.sha256((root/p).read_bytes()).hexdigest() for p in files}
protected=json.loads((root/'docs/git-plugin-removal/protected-files.json').read_text())
# Verify deployed non-Git plugin source against the current workspace as well.
manifest.update({p:hashlib.sha256((root/p).read_bytes()).hexdigest() for p in protected if pathlib.Path(p).suffix in ['.mjs','.js','.ts','.tsx','.css','.json']})
subprocess.run(['docker','run','--rm','--network','none','--entrypoint','node',tag,'-e',script,json.dumps(manifest)],check=True)
report={'tag':tag,'imageId':subprocess.check_output(['docker','image','inspect',tag,'--format','{{.Id}}'],text=True).strip(),'verifiedFiles':len(manifest)}
(root/'docs/git-plugin-removal/image-verification.json').write_text(json.dumps(report,indent=2))
