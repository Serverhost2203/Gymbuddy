"""
Comprehensive backend tests for Forge Fitness API.
Covers auth, profile, admin, weight, measurements, foods/diary, exercises, plans,
sessions/PRs, cycle, stats, gamification, dashboard, progress photos.
"""
import io
import os
import time
import pytest
import requests

BASE = os.environ.get("EXPO_PUBLIC_BACKEND_URL").rstrip("/")
API = f"{BASE}/api"


# ---------- AUTH ----------
class TestAuth:
    def test_register_and_me(self, s, user_token, user_creds):
        r = s.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {user_token}"})
        assert r.status_code == 200
        j = r.json()
        assert j["email"] == user_creds["email"].lower()
        assert j["is_admin"] is False
        assert "password_hash" not in j
        assert "_id" not in j

    def test_login_ok(self, s, user_creds):
        r = s.post(f"{API}/auth/login", json={"email": user_creds["email"], "password": user_creds["password"]})
        assert r.status_code == 200
        assert "access_token" in r.json()

    def test_login_bad_password(self, s, user_creds):
        r = s.post(f"{API}/auth/login", json={"email": user_creds["email"], "password": "wrong"})
        assert r.status_code == 401

    def test_register_duplicate(self, s, user_creds):
        r = s.post(f"{API}/auth/register", json=user_creds)
        assert r.status_code == 409

    def test_me_no_token(self, s):
        r = s.get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_me_bad_token(self, s):
        r = s.get(f"{API}/auth/me", headers={"Authorization": "Bearer bad.token.here"})
        assert r.status_code == 401


# ---------- ADMIN ----------
class TestAdmin:
    def test_admin_login_flag(self, s):
        r = s.post(f"{API}/auth/login", json={"email": "admin@forge.app", "password": "Admin123!"})
        assert r.status_code == 200
        assert r.json()["user"]["is_admin"] is True

    def test_admin_stats(self, s, admin_auth):
        r = s.get(f"{API}/admin/stats", headers=admin_auth)
        assert r.status_code == 200
        j = r.json()
        for k in ("users", "exercises", "plans", "foods", "sessions", "diary_entries", "achievements"):
            assert k in j
        assert j["exercises"] > 0
        assert j["plans"] >= 6

    def test_admin_users_list(self, s, admin_auth):
        r = s.get(f"{API}/admin/users", headers=admin_auth)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_non_admin_forbidden_stats(self, s, auth):
        r = s.get(f"{API}/admin/stats", headers=auth)
        assert r.status_code == 403

    def test_non_admin_forbidden_users(self, s, auth):
        r = s.get(f"{API}/admin/users", headers=auth)
        assert r.status_code == 403

    def test_admin_update_user_toggle(self, s, admin_auth, user_token):
        # get user id
        me = s.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {user_token}"}).json()
        uid = me["id"]
        r = s.put(f"{API}/admin/users/{uid}", headers=admin_auth, json={"disabled": True})
        assert r.status_code == 200
        # login should fail now
        login = s.post(f"{API}/auth/login", json={"email": me["email"], "password": "TestPass123!"})
        assert login.status_code == 403
        # re-enable
        r2 = s.put(f"{API}/admin/users/{uid}", headers=admin_auth, json={"disabled": False})
        assert r2.status_code == 200


# ---------- PROFILE ----------
class TestProfile:
    def test_update_profile(self, s, auth):
        payload = {"age": 28, "gender": "male", "height": 180, "weight": 82,
                   "target_weight": 78, "goal": "fat_loss", "activity_level": "moderate", "onboarded": True}
        r = s.put(f"{API}/profile", headers=auth, json=payload)
        assert r.status_code == 200
        p = r.json()["profile"]
        assert p["age"] == 28 and p["height"] == 180 and p["onboarded"] is True

    def test_profile_metrics(self, s, auth):
        r = s.get(f"{API}/profile/metrics", headers=auth)
        assert r.status_code == 200
        m = r.json()
        assert m["bmi"] is not None and m["tdee"] is not None
        assert m["calorie_target"] < m["tdee"]  # fat_loss
        assert m["macros"]["protein"] > 0
        assert m["weeks_to_goal"] is not None


# ---------- WEIGHT & MEASUREMENTS ----------
class TestWeightMeasure:
    def test_add_and_get_weight(self, s, auth):
        r = s.post(f"{API}/weight", headers=auth, json={"weight": 81.5, "date": "2026-01-05"})
        assert r.status_code == 200
        r2 = s.get(f"{API}/weight", headers=auth)
        assert r2.status_code == 200
        assert any(abs(w["weight"] - 81.5) < 0.01 for w in r2.json())

    def test_add_and_get_measurement(self, s, auth):
        r = s.post(f"{API}/measurements", headers=auth,
                   json={"date": "2026-01-05", "waist": 82, "chest": 100, "arms": 36})
        assert r.status_code == 200
        r2 = s.get(f"{API}/measurements", headers=auth)
        assert r2.status_code == 200
        assert any(m.get("waist") == 82 for m in r2.json())


# ---------- FOODS / DIARY ----------
class TestFoodsDiary:
    def test_search_local_seed(self, s, auth):
        r = s.get(f"{API}/foods/search?q=chicken", headers=auth)
        assert r.status_code == 200
        assert isinstance(r.json(), list)
        assert len(r.json()) > 0

    def test_barcode_off(self, s, auth):
        # coca cola barcode - may or may not resolve; just accept 200 or 404
        r = s.get(f"{API}/foods/barcode/5449000000996", headers=auth)
        assert r.status_code in (200, 404)

    def test_create_custom_food(self, s, auth):
        r = s.post(f"{API}/foods", headers=auth,
                   json={"name": "TEST_MyProtein", "calories": 400, "protein": 80, "carbs": 5, "fat": 5})
        assert r.status_code == 200
        assert r.json()["id"]
        r2 = s.get(f"{API}/foods/custom", headers=auth)
        assert any(f["name"] == "TEST_MyProtein" for f in r2.json())

    def test_diary_add_get_delete(self, s, auth):
        r = s.post(f"{API}/diary", headers=auth,
                   json={"meal": "lunch", "name": "TEST_Rice", "quantity": 150,
                         "calories": 200, "protein": 5, "carbs": 40, "fat": 1, "date": "2026-01-06"})
        assert r.status_code == 200
        entry_id = r.json()["id"]
        r2 = s.get(f"{API}/diary?date=2026-01-06", headers=auth)
        assert r2.status_code == 200
        j = r2.json()
        assert j["totals"]["calories"] >= 200
        assert any(e["id"] == entry_id for e in j["entries"])
        r3 = s.delete(f"{API}/diary/{entry_id}", headers=auth)
        assert r3.status_code == 200
        r4 = s.get(f"{API}/diary?date=2026-01-06", headers=auth)
        assert not any(e["id"] == entry_id for e in r4.json()["entries"])

    def test_water(self, s, auth):
        r = s.post(f"{API}/water", headers=auth, json={"ml": 500, "date": "2026-01-06"})
        assert r.status_code == 200 and r.json()["ml"] >= 500
        r2 = s.post(f"{API}/water", headers=auth, json={"ml": 250, "date": "2026-01-06"})
        assert r2.json()["ml"] >= 750

    def test_recent_and_weekly(self, s, auth):
        r = s.get(f"{API}/foods/recent", headers=auth)
        assert r.status_code == 200 and isinstance(r.json(), list)
        r2 = s.get(f"{API}/nutrition/weekly", headers=auth)
        assert r2.status_code == 200
        assert len(r2.json()) == 7


# ---------- EXERCISES ----------
class TestExercises:
    def test_list_by_muscle_group(self, s, auth):
        r = s.get(f"{API}/exercises?muscle_group=chest", headers=auth)
        assert r.status_code == 200
        data = r.json()
        assert len(data) > 0
        assert all(e["muscle_group"] == "chest" for e in data)

    def test_equipment_only_filter(self, s, auth):
        r = s.get(f"{API}/exercises?equipment_only=true", headers=auth)
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# ---------- PLANS ----------
class TestPlans:
    def test_seeded_templates(self, s, auth):
        r = s.get(f"{API}/plans?templates_only=true", headers=auth)
        assert r.status_code == 200
        templates = [p for p in r.json() if p.get("is_template")]
        assert len(templates) >= 6

    def test_crud_custom_plan(self, s, auth):
        r = s.post(f"{API}/plans", headers=auth, json={
            "name": "TEST_MyPlan", "level": "beginner", "goal": "muscle_gain", "split": "PPL",
            "days": [{"name": "Push", "exercises": [{"exercise_name": "Bench Press", "sets": 3, "reps": "8"}]}]
        })
        assert r.status_code == 200
        pid = r.json()["id"]
        r2 = s.get(f"{API}/plans/{pid}", headers=auth)
        assert r2.status_code == 200 and r2.json()["name"] == "TEST_MyPlan"
        r3 = s.put(f"{API}/plans/{pid}", headers=auth, json={
            "name": "TEST_MyPlan_v2", "level": "intermediate", "goal": "muscle_gain", "split": "PPL",
            "days": []
        })
        assert r3.status_code == 200 and r3.json()["name"] == "TEST_MyPlan_v2"
        r4 = s.delete(f"{API}/plans/{pid}", headers=auth)
        assert r4.status_code == 200
        r5 = s.get(f"{API}/plans/{pid}", headers=auth)
        assert r5.status_code == 404


# ---------- SESSIONS / PRs / GAMIFICATION ----------
class TestSessions:
    def test_log_session_computes_volume_pr_xp(self, s, auth):
        payload = {
            "name": "TEST_Push Day", "duration": 3600,
            "exercises": [{
                "exercise_name": "TEST_Bench Press", "muscle_group": "chest",
                "sets": [{"reps": 5, "weight": 100, "done": True},
                         {"reps": 5, "weight": 100, "done": True},
                         {"reps": 5, "weight": 105, "done": True}]
            }]
        }
        r = s.post(f"{API}/sessions", headers=auth, json=payload)
        assert r.status_code == 200
        j = r.json()
        assert j["volume"] > 0
        assert j["total_sets"] == 3
        assert j["xp_earned"] == 100
        assert len(j["new_prs"]) >= 1

        prs = s.get(f"{API}/prs", headers=auth).json()
        assert any(p["exercise_name"] == "TEST_Bench Press" for p in prs)

        sessions = s.get(f"{API}/sessions", headers=auth).json()
        assert any(sess["name"] == "TEST_Push Day" for sess in sessions)

    def test_gamification_after_session(self, s, auth):
        r = s.get(f"{API}/gamification", headers=auth)
        assert r.status_code == 200
        j = r.json()
        assert j["xp"] >= 100
        assert j["level"] >= 1
        assert isinstance(j["achievements"], list) and len(j["achievements"]) > 0
        assert any(a.get("unlocked") for a in j["achievements"])
        assert isinstance(j["challenges"], list)


# ---------- CYCLE / STATS / DASHBOARD ----------
class TestCycleStatsDashboard:
    def test_cycle_default_and_update(self, s, auth):
        r = s.get(f"{API}/cycle", headers=auth)
        assert r.status_code == 200
        j = r.json()
        assert "days" in j and "completed" in j and "day_dates" in j
        ws = j["week_start"]

        r2 = s.put(f"{API}/cycle", headers=auth, json={
            "week_start": ws,
            "days": {"mon": {"type": "workout", "plan_name": "Push"},
                     "tue": {"type": "rest"}, "wed": {"type": "rest"}, "thu": {"type": "rest"},
                     "fri": {"type": "rest"}, "sat": {"type": "rest"}, "sun": {"type": "rest"}}
        })
        assert r2.status_code == 200
        assert r2.json()["days"]["mon"]["type"] == "workout"

    def test_stats_overview(self, s, auth):
        r = s.get(f"{API}/stats/overview", headers=auth)
        assert r.status_code == 200
        j = r.json()
        for k in ("total_workouts", "total_volume", "total_sets", "muscle_groups",
                  "weekly_frequency", "volume_series", "pr_count"):
            assert k in j
        assert j["total_workouts"] >= 1
        assert len(j["weekly_frequency"]) == 8

    def test_dashboard(self, s, auth):
        r = s.get(f"{API}/dashboard", headers=auth)
        assert r.status_code == 200
        j = r.json()
        for k in ("profile", "metrics", "nutrition", "weight_series",
                  "today_plan", "workouts_this_week", "gamification"):
            assert k in j
        assert j["gamification"]["xp"] >= 100


# ---------- PROGRESS PHOTOS ----------
class TestPhotos:
    _PNG = (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
        b"\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\rIDATx\x9cc\xf8\xff"
        b"\xff?\x00\x05\xfe\x02\xfe\xdc\xccY\xe7\x00\x00\x00\x00IEND\xaeB`\x82"
    )

    def test_photo_upload_list_serve_delete(self, s, user_token):
        headers = {"Authorization": f"Bearer {user_token}"}
        files = {"file": ("test.png", io.BytesIO(self._PNG), "image/png")}
        data = {"note": "TEST_photo", "date_str": "2026-01-06"}
        r = requests.post(f"{API}/photos", headers=headers, files=files, data=data, timeout=60)
        if r.status_code != 200:
            pytest.skip(f"Photo upload not available (storage): {r.status_code} {r.text[:200]}")
        pid = r.json()["id"]

        r2 = s.get(f"{API}/photos", headers=headers)
        assert r2.status_code == 200
        assert any(p["id"] == pid for p in r2.json())
        # response should not leak storage_path
        assert all("storage_path" not in p for p in r2.json())

        # serve via query token
        r3 = requests.get(f"{API}/files/{pid}?token={user_token}", timeout=30)
        assert r3.status_code == 200
        assert r3.headers.get("Content-Type", "").startswith("image/")

        # unauthorized: no token
        r4 = requests.get(f"{API}/files/{pid}", timeout=30)
        assert r4.status_code == 401

        # delete
        r5 = s.delete(f"{API}/photos/{pid}", headers=headers)
        assert r5.status_code == 200
        r6 = s.get(f"{API}/photos", headers=headers)
        assert not any(p["id"] == pid for p in r6.json())
