import os
import uuid
import logging
import math
from pathlib import Path
from datetime import datetime, timezone, timedelta, date

import jwt
import bcrypt
import httpx
import requests
from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Form
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import Response
from fastapi.concurrency import run_in_threadpool
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any

import seed_data

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ.get('JWT_SECRET', 'forge-fitness-dev-secret-change-me')
JWT_ALGO = 'HS256'
TOKEN_DAYS = 30
SUPER_ADMIN_EMAIL = "myscraptv@gmail.com"

UPLOAD_DIR = ROOT_DIR / 'uploads'
UPLOAD_DIR.mkdir(exist_ok=True)

# ----------------------------- object storage -----------------------------
STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")
APP_NAME = "forge-fitness"
_storage_key = None


def init_storage():
    global _storage_key
    if _storage_key:
        return _storage_key
    resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
    resp.raise_for_status()
    _storage_key = resp.json()["storage_key"]
    return _storage_key


def put_object(path: str, data: bytes, content_type: str) -> dict:
    global _storage_key
    key = init_storage()
    resp = requests.put(f"{STORAGE_URL}/objects/{path}",
                        headers={"X-Storage-Key": key, "Content-Type": content_type}, data=data, timeout=120)
    if resp.status_code == 503:
        _storage_key = None
        key = init_storage()
        resp = requests.put(f"{STORAGE_URL}/objects/{path}",
                            headers={"X-Storage-Key": key, "Content-Type": content_type}, data=data, timeout=120)
    resp.raise_for_status()
    return resp.json()


def get_object(path: str):
    global _storage_key
    key = init_storage()
    resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    if resp.status_code == 503:
        _storage_key = None
        key = init_storage()
        resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")

app = FastAPI(title="Forge Fitness API")
api_router = APIRouter(prefix="/api")
bearer = HTTPBearer(auto_error=False)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("forge")


# ----------------------------- helpers -----------------------------
def now_utc():
    return datetime.now(timezone.utc)


def new_id():
    return uuid.uuid4().hex


def today_str():
    return date.today().isoformat()


def hash_pw(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


def verify_pw(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False


def make_token(user_id: str) -> str:
    payload = {"sub": user_id, "iat": now_utc(), "exp": now_utc() + timedelta(days=TOKEN_DAYS)}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)


def level_from_xp(xp: int) -> int:
    # each level needs progressively more xp; level n needs 100*n^1.5 cumulative-ish
    return max(1, int((xp / 100) ** 0.6) + 1)


def xp_for_level(level: int) -> int:
    return int(((level - 1) / 1.0) ** (1 / 0.6) * 100) if level > 1 else 0


async def get_current_user(creds: Optional[HTTPAuthorizationCredentials] = Depends(bearer)) -> dict:
    err = HTTPException(status_code=401, detail="auth.invalid_token")
    if not creds or creds.scheme.lower() != "bearer":
        raise err
    try:
        payload = jwt.decode(creds.credentials, JWT_SECRET, algorithms=[JWT_ALGO])
        uid = payload["sub"]
    except Exception:
        raise err
    user = await db.users.find_one({"id": uid}, {"_id": 0})
    if not user or user.get("disabled"):
        raise err
    return user


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="auth.admin_required")
    return user


def public_user(u: dict) -> dict:
    u = dict(u)
    u.pop("password_hash", None)
    u.pop("_id", None)
    return u


# ----------------------------- models -----------------------------
class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    name: Optional[str] = None


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class ProfileIn(BaseModel):
    name: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None  # male/female/other
    height: Optional[float] = None  # cm
    weight: Optional[float] = None  # kg
    target_weight: Optional[float] = None
    goal: Optional[str] = None  # muscle_gain/fat_loss/maintenance/strength
    activity_level: Optional[str] = None  # sedentary/light/moderate/active/very_active
    birthdate: Optional[str] = None
    units: Optional[str] = None
    onboarded: Optional[bool] = None


class SettingsIn(BaseModel):
    language: Optional[str] = None
    units: Optional[str] = None
    notifications: Optional[Dict[str, bool]] = None
    default_rest: Optional[int] = None
    rest_autostart: Optional[bool] = None
    water_goal: Optional[int] = None


class SuggestIn(BaseModel):
    names: List[str]


class EquipmentIn(BaseModel):
    equipment: List[str]


class WeightIn(BaseModel):
    weight: float
    date: Optional[str] = None


class MeasurementIn(BaseModel):
    date: Optional[str] = None
    waist: Optional[float] = None
    chest: Optional[float] = None
    arms: Optional[float] = None
    legs: Optional[float] = None
    hips: Optional[float] = None
    shoulders: Optional[float] = None


class FoodIn(BaseModel):
    name: str
    brand: Optional[str] = "Custom"
    calories: float
    protein: float
    carbs: float
    fat: float
    barcode: Optional[str] = None


class DiaryIn(BaseModel):
    date: Optional[str] = None
    meal: str  # breakfast/lunch/dinner/snack
    name: str
    quantity: float = 100  # grams
    calories: float
    protein: float
    carbs: float
    fat: float
    food_id: Optional[str] = None


class WaterIn(BaseModel):
    date: Optional[str] = None
    ml: int


class SetLog(BaseModel):
    reps: float = 0
    weight: float = 0
    done: bool = False


class SessionExercise(BaseModel):
    exercise_name: str
    muscle_group: Optional[str] = None
    sets: List[SetLog] = []


class SessionIn(BaseModel):
    date: Optional[str] = None
    name: str
    plan_id: Optional[str] = None
    duration: int = 0  # seconds
    exercises: List[SessionExercise] = []


class PlanExerciseIn(BaseModel):
    exercise_name: str
    sets: int = 3
    reps: str = "10"
    weight: float = 0
    rest: int = 90


class PlanDayIn(BaseModel):
    name: str
    exercises: List[PlanExerciseIn] = []


class PlanIn(BaseModel):
    name: str
    level: str = "beginner"
    goal: str = "general_fitness"
    split: str = "custom"
    description: Optional[str] = ""
    days: List[PlanDayIn] = []


class CycleIn(BaseModel):
    week_start: str
    days: Dict[str, Any]  # {mon: {type, plan_id, day_index, plan_name}, ...}


class TranslationIn(BaseModel):
    lang: str
    key: str
    value: str


# ----------------------------- nutrition / calorie math -----------------------------
def compute_metrics(profile: dict) -> dict:
    h = profile.get("height")
    w = profile.get("weight")
    tw = profile.get("target_weight")
    age = profile.get("age") or 25
    gender = profile.get("gender") or "male"
    goal = profile.get("goal") or "maintenance"
    activity = profile.get("activity_level") or "moderate"

    out = {"bmi": None, "tdee": None, "calorie_target": None, "macros": None,
           "weeks_to_goal": None, "weekly_rate": None, "weight_to_go": None}
    if h and w and h > 0:
        bmi = w / ((h / 100) ** 2)
        out["bmi"] = round(bmi, 1)
    if h and w:
        s = 5 if gender == "male" else -161
        bmr = 10 * w + 6.25 * h - 5 * age + s
        mult = {"sedentary": 1.2, "light": 1.375, "moderate": 1.55, "active": 1.725, "very_active": 1.9}.get(activity, 1.55)
        tdee = bmr * mult
        out["tdee"] = round(tdee)
        adj = 0
        if goal == "fat_loss":
            adj = -0.20
        elif goal in ("muscle_gain",):
            adj = 0.12
        elif goal == "strength":
            adj = 0.08
        target = tdee * (1 + adj)
        out["calorie_target"] = round(target)
        # macros
        protein_g = round(w * (2.2 if goal in ("muscle_gain", "strength", "fat_loss") else 1.8))
        fat_g = round((target * 0.25) / 9)
        carbs_g = max(0, round((target - protein_g * 4 - fat_g * 9) / 4))
        out["macros"] = {"protein": protein_g, "carbs": carbs_g, "fat": fat_g}
    if w and tw:
        diff = tw - w
        out["weight_to_go"] = round(diff, 1)
        # realistic weekly rate
        if diff < 0:  # losing
            rate = -0.6
        elif diff > 0:  # gaining
            rate = 0.25
        else:
            rate = 0
        out["weekly_rate"] = rate
        if rate != 0:
            out["weeks_to_goal"] = max(1, math.ceil(abs(diff) / abs(rate)))
    return out


# ----------------------------- gamification -----------------------------
async def award_xp(user_id: str, amount: int):
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        return
    g = user.get("gamification", {}) or {}
    xp = int(g.get("xp", 0)) + amount
    lvl = level_from_xp(xp)
    prev_lvl = g.get("level", 1)
    g["xp"] = xp
    g["level"] = lvl
    await db.users.update_one({"id": user_id}, {"$set": {"gamification": g}})
    if lvl >= 5:
        await unlock_achievement(user_id, "level_5")
    if lvl >= 10:
        await unlock_achievement(user_id, "level_10")


async def unlock_achievement(user_id: str, code: str):
    existing = await db.user_achievements.find_one({"user_id": user_id, "code": code})
    if existing:
        return None
    ach = await db.achievements.find_one({"code": code}, {"_id": 0})
    if not ach:
        return None
    await db.user_achievements.insert_one({
        "id": new_id(), "user_id": user_id, "code": code, "unlocked_at": now_utc().isoformat()
    })
    if ach.get("xp"):
        await award_xp(user_id, ach["xp"])
    return ach


async def update_streak(user_id: str):
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    g = user.get("gamification", {}) or {}
    last = g.get("last_active_date")
    today = today_str()
    yesterday = (date.today() - timedelta(days=1)).isoformat()
    if last == today:
        pass
    elif last == yesterday:
        g["streak"] = int(g.get("streak", 0)) + 1
    else:
        g["streak"] = 1
    g["last_active_date"] = today
    g["best_streak"] = max(int(g.get("best_streak", 0)), int(g.get("streak", 0)))
    await db.users.update_one({"id": user_id}, {"$set": {"gamification": g}})
    if g.get("streak", 0) >= 7:
        await unlock_achievement(user_id, "streak_7")
    if g.get("streak", 0) >= 30:
        await unlock_achievement(user_id, "streak_30")


# ============================= AUTH =============================
@api_router.post("/auth/register")
async def register(body: RegisterIn):
    email = body.email.strip().lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(409, "auth.email_unavailable")
    uid = new_id()
    doc = {
        "id": uid, "email": email, "password_hash": hash_pw(body.password),
        "is_admin": email == SUPER_ADMIN_EMAIL, "disabled": False, "created_at": now_utc().isoformat(),
        "profile": {"name": body.name or email.split("@")[0], "onboarded": False, "units": "metric"},
        "settings": {"language": "en", "units": "metric",
                     "notifications": {"workout": True, "meal": True, "water": True, "weight": True, "rest": True, "pr": True}},
        "equipment": ["bodyweight", "dumbbells"],
        "gamification": {"xp": 0, "level": 1, "streak": 0, "best_streak": 0, "last_active_date": None},
    }
    await db.users.insert_one(doc)
    return {"access_token": make_token(uid), "token_type": "bearer", "user": public_user(doc)}


@api_router.post("/auth/login")
async def login(body: LoginIn):
    email = body.email.strip().lower()
    user = await db.users.find_one({"email": email}, {"_id": 0})
    if not user or not verify_pw(body.password, user.get("password_hash", "")):
        raise HTTPException(401, "auth.invalid_credentials")
    if user.get("disabled"):
        raise HTTPException(403, "auth.account_disabled")
    if user["email"] == SUPER_ADMIN_EMAIL and not user.get("is_admin"):
        await db.users.update_one({"id": user["id"]}, {"$set": {"is_admin": True}})
        user["is_admin"] = True
    return {"access_token": make_token(user["id"]), "token_type": "bearer", "user": public_user(user)}


@api_router.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return public_user(user)


# ============================= PROFILE =============================
@api_router.put("/profile")
async def update_profile(body: ProfileIn, user: dict = Depends(get_current_user)):
    profile = user.get("profile", {})
    updates = {k: v for k, v in body.dict().items() if v is not None}
    profile.update(updates)
    await db.users.update_one({"id": user["id"]}, {"$set": {"profile": profile}})
    fresh = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    return public_user(fresh)


@api_router.get("/profile/metrics")
async def profile_metrics(user: dict = Depends(get_current_user)):
    return compute_metrics(user.get("profile", {}))


@api_router.put("/settings")
async def update_settings(body: SettingsIn, user: dict = Depends(get_current_user)):
    settings = user.get("settings", {})
    updates = {k: v for k, v in body.dict().items() if v is not None}
    settings.update(updates)
    await db.users.update_one({"id": user["id"]}, {"$set": {"settings": settings}})
    return settings


@api_router.get("/equipment")
async def list_equipment():
    return {"equipment": seed_data.EQUIPMENT, "muscle_groups": seed_data.MUSCLE_GROUPS}


@api_router.put("/profile/equipment")
async def set_equipment(body: EquipmentIn, user: dict = Depends(get_current_user)):
    await db.users.update_one({"id": user["id"]}, {"$set": {"equipment": body.equipment}})
    return {"equipment": body.equipment}


# ============================= WEIGHT & MEASUREMENTS =============================
@api_router.post("/weight")
async def add_weight(body: WeightIn, user: dict = Depends(get_current_user)):
    d = body.date or today_str()
    doc = {"id": new_id(), "user_id": user["id"], "weight": body.weight, "date": d, "created_at": now_utc().isoformat()}
    await db.weight_entries.update_one({"user_id": user["id"], "date": d}, {"$set": doc}, upsert=True)
    # update profile current weight if latest
    latest = await db.weight_entries.find({"user_id": user["id"]}, {"_id": 0}).sort("date", -1).to_list(1)
    if latest and latest[0]["date"] == d:
        profile = user.get("profile", {})
        profile["weight"] = body.weight
        await db.users.update_one({"id": user["id"]}, {"$set": {"profile": profile}})
    await unlock_achievement(user["id"], "first_weight")
    await award_xp(user["id"], 10)
    # goal reached check
    tw = user.get("profile", {}).get("target_weight")
    if tw and abs(body.weight - tw) <= 0.3:
        await unlock_achievement(user["id"], "goal_reached")
    return doc


@api_router.get("/weight")
async def get_weight(user: dict = Depends(get_current_user)):
    return await db.weight_entries.find({"user_id": user["id"]}, {"_id": 0}).sort("date", 1).to_list(1000)


@api_router.delete("/weight/{entry_id}")
async def delete_weight(entry_id: str, user: dict = Depends(get_current_user)):
    await db.weight_entries.delete_one({"id": entry_id, "user_id": user["id"]})
    return {"ok": True}


@api_router.post("/measurements")
async def add_measurement(body: MeasurementIn, user: dict = Depends(get_current_user)):
    d = body.date or today_str()
    doc = {"id": new_id(), "user_id": user["id"], "date": d, "created_at": now_utc().isoformat()}
    doc.update({k: v for k, v in body.dict().items() if v is not None and k != "date"})
    await db.measurements.update_one({"user_id": user["id"], "date": d}, {"$set": doc}, upsert=True)
    return doc


@api_router.get("/measurements")
async def get_measurements(user: dict = Depends(get_current_user)):
    return await db.measurements.find({"user_id": user["id"]}, {"_id": 0}).sort("date", 1).to_list(1000)


# progress photos
@api_router.post("/photos")
async def upload_photo(file: UploadFile = File(...), note: str = Form(""), date_str: str = Form(""),
                       user: dict = Depends(get_current_user)):
    ext = (file.filename or "photo.jpg").split(".")[-1][:5].lower() or "jpg"
    content = await file.read()
    pid = new_id()
    storage_path = f"{APP_NAME}/uploads/{user['id']}/{pid}.{ext}"
    content_type = file.content_type or "image/jpeg"
    await run_in_threadpool(put_object, storage_path, content, content_type)
    doc = {"id": pid, "user_id": user["id"], "storage_path": storage_path, "content_type": content_type,
           "note": note, "date": date_str or today_str(), "created_at": now_utc().isoformat()}
    await db.progress_photos.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api_router.get("/files/{photo_id}")
async def serve_photo(photo_id: str, token: Optional[str] = None,
                      creds: Optional[HTTPAuthorizationCredentials] = Depends(bearer)):
    # accept token via query (web <img>) or Authorization header (native)
    jwt_token = token or (creds.credentials if creds else None)
    if not jwt_token:
        raise HTTPException(401, "auth.invalid_token")
    try:
        payload = jwt.decode(jwt_token, JWT_SECRET, algorithms=[JWT_ALGO])
        uid = payload["sub"]
    except Exception:
        raise HTTPException(401, "auth.invalid_token")
    photo = await db.progress_photos.find_one({"id": photo_id}, {"_id": 0})
    if not photo or photo.get("user_id") != uid:
        raise HTTPException(404, "photo.not_found")
    content, ctype = await run_in_threadpool(get_object, photo["storage_path"])
    return Response(content=content, media_type=ctype)


@api_router.get("/photos")
async def get_photos(user: dict = Depends(get_current_user)):
    photos = await db.progress_photos.find({"user_id": user["id"]}, {"_id": 0, "storage_path": 0}).sort("date", -1).to_list(500)
    return photos


@api_router.delete("/photos/{photo_id}")
async def delete_photo(photo_id: str, user: dict = Depends(get_current_user)):
    await db.progress_photos.delete_one({"id": photo_id, "user_id": user["id"]})
    return {"ok": True}


# ============================= FOOD & NUTRITION =============================
@api_router.get("/foods/search")
async def search_foods(q: str = "", user: dict = Depends(get_current_user)):
    q = q.strip()
    lang = (user.get("settings", {}) or {}).get("language", "en")
    # local + custom foods (empty q = browse whole built-in database)
    query: dict = {"$or": [{"user_id": None}, {"user_id": user["id"]}]}
    if q:
        query["name"] = {"$regex": q, "$options": "i"}
    results = await db.foods.find(query, {"_id": 0}).sort("name", 1).limit(40).to_list(40)
    # Open Food Facts (search-a-licious) — only when actively searching
    if q and len(q) >= 2 and len(results) < 25:
        try:
            async with httpx.AsyncClient(timeout=6) as http:
                r = await http.get(
                    "https://search.openfoodfacts.org/search",
                    params={"q": q, "page_size": 20, "lang": lang},
                )
                data = r.json()
                seen = {x["name"].lower() for x in results}
                for p in data.get("hits", []):
                    name = p.get(f"product_name_{lang}") or p.get("product_name")
                    n = p.get("nutriments", {}) or {}
                    kcal = n.get("energy-kcal_100g")
                    if not name or not kcal:
                        continue
                    if name.lower() in seen:
                        continue
                    seen.add(name.lower())
                    brands = p.get("brands")
                    brand = (brands[0] if isinstance(brands, list) and brands else brands) or "Off"
                    results.append({
                        "id": None, "name": name, "brand": brand,
                        "calories": round(kcal, 1),
                        "protein": round(n.get("proteins_100g", 0) or 0, 1),
                        "carbs": round(n.get("carbohydrates_100g", 0) or 0, 1),
                        "fat": round(n.get("fat_100g", 0) or 0, 1),
                        "barcode": p.get("code"), "source": "off",
                    })
        except Exception as e:
            logger.warning(f"OFF search failed: {e}")
    return results[:40]


@api_router.get("/foods/barcode/{code}")
async def barcode_lookup(code: str, user: dict = Depends(get_current_user)):
    # check local first
    local = await db.foods.find_one({"barcode": code}, {"_id": 0})
    if local:
        return local
    try:
        async with httpx.AsyncClient(timeout=6) as http:
            r = await http.get(f"https://world.openfoodfacts.org/api/v2/product/{code}.json")
            data = r.json()
            if data.get("status") == 1:
                p = data["product"]
                n = p.get("nutriments", {})
                return {
                    "id": None, "name": p.get("product_name", "Unknown Product"),
                    "brand": p.get("brands", "") or "Off",
                    "calories": round(n.get("energy-kcal_100g", 0) or 0, 1),
                    "protein": round(n.get("proteins_100g", 0) or 0, 1),
                    "carbs": round(n.get("carbohydrates_100g", 0) or 0, 1),
                    "fat": round(n.get("fat_100g", 0) or 0, 1),
                    "barcode": code, "source": "off",
                }
    except Exception as e:
        logger.warning(f"OFF barcode failed: {e}")
    raise HTTPException(404, "food.not_found")


@api_router.post("/foods")
async def create_food(body: FoodIn, user: dict = Depends(get_current_user)):
    doc = {"id": new_id(), "user_id": user["id"], "verified": False, **body.dict()}
    await db.foods.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api_router.get("/foods/custom")
async def my_foods(user: dict = Depends(get_current_user)):
    return await db.foods.find({"user_id": user["id"]}, {"_id": 0}).sort("name", 1).to_list(200)


@api_router.get("/foods/recent")
async def recent_foods(user: dict = Depends(get_current_user)):
    entries = await db.diary_entries.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(60)
    seen, out = set(), []
    for e in entries:
        key = e["name"]
        if key in seen:
            continue
        seen.add(key)
        out.append({"name": e["name"], "calories": e["calories"], "protein": e["protein"],
                    "carbs": e["carbs"], "fat": e["fat"], "quantity": e.get("quantity", 100)})
        if len(out) >= 15:
            break
    return out


@api_router.post("/diary")
async def add_diary(body: DiaryIn, user: dict = Depends(get_current_user)):
    d = body.date or today_str()
    doc = {"id": new_id(), "user_id": user["id"], "date": d, "created_at": now_utc().isoformat(), **body.dict()}
    doc["date"] = d
    await db.diary_entries.insert_one(doc)
    doc.pop("_id", None)
    await unlock_achievement(user["id"], "first_meal")
    await award_xp(user["id"], 5)
    return doc


@api_router.get("/diary")
async def get_diary(date: Optional[str] = None, user: dict = Depends(get_current_user)):
    d = date or today_str()
    entries = await db.diary_entries.find({"user_id": user["id"], "date": d}, {"_id": 0}).to_list(200)
    water = await db.water_entries.find_one({"user_id": user["id"], "date": d}, {"_id": 0})
    totals = {"calories": 0, "protein": 0, "carbs": 0, "fat": 0}
    for e in entries:
        totals["calories"] += e.get("calories", 0)
        totals["protein"] += e.get("protein", 0)
        totals["carbs"] += e.get("carbs", 0)
        totals["fat"] += e.get("fat", 0)
    for k in totals:
        totals[k] = round(totals[k], 1)
    return {"date": d, "entries": entries, "totals": totals, "water_ml": (water or {}).get("ml", 0)}


@api_router.delete("/diary/{entry_id}")
async def delete_diary(entry_id: str, user: dict = Depends(get_current_user)):
    await db.diary_entries.delete_one({"id": entry_id, "user_id": user["id"]})
    return {"ok": True}


@api_router.post("/water")
async def set_water(body: WaterIn, user: dict = Depends(get_current_user)):
    d = body.date or today_str()
    existing = await db.water_entries.find_one({"user_id": user["id"], "date": d}, {"_id": 0})
    ml = max(0, (existing or {}).get("ml", 0) + body.ml)
    await db.water_entries.update_one({"user_id": user["id"], "date": d},
                                      {"$set": {"id": new_id(), "user_id": user["id"], "date": d, "ml": ml}}, upsert=True)
    if ml >= 2000:
        await unlock_achievement(user["id"], "hydrated")
    return {"date": d, "ml": ml}


@api_router.get("/nutrition/weekly")
async def weekly_nutrition(user: dict = Depends(get_current_user)):
    start = date.today() - timedelta(days=6)
    days = [(start + timedelta(days=i)).isoformat() for i in range(7)]
    out = []
    for d in days:
        entries = await db.diary_entries.find({"user_id": user["id"], "date": d}, {"_id": 0}).to_list(200)
        cal = sum(e.get("calories", 0) for e in entries)
        out.append({"date": d, "calories": round(cal), "protein": round(sum(e.get("protein", 0) for e in entries)),
                    "carbs": round(sum(e.get("carbs", 0) for e in entries)), "fat": round(sum(e.get("fat", 0) for e in entries))})
    return out


# ============================= EXERCISES =============================
@api_router.get("/exercises")
async def list_exercises(muscle_group: Optional[str] = None, equipment_only: bool = False,
                         user: dict = Depends(get_current_user)):
    query = {}
    if muscle_group:
        query["muscle_group"] = muscle_group
    exercises = await db.exercises.find(query, {"_id": 0}).sort("name", 1).to_list(500)
    if equipment_only:
        owned = set(user.get("equipment", []))
        exercises = [e for e in exercises if any(eq in owned for eq in e.get("equipment", [])) or "bodyweight" in e.get("equipment", [])]
    return exercises


@api_router.get("/exercises/{exercise_id}")
async def get_exercise(exercise_id: str, user: dict = Depends(get_current_user)):
    ex = await db.exercises.find_one({"id": exercise_id}, {"_id": 0})
    if not ex:
        raise HTTPException(404, "exercise.not_found")
    return ex


@api_router.post("/exercises/suggestions")
async def exercise_suggestions(body: SuggestIn, user: dict = Depends(get_current_user)):
    """Progressive-overload: last performance + a suggested next target per exercise."""
    out: Dict[str, Any] = {}
    for name in body.names:
        sessions = await db.workout_sessions.find(
            {"user_id": user["id"], "exercises.exercise_name": name}, {"_id": 0}
        ).sort("date", -1).to_list(5)
        last = None
        for sess in sessions:
            for ex in sess.get("exercises", []):
                if ex.get("exercise_name") != name:
                    continue
                best = None
                for st in ex.get("sets", []):
                    if st.get("done") and st.get("weight"):
                        score = (st.get("weight", 0)) * (st.get("reps", 0) or 1)
                        if best is None or score > best["_score"]:
                            best = {"weight": st.get("weight", 0), "reps": st.get("reps", 0), "_score": score}
                if best:
                    last = {"weight": best["weight"], "reps": best["reps"], "date": sess["date"]}
                    break
            if last:
                break
        suggestion = None
        if last and last["weight"]:
            w, r = last["weight"], last["reps"]
            if r >= 10:
                nw = round((w * 1.025) * 2) / 2  # +2.5% rounded to nearest 0.5
                if nw <= w:
                    nw = w + 2.5
                suggestion = {"weight": nw, "reps": 8, "note": "weight"}
            else:
                suggestion = {"weight": w, "reps": r + 1, "note": "reps"}
        elif last:
            suggestion = {"weight": last["weight"], "reps": last["reps"] + 1, "note": "reps"}
        out[name] = {"last": last, "suggestion": suggestion}
    return out


# ============================= WORKOUT PLANS =============================
@api_router.get("/plans")
async def list_plans(templates_only: bool = False, match_equipment: bool = False,
                     user: dict = Depends(get_current_user)):
    query = {"$or": [{"is_template": True}, {"user_id": user["id"]}]}
    if templates_only:
        query = {"is_template": True}
    plans = await db.workout_plans.find(query, {"_id": 0}).to_list(500)
    if match_equipment:
        owned = set(user.get("equipment", []))
        plans = [p for p in plans if all(e in owned for e in p.get("required_equipment", [])) or not p.get("required_equipment")]
    return plans


@api_router.get("/plans/{plan_id}")
async def get_plan(plan_id: str, user: dict = Depends(get_current_user)):
    p = await db.workout_plans.find_one({"id": plan_id}, {"_id": 0})
    if not p:
        raise HTTPException(404, "plan.not_found")
    return p


@api_router.post("/plans")
async def create_plan(body: PlanIn, user: dict = Depends(get_current_user)):
    doc = {"id": new_id(), "user_id": user["id"], "is_template": False, "required_equipment": [],
           **body.dict()}
    await db.workout_plans.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api_router.put("/plans/{plan_id}")
async def update_plan(plan_id: str, body: PlanIn, user: dict = Depends(get_current_user)):
    p = await db.workout_plans.find_one({"id": plan_id})
    if not p or p.get("user_id") != user["id"]:
        raise HTTPException(404, "plan.not_found")
    await db.workout_plans.update_one({"id": plan_id}, {"$set": body.dict()})
    fresh = await db.workout_plans.find_one({"id": plan_id}, {"_id": 0})
    return fresh


@api_router.delete("/plans/{plan_id}")
async def delete_plan(plan_id: str, user: dict = Depends(get_current_user)):
    await db.workout_plans.delete_one({"id": plan_id, "user_id": user["id"]})
    return {"ok": True}


# ============================= WORKOUT SESSIONS =============================
@api_router.post("/sessions")
async def log_session(body: SessionIn, user: dict = Depends(get_current_user)):
    d = body.date or today_str()
    volume = 0.0
    total_sets = 0
    for ex in body.exercises:
        for s in ex.sets:
            if s.done:
                volume += (s.weight or 0) * (s.reps or 0)
                total_sets += 1
    doc = {"id": new_id(), "user_id": user["id"], "date": d, "name": body.name, "plan_id": body.plan_id,
           "duration": body.duration, "volume": round(volume), "total_sets": total_sets,
           "exercises": [e.dict() for e in body.exercises], "created_at": now_utc().isoformat()}
    await db.workout_sessions.insert_one(doc)
    doc.pop("_id", None)

    # PRs
    new_prs = []
    for ex in body.exercises:
        best = None
        for s in ex.sets:
            if s.done and s.weight and s.reps:
                e1rm = s.weight * (1 + s.reps / 30.0)
                if best is None or e1rm > best["e1rm"]:
                    best = {"weight": s.weight, "reps": s.reps, "e1rm": round(e1rm, 1)}
        if best:
            existing = await db.personal_records.find_one({"user_id": user["id"], "exercise_name": ex.exercise_name})
            if not existing or best["e1rm"] > existing.get("e1rm", 0):
                pr = {"id": new_id(), "user_id": user["id"], "exercise_name": ex.exercise_name,
                      "weight": best["weight"], "reps": best["reps"], "e1rm": best["e1rm"], "date": d}
                await db.personal_records.update_one(
                    {"user_id": user["id"], "exercise_name": ex.exercise_name}, {"$set": pr}, upsert=True)
                new_prs.append(pr)

    await update_streak(user["id"])
    await award_xp(user["id"], 100)
    await unlock_achievement(user["id"], "first_workout")
    if new_prs:
        await unlock_achievement(user["id"], "first_pr")
    count = await db.workout_sessions.count_documents({"user_id": user["id"]})
    if count >= 10:
        await unlock_achievement(user["id"], "workout_10")
    if count >= 50:
        await unlock_achievement(user["id"], "workout_50")
    doc["new_prs"] = new_prs
    doc["xp_earned"] = 100
    return doc


@api_router.get("/sessions")
async def list_sessions(user: dict = Depends(get_current_user)):
    return await db.workout_sessions.find({"user_id": user["id"]}, {"_id": 0}).sort("date", -1).to_list(300)


@api_router.get("/prs")
async def list_prs(user: dict = Depends(get_current_user)):
    return await db.personal_records.find({"user_id": user["id"]}, {"_id": 0}).sort("e1rm", -1).to_list(200)


# ============================= WEEKLY CYCLE =============================
@api_router.get("/cycle")
async def get_cycle(week_start: Optional[str] = None, user: dict = Depends(get_current_user)):
    # week_start = monday iso date
    if not week_start:
        today = date.today()
        monday = today - timedelta(days=today.weekday())
        week_start = monday.isoformat()
    cycle = await db.weekly_cycle.find_one({"user_id": user["id"], "week_start": week_start}, {"_id": 0})
    if not cycle:
        cycle = {"user_id": user["id"], "week_start": week_start,
                 "days": {d: {"type": "rest"} for d in ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]}}
    # attach completed sessions per date
    ws = date.fromisoformat(week_start)
    day_dates = {["mon", "tue", "wed", "thu", "fri", "sat", "sun"][i]: (ws + timedelta(days=i)).isoformat() for i in range(7)}
    completed = {}
    for k, dt in day_dates.items():
        s = await db.workout_sessions.find_one({"user_id": user["id"], "date": dt}, {"_id": 0})
        completed[k] = bool(s)
    cycle["completed"] = completed
    cycle["day_dates"] = day_dates
    return cycle


@api_router.put("/cycle")
async def set_cycle(body: CycleIn, user: dict = Depends(get_current_user)):
    await db.weekly_cycle.update_one(
        {"user_id": user["id"], "week_start": body.week_start},
        {"$set": {"user_id": user["id"], "week_start": body.week_start, "days": body.days}}, upsert=True)
    return await get_cycle(body.week_start, user)


# ============================= STATS =============================
@api_router.get("/stats/overview")
async def stats_overview(user: dict = Depends(get_current_user)):
    sessions = await db.workout_sessions.find({"user_id": user["id"]}, {"_id": 0}).to_list(1000)
    total_volume = sum(s.get("volume", 0) for s in sessions)
    # muscle group distribution
    mg = {}
    for s in sessions:
        for ex in s.get("exercises", []):
            g = ex.get("muscle_group") or "other"
            done_sets = sum(1 for st in ex.get("sets", []) if st.get("done"))
            mg[g] = mg.get(g, 0) + done_sets
    # weekly frequency last 8 weeks
    freq = []
    for w in range(7, -1, -1):
        start = date.today() - timedelta(days=date.today().weekday()) - timedelta(weeks=w)
        end = start + timedelta(days=7)
        c = sum(1 for s in sessions if start.isoformat() <= s.get("date", "") < end.isoformat())
        freq.append({"week": start.isoformat(), "count": c})
    # volume over time (per session)
    vol_series = [{"date": s["date"], "volume": s.get("volume", 0)} for s in sorted(sessions, key=lambda x: x.get("date", ""))][-20:]
    prs = await db.personal_records.count_documents({"user_id": user["id"]})
    return {
        "total_workouts": len(sessions),
        "total_volume": round(total_volume),
        "total_sets": sum(s.get("total_sets", 0) for s in sessions),
        "muscle_groups": mg,
        "weekly_frequency": freq,
        "volume_series": vol_series,
        "pr_count": prs,
    }


# ============================= GAMIFICATION =============================
@api_router.get("/gamification")
async def gamification(user: dict = Depends(get_current_user)):
    g = user.get("gamification", {}) or {}
    xp = int(g.get("xp", 0))
    lvl = level_from_xp(xp)
    cur_floor = xp_for_level(lvl)
    next_floor = xp_for_level(lvl + 1)
    achievements = await db.achievements.find({}, {"_id": 0}).to_list(200)
    unlocked = await db.user_achievements.find({"user_id": user["id"]}, {"_id": 0}).to_list(200)
    unlocked_map = {u["code"]: u["unlocked_at"] for u in unlocked}
    for a in achievements:
        a["unlocked"] = a["code"] in unlocked_map
        a["unlocked_at"] = unlocked_map.get(a["code"])
    # weekly challenge progress
    challenges = await db.challenges.find({}, {"_id": 0}).to_list(50)
    monday = (date.today() - timedelta(days=date.today().weekday()))
    week_dates = [(monday + timedelta(days=i)).isoformat() for i in range(7)]
    workouts_week = await db.workout_sessions.count_documents({"user_id": user["id"], "date": {"$in": week_dates}})
    for c in challenges:
        if c["type"] == "workouts":
            c["progress"] = workouts_week
        elif c["type"] == "water_days":
            wd = await db.water_entries.count_documents({"user_id": user["id"], "date": {"$in": week_dates}, "ml": {"$gte": 2000}})
            c["progress"] = wd
        elif c["type"] == "log_days":
            days = await db.diary_entries.distinct("date", {"user_id": user["id"], "date": {"$in": week_dates}})
            c["progress"] = len(days)
        else:
            c["progress"] = 0
    return {
        "xp": xp, "level": lvl, "streak": g.get("streak", 0), "best_streak": g.get("best_streak", 0),
        "xp_current_level": cur_floor, "xp_next_level": next_floor,
        "achievements": achievements, "challenges": challenges,
    }


# ============================= DASHBOARD =============================
@api_router.get("/dashboard")
async def dashboard(user: dict = Depends(get_current_user)):
    metrics = compute_metrics(user.get("profile", {}))
    diary = await get_diary(today_str(), user)
    g = user.get("gamification", {}) or {}
    # today's planned workout from cycle
    today = date.today()
    monday = (today - timedelta(days=today.weekday())).isoformat()
    day_key = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"][today.weekday()]
    cycle = await db.weekly_cycle.find_one({"user_id": user["id"], "week_start": monday}, {"_id": 0})
    today_plan = None
    if cycle:
        today_plan = cycle.get("days", {}).get(day_key)
    weight = await db.weight_entries.find({"user_id": user["id"]}, {"_id": 0}).sort("date", 1).to_list(1000)
    # weekly workout count
    week_dates = [(today - timedelta(days=today.weekday()) + timedelta(days=i)).isoformat() for i in range(7)]
    workouts_week = await db.workout_sessions.count_documents({"user_id": user["id"], "date": {"$in": week_dates}})
    return {
        "profile": user.get("profile", {}),
        "metrics": metrics,
        "nutrition": diary,
        "weight_series": weight[-30:],
        "today_plan": today_plan,
        "workouts_this_week": workouts_week,
        "gamification": {"xp": g.get("xp", 0), "level": level_from_xp(int(g.get("xp", 0))), "streak": g.get("streak", 0)},
    }


# ============================= TRANSLATIONS =============================
@api_router.get("/translations/{lang}")
async def get_translations(lang: str):
    docs = await db.translations.find({"lang": lang}, {"_id": 0}).to_list(2000)
    return {d["key"]: d["value"] for d in docs}


# ============================= ADMIN =============================
@api_router.get("/admin/stats")
async def admin_stats(admin: dict = Depends(require_admin)):
    return {
        "users": await db.users.count_documents({}),
        "active_users": await db.users.count_documents({"disabled": False}),
        "exercises": await db.exercises.count_documents({}),
        "plans": await db.workout_plans.count_documents({}),
        "foods": await db.foods.count_documents({}),
        "sessions": await db.workout_sessions.count_documents({}),
        "diary_entries": await db.diary_entries.count_documents({}),
        "achievements": await db.achievements.count_documents({}),
    }


@api_router.get("/admin/users")
async def admin_users(admin: dict = Depends(require_admin)):
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).sort("created_at", -1).to_list(1000)
    return users


@api_router.get("/admin/users/{user_id}/detail")
async def admin_user_detail(user_id: str, admin: dict = Depends(require_admin)):
    u = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if not u:
        raise HTTPException(404, "user.not_found")
    sessions = await db.workout_sessions.find({"user_id": user_id}, {"_id": 0}).sort("date", -1).to_list(300)
    weight = await db.weight_entries.find({"user_id": user_id}, {"_id": 0}).sort("date", 1).to_list(1000)
    measurements = await db.measurements.find({"user_id": user_id}, {"_id": 0}).sort("date", -1).to_list(300)
    prs = await db.personal_records.find({"user_id": user_id}, {"_id": 0}).sort("e1rm", -1).to_list(200)
    total_volume = sum(s.get("volume", 0) for s in sessions)
    total_duration = sum(s.get("duration", 0) for s in sessions)
    metrics = compute_metrics(u.get("profile", {}))
    return {
        "user": u, "metrics": metrics, "sessions": sessions, "weight": weight,
        "measurements": measurements, "prs": prs,
        "totals": {"workouts": len(sessions), "volume": round(total_volume), "duration": total_duration},
    }


@api_router.put("/admin/users/{user_id}")
async def admin_update_user(user_id: str, body: dict, admin: dict = Depends(require_admin)):
    target = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not target:
        raise HTTPException(404, "user.not_found")
    # the super-admin account can never be demoted or disabled
    if target["email"] == SUPER_ADMIN_EMAIL:
        body.pop("is_admin", None)
        body.pop("disabled", None)
    allowed = {k: v for k, v in body.items() if k in ("disabled", "is_admin")}
    if allowed:
        await db.users.update_one({"id": user_id}, {"$set": allowed})
    return await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})


@api_router.put("/admin/users/{user_id}/profile")
async def admin_update_user_profile(user_id: str, body: ProfileIn, admin: dict = Depends(require_admin)):
    target = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not target:
        raise HTTPException(404, "user.not_found")
    profile = target.get("profile", {})
    updates = {k: v for k, v in body.dict().items() if v is not None}
    profile.update(updates)
    await db.users.update_one({"id": user_id}, {"$set": {"profile": profile}})
    return await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})


@api_router.delete("/admin/users/{user_id}")
async def admin_delete_user(user_id: str, admin: dict = Depends(require_admin)):
    await db.users.update_one({"id": user_id}, {"$set": {"disabled": True}})
    return {"ok": True}


@api_router.post("/admin/exercises")
async def admin_add_exercise(body: dict, admin: dict = Depends(require_admin)):
    doc = {"id": new_id(), "name": body.get("name"), "muscle_group": body.get("muscle_group"),
           "equipment": body.get("equipment", []), "instructions": body.get("instructions", "")}
    await db.exercises.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api_router.put("/admin/exercises/{ex_id}")
async def admin_update_exercise(ex_id: str, body: dict, admin: dict = Depends(require_admin)):
    upd = {k: body[k] for k in ("name", "muscle_group", "equipment", "instructions") if k in body}
    await db.exercises.update_one({"id": ex_id}, {"$set": upd})
    return await db.exercises.find_one({"id": ex_id}, {"_id": 0})


@api_router.delete("/admin/exercises/{ex_id}")
async def admin_delete_exercise(ex_id: str, admin: dict = Depends(require_admin)):
    await db.exercises.delete_one({"id": ex_id})
    return {"ok": True}


@api_router.post("/admin/foods")
async def admin_add_food(body: dict, admin: dict = Depends(require_admin)):
    doc = {"id": new_id(), "user_id": None, "verified": True, "name": body.get("name"),
           "brand": body.get("brand", "Generic"), "calories": body.get("calories", 0),
           "protein": body.get("protein", 0), "carbs": body.get("carbs", 0), "fat": body.get("fat", 0),
           "barcode": body.get("barcode")}
    await db.foods.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api_router.delete("/admin/foods/{food_id}")
async def admin_delete_food(food_id: str, admin: dict = Depends(require_admin)):
    await db.foods.delete_one({"id": food_id})
    return {"ok": True}


@api_router.post("/admin/achievements")
async def admin_add_achievement(body: dict, admin: dict = Depends(require_admin)):
    doc = {"code": body.get("code"), "name": body.get("name"), "description": body.get("description", ""),
           "icon": body.get("icon", "Trophy"), "xp": body.get("xp", 0), "category": body.get("category", "workout")}
    await db.achievements.update_one({"code": doc["code"]}, {"$set": doc}, upsert=True)
    return doc


@api_router.put("/admin/translations")
async def admin_set_translation(body: TranslationIn, admin: dict = Depends(require_admin)):
    await db.translations.update_one({"lang": body.lang, "key": body.key},
                                     {"$set": {"lang": body.lang, "key": body.key, "value": body.value}}, upsert=True)
    return {"ok": True}


@api_router.get("/admin/translations")
async def admin_get_translations(lang: Optional[str] = None, admin: dict = Depends(require_admin)):
    q = {"lang": lang} if lang else {}
    return await db.translations.find(q, {"_id": 0}).to_list(3000)


@api_router.get("/admin/exercises")
async def admin_list_exercises(admin: dict = Depends(require_admin)):
    return await db.exercises.find({}, {"_id": 0}).sort("name", 1).to_list(1000)


@api_router.get("/admin/foods")
async def admin_list_foods(admin: dict = Depends(require_admin)):
    return await db.foods.find({"user_id": None}, {"_id": 0}).sort("name", 1).to_list(1000)


@api_router.get("/admin/achievements")
async def admin_list_achievements(admin: dict = Depends(require_admin)):
    return await db.achievements.find({}, {"_id": 0}).sort("category", 1).to_list(200)


@api_router.delete("/admin/achievements/{code}")
async def admin_delete_achievement(code: str, admin: dict = Depends(require_admin)):
    await db.achievements.delete_one({"code": code})
    return {"ok": True}


# ----------------------------- seeding -----------------------------
async def seed_database():
    if await db.exercises.count_documents({}) == 0:
        for name, mg, equip, instr in seed_data.EXERCISES:
            await db.exercises.insert_one({"id": new_id(), "name": name, "muscle_group": mg,
                                           "equipment": equip, "instructions": instr})
        logger.info("Seeded exercises")
    if await db.foods.count_documents({"user_id": None}) < len(seed_data.FOODS):
        for name, brand, cal, p, c, f in seed_data.FOODS:
            await db.foods.update_one(
                {"user_id": None, "name": name},
                {"$set": {"user_id": None, "verified": True, "name": name,
                          "brand": brand, "calories": cal, "protein": p, "carbs": c, "fat": f, "barcode": None},
                 "$setOnInsert": {"id": new_id()}},
                upsert=True,
            )
        logger.info("Seeded foods")
    if await db.workout_plans.count_documents({"is_template": True}) == 0:
        for p in seed_data.WORKOUT_PLANS:
            await db.workout_plans.insert_one({"id": new_id(), "is_template": True, "user_id": None, **p})
        logger.info("Seeded plans")
    for a in seed_data.ACHIEVEMENTS:
        await db.achievements.update_one({"code": a["code"]}, {"$set": a}, upsert=True)
    for c in seed_data.CHALLENGES:
        await db.challenges.update_one({"code": c["code"]}, {"$set": c}, upsert=True)
    # seed admin user
    admin_email = "admin@forge.app"
    if not await db.users.find_one({"email": admin_email}):
        uid = new_id()
        await db.users.insert_one({
            "id": uid, "email": admin_email, "password_hash": hash_pw("Admin123!"),
            "is_admin": True, "disabled": False, "created_at": now_utc().isoformat(),
            "profile": {"name": "Admin", "onboarded": True, "units": "metric", "age": 30, "gender": "male",
                        "height": 180, "weight": 80, "target_weight": 78, "goal": "maintenance", "activity_level": "moderate"},
            "settings": {"language": "en", "units": "metric",
                         "notifications": {"workout": True, "meal": True, "water": True, "weight": True, "rest": True, "pr": True}},
            "equipment": [e["code"] for e in seed_data.EQUIPMENT],
            "gamification": {"xp": 0, "level": 1, "streak": 0, "best_streak": 0, "last_active_date": None},
        })
        logger.info("Seeded admin user")
    # ensure the designated super-admin email always has admin rights
    await db.users.update_one({"email": SUPER_ADMIN_EMAIL}, {"$set": {"is_admin": True}})


@app.on_event("startup")
async def startup():
    try:
        await run_in_threadpool(init_storage)
    except Exception as e:
        logger.warning(f"storage init failed: {e}")
    await seed_database()


@app.on_event("shutdown")
async def shutdown():
    client.close()


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
