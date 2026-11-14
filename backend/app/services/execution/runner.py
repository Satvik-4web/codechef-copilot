import os
import time
import shutil
import tempfile
import subprocess
from pathlib import Path
from typing import List, Dict, Any, Tuple
from app.config import settings
from app.schemas.execution import TestCaseInput, TestResultOutput, ExecutionResponse

class ExecutionRunner:
    """
    Executes C++17 code in a tightly sandboxed, resource-limited Docker container.
    Strictly enforces zero host fallback to guarantee security.
    """

    @classmethod
    def is_docker_available(cls) -> bool:
        try:
            res = subprocess.run(
                ["docker", "info"],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                timeout=3
            )
            return res.returncode == 0
        except Exception:
            return False

    @classmethod
    def normalize_output(cls, text: str) -> str:
        """
        Normalizes harmless trailing whitespace while preserving essential interior structure.
        """
        lines = [line.rstrip() for line in text.strip().splitlines()]
        return "\n".join(lines)

    @classmethod
    def run_cpp(
        cls,
        source_code: str,
        tests: List[TestCaseInput],
        run_id: int = 1
    ) -> ExecutionResponse:
        start_time = time.time()

        # Security check: verify Docker isolation is available
        if not cls.is_docker_available():
            duration = (time.time() - start_time) * 1000
            return ExecutionResponse(
                run_id=run_id,
                status="docker_unavailable",
                compile_stdout="",
                compile_stderr=(
                    "Docker daemon is not running or unreachable.\n"
                    "Please launch Docker Desktop to enable secure, isolated container execution.\n"
                    "Per non-negotiable safety rules, CodeChef Copilot strictly refuses unrestricted host execution."
                ),
                results=[],
                duration_ms=round(duration, 2),
                is_docker_isolated=False,
                message="Execution blocked: Docker container isolation unavailable."
            )

        # Ensure image is present, or build it
        image_name = settings.DOCKER_IMAGE_NAME
        temp_dir = tempfile.mkdtemp(prefix="codechef_run_")

        try:
            # Write source code to temporary sandbox directory
            source_file = Path(temp_dir) / "solution.cpp"
            source_file.write_text(source_code, encoding="utf-8")

            # 1. Compile Phase inside Docker
            compile_cmd = [
                "docker", "run", "--rm",
                "--network", "none",
                "--memory", f"{settings.EXECUTION_MEMORY_MB}m",
                "--cpus", "1.0",
                "--pids-limit", "64",
                "-v", f"{temp_dir}:/sandbox",
                image_name,
                "g++", "-O2", "-std=c++17", "-Wall", "solution.cpp", "-o", "solution.out"
            ]

            comp_res = subprocess.run(
                compile_cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                timeout=15
            )

            if comp_res.returncode != 0:
                duration = (time.time() - start_time) * 1000
                return ExecutionResponse(
                    run_id=run_id,
                    status="compile_error",
                    compile_stdout=comp_res.stdout,
                    compile_stderr=comp_res.stderr,
                    results=[],
                    duration_ms=round(duration, 2),
                    is_docker_isolated=True,
                    message="Compilation Failed"
                )

            # 2. Test Execution Phase
            results: List[TestResultOutput] = []
            has_runtime_error = False
            has_timeout = False
            has_mismatch = False

            for idx, test in enumerate(tests):
                test_start = time.time()
                run_cmd = [
                    "docker", "run", "--rm", "-i",
                    "--network", "none",
                    "--memory", f"{settings.EXECUTION_MEMORY_MB}m",
                    "--cpus", "1.0",
                    "--pids-limit", "64",
                    "-v", f"{temp_dir}:/sandbox",
                    image_name,
                    "./solution.out"
                ]

                try:
                    proc = subprocess.run(
                        run_cmd,
                        input=test.stdin,
                        stdout=subprocess.PIPE,
                        stderr=subprocess.PIPE,
                        text=True,
                        timeout=settings.EXECUTION_TIMEOUT_SECONDS
                    )
                    test_duration = (time.time() - test_start) * 1000
                    actual_out = proc.stdout
                    err_out = proc.stderr

                    if proc.returncode != 0:
                        has_runtime_error = True
                        results.append(TestResultOutput(
                            name=test.name or f"Test Case {idx + 1}",
                            passed=False,
                            stdin=test.stdin,
                            expected_stdout=test.expected_stdout,
                            actual_stdout=actual_out,
                            stderr=err_out or f"Non-zero exit code: {proc.returncode}",
                            status="runtime_error",
                            duration_ms=round(test_duration, 2)
                        ))
                    else:
                        norm_expected = cls.normalize_output(test.expected_stdout)
                        norm_actual = cls.normalize_output(actual_out)
                        passed = (norm_expected == norm_actual)
                        if not passed:
                            has_mismatch = True

                        results.append(TestResultOutput(
                            name=test.name or f"Test Case {idx + 1}",
                            passed=passed,
                            stdin=test.stdin,
                            expected_stdout=test.expected_stdout,
                            actual_stdout=actual_out,
                            stderr=err_out,
                            status="passed" if passed else "wrong_answer",
                            duration_ms=round(test_duration, 2)
                        ))

                except subprocess.TimeoutExpired:
                    has_timeout = True
                    results.append(TestResultOutput(
                        name=test.name or f"Test Case {idx + 1}",
                        passed=False,
                        stdin=test.stdin,
                        expected_stdout=test.expected_stdout,
                        actual_stdout="",
                        stderr=f"Execution timed out (> {settings.EXECUTION_TIMEOUT_SECONDS}s)",
                        status="timeout",
                        duration_ms=settings.EXECUTION_TIMEOUT_SECONDS * 1000
                    ))

            total_duration = (time.time() - start_time) * 1000

            # Determine aggregate status
            if has_runtime_error:
                overall_status = "runtime_error"
                msg = "Runtime error encountered during test execution."
            elif has_timeout:
                overall_status = "timeout"
                msg = f"Time Limit Exceeded (> {settings.EXECUTION_TIMEOUT_SECONDS}s)."
            elif has_mismatch:
                overall_status = "output_mismatch"
                msg = "Output mismatch on one or more test cases."
            else:
                overall_status = "success"
                msg = f"All {len(tests)} test cases passed successfully."

            return ExecutionResponse(
                run_id=run_id,
                status=overall_status,
                compile_stdout=comp_res.stdout,
                compile_stderr=comp_res.stderr,
                results=results,
                duration_ms=round(total_duration, 2),
                is_docker_isolated=True,
                message=msg
            )

        finally:
            # Clean up per-run temporary files
            shutil.rmtree(temp_dir, ignore_errors=True)
