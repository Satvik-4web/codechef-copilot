from pathlib import Path
from app.services.parser.problem_parser import ProblemParser

FIXTURE_PATH = Path(__file__).parent / "fixtures" / "sample_problem.html"

def test_parse_sample_problem():
    html_content = FIXTURE_PATH.read_text(encoding="utf-8")
    parsed = ProblemParser.parse(
        html=html_content,
        url="https://www.codechef.com/problems/ATM2"
    )

    assert "ATM Machine" in parsed["title"]
    assert "ATM machine" in parsed["statement"]
    assert "denoting the number of test cases" in parsed["input_format"]
    assert "string of length" in parsed["output_format"]
    assert "100" in parsed["constraints"]
    assert len(parsed["examples"]) >= 1
    assert parsed["examples"][0]["stdin"] != ""
    assert parsed["examples"][0]["expected_stdout"] != ""
    assert parsed["parser_confidence"] > 0.7

def test_parser_fallback_with_missing_selectors():
    broken_html = "<html><body><div>Unknown layout without standard classes</div></body></html>"
    parsed = ProblemParser.parse(
        html=broken_html,
        url="https://www.codechef.com/problems/TESTCODE",
        manual_statement="Given two numbers A and B, print their sum.\nInput Format: Two integers A and B\nOutput Format: Single integer"
    )

    assert "TESTCODE" in parsed["title"]
    assert "Two numbers A and B" in parsed["statement"] or "print their sum" in parsed["statement"]
    assert parsed["parser_confidence"] >= 0.2

def test_parser_confidence_score_calculation():
    # Empty page should have low confidence
    empty_parsed = ProblemParser.parse(html="", url="")
    assert empty_parsed["parser_confidence"] <= 0.4
