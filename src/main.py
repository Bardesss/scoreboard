from fastapi import FastAPI, Request, Depends, Form, Query
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlalchemy.orm import Session
from database import SessionLocal, engine, Base
import crud
import models
import auth
from datetime import datetime, timedelta
from starlette.middleware.sessions import SessionMiddleware
from dependencies import get_db
import os
import secrets
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

def get_common_data(db: Session):
    return {
        'players': crud.get_players(db),
        'games': crud.get_boardgames(db),
        'societies': crud.get_societies(db)
    }

def handle_form_errors(template_name: str, request: Request, errors: list, **context):
    return templates.TemplateResponse(template_name, {
        "request": request,
        "errors": errors,
        **context
    })

def sanitize_input(text: str) -> str:
    if not text:
        return ""
    import html
    return html.escape(text.strip())

app = FastAPI()

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(TrustedHostMiddleware, allowed_hosts=["*"])
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:6060", "http://127.0.0.1:6060"],
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

app.mount('/static', StaticFiles(directory='static'), name='static')
templates = Jinja2Templates(directory='templates')

Base.metadata.create_all(bind=engine)

app.add_middleware(SessionMiddleware, secret_key=secrets.token_hex(32))
app.include_router(auth.router)

@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Content-Security-Policy"] = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:;"
    return response

@app.get('/', response_class=HTMLResponse)
@limiter.limit("30/minute")
def read_root(request: Request, db: Session = Depends(get_db)):
    admin_exists = db.query(models.User).filter(models.User.is_admin == True).first()
    if not admin_exists:
        return RedirectResponse('/setup', status_code=303)
    societies = crud.get_societies(db)
    players = crud.get_players(db)
    games = crud.get_boardgames(db)
    played_games = db.query(models.PlayedGame).order_by(models.PlayedGame.played_at.desc()).limit(10).all()

    from sqlalchemy import func
    last_played_subquery = db.query(
        models.PlayedGame.society_id,
        func.max(models.PlayedGame.played_at).label('last_played')
    ).group_by(models.PlayedGame.society_id).subquery()
    
    last_played = {}
    for society_id, last_played_date in db.query(last_played_subquery.c.society_id, last_played_subquery.c.last_played).all():
        last_played[society_id] = last_played_date
    
    for s in societies:
        s.last_played = last_played.get(s.id)
    societies_sorted = sorted(
        societies,
        key=lambda s: s.last_played or datetime.min,
        reverse=True
    )

    return templates.TemplateResponse('public_home.html', {"request": request, "societies": societies_sorted, "players": players, "games": games, "played_games": played_games})
@app.get('/admin/players', response_class=HTMLResponse)
@auth.admin_required
async def list_players(request: Request, db: Session = Depends(get_db)):
    common_data = get_common_data(db)
    return templates.TemplateResponse('players.html', {"request": request, "players": common_data['players']})

@app.post('/admin/players/add')
@auth.admin_required
async def add_player(request: Request, db: Session = Depends(get_db)):
    form = await request.form()
    name = sanitize_input(form.get('name', ''))
    color = sanitize_input(form.get('color', ''))
    
    players = crud.get_players(db)
    
    errors = []
    
    if not name or name.strip() == "":
        errors.append("Please enter a player name.")
    
    if not color or color.strip() == "":
        errors.append("Please select a color.")
    
    if color and any(player.color == color for player in players):
        errors.append("This color is already in use. Please select a different color.")
    
    if errors:
        return handle_form_errors('players.html', request, errors, players=players)
    
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

@app.get('/admin/players/edit/{player_id}', response_class=HTMLResponse)
@auth.admin_required
async def edit_player_form(request: Request, player_id: int, db: Session = Depends(get_db)):
    player = db.query(models.Player).filter(models.Player.id == player_id).first()
    return templates.TemplateResponse('edit_player.html', {"request": request, "player": player})

@app.post('/admin/players/edit/{player_id}')
@auth.admin_required
async def edit_player(request: Request, player_id: int, db: Session = Depends(get_db)):
    form = await request.form()
    name = form.get('name', '')
    color = form.get('color', '')
    
    player = db.query(models.Player).filter(models.Player.id == player_id).first()
    all_players = crud.get_players(db)
    
    errors = []
    
    if not name or name.strip() == "":
        errors.append("Please enter a player name.")
    
    if not color or color.strip() == "":
        errors.append("Please select a color.")
    
    if color and any(p.color == color and p.id != player_id for p in all_players):
        errors.append("This color is already in use. Please select a different color.")
    
    if errors:
        return templates.TemplateResponse('edit_player.html', {
            "request": request,
            "player": player,
            "errors": errors
        })
    
    crud.update_player(db, player_id, name, color)
    return RedirectResponse('/admin/players', status_code=303)

@app.get('/admin/boardgames', response_class=HTMLResponse)
@auth.admin_required
async def list_boardgames(request: Request, db: Session = Depends(get_db)):
    common_data = get_common_data(db)
    return templates.TemplateResponse('boardgames.html', {"request": request, "games": common_data['games']})

@app.post('/admin/boardgames/add')
@auth.admin_required
async def add_boardgame(request: Request, db: Session = Depends(get_db)):
    form = await request.form()
    name = form.get('name', '')
    win_type = form.get('win_type', '')
    
    games = crud.get_boardgames(db)
    
    errors = []
    
    if not name or name.strip() == "":
        errors.append("Please enter a boardgame name.")
    
    if not win_type or win_type.strip() == "":
        errors.append("Please select a win type.")
    
    if errors:
        return templates.TemplateResponse('boardgames.html', {
            "request": request,
            "games": games,
            "errors": errors
        })
    
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

@app.get('/admin/boardgames/edit/{game_id}', response_class=HTMLResponse)
@auth.admin_required
async def edit_boardgame_form(request: Request, game_id: int, db: Session = Depends(get_db)):
    game = db.query(models.BoardGame).filter(models.BoardGame.id == game_id).first()
    return templates.TemplateResponse('edit_boardgame.html', {"request": request, "game": game})

@app.post('/admin/boardgames/edit/{game_id}')
@auth.admin_required
async def edit_boardgame(request: Request, game_id: int, db: Session = Depends(get_db)):
    form = await request.form()
    name = form.get('name', '')
    win_type = form.get('win_type', '')
    
    game = db.query(models.BoardGame).filter(models.BoardGame.id == game_id).first()
    
    errors = []
    
    if not name or name.strip() == "":
        errors.append("Please enter a boardgame name.")
    
    if not win_type or win_type.strip() == "":
        errors.append("Please select a win type.")
    
    if errors:
        return templates.TemplateResponse('edit_boardgame.html', {
            "request": request,
            "game": game,
            "errors": errors
        })
    
    crud.update_boardgame(db, game_id, name, win_type)
    return RedirectResponse('/admin/boardgames', status_code=303)

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
async def add_task(request: Request, db: Session = Depends(get_db)):
    form = await request.form()
    number = form.get('number', '')
    name = form.get('name', '')
    boardgame_id = form.get('boardgame_id', '')
    
    all_games = crud.get_boardgames(db)
    games = [g for g in all_games if g.win_type == 'task']
    tasks = crud.get_tasks(db, boardgame_id=boardgame_id) if boardgame_id else []
    next_number = 1
    if boardgame_id:
        existing_numbers = [task.number for task in tasks]
        while next_number in existing_numbers:
            next_number += 1
    
    errors = []
    
    if not name or name.strip() == "":
        errors.append("Please enter a task name.")
    
    if errors:
        return templates.TemplateResponse('tasks.html', {
            "request": request,
            "tasks": tasks,
            "games": games,
            "selected_boardgame_id": boardgame_id,
            "next_number": next_number,
            "errors": errors
        })
    
    try:
        number_int = int(number) if number else next_number
        boardgame_id_int = int(boardgame_id) if boardgame_id else None
    except ValueError:
        errors.append("Invalid number or boardgame ID.")
        return templates.TemplateResponse('tasks.html', {
            "request": request,
            "tasks": tasks,
            "games": games,
            "selected_boardgame_id": boardgame_id,
            "next_number": next_number,
            "errors": errors
        })
    
    crud.create_task(db, number_int, name, boardgame_id_int)
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

@app.get('/admin/tasks/edit/{task_id}', response_class=HTMLResponse)
@auth.admin_required
async def edit_task_form(request: Request, task_id: int, db: Session = Depends(get_db), boardgame_id: int = None):
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    games = crud.get_boardgames(db)
    selected_boardgame_id = boardgame_id or (task.boardgame_id if task else None)
    return templates.TemplateResponse('edit_task.html', {"request": request, "task": task, "games": games, "selected_boardgame_id": selected_boardgame_id})

@app.post('/admin/tasks/edit/{task_id}')
@auth.admin_required
async def edit_task(request: Request, task_id: int, db: Session = Depends(get_db)):
    form = await request.form()
    number = form.get('number', '')
    name = form.get('name', '')
    boardgame_id = form.get('boardgame_id', '')
    
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    games = crud.get_boardgames(db)
    selected_boardgame_id = boardgame_id or (task.boardgame_id if task else None)
    
    errors = []
    
    if not name or name.strip() == "":
        errors.append("Please enter a task name.")
    
    if errors:
        return templates.TemplateResponse('edit_task.html', {
            "request": request,
            "task": task,
            "games": games,
            "selected_boardgame_id": selected_boardgame_id,
            "errors": errors
        })
    
    try:
        number_int = int(number) if number else 1
        boardgame_id_int = int(boardgame_id) if boardgame_id else None
    except ValueError:
        errors.append("Invalid number or boardgame ID.")
        return templates.TemplateResponse('edit_task.html', {
            "request": request,
            "task": task,
            "games": games,
            "selected_boardgame_id": selected_boardgame_id,
            "errors": errors
        })
    
    if task:
        task.number = number_int
        task.name = name
        task.boardgame_id = boardgame_id_int
        db.commit()
        db.refresh(task)
    return RedirectResponse(f'/admin/tasks?boardgame_id={boardgame_id}', status_code=303)

@app.get('/admin/societies', response_class=HTMLResponse)
@auth.admin_required
async def list_societies(request: Request, db: Session = Depends(get_db)):
    common_data = get_common_data(db)
    return templates.TemplateResponse('societies.html', {"request": request, "societies": common_data['societies'], "players": common_data['players'], "games": common_data['games']})

@app.post('/admin/societies/add')
@auth.admin_required
async def add_society(request: Request, db: Session = Depends(get_db)):
    form = await request.form()
    name = form.get('name', '')
    player_ids = form.getlist('player_ids')
    boardgame_ids = form.get('boardgame_ids', '')
    societies = crud.get_societies(db)
    players = crud.get_players(db)
    games = crud.get_boardgames(db)
    
    errors = []
    
    if not name or name.strip() == "":
        errors.append("Please enter a society name.")
    
    if not player_ids or len(player_ids) < 2:
        errors.append("Please select at least 2 players.")
    
    if boardgame_ids is None or not boardgame_ids or boardgame_ids.strip() == "":
        errors.append("Please select a boardgame.")
    
    if errors:
        return templates.TemplateResponse('societies.html', {
            "request": request, 
            "societies": societies, 
            "players": players, 
            "games": games,
            "errors": errors
        })
    
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
async def edit_society(request: Request, society_id: int, db: Session = Depends(get_db)):
    form = await request.form()
    name = form.get('name', '')
    player_ids = form.getlist('player_ids')
    boardgame_ids = form.get('boardgame_ids', '')
    society = db.query(models.Society).filter(models.Society.id == society_id).first()
    players = crud.get_players(db)
    games = crud.get_boardgames(db)
    selected_players = [int(pid) for pid in society.player_ids.split(',')] if society.player_ids else []
    selected_games = [int(bid) for bid in society.boardgame_ids.split(',')] if society.boardgame_ids else []
    
    errors = []
    
    if not name or name.strip() == "":
        errors.append("Please enter a society name.")
    
    if not player_ids or len(player_ids) < 2:
        errors.append("Please select at least 2 players.")
    
    if boardgame_ids is None or not boardgame_ids or boardgame_ids.strip() == "":
        errors.append("Please select a boardgame.")
    
    if errors:
        return templates.TemplateResponse('edit_society.html', {
            "request": request, 
            "society": society, 
            "players": players, 
            "games": games, 
            "selected_players": selected_players, 
            "selected_games": selected_games,
            "errors": errors
        })
    
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

@app.get('/api/societies/{society_id}/games')
def get_played_games_paginated(society_id: int, page: int = Query(1, ge=1), limit: int = Query(20, ge=1, le=100), db: Session = Depends(get_db)):
    offset = (page - 1) * limit
    played_games = crud.get_played_games_paginated(db, society_id, offset, limit)
    total_count = crud.get_played_games_count(db, society_id)
    total_pages = (total_count + limit - 1) // limit
    
    games_data = []
    for game in played_games:
        games_data.append({
            'id': game.id,
            'played_at': game.played_at.strftime('%d/%m/%Y %H:%M'),
            'winner_id': game.winner_id,
            'winner_id_task': game.winner_id_task,
            'points': game.points,
            'task_id': game.task_id,
            'boardgame_id': game.boardgame_id
        })
    
    return {
        'games': games_data,
        'pagination': {
            'current_page': page,
            'total_pages': total_pages,
            'total_count': total_count,
            'has_next': page < total_pages,
            'has_prev': page > 1
        }
    }

@app.get('/societies/{society_id}/games/add', response_class=HTMLResponse)
@auth.admin_required
async def add_played_game_form(request: Request, society_id: int, db: Session = Depends(get_db)):
    society = db.query(models.Society).filter(models.Society.id == society_id).first()
    games = crud.get_boardgames(db)
    player_ids = [int(pid) for pid in society.player_ids.split(',')] if society.player_ids else []
    all_players = crud.get_players(db)
    players = [p for p in all_players if p.id in player_ids]
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
async def add_played_game(request: Request, society_id: int, db: Session = Depends(get_db)):
    form = await request.form()
    boardgame_id = form.get('boardgame_id', '')
    win_type = form.get('win_type', '')
    played_at = form.get('played_at', '')
    
    society = db.query(models.Society).filter(models.Society.id == society_id).first()
    games = crud.get_boardgames(db)
    player_ids = [int(pid) for pid in society.player_ids.split(',')] if society.player_ids else []
    all_players = crud.get_players(db)
    players = [p for p in all_players if p.id in player_ids]
    selected_boardgame_id = int(society.boardgame_ids.split(',')[0]) if society.boardgame_ids else None
    selected_game = db.query(models.BoardGame).filter(models.BoardGame.id == selected_boardgame_id).first() if selected_boardgame_id else None
    selected_win_type = selected_game.win_type if selected_game else None
    tasks = crud.get_tasks(db, boardgame_id=selected_boardgame_id) if selected_win_type == 'task' else []
    
    errors = []
    
    if not played_at or played_at.strip() == "":
        errors.append("Please enter a date and time.")
    else:
        try:
            played_at_dt = datetime.fromisoformat(played_at)
            if played_at_dt > datetime.now():
                errors.append("The date cannot be in the future!")
        except ValueError:
            errors.append("Please enter a valid date and time.")
    
    if selected_win_type == 'winner':
        winner_id = form.get('winner_id', '')
        if not winner_id or winner_id.strip() == "":
            errors.append("Please select a winner.")
    
    elif selected_win_type == 'points':
        points_entered = False
        for key, value in form.items():
            if key.startswith('points_') and value.strip() != "":
                points_entered = True
                break
        if not points_entered:
            errors.append("Please enter points for at least one player.")
    
    elif selected_win_type == 'task':
        task_id = form.get('task_id', '')
        winner_id_task = form.get('winner_id_task', '')
        if not task_id or task_id.strip() == "":
            errors.append("Please select a task.")
        if not winner_id_task or winner_id_task.strip() == "":
            errors.append("Please select a task winner.")
    
    if errors:
        return templates.TemplateResponse('add_played_game.html', {
            "request": request,
            "society": society,
            "games": games,
            "players": players,
            "selected_game": selected_game,
            "win_type": selected_win_type,
            "tasks": tasks,
            "now": datetime.now(),
            "errors": errors
        })
    
    data = {}
    form = await request.form()
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
    return templates.TemplateResponse('edit_played_game.html', {"request": request, "played_game": played_game, "society": society, "games": games, "players": players, "selected_game": selected_game, "win_type": win_type, "tasks": tasks, "now": datetime.now()})

@app.post('/societies/{society_id}/games/edit/{game_id}')
@auth.admin_required
async def edit_played_game(request: Request, society_id: int, game_id: int, db: Session = Depends(get_db)):
    form = await request.form()
    boardgame_id = form.get('boardgame_id', '')
    win_type = form.get('win_type', '')
    played_at = form.get('played_at', '')
    
    played_game = db.query(models.PlayedGame).filter(models.PlayedGame.id == game_id).first()
    society = db.query(models.Society).filter(models.Society.id == society_id).first()
    games = crud.get_boardgames(db)
    players = crud.get_players(db)
    selected_game = db.query(models.BoardGame).filter(models.BoardGame.id == played_game.boardgame_id).first()
    selected_win_type = selected_game.win_type if selected_game else None
    tasks = crud.get_tasks(db, boardgame_id=played_game.boardgame_id) if selected_win_type == 'task' else []
    
    errors = []
    
    if not played_at or played_at.strip() == "":
        errors.append("Please enter a date and time.")
    else:
        try:
            played_at_dt = datetime.fromisoformat(played_at)
            if played_at_dt > datetime.now():
                errors.append("The date cannot be in the future!")
        except ValueError:
            errors.append("Please enter a valid date and time.")
    
    if selected_win_type == 'winner':
        winner_id = form.get('winner_id', '')
        if not winner_id or winner_id.strip() == "":
            errors.append("Please select a winner.")
    
    elif selected_win_type == 'points':
        points_entered = False
        for key, value in form.items():
            if key.startswith('points_') and value.strip() != "":
                points_entered = True
                break
        if not points_entered:
            errors.append("Please enter points for at least one player.")
    
    elif selected_win_type == 'task':
        task_id = form.get('task_id', '')
        winner_id_task = form.get('winner_id_task', '')
        if not task_id or task_id.strip() == "":
            errors.append("Please select a task.")
        if not winner_id_task or winner_id_task.strip() == "":
            errors.append("Please select a task winner.")
    
    if errors:
        return templates.TemplateResponse('edit_played_game.html', {
            "request": request,
            "played_game": played_game,
            "society": society,
            "games": games,
            "players": players,
            "selected_game": selected_game,
            "win_type": selected_win_type,
            "tasks": tasks,
            "now": datetime.now(),
            "errors": errors
        })
    
    data = {}
    form = await request.form()
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
    year_int = int(year) if year and year.strip() else None
    month_int = int(month) if month and month.strip() else None
    day_int = int(day) if day and day.strip() else None
    week_int = int(week) if week and week.strip() else None
    from_date = None
    to_date = None
    
    if period == 'all':
        pass
    elif period == 'year' and year_int:
        from_date = datetime(year_int, 1, 1)
        to_date = datetime(year_int, 12, 31, 23, 59, 59)
    elif period == 'month' and year_int and month_int:
        from_date = datetime(year_int, month_int, 1)
        if month_int == 12:
            to_date = datetime(year_int + 1, 1, 1) - timedelta(seconds=1)
        else:
            to_date = datetime(year_int, month_int + 1, 1) - timedelta(seconds=1)
    elif period == 'week' and year_int and week_int:
        from datetime import date
        jan1 = date(year_int, 1, 1)
        week_start = jan1 + timedelta(weeks=week_int)
        from_date = datetime.combine(week_start, datetime.min.time())
        to_date = datetime.combine(week_start + timedelta(days=6), datetime.max.time())
    elif period == 'day' and year_int and month_int and day_int:
        from_date = datetime(year_int, month_int, day_int)
        to_date = datetime(year_int, month_int, day_int, 23, 59, 59)
    else:
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
    
    available_years_with_count = crud.get_available_years_with_count(db, society_id)
    available_months_with_count = crud.get_available_months_with_count(db, society_id, year_int) if year_int else []
    available_weeks_with_count = crud.get_available_weeks_with_count(db, society_id, year_int) if year_int else []
    available_days_with_count = crud.get_available_days_with_count(db, society_id, year_int, month_int) if year_int and month_int else []
    
    available_years = [year for year, count in available_years_with_count]
    available_months = [(year, month) for year, month, count in available_months_with_count]
    available_weeks = [(year, week) for year, week, count in available_weeks_with_count]
    available_days = [(year, month, day) for year, month, day, weekday, count in available_days_with_count]
    
    players = crud.get_players(db)
    tasks = crud.get_tasks(db)
    most_wins = crud.get_stats_most_wins(db, society_id, from_date, to_date)
    most_points = crud.get_stats_most_points(db, society_id, from_date, to_date)
    most_won_task = crud.get_stats_most_won_task(db, society_id, from_date, to_date)
    highest_points = crud.get_stats_highest_points_per_game(db, society_id, from_date, to_date)
    society = db.query(models.Society).filter(models.Society.id == society_id).first()
    
    boardgame_id = int(society.boardgame_ids.split(',')[0]) if society.boardgame_ids else None
    boardgame = db.query(models.BoardGame).filter(models.BoardGame.id == boardgame_id).first() if boardgame_id else None
    win_type = boardgame.win_type if boardgame else None
    
    most_popular_days = crud.get_stats_most_popular_days(db, society_id, from_date, to_date)
    longest_win_streak = crud.get_stats_longest_win_streak(db, society_id, from_date, to_date)
    games_played = crud.get_stats_games_played(db, society_id, from_date, to_date)
    
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
    month_names = {
        1: "January", 2: "February", 3: "March", 4: "April",
        5: "May", 6: "June", 7: "July", 8: "August",
        9: "September", 10: "October", 11: "November", 12: "December"
    }
    return month_names.get(month_number, str(month_number))



@app.get('/api/societies/{society_id}/dropdown-data')
def get_dropdown_data(society_id: int, year: str = Query(None), month: str = Query(None), db: Session = Depends(get_db)):
    year_int = int(year) if year and year.strip() else None
    month_int = int(month) if month and month.strip() else None
    
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
