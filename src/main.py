from fastapi import FastAPI, Request, Depends, Form, Query
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlalchemy.orm import Session
from database import SessionLocal, engine, Base, run_migrations
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

def get_user_permissions(request: Request, db: Session):
    user_id = request.session.get('user_id')
    is_admin = request.session.get('is_admin', False)
    return user_id, is_admin

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

run_migrations()

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
@auth.login_required
async def list_players(request: Request, db: Session = Depends(get_db)):
    user_id, is_admin = get_user_permissions(request, db)
    players = crud.get_players(db)
    return templates.TemplateResponse('players.html', {"request": request, "players": players, "user_id": user_id, "is_admin": is_admin})

@app.post('/admin/players/add')
@auth.login_required
async def add_player(request: Request, db: Session = Depends(get_db)):
    user_id, is_admin = get_user_permissions(request, db)
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
        return handle_form_errors('players.html', request, errors, players=players, user_id=user_id, is_admin=is_admin)
    
    crud.create_player(db, name, color, user_id)
    return RedirectResponse('/admin/players', status_code=303)

@app.post('/admin/players/delete/{player_id}')
@auth.login_required
async def delete_player(request: Request, player_id: int, db: Session = Depends(get_db)):
    user_id, is_admin = get_user_permissions(request, db)
    
    if not crud.can_edit_player(db, player_id, user_id, is_admin):
        return RedirectResponse('/admin/players', status_code=303)
    
    try:
        crud.delete_player(db, player_id)
        return RedirectResponse('/admin/players', status_code=303)
    except ValueError as e:
        players = crud.get_players(db)
        return templates.TemplateResponse('players.html', {
            "request": request,
            "players": players,
            "error": str(e),
            "user_id": user_id,
            "is_admin": is_admin
        })

@app.get('/admin/players/edit/{player_id}', response_class=HTMLResponse)
@auth.login_required
async def edit_player_form(request: Request, player_id: int, db: Session = Depends(get_db)):
    user_id, is_admin = get_user_permissions(request, db)
    
    if not crud.can_edit_player(db, player_id, user_id, is_admin):
        return RedirectResponse('/admin/players', status_code=303)
    
    player = db.query(models.Player).filter(models.Player.id == player_id).first()
    return templates.TemplateResponse('edit_player.html', {"request": request, "player": player, "user_id": user_id, "is_admin": is_admin})

@app.post('/admin/players/edit/{player_id}')
@auth.login_required
async def edit_player(request: Request, player_id: int, db: Session = Depends(get_db)):
    user_id, is_admin = get_user_permissions(request, db)
    
    if not crud.can_edit_player(db, player_id, user_id, is_admin):
        return RedirectResponse('/admin/players', status_code=303)
    
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
            "errors": errors,
            "user_id": user_id,
            "is_admin": is_admin
        })
    
    crud.update_player(db, player_id, name, color)
    return RedirectResponse('/admin/players', status_code=303)

@app.get('/admin/boardgames', response_class=HTMLResponse)
@auth.login_required
async def list_boardgames(request: Request, db: Session = Depends(get_db)):
    user_id, is_admin = get_user_permissions(request, db)
    games = crud.get_boardgames(db)
    return templates.TemplateResponse('boardgames.html', {"request": request, "games": games, "user_id": user_id, "is_admin": is_admin})

@app.post('/admin/boardgames/add')
@auth.login_required
async def add_boardgame(request: Request, db: Session = Depends(get_db)):
    user_id, is_admin = get_user_permissions(request, db)
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
            "errors": errors,
            "user_id": user_id,
            "is_admin": is_admin
        })
    
    crud.create_boardgame(db, name, win_type, user_id)
    return RedirectResponse('/admin/boardgames', status_code=303)

@app.post('/admin/boardgames/delete/{game_id}')
@auth.login_required
async def delete_boardgame(request: Request, game_id: int, db: Session = Depends(get_db)):
    user_id, is_admin = get_user_permissions(request, db)
    game = db.query(models.BoardGame).filter(models.BoardGame.id == game_id).first()
    
    if not game:
        return RedirectResponse('/admin/boardgames', status_code=303)
    
    if not is_admin and game.created_by_user_id != user_id:
        return RedirectResponse('/admin/boardgames', status_code=303)
    
    try:
        crud.delete_boardgame(db, game_id)
        return RedirectResponse('/admin/boardgames', status_code=303)
    except ValueError as e:
        games = crud.get_boardgames(db)
        return templates.TemplateResponse('boardgames.html', {
            "request": request,
            "games": games,
            "error": str(e),
            "user_id": user_id,
            "is_admin": is_admin
        })

@app.get('/admin/boardgames/edit/{game_id}', response_class=HTMLResponse)
@auth.login_required
async def edit_boardgame_form(request: Request, game_id: int, db: Session = Depends(get_db)):
    user_id, is_admin = get_user_permissions(request, db)
    game = db.query(models.BoardGame).filter(models.BoardGame.id == game_id).first()
    
    if not game:
        return RedirectResponse('/admin/boardgames', status_code=303)
    
    if not is_admin and game.created_by_user_id != user_id:
        return RedirectResponse('/admin/boardgames', status_code=303)
    
    return templates.TemplateResponse('edit_boardgame.html', {"request": request, "game": game, "user_id": user_id, "is_admin": is_admin})

@app.post('/admin/boardgames/edit/{game_id}')
@auth.login_required
async def edit_boardgame(request: Request, game_id: int, db: Session = Depends(get_db)):
    user_id, is_admin = get_user_permissions(request, db)
    game = db.query(models.BoardGame).filter(models.BoardGame.id == game_id).first()
    
    if not game:
        return RedirectResponse('/admin/boardgames', status_code=303)
    
    if not is_admin and game.created_by_user_id != user_id:
        return RedirectResponse('/admin/boardgames', status_code=303)
    
    form = await request.form()
    name = form.get('name', '')
    win_type = form.get('win_type', '')
    
    errors = []
    
    if not name or name.strip() == "":
        errors.append("Please enter a boardgame name.")
    
    if not win_type or win_type.strip() == "":
        errors.append("Please select a win type.")
    
    if errors:
        user_id, is_admin = get_user_permissions(request, db)
        return templates.TemplateResponse('edit_boardgame.html', {
            "request": request,
            "game": game,
            "errors": errors,
            "user_id": user_id,
            "is_admin": is_admin
        })
    
    crud.update_boardgame(db, game_id, name, win_type)
    return RedirectResponse('/admin/boardgames', status_code=303)

@app.get('/admin/tasks', response_class=HTMLResponse)
@auth.login_required
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
    user_id, is_admin = get_user_permissions(request, db)
    
    # Check if user can add tasks to the selected board game
    can_add_task = False
    if selected_boardgame_id:
        can_add_task = crud.can_add_task_to_boardgame(db, selected_boardgame_id, user_id, is_admin)
    
    return templates.TemplateResponse('tasks.html', {
        "request": request, 
        "tasks": tasks, 
        "games": games, 
        "all_games": all_games, 
        "selected_boardgame_id": selected_boardgame_id, 
        "next_number": next_number, 
        "user_id": user_id, 
        "is_admin": is_admin,
        "can_add_task": can_add_task
    })

@app.post('/admin/tasks/add')
@auth.login_required
async def add_task(request: Request, db: Session = Depends(get_db)):
    user_id, is_admin = get_user_permissions(request, db)
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
    
    # Check if user can add tasks to this board game
    if boardgame_id:
        try:
            boardgame_id_int = int(boardgame_id)
            if not crud.can_add_task_to_boardgame(db, boardgame_id_int, user_id, is_admin):
                errors.append("You can only add tasks to board games that you created.")
        except ValueError:
            errors.append("Invalid board game ID.")
    
    if errors:
        user_id, is_admin = get_user_permissions(request, db)
        
        # Check if user can add tasks to the selected board game
        can_add_task = False
        if boardgame_id:
            try:
                boardgame_id_int = int(boardgame_id)
                can_add_task = crud.can_add_task_to_boardgame(db, boardgame_id_int, user_id, is_admin)
            except ValueError:
                pass
        
        return templates.TemplateResponse('tasks.html', {
            "request": request,
            "tasks": tasks,
            "games": games,
            "all_games": all_games,
            "selected_boardgame_id": boardgame_id,
            "next_number": next_number,
            "errors": errors,
            "user_id": user_id,
            "is_admin": is_admin,
            "can_add_task": can_add_task
        })
    
    try:
        number_int = int(number) if number else next_number
        boardgame_id_int = int(boardgame_id) if boardgame_id else None
    except ValueError:
        errors.append("Invalid number or boardgame ID.")
        user_id, is_admin = get_user_permissions(request, db)
        
        # Check if user can add tasks to the selected board game
        can_add_task = False
        if boardgame_id:
            try:
                boardgame_id_int = int(boardgame_id)
                can_add_task = crud.can_add_task_to_boardgame(db, boardgame_id_int, user_id, is_admin)
            except ValueError:
                pass
        
        return templates.TemplateResponse('tasks.html', {
            "request": request,
            "tasks": tasks,
            "games": games,
            "all_games": all_games,
            "selected_boardgame_id": boardgame_id,
            "next_number": next_number,
            "errors": errors,
            "user_id": user_id,
            "is_admin": is_admin,
            "can_add_task": can_add_task
        })
    
    crud.create_task(db, number_int, name, boardgame_id_int, user_id)
    return RedirectResponse(f'/admin/tasks?boardgame_id={boardgame_id}', status_code=303)

@app.post('/admin/tasks/delete/{task_id}')
@auth.login_required
async def delete_task(request: Request, task_id: int, db: Session = Depends(get_db), boardgame_id: int = None):
    user_id, is_admin = get_user_permissions(request, db)
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    
    if not task:
        boardgame_id_param = f'?boardgame_id={boardgame_id}' if boardgame_id else ''
        return RedirectResponse(f'/admin/tasks{boardgame_id_param}', status_code=303)
    
    if not is_admin and task.created_by_user_id != user_id:
        boardgame_id_param = f'?boardgame_id={boardgame_id}' if boardgame_id else ''
        return RedirectResponse(f'/admin/tasks{boardgame_id_param}', status_code=303)
    
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
            "error": str(e),
            "user_id": user_id,
            "is_admin": is_admin
        })

@app.get('/admin/tasks/edit/{task_id}', response_class=HTMLResponse)
@auth.login_required
async def edit_task_form(request: Request, task_id: int, db: Session = Depends(get_db), boardgame_id: int = None):
    user_id, is_admin = get_user_permissions(request, db)
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    
    if not task:
        return RedirectResponse('/admin/tasks', status_code=303)
    
    if not is_admin and task.created_by_user_id != user_id:
        return RedirectResponse('/admin/tasks', status_code=303)
    
    games = crud.get_boardgames(db)
    selected_boardgame_id = boardgame_id or (task.boardgame_id if task else None)
    return templates.TemplateResponse('edit_task.html', {"request": request, "task": task, "games": games, "selected_boardgame_id": selected_boardgame_id, "user_id": user_id, "is_admin": is_admin})

@app.post('/admin/tasks/edit/{task_id}')
@auth.login_required
async def edit_task(request: Request, task_id: int, db: Session = Depends(get_db)):
    user_id, is_admin = get_user_permissions(request, db)
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    
    if not task:
        return RedirectResponse('/admin/tasks', status_code=303)
    
    if not is_admin and task.created_by_user_id != user_id:
        return RedirectResponse('/admin/tasks', status_code=303)
    
    form = await request.form()
    number = form.get('number', '')
    name = form.get('name', '')
    boardgame_id = form.get('boardgame_id', '')
    games = crud.get_boardgames(db)
    selected_boardgame_id = boardgame_id or (task.boardgame_id if task else None)
    
    errors = []
    
    if not name or name.strip() == "":
        errors.append("Please enter a task name.")
    
    if errors:
        user_id, is_admin = get_user_permissions(request, db)
        return templates.TemplateResponse('edit_task.html', {
            "request": request,
            "task": task,
            "games": games,
            "selected_boardgame_id": selected_boardgame_id,
            "errors": errors,
            "user_id": user_id,
            "is_admin": is_admin
        })
    
    try:
        number_int = int(number) if number else 1
        boardgame_id_int = int(boardgame_id) if boardgame_id else None
    except ValueError:
        errors.append("Invalid number or boardgame ID.")
        user_id, is_admin = get_user_permissions(request, db)
        return templates.TemplateResponse('edit_task.html', {
            "request": request,
            "task": task,
            "games": games,
            "selected_boardgame_id": selected_boardgame_id,
            "errors": errors,
            "user_id": user_id,
            "is_admin": is_admin
        })
    
    if task:
        task.number = number_int
        task.name = name
        task.boardgame_id = boardgame_id_int
        db.commit()
        db.refresh(task)
    return RedirectResponse(f'/admin/tasks?boardgame_id={boardgame_id}', status_code=303)

@app.get('/admin/societies', response_class=HTMLResponse)
@auth.login_required
async def list_societies(request: Request, db: Session = Depends(get_db)):
    common_data = get_common_data(db)
    user_id, is_admin = get_user_permissions(request, db)
    return templates.TemplateResponse('societies.html', {"request": request, "societies": common_data['societies'], "players": common_data['players'], "games": common_data['games'], "user_id": user_id, "is_admin": is_admin})

@app.post('/admin/societies/add')
@auth.login_required
async def add_society(request: Request, db: Session = Depends(get_db)):
    user_id, is_admin = get_user_permissions(request, db)
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
        user_id, is_admin = get_user_permissions(request, db)
        return templates.TemplateResponse('societies.html', {
            "request": request, 
            "societies": societies, 
            "players": players, 
            "games": games,
            "errors": errors,
            "user_id": user_id,
            "is_admin": is_admin
        })
    
    crud.create_society(db, name, player_ids, [boardgame_ids], user_id)
    return RedirectResponse('/admin/societies', status_code=303)

@app.get('/admin/societies/edit/{society_id}', response_class=HTMLResponse)
@auth.login_required
async def edit_society_form(request: Request, society_id: int, db: Session = Depends(get_db)):
    user_id, is_admin = get_user_permissions(request, db)
    society = db.query(models.Society).filter(models.Society.id == society_id).first()
    
    if not society:
        return RedirectResponse('/admin/societies', status_code=303)
    
    if not is_admin and society.created_by_user_id != user_id:
        return RedirectResponse('/admin/societies', status_code=303)
    
    players = crud.get_players(db)
    games = crud.get_boardgames(db)
    selected_players = [int(pid) for pid in society.player_ids.split(',')] if society.player_ids else []
    selected_games = [int(bid) for bid in society.boardgame_ids.split(',')] if society.boardgame_ids else []
    return templates.TemplateResponse('edit_society.html', {"request": request, "society": society, "players": players, "games": games, "selected_players": selected_players, "selected_games": selected_games, "user_id": user_id, "is_admin": is_admin})

@app.post('/admin/societies/edit/{society_id}')
@auth.login_required
async def edit_society(request: Request, society_id: int, db: Session = Depends(get_db)):
    user_id, is_admin = get_user_permissions(request, db)
    society = db.query(models.Society).filter(models.Society.id == society_id).first()
    
    if not society:
        return RedirectResponse('/admin/societies', status_code=303)
    
    if not is_admin and society.created_by_user_id != user_id:
        return RedirectResponse('/admin/societies', status_code=303)
    
    form = await request.form()
    name = form.get('name', '')
    player_ids = form.getlist('player_ids')
    boardgame_ids = form.get('boardgame_ids', '')
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
@auth.login_required
async def delete_society(request: Request, society_id: int, db: Session = Depends(get_db)):
    user_id, is_admin = get_user_permissions(request, db)
    society = db.query(models.Society).filter(models.Society.id == society_id).first()
    
    if not society:
        return RedirectResponse('/admin/societies', status_code=303)
    
    if not is_admin and society.created_by_user_id != user_id:
        return RedirectResponse('/admin/societies', status_code=303)
    
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
            'boardgame_id': game.boardgame_id,
            'created_by_user_id': game.created_by_user_id
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
@auth.login_required
async def add_played_game_form(request: Request, society_id: int, db: Session = Depends(get_db)):
    user_id, is_admin = get_user_permissions(request, db)
    society = db.query(models.Society).filter(models.Society.id == society_id).first()
    
    if not society:
        return RedirectResponse('/admin/societies', status_code=303)
    
    if not is_admin and (not society.created_by_user_id or society.created_by_user_id != user_id):
        return RedirectResponse(f'/societies/{society_id}/games', status_code=303)
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
@auth.login_required
async def add_played_game(request: Request, society_id: int, db: Session = Depends(get_db)):
    user_id, is_admin = get_user_permissions(request, db)
    society = db.query(models.Society).filter(models.Society.id == society_id).first()
    
    if not society:
        return RedirectResponse('/admin/societies', status_code=303)
    
    if not is_admin and (not society.created_by_user_id or society.created_by_user_id != user_id):
        return RedirectResponse(f'/societies/{society_id}/games', status_code=303)
    
    form = await request.form()
    boardgame_id = form.get('boardgame_id', '')
    win_type = form.get('win_type', '')
    played_at = form.get('played_at', '')
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
        winner_id_points = form.get('winner_id_points', '')
        winner_points = form.get('winner_points', '')
        if not winner_id_points or winner_id_points.strip() == "":
            errors.append("Please select a winner.")
        if not winner_points or winner_points.strip() == "":
            errors.append("Please enter the winner's points.")
        else:
            try:
                int(winner_points)
            except ValueError:
                errors.append("Please enter a valid number for winner's points.")
    
    elif selected_win_type == 'highest_points':
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
        data['winner_id'] = int(form['winner_id_points'])
        data['winner_points'] = int(form['winner_points'])
    elif win_type == 'highest_points':
        points = {k.split('_')[1]: int(v) for k, v in form.items() if k.startswith('points_') and v.strip() != ""}
        # Only include points for players who participated
        points = {k: v for k, v in points.items() if int(k) in present_players}
        data['points'] = points
    elif win_type == 'task':
        data['winner_id_task'] = int(form['winner_id_task'])
        data['task_id'] = int(form['task_id'])
    crud.create_played_game(db, society_id, boardgame_id, win_type, data, user_id)
    return RedirectResponse(f'/societies/{society_id}/games', status_code=303)

@app.get('/societies/{society_id}/games/edit/{game_id}', response_class=HTMLResponse)
@auth.login_required
async def edit_played_game_form(request: Request, society_id: int, game_id: int, db: Session = Depends(get_db)):
    user_id, is_admin = get_user_permissions(request, db)
    played_game = db.query(models.PlayedGame).filter(models.PlayedGame.id == game_id).first()
    
    if not played_game:
        return RedirectResponse(f'/societies/{society_id}/games', status_code=303)
    
    if not is_admin and played_game.created_by_user_id != user_id:
        return RedirectResponse(f'/societies/{society_id}/games', status_code=303)
    
    society = db.query(models.Society).filter(models.Society.id == society_id).first()
    games = crud.get_boardgames(db)
    players = crud.get_players(db)
    selected_game = db.query(models.BoardGame).filter(models.BoardGame.id == played_game.boardgame_id).first()
    win_type = selected_game.win_type if selected_game else None
    tasks = crud.get_tasks(db, boardgame_id=played_game.boardgame_id) if win_type == 'task' else []
    return templates.TemplateResponse('edit_played_game.html', {"request": request, "played_game": played_game, "society": society, "games": games, "players": players, "selected_game": selected_game, "win_type": win_type, "tasks": tasks, "now": datetime.now(), "user_id": user_id, "is_admin": is_admin})

@app.post('/societies/{society_id}/games/edit/{game_id}')
@auth.login_required
async def edit_played_game(request: Request, society_id: int, game_id: int, db: Session = Depends(get_db)):
    user_id, is_admin = get_user_permissions(request, db)
    played_game = db.query(models.PlayedGame).filter(models.PlayedGame.id == game_id).first()
    
    if not played_game:
        return RedirectResponse(f'/societies/{society_id}/games', status_code=303)
    
    if not is_admin and played_game.created_by_user_id != user_id:
        return RedirectResponse(f'/societies/{society_id}/games', status_code=303)
    
    form = await request.form()
    boardgame_id = form.get('boardgame_id', '')
    win_type = form.get('win_type', '')
    played_at = form.get('played_at', '')
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
        winner_id_points = form.get('winner_id_points', '')
        winner_points = form.get('winner_points', '')
        if not winner_id_points or winner_id_points.strip() == "":
            errors.append("Please select a winner.")
        if not winner_points or winner_points.strip() == "":
            errors.append("Please enter the winner's points.")
        else:
            try:
                int(winner_points)
            except ValueError:
                errors.append("Please enter a valid number for winner's points.")
    
    elif selected_win_type == 'highest_points':
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
        data['winner_id'] = int(form['winner_id_points'])
        data['winner_points'] = int(form['winner_points'])
    elif win_type == 'highest_points':
        points = {k.split('_')[1]: int(v) for k, v in form.items() if k.startswith('points_') and v.strip() != ""}
        # Only include points for players who participated
        points = {k: v for k, v in points.items() if int(k) in present_players}
        data['points'] = points
    elif win_type == 'task':
        data['winner_id_task'] = int(form['winner_id_task'])
        data['task_id'] = int(form['task_id'])
    crud.update_played_game(db, game_id, boardgame_id, win_type, data)
    return RedirectResponse(f'/societies/{society_id}/games', status_code=303)

@app.post('/societies/{society_id}/games/delete/{game_id}')
@auth.login_required
async def delete_played_game(request: Request, society_id: int, game_id: int, db: Session = Depends(get_db)):
    user_id, is_admin = get_user_permissions(request, db)
    played_game = db.query(models.PlayedGame).filter(models.PlayedGame.id == game_id).first()
    
    if not played_game:
        return RedirectResponse(f'/societies/{society_id}/games', status_code=303)
    
    if not is_admin and played_game.created_by_user_id != user_id:
        return RedirectResponse(f'/societies/{society_id}/games', status_code=303)
    
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
        if played > 0 and wins > 0:
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

@app.get('/api/societies/{society_id}/stats')
def get_society_stats_json(society_id: int, period: str = Query('all'), 
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
        if played > 0 and wins > 0:
            win_ratios[pid] = wins / played
    
    return {
        "most_wins": {
            "labels": [next((p.name for p in players if p.id == pid), "Unknown") for pid in most_wins.keys()],
            "data": list(most_wins.values()),
            "colors": [next((p.color for p in players if p.id == pid), "#000000") for pid in most_wins.keys()]
        },
        "most_points": {
            "labels": [next((p.name for p in players if p.id == pid), "Unknown") for pid in most_points.keys()],
            "data": list(most_points.values()),
            "colors": [next((p.color for p in players if p.id == pid), "#000000") for pid in most_points.keys()]
        },
        "most_won_task": {
            "labels": [next((t.name for t in tasks if t.id == tid), "Unknown") for tid in most_won_task.keys()],
            "data": list(most_won_task.values()),
            "colors": [f"hsl({(i * 137.5) % 360}, 70%, 80%)" for i in range(len(most_won_task))]
        },
        "highest_points": {
            "labels": [next((p.name for p in players if p.id == pid), "Unknown") for pid in highest_points.keys()],
            "data": list(highest_points.values()),
            "colors": [next((p.color for p in players if p.id == pid), "#000000") for pid in highest_points.keys()]
        },
        "win_ratios": {
            "labels": [next((p.name for p in players if p.id == pid), "Unknown") for pid in win_ratios.keys()],
            "data": [ratio * 100 for ratio in win_ratios.values()],
            "colors": [next((p.color for p in players if p.id == pid), "#000000") for pid in win_ratios.keys()]
        },
        "most_popular_days": {
            "labels": [['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][day] for day in most_popular_days.keys()],
            "data": list(most_popular_days.values()),
            "colors": [f"hsl({(day * 137.5) % 360}, 70%, 80%)" for day in most_popular_days.keys()]
        },
        "longest_win_streak": {
            "labels": [next((p.name for p in players if p.id == pid), "Unknown") for pid in longest_win_streak.keys()],
            "data": list(longest_win_streak.values()),
            "colors": [next((p.color for p in players if p.id == pid), "#000000") for pid in longest_win_streak.keys()]
        },
        "win_type": win_type,
        "society_player_count": len(society.player_ids.split(',')) if society.player_ids else 0
    } 

# ============================================================================
# JSON API ENDPOINTS
# ============================================================================

# Players API
@app.get('/api/players')
def get_players_api(db: Session = Depends(get_db)):
    """Get all players"""
    players = crud.get_players(db)
    return [{"id": p.id, "name": p.name, "color": p.color, "created_by_user_id": p.created_by_user_id} for p in players]

@app.get('/api/players/{player_id}')
def get_player_api(player_id: int, db: Session = Depends(get_db)):
    """Get a specific player by ID"""
    player = db.query(models.Player).filter(models.Player.id == player_id).first()
    if not player:
        return {"error": "Player not found"}, 404
    return {"id": player.id, "name": player.name, "color": player.color, "created_by_user_id": player.created_by_user_id}

@app.post('/api/players')
@auth.login_required
async def create_player_api(request: Request, db: Session = Depends(get_db)):
    """Create a new player"""
    user_id, is_admin = get_user_permissions(request, db)
    form = await request.form()
    name = sanitize_input(form.get('name', ''))
    color = form.get('color', '#000000')
    
    if not name:
        return {"error": "Name is required"}, 400
    
    player = crud.create_player(db, name, color, user_id)
    return {"id": player.id, "name": player.name, "color": player.color, "created_by_user_id": player.created_by_user_id}

@app.put('/api/players/{player_id}')
@auth.login_required
async def update_player_api(request: Request, player_id: int, db: Session = Depends(get_db)):
    """Update a player"""
    user_id, is_admin = get_user_permissions(request, db)
    
    if not crud.can_edit_player(db, player_id, user_id, is_admin):
        return {"error": "Permission denied"}, 403
    
    form = await request.form()
    name = sanitize_input(form.get('name', ''))
    color = form.get('color', '#000000')
    
    if not name:
        return {"error": "Name is required"}, 400
    
    player = crud.update_player(db, player_id, name, color)
    return {"id": player.id, "name": player.name, "color": player.color, "created_by_user_id": player.created_by_user_id}

@app.delete('/api/players/{player_id}')
@auth.login_required
async def delete_player_api(request: Request, player_id: int, db: Session = Depends(get_db)):
    """Delete a player"""
    user_id, is_admin = get_user_permissions(request, db)
    
    if not crud.can_edit_player(db, player_id, user_id, is_admin):
        return {"error": "Permission denied"}, 403
    
    crud.delete_player(db, player_id)
    return {"message": "Player deleted successfully"}

# Board Games API
@app.get('/api/boardgames')
def get_boardgames_api(db: Session = Depends(get_db)):
    """Get all board games"""
    games = crud.get_boardgames(db)
    return [{"id": g.id, "name": g.name, "win_type": g.win_type, "created_by_user_id": g.created_by_user_id} for g in games]

@app.get('/api/boardgames/{game_id}')
def get_boardgame_api(game_id: int, db: Session = Depends(get_db)):
    """Get a specific board game by ID"""
    game = db.query(models.BoardGame).filter(models.BoardGame.id == game_id).first()
    if not game:
        return {"error": "Board game not found"}, 404
    return {"id": game.id, "name": game.name, "win_type": game.win_type, "created_by_user_id": game.created_by_user_id}

@app.post('/api/boardgames')
@auth.login_required
async def create_boardgame_api(request: Request, db: Session = Depends(get_db)):
    """Create a new board game"""
    user_id, is_admin = get_user_permissions(request, db)
    form = await request.form()
    name = sanitize_input(form.get('name', ''))
    win_type = form.get('win_type', '')
    
    if not name or not win_type:
        return {"error": "Name and win_type are required"}, 400
    
    game = crud.create_boardgame(db, name, win_type, user_id)
    return {"id": game.id, "name": game.name, "win_type": game.win_type, "created_by_user_id": game.created_by_user_id}

@app.put('/api/boardgames/{game_id}')
@auth.login_required
async def update_boardgame_api(request: Request, game_id: int, db: Session = Depends(get_db)):
    """Update a board game"""
    user_id, is_admin = get_user_permissions(request, db)
    
    if not crud.can_edit_boardgame(db, game_id, user_id, is_admin):
        return {"error": "Permission denied"}, 403
    
    form = await request.form()
    name = sanitize_input(form.get('name', ''))
    win_type = form.get('win_type', '')
    
    if not name or not win_type:
        return {"error": "Name and win_type are required"}, 400
    
    game = crud.update_boardgame(db, game_id, name, win_type)
    return {"id": game.id, "name": game.name, "win_type": game.win_type, "created_by_user_id": game.created_by_user_id}

@app.delete('/api/boardgames/{game_id}')
@auth.login_required
async def delete_boardgame_api(request: Request, game_id: int, db: Session = Depends(get_db)):
    """Delete a board game"""
    user_id, is_admin = get_user_permissions(request, db)
    
    if not crud.can_edit_boardgame(db, game_id, user_id, is_admin):
        return {"error": "Permission denied"}, 403
    
    crud.delete_boardgame(db, game_id)
    return {"message": "Board game deleted successfully"}

# Tasks API
@app.get('/api/tasks')
def get_tasks_api(boardgame_id: int = Query(None), db: Session = Depends(get_db)):
    """Get all tasks, optionally filtered by board game"""
    tasks = crud.get_tasks(db, boardgame_id)
    return [{"id": t.id, "number": t.number, "name": t.name, "boardgame_id": t.boardgame_id, "created_by_user_id": t.created_by_user_id} for t in tasks]

@app.get('/api/tasks/{task_id}')
def get_task_api(task_id: int, db: Session = Depends(get_db)):
    """Get a specific task by ID"""
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not task:
        return {"error": "Task not found"}, 404
    return {"id": task.id, "number": task.number, "name": task.name, "boardgame_id": task.boardgame_id, "created_by_user_id": task.created_by_user_id}

@app.post('/api/tasks')
@auth.login_required
async def create_task_api(request: Request, db: Session = Depends(get_db)):
    """Create a new task"""
    user_id, is_admin = get_user_permissions(request, db)
    form = await request.form()
    number = form.get('number', '')
    name = sanitize_input(form.get('name', ''))
    boardgame_id = form.get('boardgame_id', '')
    
    if not name or not boardgame_id:
        return {"error": "Name and boardgame_id are required"}, 400
    
    try:
        number_int = int(number) if number else 1
        boardgame_id_int = int(boardgame_id)
    except ValueError:
        return {"error": "Invalid number or boardgame_id"}, 400
    
    if not crud.can_add_task_to_boardgame(db, boardgame_id_int, user_id, is_admin):
        return {"error": "Permission denied"}, 403
    
    task = crud.create_task(db, number_int, name, boardgame_id_int, user_id)
    return {"id": task.id, "number": task.number, "name": task.name, "boardgame_id": task.boardgame_id, "created_by_user_id": task.created_by_user_id}

@app.put('/api/tasks/{task_id}')
@auth.login_required
async def update_task_api(request: Request, task_id: int, db: Session = Depends(get_db)):
    """Update a task"""
    user_id, is_admin = get_user_permissions(request, db)
    
    if not crud.can_edit_task(db, task_id, user_id, is_admin):
        return {"error": "Permission denied"}, 403
    
    form = await request.form()
    number = form.get('number', '')
    name = sanitize_input(form.get('name', ''))
    boardgame_id = form.get('boardgame_id', '')
    
    if not name or not boardgame_id:
        return {"error": "Name and boardgame_id are required"}, 400
    
    try:
        number_int = int(number) if number else 1
        boardgame_id_int = int(boardgame_id)
    except ValueError:
        return {"error": "Invalid number or boardgame_id"}, 400
    
    task = crud.update_task(db, task_id, number_int, name, boardgame_id_int)
    return {"id": task.id, "number": task.number, "name": task.name, "boardgame_id": task.boardgame_id, "created_by_user_id": task.created_by_user_id}

@app.delete('/api/tasks/{task_id}')
@auth.login_required
async def delete_task_api(request: Request, task_id: int, db: Session = Depends(get_db)):
    """Delete a task"""
    user_id, is_admin = get_user_permissions(request, db)
    
    if not crud.can_edit_task(db, task_id, user_id, is_admin):
        return {"error": "Permission denied"}, 403
    
    crud.delete_task(db, task_id)
    return {"message": "Task deleted successfully"}

# Societies API
@app.get('/api/societies')
def get_societies_api(db: Session = Depends(get_db)):
    """Get all societies"""
    societies = crud.get_societies(db)
    return [{"id": s.id, "name": s.name, "player_ids": s.player_ids, "boardgame_ids": s.boardgame_ids, "created_by_user_id": s.created_by_user_id} for s in societies]

@app.get('/api/societies/{society_id}')
def get_society_api(society_id: int, db: Session = Depends(get_db)):
    """Get a specific society by ID"""
    society = db.query(models.Society).filter(models.Society.id == society_id).first()
    if not society:
        return {"error": "Society not found"}, 404
    return {"id": society.id, "name": society.name, "player_ids": society.player_ids, "boardgame_ids": society.boardgame_ids, "created_by_user_id": society.created_by_user_id}

@app.post('/api/societies')
@auth.login_required
async def create_society_api(request: Request, db: Session = Depends(get_db)):
    """Create a new society"""
    user_id, is_admin = get_user_permissions(request, db)
    form = await request.form()
    name = sanitize_input(form.get('name', ''))
    player_ids = form.getlist('player_ids') if hasattr(form, 'getlist') else [form.get('player_ids', '')]
    boardgame_ids = form.getlist('boardgame_ids') if hasattr(form, 'getlist') else [form.get('boardgame_ids', '')]
    
    if not name:
        return {"error": "Name is required"}, 400
    
    try:
        player_ids_int = [int(pid) for pid in player_ids if pid]
        boardgame_ids_int = [int(bid) for bid in boardgame_ids if bid]
    except ValueError:
        return {"error": "Invalid player_ids or boardgame_ids"}, 400
    
    society = crud.create_society(db, name, player_ids_int, boardgame_ids_int, user_id)
    return {"id": society.id, "name": society.name, "player_ids": society.player_ids, "boardgame_ids": society.boardgame_ids, "created_by_user_id": society.created_by_user_id}

@app.put('/api/societies/{society_id}')
@auth.login_required
async def update_society_api(request: Request, society_id: int, db: Session = Depends(get_db)):
    """Update a society"""
    user_id, is_admin = get_user_permissions(request, db)
    
    if not crud.can_edit_society(db, society_id, user_id, is_admin):
        return {"error": "Permission denied"}, 403
    
    form = await request.form()
    name = sanitize_input(form.get('name', ''))
    player_ids = form.getlist('player_ids') if hasattr(form, 'getlist') else [form.get('player_ids', '')]
    boardgame_ids = form.getlist('boardgame_ids') if hasattr(form, 'getlist') else [form.get('boardgame_ids', '')]
    
    if not name:
        return {"error": "Name is required"}, 400
    
    try:
        player_ids_int = [int(pid) for pid in player_ids if pid]
        boardgame_ids_int = [int(bid) for bid in boardgame_ids if bid]
    except ValueError:
        return {"error": "Invalid player_ids or boardgame_ids"}, 400
    
    society = crud.update_society(db, society_id, name, player_ids_int, boardgame_ids_int)
    return {"id": society.id, "name": society.name, "player_ids": society.player_ids, "boardgame_ids": society.boardgame_ids, "created_by_user_id": society.created_by_user_id}

@app.delete('/api/societies/{society_id}')
@auth.login_required
async def delete_society_api(request: Request, society_id: int, db: Session = Depends(get_db)):
    """Delete a society"""
    user_id, is_admin = get_user_permissions(request, db)
    
    if not crud.can_edit_society(db, society_id, user_id, is_admin):
        return {"error": "Permission denied"}, 403
    
    crud.delete_society(db, society_id)
    return {"message": "Society deleted successfully"}

# Played Games API
@app.get('/api/played-games')
def get_played_games_api(society_id: int = Query(None), db: Session = Depends(get_db)):
    """Get all played games, optionally filtered by society"""
    games = crud.get_played_games(db, society_id)
    return [{"id": g.id, "society_id": g.society_id, "boardgame_id": g.boardgame_id, "win_type": g.win_type, "winner_id": g.winner_id, "winner_id_task": g.winner_id_task, "points": g.points, "task_id": g.task_id, "played_at": g.played_at.isoformat(), "created_by_user_id": g.created_by_user_id} for g in games]

@app.get('/api/played-games/{game_id}')
def get_played_game_api(game_id: int, db: Session = Depends(get_db)):
    """Get a specific played game by ID"""
    game = db.query(models.PlayedGame).filter(models.PlayedGame.id == game_id).first()
    if not game:
        return {"error": "Played game not found"}, 404
    return {"id": game.id, "society_id": game.society_id, "boardgame_id": game.boardgame_id, "win_type": game.win_type, "winner_id": game.winner_id, "winner_id_task": game.winner_id_task, "points": game.points, "task_id": game.task_id, "played_at": game.played_at.isoformat(), "created_by_user_id": game.created_by_user_id}

@app.post('/api/played-games')
@auth.login_required
async def create_played_game_api(request: Request, db: Session = Depends(get_db)):
    """Create a new played game"""
    user_id, is_admin = get_user_permissions(request, db)
    form = await request.form()
    
    society_id = form.get('society_id', '')
    boardgame_id = form.get('boardgame_id', '')
    win_type = form.get('win_type', '')
    
    if not society_id or not boardgame_id or not win_type:
        return {"error": "society_id, boardgame_id, and win_type are required"}, 400
    
    try:
        society_id_int = int(society_id)
        boardgame_id_int = int(boardgame_id)
    except ValueError:
        return {"error": "Invalid society_id or boardgame_id"}, 400
    
    # Build data dict based on win_type
    data = {}
    if win_type == 'winner':
        winner_id = form.get('winner_id', '')
        if winner_id:
            data['winner_id'] = int(winner_id)
    elif win_type == 'points':
        points = form.get('points', '')
        if points:
            data['points'] = points
    elif win_type == 'highest_points':
        points = form.get('points', '')
        if points:
            data['points'] = points
    elif win_type == 'task':
        task_id = form.get('task_id', '')
        winner_id_task = form.get('winner_id_task', '')
        if task_id and winner_id_task:
            data['task_id'] = int(task_id)
            data['winner_id_task'] = int(winner_id_task)
    
    game = crud.create_played_game(db, society_id_int, boardgame_id_int, win_type, data, user_id)
    return {"id": game.id, "society_id": game.society_id, "boardgame_id": game.boardgame_id, "win_type": game.win_type, "winner_id": game.winner_id, "winner_id_task": game.winner_id_task, "points": game.points, "task_id": game.task_id, "played_at": game.played_at.isoformat(), "created_by_user_id": game.created_by_user_id}

@app.put('/api/played-games/{game_id}')
@auth.login_required
async def update_played_game_api(request: Request, game_id: int, db: Session = Depends(get_db)):
    """Update a played game"""
    user_id, is_admin = get_user_permissions(request, db)
    
    if not crud.can_edit_played_game(db, game_id, user_id, is_admin):
        return {"error": "Permission denied"}, 403
    
    form = await request.form()
    boardgame_id = form.get('boardgame_id', '')
    win_type = form.get('win_type', '')
    
    if not boardgame_id or not win_type:
        return {"error": "boardgame_id and win_type are required"}, 400
    
    try:
        boardgame_id_int = int(boardgame_id)
    except ValueError:
        return {"error": "Invalid boardgame_id"}, 400
    
    # Build data dict based on win_type
    data = {}
    if win_type == 'winner':
        winner_id = form.get('winner_id', '')
        if winner_id:
            data['winner_id'] = int(winner_id)
    elif win_type == 'points':
        points = form.get('points', '')
        if points:
            data['points'] = points
    elif win_type == 'highest_points':
        points = form.get('points', '')
        if points:
            data['points'] = points
    elif win_type == 'task':
        task_id = form.get('task_id', '')
        winner_id_task = form.get('winner_id_task', '')
        if task_id and winner_id_task:
            data['task_id'] = int(task_id)
            data['winner_id_task'] = int(winner_id_task)
    
    game = crud.update_played_game(db, game_id, boardgame_id_int, win_type, data)
    return {"id": game.id, "society_id": game.society_id, "boardgame_id": game.boardgame_id, "win_type": game.win_type, "winner_id": game.winner_id, "winner_id_task": game.winner_id_task, "points": game.points, "task_id": game.task_id, "played_at": game.played_at.isoformat(), "created_by_user_id": game.created_by_user_id}

@app.delete('/api/played-games/{game_id}')
@auth.login_required
async def delete_played_game_api(request: Request, game_id: int, db: Session = Depends(get_db)):
    """Delete a played game"""
    user_id, is_admin = get_user_permissions(request, db)
    
    if not crud.can_edit_played_game(db, game_id, user_id, is_admin):
        return {"error": "Permission denied"}, 403
    
    crud.delete_played_game(db, game_id)
    return {"message": "Played game deleted successfully"}
