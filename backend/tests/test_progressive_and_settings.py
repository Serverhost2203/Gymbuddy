"""
Iteration 4 tests:
- Progressive overload: POST /api/exercises/suggestions
- Configurable settings: PUT /api/settings + GET /api/auth/me reflection
- Regressions: route ordering (GET /api/exercises/{id}), foods/search empty & query
"""
import os
import uuid
import pytest
import requests

BASE = os.environ.get("EXPO_PUBLIC_BACKEND_URL").rstrip("/")
API = f"{BASE}/api"


# ---------- helpers ----------
def _register_fresh():
    """Create a brand new user for this test module to keep state isolated."""
    creds = {
        "email": f"TEST_iter4_{uuid.uuid4().hex[:8]}@forge.app",
        "password": "TestPass123!",
        "name": "Iter4",
    }
    r = requests.post(f"{API}/auth/register", json=creds, timeout=30)
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text}"
    return creds, r.json()["access_token"]


@pytest.fixture(scope="module")
def fresh_user():
    creds, tok = _register_fresh()
    return {"creds": creds, "token": tok, "auth": {"Authorization": f"Bearer {tok}"}}


# ---------- Progressive overload ----------
class TestProgressiveOverload:
    def test_requires_auth(self):
        r = requests.post(f"{API}/exercises/suggestions", json={"names": ["Bench Press"]}, timeout=30)
        assert r.status_code == 401

    def test_no_prior_session_returns_nulls(self, fresh_user):
        r = requests.post(
            f"{API}/exercises/suggestions",
            headers=fresh_user["auth"],
            json={"names": ["Barbell Bench Press", "Deadlift"]},
            timeout=30,
        )
        assert r.status_code == 200, r.text
        j = r.json()
        assert "Barbell Bench Press" in j and "Deadlift" in j
        assert j["Barbell Bench Press"] == {"last": None, "suggestion": None}
        assert j["Deadlift"] == {"last": None, "suggestion": None}

    def test_suggestion_after_logging_bench_reps10(self, fresh_user):
        # Log a session with Barbell Bench Press: 80kg x 10, done
        payload = {
            "name": "Iter4 Push",
            "duration": 1800,
            "exercises": [
                {
                    "exercise_name": "Barbell Bench Press",
                    "muscle_group": "chest",
                    "sets": [{"reps": 10, "weight": 80, "done": True}],
                }
            ],
        }
        r = requests.post(f"{API}/sessions", headers=fresh_user["auth"], json=payload, timeout=30)
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["volume"] > 0
        assert "new_prs" in j and "xp_earned" in j

        # Now ask for suggestions
        r2 = requests.post(
            f"{API}/exercises/suggestions",
            headers=fresh_user["auth"],
            json={"names": ["Barbell Bench Press"]},
            timeout=30,
        )
        assert r2.status_code == 200, r2.text
        data = r2.json()["Barbell Bench Press"]
        assert data["last"] is not None
        assert data["last"]["weight"] == 80
        assert data["last"]["reps"] == 10
        assert data["suggestion"] is not None
        # weight increased (~+2.5%): 80 * 1.025 = 82.0
        assert data["suggestion"]["weight"] > 80
        assert data["suggestion"]["weight"] == pytest.approx(82.0, abs=0.01)
        assert data["suggestion"]["reps"] == 8
        assert data["suggestion"]["note"] == "weight"

    def test_suggestion_reps_bump_when_low_reps(self, fresh_user):
        # Log Deadlift with reps < 10 (e.g. 100kg x 6)
        payload = {
            "name": "Iter4 Pull",
            "duration": 1200,
            "exercises": [
                {
                    "exercise_name": "Deadlift",
                    "muscle_group": "back",
                    "sets": [{"reps": 6, "weight": 100, "done": True}],
                }
            ],
        }
        r = requests.post(f"{API}/sessions", headers=fresh_user["auth"], json=payload, timeout=30)
        assert r.status_code == 200

        r2 = requests.post(
            f"{API}/exercises/suggestions",
            headers=fresh_user["auth"],
            json={"names": ["Deadlift"]},
            timeout=30,
        )
        assert r2.status_code == 200
        data = r2.json()["Deadlift"]
        assert data["last"] == {"weight": 100, "reps": 6, "date": data["last"]["date"]}
        assert data["suggestion"] is not None
        assert data["suggestion"]["weight"] == 100  # keep weight
        assert data["suggestion"]["reps"] == 7  # reps + 1
        assert data["suggestion"]["note"] == "reps"


# ---------- Configurable settings ----------
class TestSettings:
    def test_put_settings_persists_new_fields(self, fresh_user):
        body = {"default_rest": 120, "rest_autostart": True, "water_goal": 3000}
        r = requests.put(f"{API}/settings", headers=fresh_user["auth"], json=body, timeout=30)
        assert r.status_code == 200, r.text
        s = r.json()
        assert s["default_rest"] == 120
        assert s["rest_autostart"] is True
        assert s["water_goal"] == 3000

    def test_me_reflects_settings(self, fresh_user):
        r = requests.get(f"{API}/auth/me", headers=fresh_user["auth"], timeout=30)
        assert r.status_code == 200
        me = r.json()
        assert "settings" in me
        s = me["settings"]
        assert s.get("default_rest") == 120
        assert s.get("rest_autostart") is True
        assert s.get("water_goal") == 3000

    def test_settings_merge_preserves_existing(self, fresh_user):
        # First set language + units + notifications
        r = requests.put(
            f"{API}/settings",
            headers=fresh_user["auth"],
            json={"language": "en", "units": "metric", "notifications": {"push": True}},
            timeout=30,
        )
        assert r.status_code == 200
        # Now update only new fields; existing must remain
        r2 = requests.put(
            f"{API}/settings",
            headers=fresh_user["auth"],
            json={"default_rest": 90},
            timeout=30,
        )
        assert r2.status_code == 200
        s = r2.json()
        assert s["default_rest"] == 90
        assert s.get("language") == "en"
        assert s.get("units") == "metric"
        assert s.get("notifications") == {"push": True}
        # rest_autostart / water_goal set earlier should still be there
        assert s.get("rest_autostart") is True
        assert s.get("water_goal") == 3000


# ---------- Regression: route ordering ----------
class TestRouteOrdering:
    def test_get_exercise_by_id_not_shadowed(self, fresh_user):
        # List exercises, pick one, GET by id
        r = requests.get(f"{API}/exercises?muscle_group=chest", headers=fresh_user["auth"], timeout=30)
        assert r.status_code == 200
        items = r.json()
        assert len(items) > 0
        eid = items[0]["id"]
        r2 = requests.get(f"{API}/exercises/{eid}", headers=fresh_user["auth"], timeout=30)
        assert r2.status_code == 200, r2.text
        assert r2.json()["id"] == eid
        assert r2.json()["muscle_group"] == "chest"

    def test_exercises_muscle_group_filter(self, fresh_user):
        r = requests.get(f"{API}/exercises?muscle_group=chest", headers=fresh_user["auth"], timeout=30)
        assert r.status_code == 200
        arr = r.json()
        assert len(arr) > 0
        assert all(e["muscle_group"] == "chest" for e in arr)


# ---------- Regression: foods search ----------
class TestFoodsSearchRegression:
    def test_foods_search_empty(self, fresh_user):
        r = requests.get(f"{API}/foods/search", headers=fresh_user["auth"], timeout=30)
        assert r.status_code == 200
        arr = r.json()
        assert isinstance(arr, list)
        assert len(arr) > 0

    def test_foods_search_query(self, fresh_user):
        r = requests.get(f"{API}/foods/search?q=chicken", headers=fresh_user["auth"], timeout=30)
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# ---------- Regression: gamification / dashboard / diary / admin gate ----------
class TestCoreRegression:
    def test_gamification(self, fresh_user):
        r = requests.get(f"{API}/gamification", headers=fresh_user["auth"], timeout=30)
        assert r.status_code == 200
        j = r.json()
        for k in ("xp", "level", "achievements", "challenges"):
            assert k in j

    def test_dashboard(self, fresh_user):
        r = requests.get(f"{API}/dashboard", headers=fresh_user["auth"], timeout=30)
        assert r.status_code == 200
        j = r.json()
        for k in ("profile", "metrics", "nutrition", "today_plan", "gamification"):
            assert k in j

    def test_diary_post_get(self, fresh_user):
        r = requests.post(
            f"{API}/diary",
            headers=fresh_user["auth"],
            json={
                "meal": "breakfast",
                "name": "TEST_Oats",
                "quantity": 60,
                "calories": 220,
                "protein": 8,
                "carbs": 40,
                "fat": 4,
                "date": "2026-01-07",
            },
            timeout=30,
        )
        assert r.status_code == 200
        r2 = requests.get(f"{API}/diary?date=2026-01-07", headers=fresh_user["auth"], timeout=30)
        assert r2.status_code == 200
        j = r2.json()
        assert j["totals"]["calories"] >= 220

    def test_admin_endpoints_require_admin(self, fresh_user):
        r = requests.get(f"{API}/admin/stats", headers=fresh_user["auth"], timeout=30)
        assert r.status_code == 403
        r2 = requests.get(f"{API}/admin/foods", headers=fresh_user["auth"], timeout=30)
        assert r2.status_code == 403
        r3 = requests.get(f"{API}/admin/exercises", headers=fresh_user["auth"], timeout=30)
        assert r3.status_code == 403

    def test_admin_login_works(self):
        r = requests.post(
            f"{API}/auth/login",
            json={"email": "admin@forge.app", "password": "Admin123!"},
            timeout=30,
        )
        assert r.status_code == 200
        assert r.json()["user"]["is_admin"] is True
