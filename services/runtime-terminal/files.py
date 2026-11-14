"""Bounded file interchange using directory-relative descriptors; no symlinks."""
import os,sys,json,stat,base64,hashlib
LIMIT=5*1024*1024
FLAGS=os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW
def parts(path):
 if not isinstance(path,str) or len(path)>1000 or path.startswith('/') or '\\' in path or any(ord(c)<32 for c in path):raise ValueError('Invalid relative path')
 values=path.split('/')
 if not path:return []
 if any(v in ('','.','..','.git') for v in values):raise ValueError('Invalid relative path')
 return values
def directory(root,values,create=False):
 fd=os.dup(root)
 try:
  for value in values:
   if create:
    try:os.mkdir(value,0o700,dir_fd=fd)
    except FileExistsError:pass
   nxt=os.open(value,FLAGS,dir_fd=fd);os.close(fd);fd=nxt
  return fd
 except:os.close(fd);raise

def operate(root,request):
 fd=os.open(root,FLAGS)
 try:
  if request['action']=='read':
   files=[];total=0;entries=0
   def walk(parent,name,relative):
    nonlocal total,entries
    entries+=1
    if entries>2000 or relative.count('/')>50:raise ValueError('Directory traversal limit exceeded')
    info=os.stat(name,dir_fd=parent,follow_symlinks=False)
    if stat.S_ISDIR(info.st_mode):
     child=os.open(name,FLAGS,dir_fd=parent)
     try:
      for entry in sorted(os.listdir(child)):
       parts(entry);walk(child,entry,relative+'/'+entry if relative else entry)
     finally:os.close(child)
    elif stat.S_ISREG(info.st_mode):
     if len(files)>=500 or total+info.st_size>LIMIT:raise ValueError('Transfer limit: 500 files / 5 MiB')
     handle=os.open(name,os.O_RDONLY|os.O_NOFOLLOW,dir_fd=parent)
     with os.fdopen(handle,'rb') as stream:data=stream.read(LIMIT+1-total)
     total+=len(data)
     if total>LIMIT:raise ValueError('Transfer exceeds 5 MiB')
     files.append({'path':relative,'data':base64.b64encode(data).decode(),'sha256':hashlib.sha256(data).hexdigest()})
    else:raise ValueError('Links and special files cannot be transferred')
   paths=request.get('paths',[])
   if not isinstance(paths,list) or not 1<=len(paths)<=30:raise ValueError('Select 1–30 paths')
   for path in paths:
    v=parts(path)
    if not v:raise ValueError('Select a file or folder')
    parent=directory(fd,v[:-1])
    try:walk(parent,v[-1],path)
    finally:os.close(parent)
   if len({f['path'] for f in files})!=len(files):raise ValueError('Overlapping source paths')
   return {'files':files,'bytes':total}
  if request['action']=='write':
   files=request.get('files',[]);prefix=parts(request.get('destination',''));total=0;seen=set();prepared=[]
   if not isinstance(files,list) or not 1<=len(files)<=500:raise ValueError('Transfer limit: 500 files')
   for f in files:
    v=prefix+parts(f['path']);key='/'.join(v)
    if not v or key in seen:raise ValueError('Repeated destination')
    seen.add(key);data=base64.b64decode(f['data'],validate=True);total+=len(data)
    if total>LIMIT:raise ValueError('Transfer exceeds 5 MiB')
    if hashlib.sha256(data).hexdigest()!=f['sha256']:raise ValueError('File checksum mismatch')
    parent=directory(fd,v[:-1],True)
    try:
     try:os.stat(v[-1],dir_fd=parent,follow_symlinks=False)
     except FileNotFoundError:pass
     else:raise ValueError('Destination exists; choose a different destination folder')
    finally:os.close(parent)
    prepared.append((v,data))
   completed=[]
   try:
    for v,data in prepared:
     parent=directory(fd,v[:-1])
     try:
      out=os.open(v[-1],os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600,dir_fd=parent)
      with os.fdopen(out,'wb') as stream:stream.write(data)
      completed.append('/'.join(v))
     finally:os.close(parent)
   except Exception:return {'error':'Transfer interrupted; existing files were not overwritten','completed':completed}
   return {'completed':completed,'bytes':total}
  raise ValueError('Unsupported file operation')
 finally:os.close(fd)
if __name__=='__main__':
 try:print(json.dumps(operate(sys.argv[1],json.load(sys.stdin))))
 except Exception as e:print(json.dumps({'error':str(e) if isinstance(e,ValueError) else 'File unavailable or unsafe path'}));sys.exit(1)
