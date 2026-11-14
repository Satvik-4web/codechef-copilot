import datetime
from sqlalchemy import Column, Integer, String, DateTime
from app.database import Base

class UserSettings(Base):
    __tablename__ = "user_settings"

    id = Column(Integer, primary_key=True, default=1)
    active_mode = Column(String(50), nullable=False, default="learning")
    execution_timeout_seconds = Column(Integer, nullable=False, default=5)
    execution_memory_mb = Column(Integer, nullable=False, default=256)
    ai_provider = Column(String(50), nullable=True, default="")
    ai_model = Column(String(100), nullable=True, default="")
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
