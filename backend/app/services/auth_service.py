"""Minimal JWT-based auth. In-memory user store for demo purposes —
swap for a real DB table in production."""
from datetime import datetime, timedelta
from typing import Optional
import bcrypt

from jose import jwt, JWTError

from app.config import settings

# In-memory user table: username -> {hashed_password, role}
_users = {}

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode('utf-8'), hashed.encode('utf-8'))
    except ValueError:
        return False

def _seed_default_admin():
    if settings.default_admin_user not in _users:
        _users[settings.default_admin_user] = {
            "hashed_password": hash_password(settings.default_admin_password),
            "role": "admin",
        }

_seed_default_admin()


def get_user(username: str) -> Optional[dict]:
    return _users.get(username)


def create_user(username: str, password: str, role: str = "viewer"):
    _users[username] = {"hashed_password": hash_password(password), "role": role}


def authenticate_user(username: str, password: str) -> Optional[dict]:
    user = get_user(username)
    if not user or not verify_password(password, user["hashed_password"]):
        return None
    return {"username": username, "role": user["role"]}


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=settings.access_token_expire_minutes)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)


def decode_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
    except JWTError:
        return None
