import asyncio
import pytest
from app.services.assistant.provider import GeminiProvider, OpenAIProvider, OfflineRuleBasedProvider
from app.services.assistant.service import AssistantService
from app.database import SessionLocal

@pytest.mark.asyncio
async def test_ai():
    print("=== AI PROVIDER & ERROR HANDLING AUDIT ===")

    # 1. Offline provider test
    offline = OfflineRuleBasedProvider()
    res_explain = await offline.generate_text("Explain problem ATM Machine")
    assert "Conceptual Explanation" in res_explain
    print("[PASS] Offline provider: explain generated")

    res_hint = await offline.generate_text("Hint Level 1 for problem")
    assert "Hint 1" in res_hint
    print("[PASS] Offline provider: hint level 1 generated")

    res_hint2 = await offline.generate_text("Hint Level 2 for problem")
    assert "Hint 2" in res_hint2
    print("[PASS] Offline provider: hint level 2 generated")

    res_practice = await offline.generate_text("Task: practice solution for problem")
    assert "#include <iostream>" in res_practice
    print("[PASS] Offline provider: practice solution generated")

    # 2. GeminiProvider error handling with invalid key
    gemini = GeminiProvider(api_key="invalid_test_key", model="gemini-1.5-flash")
    try:
        await gemini.generate_text("Hello")
        assert False, "Should have failed with invalid API key"
    except RuntimeError as e:
        assert "Gemini API error" in str(e) or "400" in str(e) or "API_KEY_INVALID" in str(e)
        print(f"[PASS] GeminiProvider correctly handled invalid API key with error: {str(e)[:60]}...")

    # 3. OpenAIProvider error handling with invalid key
    openai = OpenAIProvider(api_key="invalid_test_key", model="gpt-4o-mini")
    try:
        await openai.generate_text("Hello")
        assert False, "Should have failed with invalid API key"
    except RuntimeError as e:
        assert "OpenAI API error" in str(e) or "401" in str(e) or "Incorrect API key" in str(e)
        print(f"[PASS] OpenAIProvider correctly handled invalid API key with error: {str(e)[:60]}...")

    print("ALL AI PROVIDER & ERROR HANDLING AUDITS PASSED!")

if __name__ == "__main__":
    asyncio.run(test_ai())
