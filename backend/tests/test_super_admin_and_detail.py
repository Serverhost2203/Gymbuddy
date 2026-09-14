"""
Iter5 tests:
- Super-admin auto-grant (register/login) for myscraptv@gmail.com
- Admin user-detail endpoint aggregation
- Access control on /admin/users and /admin/users/{id}/detail
- Profile birthdate accepted and returned
"""
import os
import uuid
import pytest
import requests

BASE = os.environ.get("EXPO_PUBLIC_BACKEND_URL").rstrip("/")
API = f"{BASE}/api"
SUPER_EMAIL = "myscraptv@gmail.com"


# -------- module-scoped: acquire a super-admin token (register-or-login) --------
@pytest.fixture(scope="module")
def super_admin_ctx(s):
    """Register super-admin (any pw). If already exists, try common pw candidates via login."""
    pw = "super123"
    r = s.post(f"{API}/auth/register", json={"email": SUPER_EMAIL, "password": pw, "name": "SuperAdmin"})
    if r.status_code == 200:
        j = r.json()
        return {"token": j["access_token"], "user": j["user"], "password": pw, "just_registered": True}
    # already exists — try login with candidate passwords
    for candidate in (pw, "SuperAdmin123!", "Admin123!", "super1234"):
        lr = s.post(f"{API}/auth/login", json={"email": SUPER_EMAIL, "password": candidate})
        if lr.status_code == 200:
            j = lr.json()
            return {"token": j["access_token"], "user": j["user"], "password": candidate, "just_registered": False}
    pytest.skip("Super-admin already registered with unknown password; skipping super-admin tests")


# -------- module-scoped fresh normal user --------
@pytest.fixture(scope="module")
def normal_user(s):
    creds = {"email": f"TEST_normal_{uuid.uuid4().hex[:8]}@forge.app",
             "password": "TestPass123!", "name": "Normal"}
    r = s.post(f"{API}/auth/register", json=creds)
    assert r.status_code == 200, r.text
    j = r.json()
    return {"token": j["access_token"], "user": j["user"], "creds": creds}


# ==================== SUPER-ADMIN AUTO-GRANT ====================
class TestSuperAdminAutoGrant:
    def test_super_admin_is_admin_flag(self, super_admin_ctx):
        u = super_admin_ctx["user"]
        assert u["email"] == SUPER_EMAIL
        assert u["is_admin"] is True, f"Super-admin user should have is_admin=True, got {u}"

    def test_super_admin_me_reflects_admin(self, s, super_admin_ctx):
        r = s.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {super_admin_ctx['token']}"})
        assert r.status_code == 200
        me = r.json()
        assert me["email"] == SUPER_EMAIL
        assert me["is_admin"] is True
        assert "password_hash" not in me

    def test_super_admin_login_grants_admin(self, s, super_admin_ctx):
        r = s.post(f"{API}/auth/login",
                   json={"email": SUPER_EMAIL, "password": super_admin_ctx["password"]})
        assert r.status_code == 200
        j = r.json()
        assert j["user"]["is_admin"] is True

    def test_normal_fresh_user_is_not_admin(self, normal_user):
        assert normal_user["user"]["is_admin"] is False


# ==================== ACCESS CONTROL ====================
class TestAdminAccessControl:
    def test_admin_users_no_token(self, s):
        r = s.get(f"{API}/admin/users")
        assert r.status_code == 401

    def test_admin_users_normal_forbidden(self, s, normal_user):
        r = s.get(f"{API}/admin/users",
                  headers={"Authorization": f"Bearer {normal_user['token']}"})
        assert r.status_code == 403

    def test_admin_user_detail_no_token(self, s, normal_user):
        r = s.get(f"{API}/admin/users/{normal_user['user']['id']}/detail")
        assert r.status_code == 401

    def test_admin_user_detail_normal_forbidden(self, s, normal_user):
        r = s.get(f"{API}/admin/users/{normal_user['user']['id']}/detail",
                  headers={"Authorization": f"Bearer {normal_user['token']}"})
        assert r.status_code == 403


# ==================== ADMIN USER-DETAIL ENDPOINT ====================
class TestAdminUserDetail:
    def test_detail_shape_using_seeded_admin_as_acting(self, s, admin_auth):
        """Use admin@forge.app (also is_admin) to probe detail of another user.

        We need a user with a logged session — log one for a fresh throwaway user, then
        fetch that user's detail as admin@forge.app. This validates the endpoint's data
        aggregation independently of the super-admin password issue.
        """
        # register throwaway user
        creds = {"email": f"TEST_detailtgt_{uuid.uuid4().hex[:8]}@forge.app",
                 "password": "TestPass123!", "name": "Target"}
        r = s.post(f"{API}/auth/register", json=creds)
        assert r.status_code == 200
        tok = r.json()["access_token"]
        uid = r.json()["user"]["id"]
        h = {"Authorization": f"Bearer {tok}"}

        # populate profile with birthdate + basics
        prof = {"name": "Target", "age": 30, "gender": "male", "height": 180,
                "weight": 82, "target_weight": 78, "goal": "fat_loss",
                "activity_level": "moderate", "birthdate": "1995-06-15", "onboarded": True}
        assert s.put(f"{API}/profile", headers=h, json=prof).status_code == 200

        # add weight + measurement
        s.post(f"{API}/weight", headers=h, json={"weight": 82.0, "date": "2026-01-07"})
        s.post(f"{API}/measurements", headers=h,
               json={"date": "2026-01-07", "waist": 82, "chest": 100})

        # log a session
        sess = s.post(f"{API}/sessions", headers=h, json={
            "date": "2026-01-07", "name": "TEST_DetailSession", "duration": 1800,
            "exercises": [{"exercise_name": "TEST_DetailBench", "muscle_group": "chest",
                           "sets": [{"reps": 5, "weight": 100, "done": True},
                                    {"reps": 5, "weight": 100, "done": True}]}]
        })
        assert sess.status_code == 200

        # now fetch detail as admin
        r = s.get(f"{API}/admin/users/{uid}/detail", headers=admin_auth)
        assert r.status_code == 200, r.text
        j = r.json()

        # required top-level keys
        for k in ("user", "metrics", "sessions", "weight", "measurements", "prs", "totals"):
            assert k in j, f"missing key {k}"

        # user block: no password_hash, has profile with birthdate
        assert "password_hash" not in j["user"]
        assert j["user"]["email"] == creds["email"].lower()
        assert j["user"]["profile"].get("birthdate") == "1995-06-15"

        # metrics block: bmi + calorie_target present
        assert j["metrics"]["bmi"] is not None
        assert j["metrics"]["calorie_target"] is not None

        # sessions: has our session with date, name, duration, volume, total_sets, exercises
        matched = [x for x in j["sessions"] if x["name"] == "TEST_DetailSession"]
        assert matched, "logged session missing from admin detail"
        sd = matched[0]
        for k in ("date", "name", "duration", "volume", "total_sets", "exercises"):
            assert k in sd
        assert sd["duration"] == 1800
        assert sd["volume"] > 0
        assert sd["total_sets"] == 2
        # per-set weight & reps preserved
        ex0 = sd["exercises"][0]
        assert ex0["exercise_name"] == "TEST_DetailBench"
        assert len(ex0["sets"]) == 2
        assert ex0["sets"][0]["weight"] == 100
        assert ex0["sets"][0]["reps"] == 5
        assert ex0["sets"][0]["done"] is True

        # weight & measurements lists
        assert any(w.get("weight") == 82.0 for w in j["weight"])
        assert any(m.get("waist") == 82 for m in j["measurements"])

        # prs list — bench PR expected
        assert any(p["exercise_name"] == "TEST_DetailBench" for p in j["prs"])

        # totals
        assert j["totals"]["workouts"] >= 1
        assert j["totals"]["volume"] > 0
        assert j["totals"]["duration"] >= 1800

    def test_detail_as_super_admin(self, s, super_admin_ctx, admin_auth):
        """Super-admin should also be able to fetch detail for admin@forge.app."""
        # get admin@forge.app user id
        users = s.get(f"{API}/admin/users", headers=admin_auth).json()
        target = next((u for u in users if u["email"] == "admin@forge.app"), None)
        assert target is not None
        r = s.get(f"{API}/admin/users/{target['id']}/detail",
                  headers={"Authorization": f"Bearer {super_admin_ctx['token']}"})
        assert r.status_code == 200
        j = r.json()
        assert "password_hash" not in j["user"]
        assert j["user"]["email"] == "admin@forge.app"

    def test_detail_not_found(self, s, admin_auth):
        r = s.get(f"{API}/admin/users/nonexistent-uid-xxx/detail", headers=admin_auth)
        assert r.status_code == 404


# ==================== PROFILE BIRTHDATE ====================
class TestProfileBirthdate:
    def test_put_and_me_reflect_birthdate(self, s, normal_user):
        h = {"Authorization": f"Bearer {normal_user['token']}"}
        r = s.put(f"{API}/profile", headers=h, json={"birthdate": "1995-06-15"})
        assert r.status_code == 200
        assert r.json()["profile"].get("birthdate") == "1995-06-15"
        me = s.get(f"{API}/auth/me", headers=h).json()
        assert me["profile"].get("birthdate") == "1995-06-15"
