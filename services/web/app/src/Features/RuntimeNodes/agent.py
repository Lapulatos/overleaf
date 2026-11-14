#!/usr/bin/env python3
"""Read-only Overleaf resource reporter. Python 3.11+, psutil is optional for macOS CPU and memory utilization."""
import argparse
import csv
import io
import plistlib
import re
import tomllib
import json
import os
import platform
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path


def command(args):
    return subprocess.check_output(args, timeout=4, stderr=subprocess.DEVNULL, text=True).strip()


def number(value):
    try:
        n = float(value)
        return n if 0 <= n < float('inf') else None
    except (TypeError, ValueError):
        return None


def gpu_usage():
    if sys.platform == 'darwin':
        try:
            data = plistlib.loads(subprocess.check_output(['ioreg','-a','-r','-c','IOAccelerator'], timeout=4, stderr=subprocess.DEVNULL))
            devices = []
            for item in data:
                stats = item.get('PerformanceStatistics', {})
                if 'Device Utilization %' in stats:
                    devices.append({'name': str(item.get('model','Apple GPU'))[:100], 'utilization': number(stats['Device Utilization %']), 'memoryUsed': number(stats.get('In use system memory')), 'memoryTotal': None})
            return {'status': 'available' if devices else 'unavailable', 'devices': devices, 'reason': 'Shared system memory' if devices else 'Driver does not expose GPU counters'}
        except (OSError, ValueError, subprocess.SubprocessError, plistlib.InvalidFileException):
            return {'status':'unavailable','devices':[],'reason':'GPU counters unavailable'}
    if shutil.which('nvidia-smi'):
        try:
            rows = csv.reader(io.StringIO(command(['nvidia-smi','--query-gpu=name,utilization.gpu,memory.used,memory.total','--format=csv,noheader,nounits'])))
            devices = []
            for row in rows:
                if len(row) != 4: continue
                used, total = number(row[2]), number(row[3])
                devices.append({'name':row[0].strip()[:100], 'utilization':number(row[1]), 'memoryUsed':None if used is None else used*1024**2, 'memoryTotal':None if total is None else total*1024**2})
            return {'status':'available' if any(d['utilization'] is not None for d in devices) else 'unavailable','devices':devices[:16],'reason':'NVIDIA driver counters'}
        except (OSError, subprocess.SubprocessError):
            return {'status':'unavailable','devices':[],'reason':'NVIDIA driver counters inaccessible'}
    devices = []
    for card in sorted(Path('/sys/class/drm').glob('card[0-9]*')):
        if not re.fullmatch(r'card[0-9]+',card.name): continue
        try:
            vendor = (card/'device/vendor').read_text().strip()
            if vendor not in ('0x8086','0x1002'): continue  # Do not mislabel FPGA devices as GPUs.
            name = ('Intel GPU' if vendor == '0x8086' else 'AMD GPU')+' · '+card.name
            def read(field):
                try: return number((card/'device'/field).read_text().strip())
                except OSError: return None
            devices.append({'name':name,'utilization':read('gpu_busy_percent'),'memoryUsed':read('mem_info_vram_used'),'memoryTotal':read('mem_info_vram_total')})
        except OSError: continue
    return {'status':'available' if any(d['utilization'] is not None for d in devices) else 'unavailable','devices':devices[:16],'reason':'Driver counters' if any(d['utilization'] is not None for d in devices) else 'GPU usage requires driver support or monitoring permission'}


def cpu_memory():
    try:
        import psutil
        usage = psutil.cpu_percent(interval=0.3)
        memory = psutil.virtual_memory()
        return usage, memory.total, memory.available
    except ImportError:
        if sys.platform == 'linux':
            def ticks():
                values = list(map(int, Path('/proc/stat').read_text().splitlines()[0].split()[1:9]))
                return sum(values), values[3]+values[4]
            a, ai = ticks(); time.sleep(.3); b, bi = ticks()
            return (round(100*(1-(bi-ai)/(b-a)),1) if b>a else None), None, None
        return None, None, None


def cpu_topology():
    result = {'sockets': None, 'cores': None, 'threads': os.cpu_count() or 1}
    try:
        if sys.platform == 'linux':
            rows = command(['lscpu', '-p=SOCKET,CORE']).splitlines()
            pairs = {tuple(line.split(',')) for line in rows if not line.startswith('#') and re.fullmatch(r'[0-9]+,[0-9]+', line)}
            if pairs:
                result['sockets'] = len({p[0] for p in pairs})
                result['cores'] = len(pairs)
        elif sys.platform == 'darwin':
            result['cores'] = int(command(['sysctl', '-n', 'hw.physicalcpu']))
            result['threads'] = int(command(['sysctl', '-n', 'hw.logicalcpu']))
            result['sockets'] = int(command(['sysctl', '-n', 'hw.packages']))
    except (OSError, ValueError, subprocess.SubprocessError):
        pass
    return result


def collect():
    total, available = 0, None
    if sys.platform == 'linux':
        values = {line.split(':')[0]: int(line.split()[1])*1024 for line in Path('/proc/meminfo').read_text().splitlines() if len(line.split()) >= 3}
        total, available = values['MemTotal'], values.get('MemAvailable')
    elif sys.platform == 'darwin':
        total = int(command(['sysctl', '-n', 'hw.memsize']))
    else:
        raise RuntimeError('This reporter currently supports Linux and macOS.')
    cpu_percent, observed_total, observed_available = cpu_memory()
    if observed_total is not None: total, available = observed_total, observed_available
    scope = 'container' if Path('/.dockerenv').exists() or Path('/run/.containerenv').exists() else 'host'
    cpu = os.cpu_count() or 1
    if scope == 'container' and Path('/sys/fs/cgroup/memory.max').exists():
        limit = Path('/sys/fs/cgroup/memory.max').read_text().strip()
        if limit.isdigit():
            total = min(total, int(limit))
            current = int(Path('/sys/fs/cgroup/memory.current').read_text())
            available = max(0, total-current)
    disk = shutil.disk_usage(Path.home())
    docker = {'available': False, 'cpuCount': None, 'memoryTotal': None, 'version': None}
    try:
        info = json.loads(command(['docker', 'info', '--format', '{{json .}}']))
        docker = {'available': True, 'cpuCount': info['NCPU'], 'memoryTotal': info['MemTotal'], 'version': info['ServerVersion']}
    except (OSError, subprocess.SubprocessError, ValueError, KeyError):
        pass
    return {'scope': scope, 'cpuCount': cpu, 'cpuTopology': cpu_topology(), 'memoryTotal': total, 'memoryAvailable': available,
            'diskTotal': disk.total, 'diskFree': disk.free, 'load1': os.getloadavg()[0], 'docker': docker, 'gpu': 'not-probed', 'usage': {'cpuPercent': cpu_percent, 'gpu': gpu_usage(), 'sampleSeconds': 0.3}}


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise RuntimeError('Redirect refused. Use the final server URL.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--server', required=True)
    parser.add_argument('--runner-config', required=True, help='Official GitLab Runner config.toml')
    parser.add_argument('--state', default=str(Path.home()/'.local/share/overleaf-runtime/node.json'))
    parser.add_argument('--allow-http', action='store_true', help='Only for a trusted private development network')
    args = parser.parse_args()
    url = urllib.parse.urlsplit(args.server)
    if url.scheme not in ('https','http') or not url.hostname or url.username or url.password or url.query or url.fragment:
        parser.error('Use a clean HTTPS server URL.')
    if url.scheme != 'https' and url.hostname not in ('localhost','127.0.0.1','::1') and not args.allow_http:
        parser.error('Remote nodes require HTTPS (or explicit --allow-http for a trusted development network).')
    statepath = Path(args.state).expanduser()
    statepath.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    # One process per state file, including registration. Prevent sequence races.
    import fcntl
    lock = os.open(str(statepath)+'.lock', os.O_CREAT|os.O_RDWR, 0o600)
    fcntl.flock(lock, fcntl.LOCK_EX|fcntl.LOCK_NB)
    def save(state):
        temp = statepath.with_suffix('.tmp')
        fd = os.open(temp, os.O_WRONLY|os.O_CREAT|os.O_TRUNC, 0o600)
        with os.fdopen(fd,'w') as stream:
            json.dump(state, stream)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temp, statepath)
    opener = urllib.request.build_opener(NoRedirect)
    def post(action, token, data):
        request = urllib.request.Request(args.server.rstrip('/')+'/runtime-nodes/'+action, data=json.dumps(data).encode(), headers={'Authorization':'Bearer '+token,'Content-Type':'application/json'})
        with opener.open(request, timeout=10) as response:
            return json.load(response)
    configpath = Path(args.runner_config).expanduser()
    config = tomllib.loads(configpath.read_text())
    runners = [r for r in config.get('runners',[]) if r.get('url','').rstrip('/') == args.server.rstrip('/')]
    if len(runners) != 1 or not runners[0].get('token','').startswith('glrt-'):
        raise RuntimeError('Select a config with one matching registered Runner.')
    credential = runners[0]['token']
    manager = (configpath.parent/'.runner_system_id').read_text().strip()
    if statepath.exists():
        state = json.loads(statepath.read_text())
        if state['server'] != args.server or state.get('systemId') != manager:
            raise RuntimeError('Telemetry state belongs to another Runner.')
    else:
        state = {'server':args.server,'systemId':manager,'sequence':0}
        save(state)
    print('Monitoring registered GitLab Runner. No separate registration performed.',flush=True)
    while True:
        cycle_start = time.monotonic()
        try:
            state['sequence'] += 1
            save(state)  # Persist before send; gaps are safe after a crash.
            post('heartbeat', credential, {'systemId':manager,'identity':{'hostname':platform.node()[:100] or 'unnamed','platform':sys.platform,'arch':platform.machine()},'sequence':state['sequence'],'resources':collect()})
        except urllib.error.HTTPError as error:
            if error.code in (401,403):
                print('Node authorization ended. Register a new node to reconnect.', file=sys.stderr)
                return 2
            print('Server unavailable; retrying resource report.', file=sys.stderr)
        except (OSError, ValueError, subprocess.SubprocessError):
            print('Resource report unavailable; retrying.', file=sys.stderr)
        time.sleep(max(0.5, 5-(time.monotonic()-cycle_start)))


if __name__ == '__main__':
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        pass
    except Exception:
        print('Reporter could not start. Check server, token, Python version and private state file.', file=sys.stderr)
        sys.exit(1)
