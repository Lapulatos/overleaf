"""Final-image native suites with disposable Redis; no live service access."""
import subprocess, time, uuid
from pathlib import Path
root=Path(__file__).resolve().parents[2]
suffix=uuid.uuid4().hex[:10]
network='native-git-validation-'+suffix
redis=network+'-redis'
image='overleaf-agent-acceptance:20261110-native-git-candidate-r15'
subprocess.run(['docker','network','create','--internal',network],check=True,stdout=subprocess.DEVNULL)
try:
    subprocess.run(['docker','run','-d','--pull','never','--name',redis,'--network',network,'redis:6.2','redis-server','--save','','--appendonly','no'],check=True,stdout=subprocess.DEVNULL)
    for attempt in range(30):
        probe=subprocess.run(['docker','exec',redis,'redis-cli','ping'],capture_output=True,text=True)
        if probe.returncode==0 and probe.stdout.strip()=='PONG':break
        time.sleep(.25)
    else:raise RuntimeError('Isolated Redis did not start')
    tests=sorted((root/'services/web/test/agent').glob('native-git-*.test.mjs'))
    paths=['/overleaf/services/web/test/agent/'+p.name for p in tests]
    result=subprocess.run(['docker','run','--rm','--platform','linux/amd64','--network',network,
        '-e','NATIVE_GIT_TEST_REDIS_URL=redis://'+redis+':6379',
        '--entrypoint','node','--mount','type=bind,source='+str(root/'services/web/test/agent')+',target=/overleaf/services/web/test/agent,readonly',
        image,'--test',*paths])
    if result.returncode:raise SystemExit(result.returncode)
finally:
    subprocess.run(['docker','rm','-f',redis],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    subprocess.run(['docker','network','rm',network],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
