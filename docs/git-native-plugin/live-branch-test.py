"""Live public Git API plus existing document service; isolated project only."""
import runpy, subprocess, json
from pathlib import Path
ctx=runpy.run_path(str(Path(__file__).with_name('http-fixture.py')))
request=ctx['request'];prefix=ctx['prefix'];project=ctx['project'];account=ctx['account']
recordPath=ctx['private']/'native-git-live-branch-progress.json'
progress=json.loads(recordPath.read_text()) if recordPath.exists() else {'projectId':project,'steps':{}}
assert progress['projectId']==project

def save():
 recordPath.write_text(json.dumps(progress,indent=2));recordPath.chmod(0o600)
def step(name,action):
 if name not in progress['steps']:
  progress['steps'][name]=action();save();print('PASS '+name,flush=True)
 return progress['steps'][name]
def command(**body):return request(prefix+'/commands',body)
script="""
import ProjectGetter from './app/src/Features/Project/ProjectGetter.mjs';
import Entities from './app/src/Features/Project/ProjectEntityHandler.mjs';
import Documents from './app/src/Features/DocumentUpdater/DocumentUpdaterHandler.mjs';
const [project,user,mode,content]=process.argv.slice(1);
const metadata=await ProjectGetter.promises.getProject(project,{name:1,owner_ref:1});
if(metadata.name!=='Native Git isolated acceptance 20261109'||String(metadata.owner_ref)!==user)throw Error('Not the isolated fixture project');
const {docs}=await Entities.promises.getAllEntities(project);
const entry=docs.find(d=>d.path==='/main.tex'||d.path==='main.tex');
if(!entry)throw Error('Missing fixture document');
const id=String(entry.doc._id);const current=await Documents.promises.getDocument(project,id,-1);
if(mode==='write')await Documents.promises.setDocument(project,id,user,JSON.parse(content).split('\\n'),'git',current.version);
const result=await Documents.promises.getDocument(project,id,-1);
console.log('RESULT '+JSON.stringify({id,text:result.lines.join('\\n'),version:result.version}));process.exit(0);
"""
def document(text=None):
 args=['docker','exec','-w','/overleaf/services/web','overleaf-deletion-acceptance-candidate-web-1','node','--input-type=module','-e',script,project,account['userId'],'read' if text is None else 'write',json.dumps(text)]
 result=subprocess.run(args,capture_output=True,text=True,timeout=60)
 if result.returncode:raise RuntimeError(result.stderr[-2500:])
 return json.loads(next(line[7:] for line in result.stdout.splitlines() if line.startswith('RESULT ')))
def same(expected):
 actual=document()['text'];assert actual==expected,'Wrong branch document bytes';return True
original=step('read initial document',lambda:document()['text'])
step('stage initial manuscript',lambda:command(command='stage',paths=['main.tex']))
initial=step('commit initial manuscript',lambda:command(command='commit',message='Fixture initial manuscript'))
step('create B',lambda:command(command='createBranch',name='B'))
step('checkout B',lambda:command(command='checkout',name='B'))
bCommitted='% Committed on B\n'+original
step('edit B document',lambda:document(bCommitted))
step('stage B document',lambda:command(command='stage',paths=['main.tex']))
b=step('commit B',lambda:command(command='commit',message='Fixture B title change'))
assert b['graph'][0]['subject']=='Fixture B title change'
assert b['status']['files']==[]
assert next(item for item in b['branches'] if item['name']=='B')['commit']!=next(item for item in b['branches'] if item['name']=='main')['commit']
bDirty='% Unfinished on B\n'+bCommitted
step('leave B uncommitted edit',lambda:document(bDirty))
old=step('checkout old main',lambda:command(command='checkout',name='main'))
assert old['status']['files']==[]
step('verify old main contents',lambda:same(original))
aDirty='% Unfinished on main\n'+original
step('leave main uncommitted edit',lambda:document(aDirty))
step('return to B',lambda:command(command='checkout',name='B'))
step('verify B unfinished content preserved',lambda:same(bDirty))
step('return to main',lambda:command(command='checkout',name='main'))
step('verify main unfinished content preserved',lambda:same(aDirty))
print('PASS live branch/commit/graph and per-branch document preservation',flush=True)
