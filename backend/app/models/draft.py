import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from app.database import Base

class Draft(Base):
    __tablename__ = "drafts"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    problem_id = Column(Integer, ForeignKey("problems.id", ondelete="CASCADE"), nullable=True)
    language = Column(String(50), nullable=False, default="cpp17")
    source_code = Column(Text, nullable=False, default="")
    mode = Column(String(50), nullable=False, default="learning")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
