"""
Iteration tests for:
- Food DB availability (empty q browse, text search, source=off enrichment when possible)
- Admin content management for exercises/foods/achievements (auth + CRUD)
- Barcode regression
"""
import os
import uuid
import pytest
import requests

BASE = os.environ.get("EXPO_PUBLIC_BACKEND_URL").rstrip("/")
API = f"{BASE}/api"


# ---------- FOOD DB AVAILABILITY ----------
class TestFoodSearchAvailability:
    def test_empty_query_returns_builtin_db(self, s, auth):
        # empty q => browse built-in local foods (limit 40)
        r = s.get(f"{API}/foods/search?q=", headers=auth)
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data, list)
        # spec: >=30 items (local limit is 40, seed grew to ~84)
        assert len(data) >= 30, f"Expected >=30 built-in foods, got {len(data)}"
        # every item has macros keys
        for item in data:
            for k in ("calories", "protein", "carbs", "fat"):
                assert k in item, f"missing {k} in {item.get('name')}"

    def test_search_milk_local_and_maybe_off(self, s, auth):
        r = s.get(f"{API}/foods/search?q=milk", headers=auth)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list) and len(data) > 0
        # at least one local (non-off) match
        assert any(item.get("source") != "off" for item in data), \
            "expected at least one local match for 'milk'"
        # OFF results are best-effort — accept absence, but if present must have kcal>=0
        for item in data:
            if item.get("source") == "off":
                assert item.get("calories") is not None

    def test_search_chicken_has_calories(self, s, auth):
        r = s.get(f"{API}/foods/search?q=chicken", headers=auth)
        assert r.status_code == 200
        data = r.json()
        assert len(data) > 0
        assert any((it.get("calories") or 0) > 0 for it in data), \
            "expected at least one chicken result with non-zero calories"

    def test_admin_foods_list_has_seeded(self, s, admin_auth):
        r = s.get(f"{API}/admin/foods", headers=admin_auth)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        # spec: at least ~80 seeded local foods
        assert len(data) >= 80, f"Expected >=80 admin foods, got {len(data)}"


# ---------- BARCODE REGRESSION ----------
class TestBarcode:
    def test_barcode_returns_200_or_404(self, s, auth):
        r = s.get(f"{API}/foods/barcode/737628064502", headers=auth)
        assert r.status_code in (200, 404), r.text
        if r.status_code == 200:
            body = r.json()
            for k in ("name", "calories", "protein", "carbs", "fat"):
                assert k in body


# ---------- ADMIN CONTENT MANAGEMENT ----------
class TestAdminExercises:
    def test_auth_required(self, s):
        r = s.get(f"{API}/admin/exercises")
        assert r.status_code == 401

    def test_forbidden_for_normal_user(self, s, auth):
        r = s.get(f"{API}/admin/exercises", headers=auth)
        assert r.status_code == 403

    def test_list_has_seeded_exercises(self, s, admin_auth):
        r = s.get(f"{API}/admin/exercises", headers=admin_auth)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        # spec ~43 seeded
        assert len(data) >= 40, f"expected ~43 seeded exercises, got {len(data)}"

    def test_crud_exercise(self, s, admin_auth):
        name = f"TEST_Ex_{uuid.uuid4().hex[:6]}"
        r = s.post(f"{API}/admin/exercises", headers=admin_auth,
                   json={"name": name, "muscle_group": "chest",
                         "equipment": ["barbell"], "instructions": "test"})
        assert r.status_code == 200, r.text
        ex = r.json()
        assert ex["name"] == name and ex["id"]
        ex_id = ex["id"]

        # Update
        r2 = s.put(f"{API}/admin/exercises/{ex_id}", headers=admin_auth,
                   json={"instructions": "updated instructions"})
        assert r2.status_code == 200
        assert r2.json()["instructions"] == "updated instructions"

        # Verify via list
        r3 = s.get(f"{API}/admin/exercises", headers=admin_auth)
        assert any(e["id"] == ex_id and e["instructions"] == "updated instructions"
                   for e in r3.json())

        # Delete
        r4 = s.delete(f"{API}/admin/exercises/{ex_id}", headers=admin_auth)
        assert r4.status_code == 200
        r5 = s.get(f"{API}/admin/exercises", headers=admin_auth)
        assert not any(e["id"] == ex_id for e in r5.json())


class TestAdminFoods:
    def test_auth_required(self, s):
        r = s.post(f"{API}/admin/foods", json={"name": "x"})
        assert r.status_code == 401

    def test_forbidden_for_normal_user(self, s, auth):
        r = s.post(f"{API}/admin/foods", headers=auth,
                   json={"name": "TEST_Nope", "calories": 10})
        assert r.status_code == 403

    def test_create_and_delete_food(self, s, admin_auth):
        name = f"TEST_Food_{uuid.uuid4().hex[:6]}"
        r = s.post(f"{API}/admin/foods", headers=admin_auth,
                   json={"name": name, "brand": "TESTBrand",
                         "calories": 123, "protein": 10, "carbs": 20, "fat": 5})
        assert r.status_code == 200
        food = r.json()
        assert food["name"] == name and food["calories"] == 123
        assert food["user_id"] is None and food["verified"] is True
        fid = food["id"]

        # It should show up in admin list
        r2 = s.get(f"{API}/admin/foods", headers=admin_auth)
        assert any(f["id"] == fid for f in r2.json())

        # And in search (as local)
        r3 = s.get(f"{API}/foods/search?q={name}", headers=admin_auth)
        assert r3.status_code == 200
        assert any(f["name"] == name for f in r3.json())

        # Delete
        r4 = s.delete(f"{API}/admin/foods/{fid}", headers=admin_auth)
        assert r4.status_code == 200
        r5 = s.get(f"{API}/admin/foods", headers=admin_auth)
        assert not any(f["id"] == fid for f in r5.json())


class TestAdminAchievements:
    def test_auth_required(self, s):
        r = s.get(f"{API}/admin/achievements")
        assert r.status_code == 401

    def test_forbidden_for_normal_user(self, s, auth):
        r = s.get(f"{API}/admin/achievements", headers=auth)
        assert r.status_code == 403

    def test_list_seeded(self, s, admin_auth):
        r = s.get(f"{API}/admin/achievements", headers=admin_auth)
        assert r.status_code == 200
        data = r.json()
        # spec: 12 seeded
        assert len(data) >= 12, f"expected >=12 achievements, got {len(data)}"

    def test_upsert_and_delete_achievement(self, s, admin_auth):
        code = f"TEST_ach_{uuid.uuid4().hex[:6]}"
        r = s.post(f"{API}/admin/achievements", headers=admin_auth,
                   json={"code": code, "name": "Test Badge",
                         "description": "for testing", "icon": "Trophy",
                         "xp": 50, "category": "workout"})
        assert r.status_code == 200
        assert r.json()["code"] == code

        # Upsert idempotency (same code, updated name)
        r2 = s.post(f"{API}/admin/achievements", headers=admin_auth,
                    json={"code": code, "name": "Test Badge v2",
                          "description": "for testing", "icon": "Trophy",
                          "xp": 75, "category": "workout"})
        assert r2.status_code == 200
        r3 = s.get(f"{API}/admin/achievements", headers=admin_auth)
        matches = [a for a in r3.json() if a["code"] == code]
        assert len(matches) == 1 and matches[0]["name"] == "Test Badge v2" \
               and matches[0]["xp"] == 75

        # Delete
        r4 = s.delete(f"{API}/admin/achievements/{code}", headers=admin_auth)
        assert r4.status_code == 200
        r5 = s.get(f"{API}/admin/achievements", headers=admin_auth)
        assert not any(a["code"] == code for a in r5.json())
