import datetime
from sqlalchemy import Column, Integer, String, Text, Float, DateTime
from app.database import Base

class Problem(Base):
    __tablename__ = "problems"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    title = Column(String(255), nullable=False, default="Untitled Problem")
    source_url = Column(String(1024), nullable=False, default="")
    statement = Column(Text, nullable=False, default="")
    input_format = Column(Text, nullable=False, default="")
    output_format = Column(Text, nullable=False, default="")
    constraints = Column(Text, nullable=False, default="")
    examples_json = Column(Text, nullable=False, default="[]")
    parser_confidence = Column(Float, nullable=False, default=1.0)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
