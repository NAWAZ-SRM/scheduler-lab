import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.database import Base


class SimulationRun(Base):
    __tablename__ = "simulation_runs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(200), nullable=True)
    workload_config = Column(JSONB, nullable=False)
    algorithms_config = Column(JSONB, nullable=False)
    results = Column(JSONB, nullable=False)
    share_token = Column(String(64), unique=True, nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
