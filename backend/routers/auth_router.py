from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
from sqlalchemy.orm import Session

import database
import auth

router = APIRouter(prefix="/api/auth", tags=["auth"])


class RegisterRequest(BaseModel):
    email: str
    password: str


@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(body: RegisterRequest, db: Session = Depends(database.get_db)):
    if db.query(database.User).filter(database.User.email == body.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    user = database.User(
        email=body.email,
        hashed_pw=auth.get_password_hash(body.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = auth.create_access_token(
        {"sub": user.email},
        timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    return {"access_token": token, "token_type": "bearer", "user": {"id": user.id, "email": user.email}}


@router.post("/login")
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(database.get_db)):
    user = db.query(database.User).filter(database.User.email == form.username).first()
    if not user or not auth.verify_password(form.password, user.hashed_pw):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = auth.create_access_token(
        {"sub": user.email},
        timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    return {"access_token": token, "token_type": "bearer", "user": {"id": user.id, "email": user.email}}


@router.get("/me")
def me(current_user: database.User = Depends(auth.get_current_user)):
    return {"id": current_user.id, "email": current_user.email}
