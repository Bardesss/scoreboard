from sqlalchemy import create_engine, text, inspect
from sqlalchemy.orm import sessionmaker, declarative_base
import os


os.makedirs("data", exist_ok=True)

SQLALCHEMY_DATABASE_URL = "sqlite:///./data/scoreboard.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def run_migrations():
    inspector = inspect(engine)
    existing_tables = inspector.get_table_names()
    
    if "users" not in existing_tables:
        import models
        Base.metadata.create_all(bind=engine)
        return
    
    with engine.connect() as conn:
        if "users" in existing_tables:
            user_columns = [col['name'] for col in inspector.get_columns('users')]
            
            if 'is_active' not in user_columns:
                conn.execute(text("ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT 1"))
            
            if 'created_at' not in user_columns:
                conn.execute(text("ALTER TABLE users ADD COLUMN created_at DATETIME"))
                conn.execute(text("UPDATE users SET created_at = CURRENT_TIMESTAMP"))
            
            if 'last_login' not in user_columns:
                conn.execute(text("ALTER TABLE users ADD COLUMN last_login DATETIME"))
        
        for table_name in ['players', 'boardgames', 'tasks', 'societies', 'played_games']:
            if table_name in existing_tables:
                table_columns = [col['name'] for col in inspector.get_columns(table_name)]
                
                if 'created_by_user_id' not in table_columns:
                    conn.execute(text(f"ALTER TABLE {table_name} ADD COLUMN created_by_user_id INTEGER"))
                    
                    admin_user = conn.execute(text("SELECT id FROM users WHERE is_admin = 1 LIMIT 1")).fetchone()
                    if admin_user:
                        admin_id = admin_user[0]
                        conn.execute(text(f"UPDATE {table_name} SET created_by_user_id = {admin_id}"))
        
        # Add winner_points column to played_games table if it doesn't exist
        if 'played_games' in existing_tables:
            played_games_columns = [col['name'] for col in inspector.get_columns('played_games')]
            
            if 'winner_points' not in played_games_columns:
                conn.execute(text("ALTER TABLE played_games ADD COLUMN winner_points INTEGER"))
        
        conn.commit() 