from fastapi import APIRouter, Depends, HTTPException, status, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID

from app.database import get_db
from app.auth import hash_password, verify_password, create_access_token, decode_access_token, credentials_exception
from app.schemas.auth import SignupRequest, LoginRequest, TokenResponse, UserResponse
from app.models.user import User

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/signup", response_model=TokenResponse)
async def signup(request: SignupRequest, db: AsyncSession = Depends(get_db)):
    # Check if username exists
    result = await db.execute(select(User).where(User.username == request.username))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Username already taken")
    
    # Check if email exists
    result = await db.execute(select(User).where(User.email == request.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create user
    user = User(
        username=request.username,
        email=request.email,
        password_hash=hash_password(request.password)
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    
    # Create token
    token = create_access_token({"user_id": str(user.id), "username": user.username, "email": user.email})
    
    return TokenResponse(
        access_token=token,
        user={"id": str(user.id), "username": user.username, "email": user.email}
    )


@router.post("/login", response_model=TokenResponse)
async def login(request: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == request.email))
    user = result.scalar_one_or_none()
    
    if not user or not verify_password(request.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_access_token({"user_id": str(user.id), "username": user.username, "email": user.email})
    
    return TokenResponse(
        access_token=token,
        user={"id": str(user.id), "username": user.username, "email": user.email}
    )


@router.get("/me", response_model=UserResponse)
async def get_current_user(
    authorization: str = Header(None),
    db: AsyncSession = Depends(get_db)
):
    # Authorization header is expected as: "Bearer <token>"
    if not authorization or not authorization.startswith("Bearer "):
        raise credentials_exception
    token = authorization.split(" ", 1)[1].strip()
    payload = decode_access_token(token)
    
    if not payload:
        raise credentials_exception
    
    user_id = payload.get("user_id")
    result = await db.execute(select(User).where(User.id == UUID(user_id)))
    user = result.scalar_one_or_none()
    
    if not user:
        raise credentials_exception
    
    return UserResponse(
        id=user.id,
        username=user.username,
        email=user.email,
        created_at=user.created_at
    )
