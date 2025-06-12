from sqlalchemy import Column, Integer, String, Boolean, DateTime
from database import Base
from datetime import datetime

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    is_admin = Column(Boolean, default=False)

class Player(Base):
    __tablename__ = "players"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)
    color = Column(String, nullable=False)

class BoardGame(Base):
    __tablename__ = "boardgames"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)
    win_type = Column(String, nullable=False)  # 'winner', 'points', 'task'

class Task(Base):
    __tablename__ = "tasks"
    id = Column(Integer, primary_key=True, index=True)
    number = Column(Integer, nullable=False)
    name = Column(String, nullable=False)
    boardgame_id = Column(Integer, nullable=False)  # ForeignKey kan later 

class Society(Base):
    __tablename__ = "societies"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)
    player_ids = Column(String, nullable=False)  # CSV van player ids
    boardgame_ids = Column(String, nullable=False)  # CSV van boardgame ids 

class PlayedGame(Base):
    __tablename__ = "played_games"
    id = Column(Integer, primary_key=True, index=True)
    society_id = Column(Integer, nullable=False)
    boardgame_id = Column(Integer, nullable=False)
    played_at = Column(DateTime, default=datetime.utcnow)
    # Voor win_type 'winner':
    winner_id = Column(Integer, nullable=True)
    # Voor win_type 'points':
    points = Column(String, nullable=True)  # CSV: player_id:points
    # Voor win_type 'task':
    winner_id_task = Column(Integer, nullable=True)
    task_id = Column(Integer, nullable=True)
    present_player_ids = Column(String, nullable=True)  # CSV van aanwezige player ids 