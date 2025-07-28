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
@auth.admin_required
async def list_players(request: Request, db: Session = Depends(get_db)):
    players = crud.get_players(db)
    return templates.TemplateResponse('players.html', {"request": request, "players": players})

@app.post('/admin/players/add')
@auth.admin_required
async def add_player(request: Request, name: str = Form(...), color: str = Form(...), db: Session = Depends(get_db)):
    crud.create_player(db, name, color)
    return RedirectResponse('/admin/players', status_code=303)

@app.post('/admin/players/delete/{player_id}')
@auth.admin_required
async def delete_player(request: Request, player_id: int, db: Session = Depends(get_db)):
    try:
        crud.delete_player(db, player_id)
        return RedirectResponse('/admin/players', status_code=303)
    except ValueError as e:
        players = crud.get_players(db)
        return templates.TemplateResponse('players.html', {
            "request": request,
            "players": players,
            "error": str(e)
        })

# PLAYER EDIT
@app.get('/admin/players/edit/{player_id}', response_class=HTMLResponse)
@auth.admin_required
async def edit_player_form(request: Request, player_id: int, db: Session = Depends(get_db)):
    player = db.query(models.Player).filter(models.Player.id == player_id).first()
    return templates.TemplateResponse('edit_player.html', {"request": request, "player": player})

@app.post('/admin/players/edit/{player_id}')
@auth.admin_required
async def edit_player(request: Request, player_id: int, name: str = Form(...), color: str = Form(...), db: Session = Depends(get_db)):
    crud.update_player(db, player_id, name, color)
    return RedirectResponse('/admin/players', status_code=303)

# BOARDGAME CRUD
@app.get('/admin/boardgames', response_class=HTMLResponse)
@auth.admin_required
async def list_boardgames(request: Request, db: Session = Depends(get_db)):
    games = crud.get_boardgames(db)
    return templates.TemplateResponse('boardgames.html', {"request": request, "games": games})

@app.post('/admin/boardgames/add')
@auth.admin_required
async def add_boardgame(request: Request, name: str = Form(...), win_type: str = Form(...), db: Session = Depends(get_db)):
    crud.create_boardgame(db, name, win_type)
    return RedirectResponse('/admin/boardgames', status_code=303)

@app.post('/admin/boardgames/delete/{game_id}')
@auth.admin_required
async def delete_boardgame(request: Request, game_id: int, db: Session = Depends(get_db)):
    try:
        crud.delete_boardgame(db, game_id)
        return RedirectResponse('/admin/boardgames', status_code=303)
    except ValueError as e:
        games = crud.get_boardgames(db)
        return templates.TemplateResponse('boardgames.html', {
            "request": request,
            "games": games,
            "error": str(e)
        })

# BOARDGAME EDIT
@app.get('/admin/boardgames/edit/{game_id}', response_class=HTMLResponse)
@auth.admin_required
async def edit_boardgame_form(request: Request, game_id: int, db: Session = Depends(get_db)):
    game = db.query(models.BoardGame).filter(models.BoardGame.id == game_id).first()
    return templates.TemplateResponse('edit_boardgame.html', {"request": request, "game": game})

@app.post('/admin/boardgames/edit/{game_id}')
@auth.admin_required
async def edit_boardgame(request: Request, game_id: int, name: str = Form(...), win_type: str = Form(...), db: Session = Depends(get_db)):
    crud.update_boardgame(db, game_id, name, win_type)
    return RedirectResponse('/admin/boardgames', status_code=303)

# TASK CRUD
@app.get('/admin/tasks', response_class=HTMLResponse)
@auth.admin_required
async def list_tasks(request: Request, db: Session = Depends(get_db), boardgame_id: int = None):
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
@auth.admin_required
async def add_task(request: Request, number: int = Form(...), name: str = Form(...), boardgame_id: int = Form(...), db: Session = Depends(get_db)):
    crud.create_task(db, number, name, boardgame_id)
    return RedirectResponse(f'/admin/tasks?boardgame_id={boardgame_id}', status_code=303)

@app.post('/admin/tasks/delete/{task_id}')
@auth.admin_required
async def delete_task(request: Request, task_id: int, db: Session = Depends(get_db), boardgame_id: int = None):
    try:
        crud.delete_task(db, task_id)
        boardgame_id_param = f'?boardgame_id={boardgame_id}' if boardgame_id else ''
        return RedirectResponse(f'/admin/tasks{boardgame_id_param}', status_code=303)
    except ValueError as e:
        all_games = crud.get_boardgames(db)
        games = [g for g in all_games if g.win_type == 'task']
        tasks = crud.get_tasks(db, boardgame_id=boardgame_id) if boardgame_id else []
        next_number = 1
        if boardgame_id:
            existing_numbers = [task.number for task in tasks]
            while next_number in existing_numbers:
                next_number += 1
        return templates.TemplateResponse('tasks.html', {
            "request": request,
            "tasks": tasks,
            "games": games,
            "selected_boardgame_id": boardgame_id,
            "next_number": next_number,
            "error": str(e)
        })

# TASK EDIT
@app.get('/admin/tasks/edit/{task_id}', response_class=HTMLResponse)
@auth.admin_required
async def edit_task_form(request: Request, task_id: int, db: Session = Depends(get_db), boardgame_id: int = None):
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    games = crud.get_boardgames(db)
    selected_boardgame_id = boardgame_id or (task.boardgame_id if task else None)
    return templates.TemplateResponse('edit_task.html', {"request": request, "task": task, "games": games, "selected_boardgame_id": selected_boardgame_id})

@app.post('/admin/tasks/edit/{task_id}')
@auth.admin_required
async def edit_task(request: Request, task_id: int, number: int = Form(...), name: str = Form(...), boardgame_id: int = Form(...), db: Session = Depends(get_db)):
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
@auth.admin_required
async def list_societies(request: Request, db: Session = Depends(get_db)):
    societies = crud.get_societies(db)
    players = crud.get_players(db)
    games = crud.get_boardgames(db)
    return templates.TemplateResponse('societies.html', {"request": request, "societies": societies, "players": players, "games": games})

@app.post('/admin/societies/add')
@auth.admin_required
async def add_society(request: Request, name: str = Form(...), player_ids: list = Form(...), boardgame_ids: str = Form(...), db: Session = Depends(get_db)):
    # boardgame_ids is nu een enkele string, maak er een lijst van
    crud.create_society(db, name, player_ids, [boardgame_ids])
    return RedirectResponse('/admin/societies', status_code=303)

@app.get('/admin/societies/edit/{society_id}', response_class=HTMLResponse)
@auth.admin_required
async def edit_society_form(request: Request, society_id: int, db: Session = Depends(get_db)):
    society = db.query(models.Society).filter(models.Society.id == society_id).first()
    players = crud.get_players(db)
    games = crud.get_boardgames(db)
    selected_players = [int(pid) for pid in society.player_ids.split(',')] if society.player_ids else []
    selected_games = [int(bid) for bid in society.boardgame_ids.split(',')] if society.boardgame_ids else []
    return templates.TemplateResponse('edit_society.html', {"request": request, "society": society, "players": players, "games": games, "selected_players": selected_players, "selected_games": selected_games})

@app.post('/admin/societies/edit/{society_id}')
@auth.admin_required
async def edit_society(request: Request, society_id: int, name: str = Form(...), player_ids: list = Form(...), boardgame_ids: str = Form(...), db: Session = Depends(get_db)):
    # boardgame_ids is nu een enkele string, maak er een lijst van
    crud.update_society(db, society_id, name, player_ids, [boardgame_ids])
    return RedirectResponse('/admin/societies', status_code=303)

@app.post('/admin/societies/delete/{society_id}')
@auth.admin_required
async def delete_society(request: Request, society_id: int, db: Session = Depends(get_db)):
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
@auth.admin_required
async def add_played_game_form(request: Request, society_id: int, db: Session = Depends(get_db)):
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
    return templates.TemplateResponse('add_played_game.html', {
        "request": request, 
        "society": society, 
        "games": games, 
        "players": players, 
        "selected_game": selected_game, 
        "win_type": win_type, 
        "tasks": tasks,
        "now": datetime.now()
    })

@app.post('/societies/{society_id}/games/add')
@auth.admin_required
async def add_played_game(request: Request, society_id: int, boardgame_id: int = Form(...), win_type: str = Form(...), played_at: str = Form(...), db: Session = Depends(get_db)):
    # Valideer de datum
    played_at_dt = datetime.fromisoformat(played_at)
    if played_at_dt > datetime.now():
        # Haal de benodigde data op voor de template
        society = db.query(models.Society).filter(models.Society.id == society_id).first()
        games = crud.get_boardgames(db)
        player_ids = [int(pid) for pid in society.player_ids.split(',')] if society.player_ids else []
        all_players = crud.get_players(db)
        players = [p for p in all_players if p.id in player_ids]
        boardgame_id = int(society.boardgame_ids.split(',')[0]) if society.boardgame_ids else None
        selected_game = db.query(models.BoardGame).filter(models.BoardGame.id == boardgame_id).first() if boardgame_id else None
        win_type = selected_game.win_type if selected_game else None
        tasks = crud.get_tasks(db, boardgame_id=boardgame_id) if win_type == 'task' else []
        
        # Toon de template met foutmelding
        return templates.TemplateResponse('add_played_game.html', {
            "request": request,
            "society": society,
            "games": games,
            "players": players,
            "selected_game": selected_game,
            "win_type": win_type,
            "tasks": tasks,
            "now": datetime.now(),
            "error": "The date cannot be in the future!"
        })
    
    data = {}
    form = await request.form()
    # Verwerk aanwezige spelers (checkboxes)
    present_players = [int(k.split('_')[1]) for k, v in form.items() if k.startswith('present_') and v == '1']
    data['present_players'] = present_players
    data['played_at'] = played_at_dt
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
@auth.admin_required
async def edit_played_game_form(request: Request, society_id: int, game_id: int, db: Session = Depends(get_db)):
    played_game = db.query(models.PlayedGame).filter(models.PlayedGame.id == game_id).first()
    society = db.query(models.Society).filter(models.Society.id == society_id).first()
    games = crud.get_boardgames(db)
    players = crud.get_players(db)
    selected_game = db.query(models.BoardGame).filter(models.BoardGame.id == played_game.boardgame_id).first()
    win_type = selected_game.win_type if selected_game else None
    tasks = crud.get_tasks(db, boardgame_id=played_game.boardgame_id) if win_type == 'task' else []
    return templates.TemplateResponse('edit_played_game.html', {"request": request, "played_game": played_game, "society": society, "games": games, "players": players, "selected_game": selected_game, "win_type": win_type, "tasks": tasks})

@app.post('/societies/{society_id}/games/edit/{game_id}')
@auth.admin_required
async def edit_played_game(request: Request, society_id: int, game_id: int, boardgame_id: int = Form(...), win_type: str = Form(...), played_at: str = Form(...), db: Session = Depends(get_db)):
    # Valideer de datum
    played_at_dt = datetime.fromisoformat(played_at)
    if played_at_dt > datetime.now():
        # Haal de benodigde data op voor de template
        played_game = db.query(models.PlayedGame).filter(models.PlayedGame.id == game_id).first()
        society = db.query(models.Society).filter(models.Society.id == society_id).first()
        games = crud.get_boardgames(db)
        players = crud.get_players(db)
        selected_game = db.query(models.BoardGame).filter(models.BoardGame.id == played_game.boardgame_id).first()
        win_type = selected_game.win_type if selected_game else None
        tasks = crud.get_tasks(db, boardgame_id=played_game.boardgame_id) if win_type == 'task' else []
        
        # Toon de template met foutmelding
        return templates.TemplateResponse('edit_played_game.html', {
            "request": request,
            "played_game": played_game,
            "society": society,
            "games": games,
            "players": players,
            "selected_game": selected_game,
            "win_type": win_type,
            "tasks": tasks,
            "error": "De datum mag niet in de toekomst liggen!"
        })
    
    data = {}
    form = await request.form()
    # Verwerk aanwezige spelers (checkboxes)
    present_players = [int(k.split('_')[1]) for k, v in form.items() if k.startswith('present_') and v == '1']
    data['present_players'] = present_players
    data['played_at'] = played_at_dt
    if win_type == 'winner':
        data['winner_id'] = int(form['winner_id'])
    elif win_type == 'points':
        points = {k.split('_')[1]: int(v) for k, v in form.items() if k.startswith('points_')}
        data['points'] = points
    elif win_type == 'task':
        data['winner_id_task'] = int(form['winner_id_task'])
        data['task_id'] = int(form['task_id'])
    crud.update_played_game(db, game_id, boardgame_id, win_type, data)
    return RedirectResponse(f'/societies/{society_id}/games', status_code=303)

@app.post('/societies/{society_id}/games/delete/{game_id}')
@auth.admin_required
async def delete_played_game(request: Request, society_id: int, game_id: int, db: Session = Depends(get_db)):
    crud.delete_played_game(db, game_id)
    return RedirectResponse(f'/societies/{society_id}/games', status_code=303)

@app.get('/societies/{society_id}/stats', response_class=HTMLResponse)
def society_stats(request: Request, society_id: int, period: str = Query('all'), 
                 year: str = Query(None), month: str = Query(None), day: str = Query(None), 
                 week: str = Query(None), db: Session = Depends(get_db)):
    # Converteer string parameters naar integers als ze niet None zijn
    year_int = int(year) if year and year.strip() else None
    month_int = int(month) if month and month.strip() else None
    day_int = int(day) if day and day.strip() else None
    week_int = int(week) if week and week.strip() else None
    # Bepaal de datum range op basis van de parameters
    from_date = None
    to_date = None
    
    if period == 'all':
        # Alle data
        pass
    elif period == 'year' and year_int:
        # Specifiek jaar
        from_date = datetime(year_int, 1, 1)
        to_date = datetime(year_int, 12, 31, 23, 59, 59)
    elif period == 'month' and year_int and month_int:
        # Specifieke maand
        from_date = datetime(year_int, month_int, 1)
        if month_int == 12:
            to_date = datetime(year_int + 1, 1, 1) - timedelta(seconds=1)
        else:
            to_date = datetime(year_int, month_int + 1, 1) - timedelta(seconds=1)
    elif period == 'week' and year_int and week_int:
        # Specifieke week (0-based, zondag als eerste dag)
        from datetime import date
        # Week berekening: week 0 is de week die 1 januari bevat
        jan1 = date(year_int, 1, 1)
        # Bereken de start van de gewenste week
        week_start = jan1 + timedelta(weeks=week_int)
        from_date = datetime.combine(week_start, datetime.min.time())
        to_date = datetime.combine(week_start + timedelta(days=6), datetime.max.time())
    elif period == 'day' and year_int and month_int and day_int:
        # Specifieke dag
        from_date = datetime(year_int, month_int, day_int)
        to_date = datetime(year_int, month_int, day_int, 23, 59, 59)
    else:
        # Fallback naar huidige periode
        now = datetime.utcnow()
        if period == 'day':
            from_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
        elif period == 'week':
            from_date = now - timedelta(days=7)
        elif period == 'month':
            from_date = now - timedelta(days=30)
        elif period == 'year':
            from_date = now - timedelta(days=365)
        to_date = now if from_date else None
    
    # Haal beschikbare data op voor de dropdowns met aantal records
    available_years_with_count = crud.get_available_years_with_count(db, society_id)
    available_months_with_count = crud.get_available_months_with_count(db, society_id, year_int) if year_int else []
    available_weeks_with_count = crud.get_available_weeks_with_count(db, society_id, year_int) if year_int else []
    available_days_with_count = crud.get_available_days_with_count(db, society_id, year_int, month_int) if year_int and month_int else []
    
    # Converteer naar de oude format voor backward compatibility
    available_years = [year for year, count in available_years_with_count]
    available_months = [(year, month) for year, month, count in available_months_with_count]
    available_weeks = [(year, week) for year, week, count in available_weeks_with_count]
    available_days = [(year, month, day) for year, month, day, weekday, count in available_days_with_count]
    
    # Haal statistieken op
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
        "year": year,
        "month": month,
        "day": day,
        "week": week,
        "win_type": win_type,
        "most_popular_days": most_popular_days,
        "longest_win_streak": longest_win_streak,
        "win_ratios": win_ratios,
        "available_years": available_years,
        "available_months": available_months,
        "available_weeks": available_weeks,
        "available_days": available_days,
        "available_years_with_count": available_years_with_count,
        "available_months_with_count": available_months_with_count,
        "available_weeks_with_count": available_weeks_with_count,
        "available_days_with_count": available_days_with_count,
        # JSON data voor charts
        "most_wins_json": [next((p.name for p in players if p.id == pid), "Unknown") for pid in most_wins.keys()],
        "most_wins_data_json": list(most_wins.values()),
        "most_wins_colors_json": [next((p.color for p in players if p.id == pid), "#000000") for pid in most_wins.keys()],
        "most_points_json": [next((p.name for p in players if p.id == pid), "Unknown") for pid in most_points.keys()],
        "most_points_data_json": list(most_points.values()),
        "most_points_colors_json": [next((p.color for p in players if p.id == pid), "#000000") for pid in most_points.keys()],
        "most_won_task_json": [next((t.name for t in tasks if t.id == tid), "Unknown") for tid in most_won_task.keys()],
        "most_won_task_data_json": list(most_won_task.values()),
        "highest_points_json": [next((p.name for p in players if p.id == pid), "Unknown") for pid in highest_points.keys()],
        "highest_points_data_json": list(highest_points.values()),
        "highest_points_colors_json": [next((p.color for p in players if p.id == pid), "#000000") for pid in highest_points.keys()],
        "win_ratios_json": [next((p.name for p in players if p.id == pid), "Unknown") for pid in win_ratios.keys()],
        "win_ratios_data_json": [ratio * 100 for ratio in win_ratios.values()],
        "win_ratios_colors_json": [next((p.color for p in players if p.id == pid), "#000000") for pid in win_ratios.keys()],
        "most_popular_days_json": ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
        "most_popular_days_data_json": list(most_popular_days.values()),
        "longest_win_streak_json": [next((p.name for p in players if p.id == pid), "Unknown") for pid in longest_win_streak.keys()],
        "longest_win_streak_data_json": list(longest_win_streak.values()),
        "longest_win_streak_colors_json": [next((p.color for p in players if p.id == pid), "#000000") for pid in longest_win_streak.keys()],
        "players_json": {p.id: p.name for p in players},
        "players_colors_json": {p.id: p.color for p in players},
        "tasks_json": {t.id: t.name for t in tasks},
    })

def get_month_name(month_number):
    """Converteer maandnummer naar Engelse maandnaam"""
    month_names = {
        1: "January", 2: "February", 3: "March", 4: "April",
        5: "May", 6: "June", 7: "July", 8: "August",
        9: "September", 10: "October", 11: "November", 12: "December"
    }
    return month_names.get(month_number, str(month_number))



@app.get('/api/societies/{society_id}/dropdown-data')
def get_dropdown_data(society_id: int, year: str = Query(None), month: str = Query(None), db: Session = Depends(get_db)):
    """API endpoint voor het ophalen van dropdown data via AJAX"""
    year_int = int(year) if year and year.strip() else None
    month_int = int(month) if month and month.strip() else None
    
    # Haal beschikbare data op
    available_years_with_count = crud.get_available_years_with_count(db, society_id)
    available_months_with_count = crud.get_available_months_with_count(db, society_id, year_int) if year_int else []
    available_weeks_with_count = crud.get_available_weeks_with_count(db, society_id, year_int) if year_int else []
    available_days_with_count = crud.get_available_days_with_count(db, society_id, year_int, month_int) if year_int and month_int else []
    
    return {
        "years": [{"value": year, "text": f"{year} ({count})"} for year, count in available_years_with_count],
        "months": [{"value": month, "text": f"{get_month_name(month)} ({count})"} for year, month, count in available_months_with_count],
        "weeks": [{"value": week, "text": f"Week {week} ({count})"} for year, week, count in available_weeks_with_count],
        "days": [{"value": day, "text": f"{day} - {weekday} ({count})"} for year, month, day, weekday, count in available_days_with_count]
    } 