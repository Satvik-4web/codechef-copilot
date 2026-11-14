import subprocess
import shutil
from unittest.mock import patch, MagicMock
from app.services.execution.runner import ExecutionRunner
from app.schemas.execution import TestCaseInput

def test_execution_runner():
    print("=== EXECUTION RUNNER COMPLETE ISOLATION AUDIT ===")

    # 1. Output Normalization
    assert ExecutionRunner.normalize_output("5 \r\n") == "5"
    assert ExecutionRunner.normalize_output(" 1 2 3   \n4 5 6  ") == "1 2 3\n4 5 6"
    print("[PASS] Output normalization preserves interior spaces and strips trailing line whitespace")

    # 2. Docker Offline Fail-Closed Verification
    with patch.object(ExecutionRunner, "is_docker_available", return_value=False):
        res = ExecutionRunner.run_cpp(
            source_code="#include <iostream>\nint main(){return 0;}",
            tests=[TestCaseInput(name="Test 1", stdin="", expected_stdout="0")]
        )
        assert res.status == "docker_unavailable"
        assert res.is_docker_isolated is False
        assert "strictly refuses unrestricted host execution" in res.compile_stderr
        print("[PASS] Fails closed when Docker offline: Host execution strictly blocked")

    # 3. Successful Compilation & Execution with Isolation Flags
    with patch.object(ExecutionRunner, "is_docker_available", return_value=True), \
         patch("subprocess.run") as mock_run:

        # Mock compile success
        compile_mock = MagicMock()
        compile_mock.returncode = 0
        compile_mock.stdout = ""
        compile_mock.stderr = ""

        # Mock run success
        run_mock = MagicMock()
        run_mock.returncode = 0
        run_mock.stdout = "5\n"
        run_mock.stderr = ""

        mock_run.side_effect = [compile_mock, run_mock]

        res = ExecutionRunner.run_cpp(
            source_code="#include <iostream>\nint main(){std::cout<<5;return 0;}",
            tests=[TestCaseInput(name="Sample 1", stdin="5", expected_stdout="5")]
        )

        assert res.status == "success"
        assert len(res.results) == 1
        assert res.results[0].passed is True
        assert res.results[0].actual_stdout == "5\n"

        # Verify exact isolation arguments were passed to docker
        compile_call_args = mock_run.call_args_list[0][0][0]
        assert "--network" in compile_call_args and "none" in compile_call_args
        assert "--memory" in compile_call_args and "256m" in compile_call_args
        assert "--cpus" in compile_call_args and "1.0" in compile_call_args
        assert "--pids-limit" in compile_call_args and "64" in compile_call_args

        run_call_args = mock_run.call_args_list[1][0][0]
        assert "--network" in run_call_args and "none" in run_call_args
        assert "--memory" in run_call_args and "256m" in run_call_args
        print("[PASS] Successful execution verified with strict container isolation (--network none, --memory 256m, --cpus 1.0, --pids-limit 64)")

    # 4. Compilation Error Branch
    with patch.object(ExecutionRunner, "is_docker_available", return_value=True), \
         patch("subprocess.run") as mock_run:

        compile_err_mock = MagicMock()
        compile_err_mock.returncode = 1
        compile_err_mock.stdout = ""
        compile_err_mock.stderr = "solution.cpp:2:1: error: expected ';' before '}' token"

        mock_run.return_value = compile_err_mock

        res = ExecutionRunner.run_cpp(
            source_code="int main() { return 0 }",
            tests=[TestCaseInput(name="Sample 1", stdin="", expected_stdout="")]
        )

        assert res.status == "compile_error"
        assert "expected ';'" in res.compile_stderr
        assert len(res.results) == 0
        print("[PASS] Compilation error correctly captured and mapped to status='compile_error'")

    # 5. Timeout (Time Limit Exceeded) Branch
    with patch.object(ExecutionRunner, "is_docker_available", return_value=True), \
         patch("subprocess.run") as mock_run:

        compile_mock = MagicMock()
        compile_mock.returncode = 0
        compile_mock.stdout = ""
        compile_mock.stderr = ""

        mock_run.side_effect = [compile_mock, subprocess.TimeoutExpired(cmd="docker run", timeout=5)]

        res = ExecutionRunner.run_cpp(
            source_code="int main() { while(true); }",
            tests=[TestCaseInput(name="Sample 1", stdin="", expected_stdout="1")]
        )

        assert res.status == "timeout"
        assert len(res.results) == 1
        assert res.results[0].status == "timeout"
        assert res.results[0].passed is False
        assert "timed out" in res.results[0].stderr
        print("[PASS] Timeout correctly caught and mapped to status='timeout' (TLE)")

    # 6. Runtime Error Branch (e.g. exit code != 0 / SIGSEGV)
    with patch.object(ExecutionRunner, "is_docker_available", return_value=True), \
         patch("subprocess.run") as mock_run:

        compile_mock = MagicMock()
        compile_mock.returncode = 0
        compile_mock.stdout = ""
        compile_mock.stderr = ""

        run_rt_mock = MagicMock()
        run_rt_mock.returncode = 139  # SIGSEGV
        run_rt_mock.stdout = ""
        run_rt_mock.stderr = "Segmentation fault (core dumped)"

        mock_run.side_effect = [compile_mock, run_rt_mock]

        res = ExecutionRunner.run_cpp(
            source_code="int main() { int* p = nullptr; *p = 1; }",
            tests=[TestCaseInput(name="Sample 1", stdin="", expected_stdout="")]
        )

        assert res.status == "runtime_error"
        assert res.results[0].status == "runtime_error"
        assert res.results[0].passed is False
        print("[PASS] Runtime crash (SIGSEGV) correctly mapped to status='runtime_error'")

    # 7. Output Mismatch Branch
    with patch.object(ExecutionRunner, "is_docker_available", return_value=True), \
         patch("subprocess.run") as mock_run:

        compile_mock = MagicMock()
        compile_mock.returncode = 0
        compile_mock.stdout = ""
        compile_mock.stderr = ""

        run_wa_mock = MagicMock()
        run_wa_mock.returncode = 0
        run_wa_mock.stdout = "10\n"
        run_wa_mock.stderr = ""

        mock_run.side_effect = [compile_mock, run_wa_mock]

        res = ExecutionRunner.run_cpp(
            source_code="int main() { cout << 10; }",
            tests=[TestCaseInput(name="Sample 1", stdin="", expected_stdout="12")]
        )

        assert res.status == "output_mismatch"
        assert res.results[0].status == "wrong_answer"
        assert res.results[0].passed is False
        print("[PASS] Output mismatch correctly mapped to status='output_mismatch' / 'wrong_answer'")

    print("\nALL EXECUTION RUNNER ISOLATION & RESOURCE LIMIT AUDITS PASSED!")

if __name__ == "__main__":
    audit_execution_runner()
