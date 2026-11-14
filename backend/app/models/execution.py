import datetime
from sqlalchemy import Column, Integer, String, Text, Float, DateTime, ForeignKey
from app.database import Base

class ExecutionRun(Base):
    __tablename__ = "execution_runs"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    draft_id = Column(Integer, ForeignKey("drafts.id", ondelete="SET NULL"), nullable=True)
    status = Column(String(50), nullable=False) # success, compile_error, runtime_error, timeout, output_mismatch, docker_unavailable
    compile_stdout = Column(Text, nullable=False, default="")
    compile_stderr = Column(Text, nullable=False, default="")
    test_results_json = Column(Text, nullable=False, default="[]")
    duration_ms = Column(Float, nullable=False, default=0.0)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
