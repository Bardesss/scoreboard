from sqlalchemy.orm import Session
from sqlalchemy import func
import models
from datetime import datetime, timedelta

def get_players(db: Session):
    return db.query(models.Player).all()

def create_player(db: Session, name: str, color: str, created_by_user_id: int = None):
    player = models.Player(name=name, color=color, created_by_user_id=created_by_user_id)
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

def create_boardgame(db: Session, name: str, win_type: str, created_by_user_id: int = None):
    game = models.BoardGame(name=name, win_type=win_type, created_by_user_id=created_by_user_id)
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

def create_task(db: Session, number: int, name: str, boardgame_id: int, created_by_user_id: int = None):
    task = models.Task(number=number, name=name, boardgame_id=boardgame_id, created_by_user_id=created_by_user_id)
    db.add(task)
    db.commit()
    db.refresh(task)
    return task

def update_task(db: Session, task_id: int, number: int, name: str, boardgame_id: int):
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if task:
        task.number = number
        task.name = name
        task.boardgame_id = boardgame_id
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

def create_society(db: Session, name: str, player_ids: list, boardgame_ids: list, created_by_user_id: int = None):
    society = models.Society(
        name=name,
        player_ids=','.join(str(pid) for pid in player_ids),
        boardgame_ids=','.join(str(bid) for bid in boardgame_ids),
        created_by_user_id=created_by_user_id
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

def create_played_game(db: Session, society_id: int, boardgame_id: int, win_type: str, data: dict, created_by_user_id: int = None):
    played_game = models.PlayedGame(
        society_id=society_id,
        boardgame_id=boardgame_id,
        played_at=data.get('played_at', datetime.now()),
        present_player_ids=','.join(map(str, data['present_players'])),
        created_by_user_id=created_by_user_id
    )
    if win_type == 'winner':
        played_game.winner_id = data['winner_id']
    elif win_type == 'points':
        played_game.winner_id = data['winner_id']
        played_game.winner_points = data['winner_points']
    elif win_type == 'highest_points':
        points_str = ','.join(f"{pid}:{pts}" for pid, pts in data['points'].items())
        played_game.points = points_str
        # Find the winner (player with highest points)
        if data['points']:
            max_points = max(data['points'].values())
            winner_id = int([pid for pid, pts in data['points'].items() if pts == max_points][0])
            played_game.winner_id = winner_id
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
        game.winner_points = None
        game.winner_id_task = None
        game.task_id = None
    elif win_type == 'points':
        game.winner_id = data.get('winner_id')
        game.winner_points = data.get('winner_points')
        game.points = None
        game.winner_id_task = None
        game.task_id = None
    elif win_type == 'highest_points':
        points_dict = data.get('points', {})
        points_str = ','.join(f"{pid}:{pts}" for pid, pts in points_dict.items())
        if points_dict:
            max_points = max(points_dict.values())
            winner_id = int([pid for pid, pts in points_dict.items() if pts == max_points][0])
        else:
            winner_id = None
        game.points = points_str
        game.winner_id = winner_id
        game.winner_points = None
        game.winner_id_task = None
        game.task_id = None
    elif win_type == 'task':
        game.winner_id_task = data.get('winner_id_task')
        game.task_id = data.get('task_id')
        game.winner_id = None
        game.points = None
        game.winner_points = None
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
    # Filter out players with 0 wins
    return {pid: count for pid, count in win_counts.items() if count > 0}

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
    # Filter out players with 0 points
    return {pid: pts for pid, pts in points.items() if pts > 0}

def get_stats_most_won_task(db: Session, society_id: int, from_date: datetime = None, to_date: datetime = None):
    q = db.query(models.PlayedGame).filter(models.PlayedGame.society_id == society_id)
    if from_date:
        q = q.filter(models.PlayedGame.played_at >= from_date)
    if to_date:
        q = q.filter(models.PlayedGame.played_at <= to_date)
    task_wins = {}
    for g in q:
        if g.task_id:
            task_wins[g.task_id] = task_wins.get(g.task_id, 0) + 1
    # Filter out tasks with 0 wins
    return {tid: count for tid, count in task_wins.items() if count > 0}

def get_stats_highest_points_per_game(db: Session, society_id: int, from_date: datetime = None, to_date: datetime = None):
    q = db.query(models.PlayedGame).filter(models.PlayedGame.society_id == society_id)
    if from_date:
        q = q.filter(models.PlayedGame.played_at >= from_date)
    if to_date:
        q = q.filter(models.PlayedGame.played_at <= to_date)
    highest_points = {}
    for g in q:
        if g.points:
            for pair in g.points.split(','):
                pid, pts = pair.split(':')
                pid = int(pid)
                pts = int(pts)
                if pid not in highest_points or pts > highest_points[pid]:
                    highest_points[pid] = pts
    # Filter out players with 0 points
    return {pid: pts for pid, pts in highest_points.items() if pts > 0}

def get_stats_most_popular_days(db: Session, society_id: int, from_date: datetime = None, to_date: datetime = None):
    q = db.query(models.PlayedGame).filter(models.PlayedGame.society_id == society_id)
    if from_date:
        q = q.filter(models.PlayedGame.played_at >= from_date)
    if to_date:
        q = q.filter(models.PlayedGame.played_at <= to_date)
    day_counts = {0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0}
    for g in q:
        day_counts[g.played_at.weekday()] += 1
    # Filter out days with 0 games
    return {day: count for day, count in day_counts.items() if count > 0}

def get_stats_longest_win_streak(db: Session, society_id: int, from_date: datetime = None, to_date: datetime = None):
    q = db.query(models.PlayedGame).filter(models.PlayedGame.society_id == society_id)
    if from_date:
        q = q.filter(models.PlayedGame.played_at >= from_date)
    if to_date:
        q = q.filter(models.PlayedGame.played_at <= to_date)
    games = q.order_by(models.PlayedGame.played_at).all()
    
    player_streaks = {}
    current_streaks = {}
    
    for game in games:
        winners = []
        if game.winner_id:
            winners.append(game.winner_id)
        if game.winner_id_task:
            winners.append(game.winner_id_task)
        
        for player_id in list(current_streaks.keys()):
            if player_id not in winners:
                if player_id not in player_streaks:
                    player_streaks[player_id] = 0
                player_streaks[player_id] = max(player_streaks[player_id], current_streaks[player_id])
                del current_streaks[player_id]
        
        for winner in winners:
            if winner in current_streaks:
                current_streaks[winner] += 1
            else:
                current_streaks[winner] = 1
    
    for player_id, streak in current_streaks.items():
        if player_id not in player_streaks:
            player_streaks[player_id] = 0
        player_streaks[player_id] = max(player_streaks[player_id], streak)
    
    # Filter out players with 0 streak
    return {pid: streak for pid, streak in player_streaks.items() if streak > 0}

def get_stats_games_played(db: Session, society_id: int, from_date: datetime = None, to_date: datetime = None):
    q = db.query(models.PlayedGame).filter(models.PlayedGame.society_id == society_id)
    if from_date:
        q = q.filter(models.PlayedGame.played_at >= from_date)
    if to_date:
        q = q.filter(models.PlayedGame.played_at <= to_date)
    games_played = {}
    for g in q:
        if g.present_player_ids:
            for pid in g.present_player_ids.split(','):
                pid = int(pid)
                games_played[pid] = games_played.get(pid, 0) + 1
    return games_played

def get_available_years_with_count(db: Session, society_id: int):
    result = db.query(
        func.extract('year', models.PlayedGame.played_at).label('year'),
        func.count().label('count')
    ).filter(models.PlayedGame.society_id == society_id).group_by(
        func.extract('year', models.PlayedGame.played_at)
    ).order_by(func.extract('year', models.PlayedGame.played_at).desc()).all()
    return [(int(row.year), row.count) for row in result]

def get_available_months_with_count(db: Session, society_id: int, year: int = None):
    query = db.query(
        func.extract('year', models.PlayedGame.played_at).label('year'),
        func.extract('month', models.PlayedGame.played_at).label('month'),
        func.count().label('count')
    ).filter(models.PlayedGame.society_id == society_id)
    
    if year:
        query = query.filter(func.extract('year', models.PlayedGame.played_at) == year)
    
    result = query.group_by(
        func.extract('year', models.PlayedGame.played_at),
        func.extract('month', models.PlayedGame.played_at)
    ).order_by(
        func.extract('year', models.PlayedGame.played_at).desc(),
        func.extract('month', models.PlayedGame.played_at).desc()
    ).all()
    
    return [(int(row.year), int(row.month), row.count) for row in result]

def get_available_weeks_with_count(db: Session, society_id: int, year: int = None):
    query = db.query(
        func.extract('year', models.PlayedGame.played_at).label('year'),
        func.extract('week', models.PlayedGame.played_at).label('week'),
        func.count().label('count')
    ).filter(models.PlayedGame.society_id == society_id)
    
    if year:
        query = query.filter(func.extract('year', models.PlayedGame.played_at) == year)
    
    result = query.group_by(
        func.extract('year', models.PlayedGame.played_at),
        func.extract('week', models.PlayedGame.played_at)
    ).order_by(
        func.extract('year', models.PlayedGame.played_at).desc(),
        func.extract('week', models.PlayedGame.played_at).desc()
    ).all()
    
    return [(int(row.year), int(row.week), row.count) for row in result]

def get_available_days_with_count(db: Session, society_id: int, year: int = None, month: int = None):
    query = db.query(
        func.extract('year', models.PlayedGame.played_at).label('year'),
        func.extract('month', models.PlayedGame.played_at).label('month'),
        func.extract('day', models.PlayedGame.played_at).label('day'),
        func.extract('dow', models.PlayedGame.played_at).label('weekday'),
        func.count().label('count')
    ).filter(models.PlayedGame.society_id == society_id)
    
    if year:
        query = query.filter(func.extract('year', models.PlayedGame.played_at) == year)
    if month:
        query = query.filter(func.extract('month', models.PlayedGame.played_at) == month)
    
    result = query.group_by(
        func.extract('year', models.PlayedGame.played_at),
        func.extract('month', models.PlayedGame.played_at),
        func.extract('day', models.PlayedGame.played_at),
        func.extract('dow', models.PlayedGame.played_at)
    ).order_by(
        func.extract('year', models.PlayedGame.played_at).desc(),
        func.extract('month', models.PlayedGame.played_at).desc(),
        func.extract('day', models.PlayedGame.played_at).desc()
    ).all()
    
    weekday_names = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    return [(int(row.year), int(row.month), int(row.day), weekday_names[int(row.weekday)], row.count) for row in result]

def can_edit_player(db: Session, player_id: int, user_id: int, is_admin: bool):
    if is_admin:
        return True
    player = db.query(models.Player).filter(models.Player.id == player_id).first()
    return player and player.created_by_user_id == user_id

def can_edit_boardgame(db: Session, boardgame_id: int, user_id: int, is_admin: bool):
    if is_admin:
        return True
    boardgame = db.query(models.BoardGame).filter(models.BoardGame.id == boardgame_id).first()
    return boardgame and boardgame.created_by_user_id == user_id

def can_edit_task(db: Session, task_id: int, user_id: int, is_admin: bool):
    if is_admin:
        return True
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    return task and task.created_by_user_id == user_id

def can_edit_society(db: Session, society_id: int, user_id: int, is_admin: bool):
    if is_admin:
        return True
    society = db.query(models.Society).filter(models.Society.id == society_id).first()
    return society and society.created_by_user_id == user_id

def can_edit_played_game(db: Session, played_game_id: int, user_id: int, is_admin: bool):
    if is_admin:
        return True
    played_game = db.query(models.PlayedGame).filter(models.PlayedGame.id == played_game_id).first()
    return played_game and played_game.created_by_user_id == user_id

def can_add_played_game_to_society(db: Session, society_id: int, user_id: int, is_admin: bool):
    if is_admin:
        return True
    society = db.query(models.Society).filter(models.Society.id == society_id).first()
    return society and society.created_by_user_id == user_id

def can_add_task_to_boardgame(db: Session, boardgame_id: int, user_id: int, is_admin: bool):
    if is_admin:
        return True
    boardgame = db.query(models.BoardGame).filter(models.BoardGame.id == boardgame_id).first()
    return boardgame and boardgame.created_by_user_id == user_id 
