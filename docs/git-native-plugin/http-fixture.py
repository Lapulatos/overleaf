"""Authenticated acceptance on a newly created candidate-only project."""
import json, urllib.request, urllib.error, http.cookiejar, os
from pathlib import Path
from html.parser import HTMLParser
private=Path.home()/'.local/share/overleaf-acceptance'
account=json.loads((private/'deletion-browser-state.json').read_text())
base='http://127.0.0.1:18081'
assert account['baseUrl'].rstrip('/')==base
jar=http.cookiejar.CookieJar(); http=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
class CSRF(HTMLParser):
 token=None
 def handle_starttag(self,tag,attrs):
  attrs=dict(attrs)
  if tag=='meta' and attrs.get('name')=='ol-csrfToken':self.token=attrs['content']
def page(path):
 body=http.open(base+path,timeout=60).read().decode(); p=CSRF();p.feed(body);return p.token
csrf=page('/login')
def request(path,body=None):
 req=urllib.request.Request(base+path,data=None if body is None else json.dumps(body).encode(),headers={'Content-Type':'application/json','X-CSRF-Token':csrf,'Accept':'application/json'})
 try:
  with http.open(req,timeout=120) as response:
   raw=response.read();return json.loads(raw) if raw else None
 except urllib.error.HTTPError as error:
  # Response excludes request payload and credentials.
  raise RuntimeError(str(error.code)+' '+error.read().decode()[:1500]) from None
request('/login',{'email':account['email'],'password':account['password'],'_csrf':csrf})
csrf=page('/project')
statePath=private/'native-git-acceptance.json'
if statePath.exists():state=json.loads(statePath.read_text())
else:
 project=request('/project/new',{'projectName':'Native Git isolated acceptance 20261109','template':'blank'})
 state={'projectId':project['project_id'],'baseUrl':base}
 fd=os.open(statePath,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
 with os.fdopen(fd,'w') as f:json.dump(state,f)
project=state['projectId']; prefix='/project/'+project+'/native-git'
status=request(prefix)
if status.get('connected') is False:status=request(prefix+'/initialize',{'branch':'main'})
print(json.dumps({'projectId':project,'status':status},indent=2))
