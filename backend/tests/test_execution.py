from app.services.execution.runner import ExecutionRunner
from app.schemas.execution import TestCaseInput

def test_output_normalization():
    raw_output = "Hello World   \nLine 2 \r\n\n"
    normalized = ExecutionRunner.normalize_output(raw_output)
    assert normalized == "Hello World\nLine 2"

def test_runner_fails_closed_when_docker_unavailable(monkeypatch):
    # Simulate Docker daemon offline
    monkeypatch.setattr(ExecutionRunner, "is_docker_available", classmethod(lambda cls: False))

    res = ExecutionRunner.run_cpp(
        source_code="#include <iostream>\nint main() { return 0; }",
        tests=[TestCaseInput(name="Test 1", stdin="", expected_stdout="")]
    )

    assert res.status == "docker_unavailable"
    assert res.is_docker_isolated is False
    assert "Docker daemon is not running" in res.compile_stderr
    assert "strictly refuses unrestricted host execution" in res.compile_stderr
