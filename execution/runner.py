"""
Standalone Execution Runner CLI
Can be executed directly or called by backend runner service.
"""
import sys
import subprocess
import tempfile
import time
from pathlib import Path

def run_isolated(cpp_file: str, stdin_data: str, timeout_sec: int = 5):
    temp_dir = tempfile.mkdtemp(prefix="cpp_runner_")
    try:
        bin_path = Path(temp_dir) / "a.out"
        compile_cmd = ["g++", "-O2", "-std=c++17", "-Wall", cpp_file, "-o", str(bin_path)]
        comp = subprocess.run(compile_cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        if comp.returncode != 0:
            print(f"[COMPILE_ERROR]\n{comp.stderr}")
            return comp.returncode

        run_cmd = [str(bin_path)]
        start = time.time()
        res = subprocess.run(run_cmd, input=stdin_data, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=timeout_sec)
        dur = (time.time() - start) * 1000
        print(f"[SUCCESS {dur:.2f}ms]\n{res.stdout}")
        if res.stderr:
            print(f"[STDERR]\n{res.stderr}")
        return res.returncode
    except subprocess.TimeoutExpired:
        print(f"[TIMEOUT > {timeout_sec}s]")
        return 124
    finally:
        import shutil
        shutil.rmtree(temp_dir, ignore_errors=True)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python runner.py <source.cpp> [stdin]")
        sys.exit(1)
    source = sys.argv[1]
    input_str = sys.argv[2] if len(sys.argv) > 2 else ""
    sys.exit(run_isolated(source, input_str))
