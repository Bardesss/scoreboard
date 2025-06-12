from fastapi import FastAPI, Request, Depends, Form, Query
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlalchemy.orm import Session
from database import SessionLocal, engine, Base
import crud
import models
import auth
import os
from datetime import datetime, timedelta
from starlette.middleware.sessions import SessionMiddleware
import json

app = FastAPI()

app.mount('/static', StaticFiles(directory='static'), name='static')
templates = Jinja2Templates(directory='templates')

Base.metadata.create_all(bind=engine)

app.add_middleware(SessionMiddleware, secret_key="change-this-secret-key")
app.include_router(auth.router)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.get('/', response_class=HTMLResponse)
def read_root(request: Request, db: Session = Depends(get_db)):
    # Check of er een admin bestaat
    admin_exists = db.query(models.User).filter(models.User.is_admin == True).first()
    if not admin_exists:
        return RedirectResponse('/setup', status_code=303)
    societies = crud.get_societies(db)
    players = crud.get_players(db)
    games = crud.get_boardgames(db)
    # Laatste 10 gespeelde spellen over alle societies
    played_games = db.query(models.PlayedGame).order_by(models.PlayedGame.played_at.desc()).limit(10).all()

    # Zoek voor elke society de meest recente played_at
    all_played_games = db.query(models.PlayedGame).all()
    last_played = {}
    for game in all_played_games:
        sid = game.society_id
        date = game.played_at
        if sid not in last_played or date > last_played[sid]:
            last_played[sid] = date
    # Voeg toe aan society object en sorteer
    for s in societies:
        s.last_played = last_played.get(s.id)
    societies_sorted = sorted(
        societies,
        key=lambda s: s.last_played or datetime.min,
        reverse=True
    )

    return templates.TemplateResponse('public_home.html', {"request": request, "societies": societies_sorted, "players": players, "games": games, "played_games": played_games})

def require_admin(request: Request):
    if not request.session.get('is_admin'):
        return RedirectResponse('/login', status_code=303)

# PLAYER CRUD
@app.get('/admin/players', response_class=HTMLResponse)
def list_players(request: Request, db: Session = Depends(get_db)):
    if not request.session.get('is_admin'):
        return RedirectResponse('/login', status_code=303)
    players = crud.get_players(db)
    return templates.TemplateResponse('players.html', {"request": request, "players": players})

@app.post('/admin/players/add')
def add_player(name: str = Form(...), color: str = Form(...), db: Session = Depends(get_db)):
    crud.create_player(db, name, color)
    return RedirectResponse('/admin/players', status_code=303)

@app.post('/admin/players/delete/{player_id}')
def delete_player(player_id: int, db: Session = Depends(get_db)):
    crud.delete_player(db, player_id)
    return RedirectResponse('/admin/players', status_code=303)

# PLAYER EDIT
@app.get('/admin/players/edit/{player_id}', response_class=HTMLResponse)
def edit_player_form(request: Request, player_id: int, db: Session = Depends(get_db)):
    player = db.query(models.Player).filter(models.Player.id == player_id).first()
    return templates.TemplateResponse('edit_player.html', {"request": request, "player": player})

@app.post('/admin/players/edit/{player_id}')
def edit_player(player_id: int, name: str = Form(...), color: str = Form(...), db: Session = Depends(get_db)):
    crud.update_player(db, player_id, name, color)
    return RedirectResponse('/admin/players', status_code=303)

# BOARDGAME CRUD
@app.get('/admin/boardgames', response_class=HTMLResponse)
def list_boardgames(request: Request, db: Session = Depends(get_db)):
    games = crud.get_boardgames(db)
    return templates.TemplateResponse('boardgames.html', {"request": request, "games": games})

@app.post('/admin/boardgames/add')
def add_boardgame(name: str = Form(...), win_type: str = Form(...), db: Session = Depends(get_db)):
    crud.create_boardgame(db, name, win_type)
    return RedirectResponse('/admin/boardgames', status_code=303)

@app.post('/admin/boardgames/delete/{game_id}')
def delete_boardgame(game_id: int, db: Session = Depends(get_db)):
    crud.delete_boardgame(db, game_id)
    return RedirectResponse('/admin/boardgames', status_code=303)

# BOARDGAME EDIT
@app.get('/admin/boardgames/edit/{game_id}', response_class=HTMLResponse)
def edit_boardgame_form(request: Request, game_id: int, db: Session = Depends(get_db)):
    game = db.query(models.BoardGame).filter(models.BoardGame.id == game_id).first()
    return templates.TemplateResponse('edit_boardgame.html', {"request": request, "game": game})

@app.post('/admin/boardgames/edit/{game_id}')
def edit_boardgame(game_id: int, name: str = Form(...), win_type: str = Form(...), db: Session = Depends(get_db)):
    crud.update_boardgame(db, game_id, name, win_type)
    return RedirectResponse('/admin/boardgames', status_code=303)

# TASK CRUD
@app.get('/admin/tasks', response_class=HTMLResponse)
def list_tasks(request: Request, db: Session = Depends(get_db), boardgame_id: int = None):
    all_games = crud.get_boardgames(db)
    games = [g for g in all_games if g.win_type == 'task']
    selected_boardgame_id = boardgame_id
    tasks = crud.get_tasks(db, boardgame_id=boardgame_id) if boardgame_id else []
    next_number = 1
    if boardgame_id:
        existing_numbers = [task.number for task in tasks]
        while next_number in existing_numbers:
            next_number += 1
    return templates.TemplateResponse('tasks.html', {"request": request, "tasks": tasks, "games": games, "selected_boardgame_id": selected_boardgame_id, "next_number": next_number})

@app.post('/admin/tasks/add')
def add_task(number: int = Form(...), name: str = Form(...), boardgame_id: int = Form(...), db: Session = Depends(get_db)):
    crud.create_task(db, number, name, boardgame_id)
    return RedirectResponse(f'/admin/tasks?boardgame_id={boardgame_id}', status_code=303)

@app.post('/admin/tasks/delete/{task_id}')
def delete_task(task_id: int, db: Session = Depends(get_db), boardgame_id: int = None):
    crud.delete_task(db, task_id)
    boardgame_id_param = f'?boardgame_id={boardgame_id}' if boardgame_id else ''
    return RedirectResponse(f'/admin/tasks{boardgame_id_param}', status_code=303)

# TASK EDIT
@app.get('/admin/tasks/edit/{task_id}', response_class=HTMLResponse)
def edit_task_form(request: Request, task_id: int, db: Session = Depends(get_db), boardgame_id: int = None):
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    games = crud.get_boardgames(db)
    selected_boardgame_id = boardgame_id or (task.boardgame_id if task else None)
    return templates.TemplateResponse('edit_task.html', {"request": request, "task": task, "games": games, "selected_boardgame_id": selected_boardgame_id})

@app.post('/admin/tasks/edit/{task_id}')
def edit_task(task_id: int, number: int = Form(...), name: str = Form(...), boardgame_id: int = Form(...), db: Session = Depends(get_db)):
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if task:
        task.number = number
        task.name = name
        task.boardgame_id = boardgame_id
        db.commit()
        db.refresh(task)
    return RedirectResponse(f'/admin/tasks?boardgame_id={boardgame_id}', status_code=303)

# SOCIETY CRUD
@app.get('/admin/societies', response_class=HTMLResponse)
def list_societies(request: Request, db: Session = Depends(get_db)):
    societies = crud.get_societies(db)
    players = crud.get_players(db)
    games = crud.get_boardgames(db)
    return templates.TemplateResponse('societies.html', {"request": request, "societies": societies, "players": players, "games": games})

@app.post('/admin/societies/add')
def add_society(name: str = Form(...), player_ids: list = Form(...), boardgame_ids: str = Form(...), db: Session = Depends(get_db)):
    # boardgame_ids is nu een enkele string, maak er een lijst van
    crud.create_society(db, name, player_ids, [boardgame_ids])
    return RedirectResponse('/admin/societies', status_code=303)

@app.get('/admin/societies/edit/{society_id}', response_class=HTMLResponse)
def edit_society_form(request: Request, society_id: int, db: Session = Depends(get_db)):
    society = db.query(models.Society).filter(models.Society.id == society_id).first()
    players = crud.get_players(db)
    games = crud.get_boardgames(db)
    selected_players = [int(pid) for pid in society.player_ids.split(',')] if society.player_ids else []
    selected_games = [int(bid) for bid in society.boardgame_ids.split(',')] if society.boardgame_ids else []
    return templates.TemplateResponse('edit_society.html', {"request": request, "society": society, "players": players, "games": games, "selected_players": selected_players, "selected_games": selected_games})

@app.post('/admin/societies/edit/{society_id}')
def edit_society(society_id: int, name: str = Form(...), player_ids: list = Form(...), boardgame_ids: str = Form(...), db: Session = Depends(get_db)):
    # boardgame_ids is nu een enkele string, maak er een lijst van
    crud.update_society(db, society_id, name, player_ids, [boardgame_ids])
    return RedirectResponse('/admin/societies', status_code=303)

@app.post('/admin/societies/delete/{society_id}')
def delete_society(society_id: int, db: Session = Depends(get_db)):
    crud.delete_society(db, society_id)
    return RedirectResponse('/admin/societies', status_code=303)

@app.get('/societies/{society_id}/games', response_class=HTMLResponse)
def list_played_games(request: Request, society_id: int, db: Session = Depends(get_db)):
    society = db.query(models.Society).filter(models.Society.id == society_id).first()
    games = crud.get_boardgames(db)
    players = crud.get_players(db)
    played_games = crud.get_played_games(db, society_id)
    tasks = crud.get_tasks(db)
    return templates.TemplateResponse('played_games.html', {"request": request, "society": society, "games": games, "players": players, "played_games": played_games, "tasks": tasks})

@app.get('/societies/{society_id}/games/add', response_class=HTMLResponse)
def add_played_game_form(request: Request, society_id: int, db: Session = Depends(get_db)):
    society = db.query(models.Society).filter(models.Society.id == society_id).first()
    games = crud.get_boardgames(db)
    # Alleen spelers van deze society
    player_ids = [int(pid) for pid in society.player_ids.split(',')] if society.player_ids else []
    all_players = crud.get_players(db)
    players = [p for p in all_players if p.id in player_ids]
    # Haal het enige bordspel van deze society op
    boardgame_id = int(society.boardgame_ids.split(',')[0]) if society.boardgame_ids else None
    selected_game = db.query(models.BoardGame).filter(models.BoardGame.id == boardgame_id).first() if boardgame_id else None
    win_type = selected_game.win_type if selected_game else None
    tasks = crud.get_tasks(db, boardgame_id=boardgame_id) if win_type == 'task' else []
    return templates.TemplateResponse('add_played_game.html', {"request": request, "society": society, "games": games, "players": players, "selected_game": selected_game, "win_type": win_type, "tasks": tasks})

@app.post('/societies/{society_id}/games/add')
async def add_played_game(society_id: int, boardgame_id: int = Form(...), win_type: str = Form(...), db: Session = Depends(get_db), request: Request = None):
    data = {}
    form = await request.form()
    # Verwerk aanwezige spelers (checkboxes)
    present_players = [int(k.split('_')[1]) for k, v in form.items() if k.startswith('present_') and v == '1']
    data['present_players'] = present_players
    if win_type == 'winner':
        data['winner_id'] = int(form['winner_id'])
    elif win_type == 'points':
        points = {k.split('_')[1]: int(v) for k, v in form.items() if k.startswith('points_')}
        data['points'] = points
    elif win_type == 'task':
        data['winner_id_task'] = int(form['winner_id_task'])
        data['task_id'] = int(form['task_id'])
    crud.create_played_game(db, society_id, boardgame_id, win_type, data)
    return RedirectResponse(f'/societies/{society_id}/games', status_code=303)

@app.get('/societies/{society_id}/games/edit/{game_id}', response_class=HTMLResponse)
def edit_played_game_form(request: Request, society_id: int, game_id: int, db: Session = Depends(get_db)):
    played_game = db.query(models.PlayedGame).filter(models.PlayedGame.id == game_id).first()
    society = db.query(models.Society).filter(models.Society.id == society_id).first()
    games = crud.get_boardgames(db)
    players = crud.get_players(db)
    selected_game = db.query(models.BoardGame).filter(models.BoardGame.id == played_game.boardgame_id).first()
    win_type = selected_game.win_type if selected_game else None
    tasks = crud.get_tasks(db, boardgame_id=selected_game.id) if win_type == 'task' else []
    return templates.TemplateResponse('edit_played_game.html', {"request": request, "society": society, "games": games, "players": players, "played_game": played_game, "selected_game": selected_game, "win_type": win_type, "tasks": tasks})

@app.post('/societies/{society_id}/games/edit/{game_id}')
async def edit_played_game(society_id: int, game_id: int, boardgame_id: int = Form(...), win_type: str = Form(...), request: Request = None, db: Session = Depends(get_db)):
    data = {}
    form = await request.form()
    if win_type == 'winner':
        data['winner_id'] = int(form['winner_id'])
    elif win_type == 'points':
        points = {k.split('_')[1]: int(v) for k, v in form.items() if k.startswith('points_')}
        data['points'] = points
    elif win_type == 'task':
        data['winner_id_task'] = int(form['winner_id_task'])
        data['task_id'] = int(form['task_id'])
    crud.update_played_game(db, game_id, win_type, data)
    return RedirectResponse(f'/societies/{society_id}/games', status_code=303)

@app.post('/societies/{society_id}/games/delete/{game_id}')
def delete_played_game(society_id: int, game_id: int, db: Session = Depends(get_db)):
    crud.delete_played_game(db, game_id)
    return RedirectResponse(f'/societies/{society_id}/games', status_code=303)

@app.get('/societies/{society_id}/stats', response_class=HTMLResponse)
def society_stats(request: Request, society_id: int, period: str = Query('all'), db: Session = Depends(get_db)):
    now = datetime.utcnow()
    if period == 'day':
        from_date = now - timedelta(days=1)
    elif period == 'week':
        from_date = now - timedelta(weeks=1)
    elif period == 'month':
        from_date = now - timedelta(days=30)
    elif period == 'year':
        from_date = now - timedelta(days=365)
    else:
        from_date = None
    to_date = now if from_date else None
    players = crud.get_players(db)
    tasks = crud.get_tasks(db)
    most_wins = crud.get_stats_most_wins(db, society_id, from_date, to_date)
    most_points = crud.get_stats_most_points(db, society_id, from_date, to_date)
    most_won_task = crud.get_stats_most_won_task(db, society_id, from_date, to_date)
    highest_points = crud.get_stats_highest_points_per_game(db, society_id, from_date, to_date)
    society = db.query(models.Society).filter(models.Society.id == society_id).first()
    # Haal het win_type van het bordspel van deze society op
    boardgame_id = int(society.boardgame_ids.split(',')[0]) if society.boardgame_ids else None
    boardgame = db.query(models.BoardGame).filter(models.BoardGame.id == boardgame_id).first() if boardgame_id else None
    win_type = boardgame.win_type if boardgame else None
    most_popular_days = crud.get_stats_most_popular_days(db, society_id, from_date, to_date)
    longest_win_streak = crud.get_stats_longest_win_streak(db, society_id, from_date, to_date)
    games_played = crud.get_stats_games_played(db, society_id, from_date, to_date)
    # Winratio per speler: aantal gewonnen / aantal gespeeld (indien >0)
    win_ratios = {}
    for pid, played in games_played.items():
        wins = most_wins.get(pid, 0)
        if played > 0:
            win_ratios[pid] = wins / played
    return templates.TemplateResponse('society_stats.html', {
        "request": request,
        "society": society,
        "players": players,
        "tasks": tasks,
        "most_wins": most_wins,
        "most_points": most_points,
        "most_won_task": most_won_task,
        "highest_points": highest_points,
        "period": period,
        "win_type": win_type,
        "most_popular_days": most_popular_days,
        "longest_win_streak": longest_win_streak,
        "win_ratios": win_ratios,
        # JSON data voor charts
        "most_wins_json": json.dumps(most_wins),
        "most_points_json": json.dumps(most_points),
        "most_won_task_json": json.dumps(most_won_task),
        "highest_points_json": json.dumps(highest_points),
        "win_ratios_json": json.dumps(win_ratios),
        "most_popular_days_json": json.dumps(most_popular_days),
        "longest_win_streak_json": json.dumps(longest_win_streak),
        "players_json": json.dumps({p.id: p.name for p in players}),
        "players_colors_json": json.dumps({p.id: p.color for p in players}),
        "tasks_json": json.dumps({t.id: t.name for t in tasks}),
    }) 