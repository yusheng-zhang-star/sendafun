#!/usr/bin/env python3
"""
📊 SendAFun — One-Click Progress / Health Check Tool
Runs in <20 seconds (most time on 10×2 HTTP HEAD checks). Zero side effects.
Usage:
  python _scripts/progress_check.py            # full 4-way check
  python _scripts/progress_check.py --no-http  # skip slow HTTP HEAD checks
"""
import argparse, os, sys, time, threading, json
from pathlib import Path
from collections import Counter, defaultdict

ROOT = Path(__file__).resolve().parent.parent
try:
    from dotenv import load_dotenv
    load_dotenv(ROOT / '.env')
except ImportError:
    pass

def _section(title):
    print('\n' + '=' * 78)
    print(f'  📊 {title}')
    print('=' * 78)

def check_processes():
    _section('1/4 — PROCESS STATE (is a long script still running?)')
    import subprocess
    try:
        # Cross-platform python process list via wmic on Windows / ps on Unix
        if os.name == 'nt':
            out = subprocess.check_output(
                ['wmic', 'process', 'where', "name='python.exe'",
                 'get', 'ProcessId,CreationDate,WorkingSetSize,KernelModeTime,UserModeTime,CommandLine',
                 '/format:csv'], text=True, timeout=15
            ).strip()
            lines = [l for l in out.splitlines() if l.strip() and not l.startswith('Node,')]
            # Filter out this progress_check.py itself from the "still running" list
            my_pid = str(os.getpid())
            relevant = []
            for line in lines:
                parts = line.split(',')
                try:
                    pid = parts[4] if len(parts)>4 else ''
                    cmdl = (parts[1] if len(parts)>1 else '').lower()
                    if pid == my_pid or 'progress_check' in cmdl:
                        continue
                    relevant.append(line)
                except Exception:
                    relevant.append(line)
            if not relevant:
                print('  ✅  NO long-running python scripts → finished / terminated')
                if lines: print(f'     (note: {len(lines)} python PIDs detected but they are this progress_check.py itself + innocuous — ignored)')
            else:
                print(f'  🔴  {len(relevant)} python.exe still running (likely a migration/Step script):')
                for line in relevant:
                    parts = line.split(',')
                    try:
                        pid = parts[4]; ws = int(parts[6])/1024/1024 if len(parts)>6 else 0
                        cmdl = parts[1] if len(parts)>1 else ''
                        print(f'      PID={pid:<7} WS={ws:>5.0f}MB   cmd={cmdl[:160]}')
                    except Exception:
                        print(f'      (raw) {line[:200]}')
        else:
            out = subprocess.check_output(
                ['ps', '-eo', 'pid,etime,rss,args'], text=True, timeout=15
            )
            py_lines = [l for l in out.splitlines()[1:] if 'python' in l.lower()]
            if not py_lines: print('  ✅  No python processes running')
            else:
                print(f'  🔴  {len(py_lines)} still running')
                for l in py_lines[:5]: print('   ', l)
    except Exception as e:
        print(f'  ⚠️  process check failed: {e!r}')

def boto_s3_client():
    import boto3
    for k in ('R2_ACCOUNT_ID','R2_ACCESS_KEY_ID','R2_SECRET_ACCESS_KEY'):
        if not os.environ.get(k):
            print(f'  ⚠️  env {k} not set → skip bucket count')
            return None
    return boto3.client(
        's3',
        endpoint_url='https://' + os.environ['R2_ACCOUNT_ID'] + '.r2.cloudflarestorage.com',
        aws_access_key_id=os.environ['R2_ACCESS_KEY_ID'],
        aws_secret_access_key=os.environ['R2_SECRET_ACCESS_KEY'],
        region_name='auto',
        config=boto3.session.Config(
            signature_version='s3v4',
            connect_timeout=15, read_timeout=30,
            retries={'max_attempts':3,'mode':'standard'},
            max_pool_connections=32,
            tcp_keepalive=True
        ),
    )

def check_bucket_counts():
    _section('2/4 — R2 BUCKET COUNTS (objective progress anchor)')
    s3 = boto_s3_client()
    if not s3: return
    targets = {
        'sendafun-preview':   {'goal':'>=250 v2-webp files',   'explain':'Preview 1080w webp w/ watermark × 25 cats × 10 (low-res visitor bucket)'},
        'sendafun-originals': {'goal':'>=250 PNG masters + 0 webp files','explain':'HD PNG masters only (2048px, ≤1.5MB). Webp previews belong exclusively in sendafun-preview, NEVER copied here.'},
    }
    for bucket, meta in targets.items():
        tot=0; by_suf=Counter(); by_cat=Counter()
        try:
            ct=None
            while True:
                kw = dict(Bucket=bucket, MaxKeys=1000)
                if ct: kw['ContinuationToken']=ct
                r = s3.list_objects_v2(**kw)
                for o in r.get('Contents',[]) or []:
                    k=o['Key']; tot+=1
                    if k.endswith('.png'): by_suf['png']+=1
                    elif k.endswith('-v2-vertical.webp'): by_suf['v2-webp']+=1
                    elif k.endswith('-vertical.webp'): by_suf['nv-webp']+=1
                    else: by_suf['other']+=1
                    seg=k.split('/')[0]
                    if len(k.split('/'))>=2: by_cat[seg]+=1
                if not r.get('IsTruncated'): break
                ct=r['NextContinuationToken']
            print(f'  📦 {bucket}: TOTAL={tot}  ← goal {meta["goal"]}')
            print(f'     explanation: {meta["explain"]}')
            print(f'     by-suffix: ' + ', '.join(f'{k}={v}' for k,v in sorted(by_suf.items())))
            cats_sorted = sorted(by_cat.items(), key=lambda kv:(-kv[1], kv[0]))
            print(f'     by-category (top+bot 5 each):')
            for c,n in cats_sorted[:5]: print(f'       {c:<22} {n} files')
            if len(cats_sorted)>10:
                print('         ...')
            for c,n in cats_sorted[-5:]: print(f'       {c:<22} {n} files')
            # PASS/FAIL verdict
            if bucket=='sendafun-preview' and tot>=250 and by_suf['v2-webp']>=250:
                print(f'     ✅  PASS (>=250 v2-webp uploaded)')
            elif bucket=='sendafun-originals' and tot>=250 and by_suf['png']>=250 and (by_suf['v2-webp']+by_suf['nv-webp']+by_suf['other'])==0:
                print(f'     ✅  PASS (>=250 PNG masters only — zero webp previews copied here)')
            else:
                print(f'     🔴  FAIL / IN PROGRESS (counts do not match completion targets yet)')
        except Exception as e:
            print(f'  ❌ {bucket} list error: {e!r}')

def check_d1_http(skip=False):
    _section('3/4 — LIVE HTTP 200 CHECK (10 cats × 2 URL fields = 20 real requests HEAD)')
    if skip: print('  ⏭️  skipped by --no-http flag'); return
    import requests
    test_cats = ['thanksgiving','christmas','easter','birthday','love','valentine','new-baby','wedding','graduation','halloween']
    ua = {'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126 Safari/537.36 ProgressCheck/1.0'}
    sess = requests.Session(); sess.headers.update(ua)
    try:
        adapter = requests.adapters.HTTPAdapter(pool_connections=10, pool_maxsize=40, max_retries=2)
        sess.mount('https://', adapter); sess.mount('http://', adapter)
    except Exception: pass
    ok=tot=0; by_status=Counter()
    start = time.time()
    for cat in test_cats:
        try:
            r = sess.get('https://sendafun.com/api/cards', params={'category':cat,'size':1}, timeout=30)
            if r.status_code!=200:
                print(f'     {cat:<13} API HTTP{r.status_code} — skip URL checks'); continue
            cards = (r.json() or {}).get('cards',[]) or []
            if not cards:
                print(f'     {cat:<13} API returned 0 cards — skip URL checks'); continue
            c = cards[0]
        except Exception as e:
            print(f'     {cat:<13} API EXCEPTION: {e!r}'); continue
        for field in ('bgImageWatermark','bgImage'):
            tot+=1; url=c.get(field) or ''
            try:
                hr = sess.head(url, timeout=25, allow_redirects=True)
                st = hr.status_code; by_status[str(st)]+=1
                ct = hr.headers.get('Content-Type','?')
                cl = hr.headers.get('Content-Length','?')
                try: cl_int = int(cl); cl_kb = f'{cl_int//1024}KB'
                except Exception: cl_kb = str(cl)
                valid = (st==200 and 'image' in ct.lower())
                if valid: ok+=1
                mark = '✅' if valid else ('❌' if st==404 else '⚠️')
                print(f'     {cat:<13} {field:<17} HTTP{st:<3} {ct:<22} {cl_kb:<7} {mark}')
            except Exception as e:
                by_status['EXC']+=1
                print(f'     {cat:<13} {field:<17} EXCEPTION: {str(e)[:60]}  ❌')
    print(f'\n  SUMMARY: {ok}/{tot} = {100*ok/max(1,tot):.0f}% PASS  (took {time.time()-start:.1f}s)')
    if by_status:
        print('  status code distribution: ' + ', '.join(f'{k}×{v}' for k,v in sorted(by_status.items())))
    if tot and ok==tot:
        print('  🎉🎉🎉 100% HTTP 200 OK — EVERY card background URL resolves to real image bytes!')

def check_recent_logs():
    _section('4/4 — RECENT LONG-SCRIPT LOG OUTPUT (last 25 lines of each temp diagnostic / migration script under _scripts)')
    # 1. Print last 40 lines of the known trae background job dir (Windows default path per session summary)
    candidates = []
    trae_job_root = Path(r'C:\Users\dell\AppData\Local\Temp\trae-agent-toolhost\jobs')
    if trae_job_root.exists():
        try:
            recent = sorted(trae_job_root.iterdir(), key=lambda p: p.stat().st_mtime, reverse=True)[:3]
            for jobdir in recent:
                logf = jobdir/'output.log'
                if logf.exists(): candidates.append(logf)
        except Exception: pass
    # 2. Also scan current dir for any *.log created within last 24h
    try:
        for p in ROOT.rglob('*.log'):
            try:
                if time.time()-p.stat().st_mtime < 86400: candidates.append(p)
            except Exception: pass
    except Exception: pass
    seen=set()
    for p in candidates:
        try:
            rp = p.resolve()
            if rp in seen: continue; seen.add(rp)
            age = time.time()-p.stat().st_mtime
            sz  = p.stat().st_size
            print(f'\n  📜 {p}')
            print(f'     age={age/60:.0f}min  size={sz/1024:.0f}KB')
            try:
                with open(p,'r',encoding='utf-8',errors='replace') as fh:
                    lines = fh.read().splitlines()
                tail = lines[-25:]
                print(f'     --- last {len(tail)}/{len(lines)} lines ---')
                for l in tail: print('     '+l)
            except Exception as e:
                print(f'     (read error: {e!r})')
        except Exception: continue
    if not candidates:
        print('  (no trae background job dir found, no recent .log files)')

def main():
    ap = argparse.ArgumentParser(description='SendAFun Progress / Health Check (zero side effects)')
    ap.add_argument('--no-http', action='store_true', help='skip slow 20-URL HTTP HEAD check (saves 10-30s)')
    args = ap.parse_args()
    print('\n' + '#'*78)
    print(f'#   📊 SendAFun Progress & Health Check   (ran at {time.strftime("%Y-%m-%d %H:%M:%S")})')
    print(f'#   CWD={os.getcwd()}')
    print('#'*78)
    t0 = time.time()
    check_processes()
    check_bucket_counts()
    check_d1_http(skip=args.no_http)
    check_recent_logs()
    print('\n' + '='*78)
    print(f'  DONE in {time.time()-t0:.1f}s. Rerun any time with:')
    print(f'    python _scripts/progress_check.py')
    print(f'    python _scripts/progress_check.py --no-http   (fast version)')
    print('='*78 + '\n')

if __name__ == '__main__':
    try: main()
    except KeyboardInterrupt: print('\nInterrupted')
