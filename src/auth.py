from fastapi import APIRouter, Request, Form, Depends, Response, HTTPException
from fastapi.responses import RedirectResponse
from starlette.middleware.sessions import SessionMiddleware
from passlib.context import CryptContext
from database import SessionLocal
from models import User
from fastapi.templating import Jinja2Templates
from functools import wraps
from dependencies import get_db
from datetime import datetime
from slowapi import Limiter
from slowapi.util import get_remote_address
import asyncio

router = APIRouter()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
templates = Jinja2Templates(directory="templates")
limiter = Limiter(key_func=get_remote_address)

def verify_password(plain, hashed):
    return pwd_context.verify(plain, hashed)

def get_password_hash(password):
    return pwd_context.hash(password)

def get_current_user(request: Request, db=Depends(get_db)):
    user_id = request.session.get('user_id')
    if not user_id:
        return None
    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.is_active:
        return None
    return user

def login_required(func):
    @wraps(func)
    async def wrapper(*args, **kwargs):
        request = kwargs.get('request')
        if not request or not request.session.get('user_id'):
            return RedirectResponse('/login', status_code=303)
        if asyncio.iscoroutinefunction(func):
            return await func(*args, **kwargs)
        else:
            return func(*args, **kwargs)
    return wrapper

def admin_required(func):
    @wraps(func)
    async def wrapper(*args, **kwargs):
        request = kwargs.get('request')
        if not request or not request.session.get('is_admin'):
            return RedirectResponse('/login', status_code=303)
        if asyncio.iscoroutinefunction(func):
            return await func(*args, **kwargs)
        else:
            return func(*args, **kwargs)
    return wrapper

@router.get('/login')
@limiter.limit("30/minute")
def login_form(request: Request):
    return templates.TemplateResponse('login.html', {"request": request})

@router.post('/login')
@limiter.limit("10/minute")
def login(request: Request, username: str = Form(...), password: str = Form(...), remember_me: str = Form(None), db=Depends(get_db)):
    user = db.query(User).filter(User.username == username).first()
    if not user or not verify_password(password, user.hashed_password):
        return templates.TemplateResponse('login.html', {"request": request, "error": "Invalid credentials"})
    
    if not user.is_active:
        return templates.TemplateResponse('login.html', {"request": request, "error": "Your account is not active. Please contact an administrator."})
    
    user.last_login = datetime.utcnow()
    db.commit()
    
    request.session['user_id'] = user.id
    request.session['is_admin'] = user.is_admin
    request.session['username'] = user.username
    
    response = RedirectResponse('/', status_code=303)
    if remember_me:
        max_age = 60 * 60 * 24 * 30
        session_cookie = request.cookies.get('session')
        if session_cookie:
            response.set_cookie('session', session_cookie, max_age=max_age)
    return response

@router.get('/logout')
def logout(request: Request):
    request.session.clear()
    return RedirectResponse('/', status_code=303)

@router.get('/register')
@limiter.limit("30/minute")
def register_form(request: Request):
    return templates.TemplateResponse('register.html', {"request": request})

@router.post('/register')
@limiter.limit("5/minute")
def register(request: Request, username: str = Form(...), password: str = Form(...), confirm_password: str = Form(...), db=Depends(get_db)):
    errors = []
    
    if not username or len(username) < 3:
        errors.append("Username must be at least 3 characters long")
    
    if not password or len(password) < 6:
        errors.append("Password must be at least 6 characters long")
    
    if password != confirm_password:
        errors.append("Passwords do not match")
    
    existing_user = db.query(User).filter(User.username == username).first()
    if existing_user:
        errors.append("Username already exists")
    
    if errors:
        return templates.TemplateResponse('register.html', {"request": request, "errors": errors})
    
    user = User(
        username=username,
        hashed_password=get_password_hash(password),
        is_admin=False,
        is_active=True,
        created_at=datetime.utcnow()
    )
    db.add(user)
    db.commit()
    
    request.session['user_id'] = user.id
    request.session['is_admin'] = user.is_admin
    request.session['username'] = user.username
    
    return RedirectResponse('/', status_code=303)

@router.get('/setup')
def setup_form(request: Request, db=Depends(get_db)):
    admin_exists = db.query(User).filter(User.is_admin == True).first()
    if admin_exists:
        return RedirectResponse('/login', status_code=303)
    return templates.TemplateResponse('setup.html', {"request": request})

@router.post('/setup')
def setup(request: Request, username: str = Form(...), password: str = Form(...), db=Depends(get_db)):
    admin_exists = db.query(User).filter(User.is_admin == True).first()
    if admin_exists:
        return RedirectResponse('/login', status_code=303)
    
    user = User(
        username=username,
        hashed_password=get_password_hash(password),
        is_admin=True,
        is_active=True,
        created_at=datetime.utcnow()
    )
    db.add(user)
    db.commit()
    
    request.session['user_id'] = user.id
    request.session['is_admin'] = user.is_admin
    request.session['username'] = user.username
    
    return RedirectResponse('/', status_code=303)

@router.get('/admin/users')
@admin_required
def list_users(request: Request, db=Depends(get_db)):
    users = db.query(User).order_by(User.created_at.desc()).all()
    return templates.TemplateResponse('users.html', {"request": request, "users": users})

@router.post('/admin/users/{user_id}/toggle-active')
@admin_required
def toggle_user_active(request: Request, user_id: int, db=Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if user and not user.is_admin:
        user.is_active = not user.is_active
        db.commit()
    return RedirectResponse('/admin/users', status_code=303)

@router.post('/admin/users/{user_id}/reset-password')
@admin_required
def reset_user_password(request: Request, user_id: int, new_password: str = Form(...), db=Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if user:
        user.hashed_password = get_password_hash(new_password)
        db.commit()
    return RedirectResponse('/admin/users', status_code=303) 