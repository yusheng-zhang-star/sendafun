#!/usr/bin/env python3
"""One-shot clean pipeline: A10 rebuild originals (purge + 250 JPG) => Step2 => Step3 => Step4.
Sequential (no race), all strict per DOC rules. No parallel processes."""
import subprocess, sys, time
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
SCRIPTS = ROOT / "_scripts"

t0 = time.time()
def run(step_name: str, script: str, *extra_args):
    t1 = time.time()
    print(f"\n{'='*80}\n🔵 [{time.strftime('%H:%M:%S')}] RUN: {step_name}\n     python {script} {' '.join(extra_args)}\n{'='*80}\n", flush=True)
    cmd = [sys.executable, str(SCRIPTS / script), *extra_args]
    # Force same python, unbuffered output, inherit env (dotenv loaded inside each)
    p = subprocess.run(cmd, cwd=ROOT, env=None)
    elapsed = time.time() - t1
    if p.returncode != 0:
        print(f"\n❌ [{time.strftime('%H:%M:%S')}] {step_name} FAILED (exit={p.returncode}) after {elapsed/60:.1f} min. ABORTING PIPELINE.", flush=True)
        sys.exit(p.returncode)
    print(f"\n✅ [{time.strftime('%H:%M:%S')}] {step_name} OK  ({elapsed/60:.1f} min)\n", flush=True)

# Step 1: A10 rebuild originals (purge all old objects + upload 250 JPG ≥2800)
run("A1.0 Rebuild Originals 250 JPG", "_tmp_A10_rebuild_originals_from_raw.py", "--apply")

# Step 2: Standardize 250 → transparent PNG, long side 2047px
run("A1.1 Step2 Standardize → 2047px transparent PNG (DOC §21)", "_step2_standardize_originals.py", "--apply")

# Step 3: Generate 1 single 9:16 watermarked WebP per card (DOC §8 / §18)
run("A2 Step3 Generate 1×9:16 watermarked WebP/master (DOC §8+§18)", "_step3_generate_previews.py", "--apply")

# Step 4: KV+D1 inject ONLY 2 fields + geo=[] placeholder (DOC §148 strict)
run("A3 Step4 Inject 2 fields (emotionalTags+envelopeStyleId) + geo=[] (DOC §148)", "_step4_update_kv_d1_fields.py", "--apply")

total = (time.time()-t0)/60
print(f"\n{'='*80}\n🏁 [{time.strftime('%H:%M:%S')}] PIPELINE DONE. Total {total:.1f} min\n{'='*80}")
print("  Run Step A-4 verification now:\n     python _scripts/_verify_a4_dual_bucket_kv.py")
