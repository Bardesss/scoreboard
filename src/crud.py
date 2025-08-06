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
    societies = db.query(models.Society).all()
    for society in societies:
        if society.player_ids and str(player_id) in society.player_ids.split(','):
            raise ValueError("Cannot delete player because they are part of one or more societies")
    
    player = db.query(models.Player).filter(models.Player.id == player_id).first()
    if player:
        db.delete(player)
        db.commit()
    return player

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
    societies = db.query(models.Society).all()
    for society in societies:
        if society.boardgame_ids and str(game_id) in society.boardgame_ids.split(','):
            raise ValueError("Cannot delete boardgame because it is used by one or more societies")
    
    game = db.query(models.BoardGame).filter(models.BoardGame.id == game_id).first()
    if game:
        db.delete(game)
        db.commit()
    return game

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



def delete_task(db: Session, task_id: int):
    played_game = db.query(models.PlayedGame).filter(models.PlayedGame.task_id == task_id).first()
    if played_game:
        raise ValueError("Cannot delete task because it is used in one or more played games")
    
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if task:
        db.delete(task)
        db.commit()
    return task

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
    db.query(models.PlayedGame).filter(models.PlayedGame.society_id == society_id).delete()
    society = db.query(models.Society).filter(models.Society.id == society_id).first()
    if society:
        db.delete(society)
        db.commit()
    return society

def get_played_games(db: Session, society_id: int = None):
    query = db.query(models.PlayedGame)
    if society_id:
        query = query.filter(models.PlayedGame.society_id == society_id)
    return query.order_by(models.PlayedGame.played_at.desc()).all()

def get_played_games_paginated(db: Session, society_id: int = None, offset: int = 0, limit: int = 20):
    query = db.query(models.PlayedGame)
    if society_id:
        query = query.filter(models.PlayedGame.society_id == society_id)
    return query.order_by(models.PlayedGame.played_at.desc()).offset(offset).limit(limit).all()

def get_played_games_count(db: Session, society_id: int = None):
    query = db.query(models.PlayedGame)
    if society_id:
        query = query.filter(models.PlayedGame.society_id == society_id)
    return query.count()

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

def update_played_game(db: Session, played_game_id: int, boardgame_id: int, win_type: str, data: dict):
    game = db.query(models.PlayedGame).filter(models.PlayedGame.id == played_game_id).first()
    if not game:
        return None
    
    if 'played_at' in data:
        game.played_at = data['played_at']
    
    if 'present_players' in data:
        game.present_player_ids = ','.join(map(str, data['present_players']))
    
    if win_type == 'winner':
        game.winner_id = data.get('winner_id')
        game.points = None
        game.winner_id_task = None
        game.task_id = None
    elif win_type == 'points':
        points_dict = data.get('points', {})
        points_str = ','.join(f"{pid}:{pts}" for pid, pts in points_dict.items())
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
        weekday = g.played_at.weekday()
        day_counts[weekday] = day_counts.get(weekday, 0) + 1
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
    games = q.order_by(models.PlayedGame.played_at.asc()).all()
    streaks = {}
    max_streaks = {}
    last_winner = None
    for g in games:
        winner_id = g.winner_id or g.winner_id_task
        if winner_id is None:
            for pid in streaks:
                streaks[pid] = 0
            last_winner = None
            continue
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

def get_available_years_with_count(db: Session, society_id: int):
    """
    Geeft een lijst van (jaar, aantal_records) tuples terug waar data van is voor een society.
    """
    from sqlalchemy import extract, func
    years_with_count = db.query(
        extract('year', models.PlayedGame.played_at).label('year'),
        func.count(models.PlayedGame.id).label('count')
    ).filter(models.PlayedGame.society_id == society_id).group_by(
        extract('year', models.PlayedGame.played_at)
    ).order_by(extract('year', models.PlayedGame.played_at).asc()).all()
    
    return [(int(year), int(count)) for year, count in years_with_count]

def get_available_months_with_count(db: Session, society_id: int, year: int = None):
    """
    Geeft een lijst van (jaar, maand, aantal_records) tuples terug waar data van is voor een society.
    Als year is opgegeven, alleen voor dat jaar.
    """
    from sqlalchemy import extract, func
    query = db.query(
        extract('year', models.PlayedGame.played_at).label('year'),
        extract('month', models.PlayedGame.played_at).label('month'),
        func.count(models.PlayedGame.id).label('count')
    ).filter(models.PlayedGame.society_id == society_id)
    
    if year:
        query = query.filter(extract('year', models.PlayedGame.played_at) == year)
    
    months_with_count = query.group_by(
        extract('year', models.PlayedGame.played_at),
        extract('month', models.PlayedGame.played_at)
    ).order_by(
        extract('year', models.PlayedGame.played_at).asc(),
        extract('month', models.PlayedGame.played_at).asc()
    ).all()
    
    return [(int(year), int(month), int(count)) for year, month, count in months_with_count]

def get_available_weeks_with_count(db: Session, society_id: int, year: int = None):
    """
    Geeft een lijst van (jaar, week, aantal_records) tuples terug waar data van is voor een society.
    Als year is opgegeven, alleen voor dat jaar.
    """
    from sqlalchemy import extract, func
    games = db.query(models.PlayedGame).filter(models.PlayedGame.society_id == society_id).all()
    
    week_counts = {}
    for game in games:
        game_year = game.played_at.year
        if year and game_year != year:
            continue
            
        jan1 = game.played_at.replace(month=1, day=1)
        days_since_jan1 = (game.played_at - jan1).days
        week_num = days_since_jan1 // 7
        
        key = (game_year, week_num)
        week_counts[key] = week_counts.get(key, 0) + 1
    
    result = [(year, week, count) for (year, week), count in week_counts.items()]
    result.sort(key=lambda x: (x[0], x[1]), reverse=False)
    
    return result

def get_available_days_with_count(db: Session, society_id: int, year: int = None, month: int = None):
    """
    Geeft een lijst van (jaar, maand, dag, dag_van_week, aantal_records) tuples terug waar data van is voor een society.
    Als year is opgegeven, alleen voor dat jaar.
    Als month is opgegeven, alleen voor die maand.
    """
    from sqlalchemy import extract, func
    from datetime import date
    
    query = db.query(
        extract('year', models.PlayedGame.played_at).label('year'),
        extract('month', models.PlayedGame.played_at).label('month'),
        extract('day', models.PlayedGame.played_at).label('day'),
        func.count(models.PlayedGame.id).label('count')
    ).filter(models.PlayedGame.society_id == society_id)
    
    if year:
        query = query.filter(extract('year', models.PlayedGame.played_at) == year)
    if month:
        query = query.filter(extract('month', models.PlayedGame.played_at) == month)
    
    days_with_count = query.group_by(
        extract('year', models.PlayedGame.played_at),
        extract('month', models.PlayedGame.played_at),
        extract('day', models.PlayedGame.played_at)
    ).order_by(
        extract('year', models.PlayedGame.played_at).asc(),
        extract('month', models.PlayedGame.played_at).asc(),
        extract('day', models.PlayedGame.played_at).asc()
    ).all()
    
    weekday_names = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    result = []
    for year, month, day, count in days_with_count:
        try:
            d = date(int(year), int(month), int(day))
            weekday = weekday_names[d.weekday()]
            result.append((int(year), int(month), int(day), weekday, int(count)))
        except ValueError:
            continue
    
    return result 
