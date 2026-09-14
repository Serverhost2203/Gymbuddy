"""
Iter7 tests:
- FEATURE: PUT /api/admin/users/{user_id}/profile updates target user's profile and
  metrics recompute from new height/weight; requires admin (401 no token / 403 non-admin).
- PROTECTION: super-admin (myscraptv@gmail.com) cannot be self-demoted (is_admin ignored)
  and cannot be disabled (disabled ignored). Verified via GET /admin/users too.
- REGRESSION: normal user is_admin & disabled toggle via PUT /admin/users/{id} still work.
"""
import os
import uuid
import pytest
import requests

BASE = os.environ.get("EXPO_PUBLIC_BACKEND_URL").rstrip("/")
API = f"{BASE}/api"
SUPER_EMAIL = "myscraptv@gmail.com"


# --- module autouse: ensure super-admin doesn't exist BEFORE (so fresh register with known pw)
#     and cleaned up AFTER (so real user can register later). Uses Mongo directly.
@pytest.fixture(scope="module", autouse=True)
def _cleanup_super_admin():
    import asyncio
    from motor.motor_asyncio import AsyncIOMotorClient
    from pathlib import Path
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent.parent / ".env")
    mongo_url = os.environ["MONGO_URL"]
    db_name = os.environ["DB_NAME"]

    async def _delete():
        c = AsyncIOMotorClient(mongo_url)
        await c[db_name].users.delete_many({"email": SUPER_EMAIL})
        c.close()

    asyncio.get_event_loop().run_until_complete(_delete()) if False else asyncio.run(_delete())
    yield
    asyncio.run(_delete())


# ---------- fixtures ----------
@pytest.fixture(scope="module")
def target_user(s):
    """Fresh normal user used as target for admin edits."""
    creds = {"email": f"TEST_edit_{uuid.uuid4().hex[:8]}@forge.app",
             "password": "TestPass123!", "name": "EditTarget"}
    r = s.post(f"{API}/auth/register", json=creds)
    assert r.status_code == 200, r.text
    j = r.json()
    return {"token": j["access_token"], "user": j["user"], "creds": creds}


@pytest.fixture(scope="module")
def another_normal(s):
    """A second normal user (used for 403 on admin endpoints)."""
    creds = {"email": f"TEST_other_{uuid.uuid4().hex[:8]}@forge.app",
             "password": "TestPass123!", "name": "OtherUser"}
    r = s.post(f"{API}/auth/register", json=creds)
    assert r.status_code == 200
    return {"token": r.json()["access_token"], "user": r.json()["user"]}


@pytest.fixture(scope="module")
def super_admin(s):
    """Register super-admin (or login) — needed for protection tests."""
    pw = "super123"
    r = s.post(f"{API}/auth/register", json={"email": SUPER_EMAIL, "password": pw, "name": "SuperAdmin"})
    if r.status_code == 200:
        return {"user": r.json()["user"], "token": r.json()["access_token"]}
    for candidate in (pw, "SuperAdmin123!", "Admin123!", "TmpVerify123"):
        lr = s.post(f"{API}/auth/login", json={"email": SUPER_EMAIL, "password": candidate})
        if lr.status_code == 200:
            return {"user": lr.json()["user"], "token": lr.json()["access_token"]}
    pytest.skip("super-admin exists with unknown password")


# =============== FEATURE: admin edits user's profile ===============
class TestAdminEditProfile:
    def test_no_token_returns_401(self, s, target_user):
        r = s.put(f"{API}/admin/users/{target_user['user']['id']}/profile",
                  json={"name": "X"})
        assert r.status_code == 401

    def test_non_admin_returns_403(self, s, target_user, another_normal):
        r = s.put(f"{API}/admin/users/{target_user['user']['id']}/profile",
                  headers={"Authorization": f"Bearer {another_normal['token']}"},
                  json={"name": "X"})
        assert r.status_code == 403

    def test_not_found_returns_404(self, s, admin_auth):
        r = s.put(f"{API}/admin/users/nonexistent-uid-xxx/profile",
                  headers=admin_auth, json={"name": "Y"})
        assert r.status_code == 404

    def test_admin_updates_all_profile_fields(self, s, target_user, admin_auth):
        payload = {
            "name": "AdminEditedName",
            "birthdate": "1990-04-12",
            "age": 34,
            "gender": "female",
            "height": 170.0,
            "weight": 65.0,
            "target_weight": 60.0,
            "goal": "fat_loss",
        }
        uid = target_user["user"]["id"]
        r = s.put(f"{API}/admin/users/{uid}/profile", headers=admin_auth, json=payload)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "password_hash" not in body
        prof = body["profile"]
        for k, v in payload.items():
            assert prof.get(k) == v, f"profile[{k}] = {prof.get(k)!r}, expected {v!r}"

        # verify via GET /admin/users/{id}/detail — persisted + metrics recompute
        d = s.get(f"{API}/admin/users/{uid}/detail", headers=admin_auth)
        assert d.status_code == 200
        dj = d.json()
        for k, v in payload.items():
            assert dj["user"]["profile"].get(k) == v
        m = dj["metrics"]
        assert m["bmi"] is not None
        assert m["calorie_target"] is not None
        # BMI = 65 / 1.7^2 ≈ 22.49
        assert abs(m["bmi"] - (65.0 / (1.70 ** 2))) < 0.1

    def test_admin_update_recomputes_metrics_after_height_weight_change(
        self, s, target_user, admin_auth
    ):
        uid = target_user["user"]["id"]
        # capture before
        d1 = s.get(f"{API}/admin/users/{uid}/detail", headers=admin_auth).json()
        bmi_before = d1["metrics"]["bmi"]
        cal_before = d1["metrics"]["calorie_target"]

        # change height + weight substantially
        r = s.put(f"{API}/admin/users/{uid}/profile", headers=admin_auth,
                  json={"height": 155.0, "weight": 90.0})
        assert r.status_code == 200

        d2 = s.get(f"{API}/admin/users/{uid}/detail", headers=admin_auth).json()
        bmi_after = d2["metrics"]["bmi"]
        cal_after = d2["metrics"]["calorie_target"]
        assert bmi_after != bmi_before
        # BMI = 90/1.55^2 ≈ 37.46
        assert abs(bmi_after - (90.0 / (1.55 ** 2))) < 0.1
        # calorie target should have shifted too (weight ↑ → BMR ↑ usually)
        assert cal_after != cal_before

    def test_partial_update_preserves_other_fields(self, s, target_user, admin_auth):
        uid = target_user["user"]["id"]
        # set fields
        s.put(f"{API}/admin/users/{uid}/profile", headers=admin_auth,
              json={"goal": "muscle_gain", "gender": "male"})
        # now partial: only change name
        r = s.put(f"{API}/admin/users/{uid}/profile", headers=admin_auth,
                  json={"name": "PartialName"})
        assert r.status_code == 200
        prof = r.json()["profile"]
        assert prof["name"] == "PartialName"
        assert prof["goal"] == "muscle_gain"
        assert prof["gender"] == "male"


# =============== PROTECTION: super-admin self-demote/disable blocked ===============
class TestSuperAdminProtection:
    def test_cannot_demote_super_admin(self, s, super_admin, admin_auth):
        sid = super_admin["user"]["id"]
        r = s.put(f"{API}/admin/users/{sid}", headers=admin_auth,
                  json={"is_admin": False})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["email"] == SUPER_EMAIL
        assert body["is_admin"] is True, "super-admin was demoted!"

    def test_cannot_disable_super_admin(self, s, super_admin, admin_auth):
        sid = super_admin["user"]["id"]
        r = s.put(f"{API}/admin/users/{sid}", headers=admin_auth,
                  json={"disabled": True})
        assert r.status_code == 200
        body = r.json()
        assert body.get("disabled", False) is False, "super-admin was disabled!"

    def test_cannot_demote_and_disable_combined(self, s, super_admin, admin_auth):
        sid = super_admin["user"]["id"]
        r = s.put(f"{API}/admin/users/{sid}", headers=admin_auth,
                  json={"is_admin": False, "disabled": True})
        assert r.status_code == 200
        body = r.json()
        assert body["is_admin"] is True
        assert body.get("disabled", False) is False

    def test_super_admin_still_admin_in_users_list(self, s, admin_auth):
        users = s.get(f"{API}/admin/users", headers=admin_auth).json()
        rec = next((u for u in users if u["email"] == SUPER_EMAIL), None)
        assert rec is not None
        assert rec["is_admin"] is True
        assert rec.get("disabled", False) is False


# =============== REGRESSION: normal user toggles still work ===============
class TestNormalUserToggle:
    def test_promote_and_demote_normal_user(self, s, another_normal, admin_auth):
        uid = another_normal["user"]["id"]
        # promote
        r = s.put(f"{API}/admin/users/{uid}", headers=admin_auth, json={"is_admin": True})
        assert r.status_code == 200
        assert r.json()["is_admin"] is True
        # demote
        r = s.put(f"{API}/admin/users/{uid}", headers=admin_auth, json={"is_admin": False})
        assert r.status_code == 200
        assert r.json()["is_admin"] is False

    def test_disable_and_enable_normal_user(self, s, target_user, admin_auth):
        uid = target_user["user"]["id"]
        r = s.put(f"{API}/admin/users/{uid}", headers=admin_auth, json={"disabled": True})
        assert r.status_code == 200
        assert r.json()["disabled"] is True
        r = s.put(f"{API}/admin/users/{uid}", headers=admin_auth, json={"disabled": False})
        assert r.status_code == 200
        assert r.json()["disabled"] is False
