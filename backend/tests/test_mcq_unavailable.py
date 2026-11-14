import pytest

from app.services.assistant import service
from app.services.assistant.provider import OfflineRuleBasedProvider


@pytest.mark.asyncio
async def test_mcq_does_not_guess_first_option_when_ai_unavailable(monkeypatch):
    monkeypatch.setattr(service, "get_ai_provider", lambda: OfflineRuleBasedProvider())
    with pytest.raises(ValueError, match="MCQ answer unavailable"):
        await service.AssistantService.solve_mcq("Which answer?", ["A", "B"])
