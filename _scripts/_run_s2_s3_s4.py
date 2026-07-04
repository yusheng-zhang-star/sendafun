#!/usr/bin/env python3
"""Sequential A10(DONE-skip) → Step2 → Step3 → Step4 runner. A10 verified ok already."""
import subprocess, sys, time
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
SCRIPTS = ROOT / "_scripts"
t0 = time.time()
def run(step, script, *args):
    t1 = time.time()
    print(f"\n{'='*80}\n🔵 [{time.strftime('%H:%M:%S')}] {step}\n{'='*80}\n", flush=True)
    p = subprocess.run([sys.executable, str(SCRIPTS / script), *args], cwd=ROOT)
    if p.returncode != 0:
        print(f"\n❌ [{time.strftime('%H:%M:%S')}] {step} FAILED (exit={p.returncode}) after {(time.time()-t1)/60:.1f} min")
        sys.exit(p.returncode)
    print(f"\n✅ [{time.strftime('%H:%M:%S')}] {step} OK ({(time.time()-t1)/60:.1f} min)\n")

# A10 already verified: 250/250 ok → skip
# Step 2: standardize (patched: boto3 retries + 5x download retry + Pass3 quantize)
run("A1.1 Step2 Standardize (2047px transparent PNG, DOC §21)", "_step2_standardize_originals.py", "--apply")
# Step 3: 1 watermarked 9:16 WebP per card (DOC §8+§18)
run("A2 Step3 1×9:16 watermarked WebP/master (DOC §8+§18)", "_step3_generate_previews.py", "--apply")
# Step 4: 2 fields only, geo=[] placeholder (DOC §148 strict)
run("A3 Step4 Inject 2 fields + geo=[] (DOC §148)", "_step4_update_kv_d1_fields.py", "--apply")
print(f"\n🏁 PIPELINE DONE ({(time.time()-t0)/60:.1f} min)")
