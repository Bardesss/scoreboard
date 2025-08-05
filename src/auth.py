from fastapi import APIRouter, Request, Form, Depends, Response
from fastapi.responses import RedirectResponse
from starlette.middleware.sessions import SessionMiddleware
from passlib.context import CryptContext
from database import SessionLocal
from models import User
from fastapi.templating import Jinja2Templates
from functools import wraps
from fastapi import HTTPException
from dependencies import get_db

router = APIRouter()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
templates = Jinja2Templates(directory="templates")





def verify_password(plain, hashed):
    return pwd_context.verify(plain, hashed)

def get_password_hash(password):
    return pwd_context.hash(password)

@router.get('/login')
def login_form(request: Request):
    return templates.TemplateResponse('login.html', {"request": request})

@router.post('/login')
def login(request: Request, username: str = Form(...), password: str = Form(...), remember_me: str = Form(None), db=Depends(get_db)):
    user = db.query(User).filter(User.username == username).first()
    if not user or not verify_password(password, user.hashed_password):
        return templates.TemplateResponse('login.html', {"request": request, "error": "Invalid credentials"})
    request.session['user_id'] = user.id
    request.session['is_admin'] = user.is_admin
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
    user = User(username=username, hashed_password=get_password_hash(password), is_admin=True)
    db.add(user)
    db.commit()
    request.session['user_id'] = user.id
    request.session['is_admin'] = user.is_admin
    return RedirectResponse('/', status_code=303)

def admin_required(func):
    @wraps(func)
    async def wrapper(*args, **kwargs):
        request = kwargs.get('request')
        if not request or not request.session.get('is_admin'):
            return RedirectResponse('/login', status_code=303)
        return await func(*args, **kwargs)
    return wrapper 