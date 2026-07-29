from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm

from app.models.schemas import Token, UserCreate
from app.services.auth_service import authenticate_user, create_access_token, create_user, get_user
from app.dependencies import require_role

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends()):
    user = authenticate_user(form_data.username, form_data.password)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect username or password")
    token = create_access_token({"sub": user["username"], "role": user["role"]})
    return Token(access_token=token)


@router.post("/users", status_code=201)
def add_user(payload: UserCreate, user: dict = Depends(require_role("admin"))):
    if get_user(payload.username):
        raise HTTPException(status_code=400, detail="Username already exists")
    create_user(payload.username, payload.password, payload.role)
    return {"username": payload.username, "role": payload.role, "created_by": user["username"]}
