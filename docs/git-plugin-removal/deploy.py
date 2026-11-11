import json,subprocess,pathlib,os,urllib.request
root=pathlib.Path(__file__).resolve().parent
verified=json.loads((root/'image-verification.json').read_text())
assert subprocess.check_output(['docker','image','inspect',verified['tag'],'--format','{{.Id}}'],text=True).strip()==verified['imageId']
name='overleaf-deletion-acceptance-candidate-web-1'
info=json.loads(subprocess.check_output(['docker','inspect',name],text=True))[0]
assert info['Config']['Image']=='overleaf-agent-acceptance:20261107-git-ui-r23'
values=dict(x.split('=',1) for x in info['Config']['Env'])
health=json.load(urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:47291/agent/health',headers={'X-Agent-Token':values['OVERLEAF_AGENT_TOKEN']}),timeout=5))
assert health['concurrency']['running']==0,'An assistant task is running'
check="""const {db,connectionPromise}=await import('/overleaf/services/web/app/src/infrastructure/mongodb.mjs');await connectionPromise;const n=await db.projects.countDocuments({gitSyncApplication:{$exists:true}})+await db.venueSyncState.countDocuments({_id:'venue-database-refresh',running:true,leaseUntil:{$gt:Date.now()}});process.exit(n?1:0);"""
subprocess.run(['docker','exec','-w','/overleaf/services/web',name,'node','--input-type=module','-e',check],check=True,capture_output=True)
assert subprocess.run(['docker','exec',name,'pgrep','-f','venue-deep-refresh.mjs'],capture_output=True).returncode==1
keys=['OVERLEAF_AGENT_TOKEN','WRITING_ASSIST_ZOTERO_ENCRYPTION_KEY']
env={**os.environ,**{k:values[k] for k in keys}}
subprocess.run(['docker','compose','-p','overleaf-deletion-acceptance','-f',str(root/'runtime.compose.yml'),'up','-d','--no-build','--pull','never','candidate-web'],env=env,check=True)
(root/'deployment.json').write_text(json.dumps({'previousImage':info['Config']['Image'],'image':verified['tag'],'url':'http://127.0.0.1:18081','browserUntouched':True,'volumesPreserved':True},indent=2))
