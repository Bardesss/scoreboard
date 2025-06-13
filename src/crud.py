from sqlalchemy.orm import Session
import models
from datetime import datetime, timedelta

def get_players(db: Session):
    return db.query(models.Player).all()

def create_player(db: Session, name: str, color: str):
    player = models.Player(name=name, color=color)
    db.add(player)
    db.commit()
    db.refresh(player)
    return player

def update_player(db: Session, player_id: int, name: str, color: str):
    player = db.query(models.Player).filter(models.Player.id == player_id).first()
    if player:
        player.name = name
        player.color = color
        db.commit()
        db.refresh(player)
    return player

def delete_player(db: Session, player_id: int):
    # Controleer of de speler in gebruik is in een society
    societies = db.query(models.Society).all()
    for society in societies:
        if society.player_ids and str(player_id) in society.player_ids.split(','):
            raise ValueError("Cannot delete player because they are part of one or more societies")
    
    player = db.query(models.Player).filter(models.Player.id == player_id).first()
    if player:
        db.delete(player)
        db.commit()
    return player

# BoardGame CRUD

def get_boardgames(db: Session):
    return db.query(models.BoardGame).all()

def create_boardgame(db: Session, name: str, win_type: str):
    game = models.BoardGame(name=name, win_type=win_type)
    db.add(game)
    db.commit()
    db.refresh(game)
    return game

def update_boardgame(db: Session, game_id: int, name: str, win_type: str):
    game = db.query(models.BoardGame).filter(models.BoardGame.id == game_id).first()
    if game:
        game.name = name
        game.win_type = win_type
        db.commit()
        db.refresh(game)
    return game

def delete_boardgame(db: Session, game_id: int):
    # Controleer of het bordspel in gebruik is in een society
    societies = db.query(models.Society).all()
    for society in societies:
        if society.boardgame_ids and str(game_id) in society.boardgame_ids.split(','):
            raise ValueError("Cannot delete boardgame because it is used by one or more societies")
    
    game = db.query(models.BoardGame).filter(models.BoardGame.id == game_id).first()
    if game:
        db.delete(game)
        db.commit()
    return game

# Task CRUD

def get_tasks(db: Session, boardgame_id: int = None):
    query = db.query(models.Task)
    if boardgame_id:
        query = query.filter(models.Task.boardgame_id == boardgame_id)
    return query.all()

def create_task(db: Session, number: int, name: str, boardgame_id: int):
    task = models.Task(number=number, name=name, boardgame_id=boardgame_id)
    db.add(task)
    db.commit()
    db.refresh(task)
    return task

def update_task(db: Session, task_id: int, number: int, name: str):
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if task:
        task.number = number
        task.name = name
        db.commit()
        db.refresh(task)
    return task

def delete_task(db: Session, task_id: int):
    # Controleer of de task in gebruik is in een played game
    played_game = db.query(models.PlayedGame).filter(models.PlayedGame.task_id == task_id).first()
    if played_game:
        raise ValueError("Cannot delete task because it is used in one or more played games")
    
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if task:
        db.delete(task)
        db.commit()
    return task

# Society CRUD

def get_societies(db: Session):
    return db.query(models.Society).all()

def create_society(db: Session, name: str, player_ids: list, boardgame_ids: list):
    society = models.Society(
        name=name,
        player_ids=','.join(str(pid) for pid in player_ids),
        boardgame_ids=','.join(str(bid) for bid in boardgame_ids)
    )
    db.add(society)
    db.commit()
    db.refresh(society)
    return society

def update_society(db: Session, society_id: int, name: str, player_ids: list, boardgame_ids: list):
    society = db.query(models.Society).filter(models.Society.id == society_id).first()
    if society:
        society.name = name
        society.player_ids = ','.join(str(pid) for pid in player_ids)
        society.boardgame_ids = ','.join(str(bid) for bid in boardgame_ids)
        db.commit()
        db.refresh(society)
    return society

def delete_society(db: Session, society_id: int):
    # Verwijder eerst alle gerelateerde played_games
    db.query(models.PlayedGame).filter(models.PlayedGame.society_id == society_id).delete()
    # Verwijder daarna de society
    society = db.query(models.Society).filter(models.Society.id == society_id).first()
    if society:
        db.delete(society)
        db.commit()
    return society

# PlayedGame CRUD

def get_played_games(db: Session, society_id: int = None):
    query = db.query(models.PlayedGame)
    if society_id:
        query = query.filter(models.PlayedGame.society_id == society_id)
    return query.order_by(models.PlayedGame.played_at.desc()).all()

def create_played_game(db: Session, society_id: int, boardgame_id: int, win_type: str, data: dict):
    played_game = models.PlayedGame(
        society_id=society_id,
        boardgame_id=boardgame_id,
        played_at=data.get('played_at', datetime.now()),
        present_player_ids=','.join(map(str, data['present_players']))
    )
    if win_type == 'winner':
        played_game.winner_id = data['winner_id']
    elif win_type == 'points':
        points_str = ','.join(f"{pid}:{pts}" for pid, pts in data['points'].items())
        played_game.points = points_str
    elif win_type == 'task':
        played_game.winner_id_task = data['winner_id_task']
        played_game.task_id = data['task_id']
    db.add(played_game)
    db.commit()
    db.refresh(played_game)
    return played_game

def update_played_game(db: Session, played_game_id: int, win_type: str, data: dict):
    game = db.query(models.PlayedGame).filter(models.PlayedGame.id == played_game_id).first()
    if not game:
        return None
    if win_type == 'winner':
        game.winner_id = data.get('winner_id')
        game.points = None
        game.winner_id_task = None
        game.task_id = None
    elif win_type == 'points':
        points_dict = data.get('points', {})
        points_str = ','.join(f"{pid}:{pts}" for pid, pts in points_dict.items())
        # Bepaal winnaar (meeste punten)
        if points_dict:
            max_points = max(points_dict.values())
            winner_id = int([pid for pid, pts in points_dict.items() if pts == max_points][0])
        else:
            winner_id = None
        game.points = points_str
        game.winner_id = winner_id
        game.winner_id_task = None
        game.task_id = None
    elif win_type == 'task':
        game.winner_id_task = data.get('winner_id_task')
        game.task_id = data.get('task_id')
        game.winner_id = None
        game.points = None
    db.commit()
    db.refresh(game)
    return game

def delete_played_game(db: Session, played_game_id: int):
    game = db.query(models.PlayedGame).filter(models.PlayedGame.id == played_game_id).first()
    if game:
        db.delete(game)
        db.commit()
    return game

def get_stats_most_wins(db: Session, society_id: int, from_date: datetime = None, to_date: datetime = None):
    q = db.query(models.PlayedGame).filter(models.PlayedGame.society_id == society_id)
    if from_date:
        q = q.filter(models.PlayedGame.played_at >= from_date)
    if to_date:
        q = q.filter(models.PlayedGame.played_at <= to_date)
    win_counts = {}
    for g in q:
        if g.winner_id:
            win_counts[g.winner_id] = win_counts.get(g.winner_id, 0) + 1
        if g.winner_id_task:
            win_counts[g.winner_id_task] = win_counts.get(g.winner_id_task, 0) + 1
    return win_counts

def get_stats_most_points(db: Session, society_id: int, from_date: datetime = None, to_date: datetime = None):
    q = db.query(models.PlayedGame).filter(models.PlayedGame.society_id == society_id)
    if from_date:
        q = q.filter(models.PlayedGame.played_at >= from_date)
    if to_date:
        q = q.filter(models.PlayedGame.played_at <= to_date)
    points = {}
    for g in q:
        if g.points:
            for pair in g.points.split(','):
                pid, pts = pair.split(':')
                points[int(pid)] = points.get(int(pid), 0) + int(pts)
    return points

def get_stats_most_won_task(db: Session, society_id: int, from_date: datetime = None, to_date: datetime = None):
    q = db.query(models.PlayedGame).filter(models.PlayedGame.society_id == society_id)
    if from_date:
        q = q.filter(models.PlayedGame.played_at >= from_date)
    if to_date:
        q = q.filter(models.PlayedGame.played_at <= to_date)
    task_wins = {}
    for g in q:
        if g.task_id and g.winner_id_task:
            task_wins[g.task_id] = task_wins.get(g.task_id, 0) + 1
    return task_wins

def get_stats_highest_points_per_game(db: Session, society_id: int, from_date: datetime = None, to_date: datetime = None):
    q = db.query(models.PlayedGame).filter(models.PlayedGame.society_id == society_id)
    if from_date:
        q = q.filter(models.PlayedGame.played_at >= from_date)
    if to_date:
        q = q.filter(models.PlayedGame.played_at <= to_date)
    highest = {}
    for g in q:
        if g.points:
            for pair in g.points.split(','):
                pid, pts = pair.split(':')
                pid = int(pid)
                pts = int(pts)
                if pid not in highest or pts > highest[pid]:
                    highest[pid] = pts
    return highest

def get_stats_most_popular_days(db: Session, society_id: int, from_date: datetime = None, to_date: datetime = None):
    q = db.query(models.PlayedGame).filter(models.PlayedGame.society_id == society_id)
    if from_date:
        q = q.filter(models.PlayedGame.played_at >= from_date)
    if to_date:
        q = q.filter(models.PlayedGame.played_at <= to_date)
    day_counts = {}
    for g in q:
        # 0=maandag, 6=zondag
        weekday = g.played_at.weekday()
        day_counts[weekday] = day_counts.get(weekday, 0) + 1
    # Sorteer op aantal aflopend
    return dict(sorted(day_counts.items(), key=lambda item: item[1], reverse=True))

def get_stats_longest_win_streak(db: Session, society_id: int, from_date: datetime = None, to_date: datetime = None):
    """
    Berekent de langste aaneengesloten win-streak per speler in een society.
    Geeft een dict terug: {player_id: streak_length}
    """
    q = db.query(models.PlayedGame).filter(models.PlayedGame.society_id == society_id)
    if from_date:
        q = q.filter(models.PlayedGame.played_at >= from_date)
    if to_date:
        q = q.filter(models.PlayedGame.played_at <= to_date)
    # Sorteer op datum oplopend
    games = q.order_by(models.PlayedGame.played_at.asc()).all()
    streaks = {}  # {player_id: huidige streak}
    max_streaks = {}  # {player_id: max streak}
    last_winner = None
    for g in games:
        # Bepaal winnaar
        winner_id = g.winner_id or g.winner_id_task
        if winner_id is None:
            # Geen winnaar, streaks resetten
            for pid in streaks:
                streaks[pid] = 0
            last_winner = None
            continue
        # Update streaks
        for pid in streaks:
            if pid != winner_id:
                streaks[pid] = 0
        if winner_id not in streaks:
            streaks[winner_id] = 1
        else:
            if last_winner == winner_id:
                streaks[winner_id] += 1
            else:
                streaks[winner_id] = 1
        # Update max_streaks
        if winner_id not in max_streaks or streaks[winner_id] > max_streaks[winner_id]:
            max_streaks[winner_id] = streaks[winner_id]
        last_winner = winner_id
    return max_streaks

def get_stats_games_played(db: Session, society_id: int, from_date: datetime = None, to_date: datetime = None):
    """
    Geeft een dict terug: {player_id: aantal_gespeeld}
    Telt voor elke speler hoe vaak hij/zij aanwezig was bij een spel in deze society.
    """
    q = db.query(models.PlayedGame).filter(models.PlayedGame.society_id == society_id)
    if from_date:
        q = q.filter(models.PlayedGame.played_at >= from_date)
    if to_date:
        q = q.filter(models.PlayedGame.played_at <= to_date)
    played_counts = {}
    for g in q:
        if g.present_player_ids:
            for pid in g.present_player_ids.split(','):
                pid = int(pid)
                played_counts[pid] = played_counts.get(pid, 0) + 1
    return played_counts 