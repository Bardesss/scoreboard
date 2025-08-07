from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    is_admin = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_login = Column(DateTime, nullable=True)

class Player(Base):
    __tablename__ = "players"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)
    color = Column(String, nullable=False)
    created_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)

class BoardGame(Base):
    __tablename__ = "boardgames"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)
    win_type = Column(String, nullable=False)
    created_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)

class Task(Base):
    __tablename__ = "tasks"
    id = Column(Integer, primary_key=True, index=True)
    number = Column(Integer, nullable=False)
    name = Column(String, nullable=False)
    boardgame_id = Column(Integer, nullable=False)
    created_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)

class Society(Base):
    __tablename__ = "societies"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)
    player_ids = Column(String, nullable=False)
    boardgame_ids = Column(String, nullable=False)
    created_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)

class PlayedGame(Base):
    __tablename__ = "played_games"
    id = Column(Integer, primary_key=True, index=True)
    society_id = Column(Integer, nullable=False)
    boardgame_id = Column(Integer, nullable=False)
    played_at = Column(DateTime, default=datetime.utcnow)
    winner_id = Column(Integer, nullable=True)
    winner_points = Column(Integer, nullable=True)
    points = Column(String, nullable=True)
    winner_id_task = Column(Integer, nullable=True)
    task_id = Column(Integer, nullable=True)
    present_player_ids = Column(String, nullable=True)
    created_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True) 