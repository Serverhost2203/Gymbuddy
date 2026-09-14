# Iteration 6: Verify registration works for myscraptv@gmail.com after leftover
# test account was deleted from MongoDB. Covers: register (200 + access_token +
# is_admin=true via SUPER_ADMIN auto-grant), login, GET /api/auth/me, and that a
# duplicate register correctly returns 409 auth.email_unavailable.
# NOTE: the account created here is deleted by a separate mandatory cleanup step
# (db.users.deleteMany) after the run, NOT in this file, so evidence remains visible.

import os
import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # fallback: read from frontend .env
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("EXPO_PUBLIC_BACKEND_URL="):
                BASE_URL = line.strip().split("=", 1)[1].rstrip("/")
                break

EMAIL = "myscraptv@gmail.com"
PASSWORD = "TmpVerify123"


def _delete_account():
    """Remove the verification account directly from MongoDB."""
    client = MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
    db = client[os.environ.get("DB_NAME", "test_database")]
    res = db.users.delete_many({"email": EMAIL})
    return res.deleted_count


@pytest.fixture(scope="module", autouse=True)
def clean_slate():
    # Precondition: leftover test account must be gone so register returns 200
    # (mirrors the manual MongoDB deletion done by the main agent).
    _delete_account()
    yield
    # Teardown: leave DB clean so later modules (super-admin fixture) can
    # register the email fresh with their own password.
    _delete_account()


class TestSuperAdminRegistration:
    token = None

    def test_register_returns_200_with_token_and_admin(self):
        r = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={"email": EMAIL, "password": PASSWORD, "name": "Verify User"},
            timeout=30,
        )
        assert r.status_code == 200, f"expected 200, got {r.status_code}: {r.text}"
        data = r.json()
        assert "access_token" in data and data["access_token"], "missing access_token"
        assert data.get("user", {}).get("email") == EMAIL
        assert data.get("user", {}).get("is_admin") is True, "super-admin auto-grant missing"
        TestSuperAdminRegistration.token = data["access_token"]

    def test_login_works_and_is_admin(self):
        r = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": EMAIL, "password": PASSWORD},
            timeout=30,
        )
        assert r.status_code == 200, f"login failed: {r.status_code}: {r.text}"
        data = r.json()
        assert "access_token" in data
        assert data.get("user", {}).get("is_admin") is True

    def test_get_me_returns_profile(self):
        assert TestSuperAdminRegistration.token, "no token from register step"
        r = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {TestSuperAdminRegistration.token}"},
            timeout=30,
        )
        assert r.status_code == 200, f"/me failed: {r.status_code}: {r.text}"
        data = r.json()
        assert data.get("email") == EMAIL
        assert data.get("is_admin") is True

    def test_duplicate_register_returns_409(self):
        r = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={"email": EMAIL, "password": PASSWORD, "name": "Dup"},
            timeout=30,
        )
        assert r.status_code == 409, f"expected 409, got {r.status_code}: {r.text}"
        assert "email_unavailable" in r.text
