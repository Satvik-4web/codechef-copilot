import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from app.database import Base

class AssistantInteraction(Base):
    __tablename__ = "assistant_interactions"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    problem_id = Column(Integer, ForeignKey("problems.id", ondelete="CASCADE"), nullable=True)
    interaction_type = Column(String(50), nullable=False) # explain, hint, approach, review, debug, practice_solution
    user_prompt = Column(Text, nullable=False, default="")
    assistant_response = Column(Text, nullable=False, default="")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
