# Forge Fitness — Self-Hosting auf Linux Mint

Diese Anleitung zeigt, wie Sie **alle Daten** (Backend + MongoDB-Datenbank) auf Ihrem
eigenen Linux-Mint-Server betreiben. Die App-Daten (Nutzer, Workouts, Ernährung, Fotos)
liegen dann komplett bei Ihnen.

> Architektur: **FastAPI (Python)** Backend + **MongoDB** Datenbank. Die mobile App (Expo)
> spricht nur mit dem Backend über die Umgebungsvariable `EXPO_PUBLIC_BACKEND_URL`.

---

## 1. Systempakete installieren

```bash
sudo apt update
sudo apt install -y python3 python3-venv python3-pip git curl gnupg
```

## 2. MongoDB installieren

```bash
# MongoDB 7 Repo hinzufügen
curl -fsSL https://pgp.mongodb.com/server-7.0.asc | \
  sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | \
  sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
sudo apt update
sudo apt install -y mongodb-org
sudo systemctl enable --now mongod
```

Prüfen: `mongosh --eval "db.runCommand({ ping: 1 })"` → `{ ok: 1 }`

## 3. Backend-Code holen

Laden Sie den Ordner `/app/backend` aus Ihrem Projekt herunter
(Emergent: **Save to GitHub** oder Code-Download) und legen Sie ihn z. B. unter
`/opt/forge/backend` ab.

```bash
sudo mkdir -p /opt/forge && sudo chown $USER /opt/forge
# backend-Ordner nach /opt/forge/backend kopieren
cd /opt/forge/backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## 4. Konfiguration (`.env`)

Erstellen Sie `/opt/forge/backend/.env`:

```env
MONGO_URL="mongodb://localhost:27017"
DB_NAME="forge_fitness"
JWT_SECRET="HIER-EIGENES-LANGES-GEHEIMNIS-EINSETZEN"
EMERGENT_LLM_KEY=""   # nur nötig, wenn Fortschrittsfotos im Emergent-Speicher liegen sollen
```

> **Fortschrittsfotos lokal speichern:** Wenn Sie ohne Emergent-Speicher arbeiten wollen,
> können die Fotos stattdessen auf der Festplatte des Servers abgelegt werden
> (kleine Anpassung der `/photos`-Endpunkte auf lokales Dateisystem). Sagen Sie
> Bescheid, dann liefere ich Ihnen diese Variante.

## 5. Backend starten

```bash
cd /opt/forge/backend
source .venv/bin/activate
uvicorn server:app --host 0.0.0.0 --port 8001
```

Test: `curl http://localhost:8001/api/equipment` → JSON mit Equipment-Liste.
Beim ersten Start legt das Backend automatisch die Übungen, Lebensmittel, Pläne,
Erfolge und den Admin-Account (`admin@forge.app` / `Admin123!`) an.

## 6. Dauerhaft laufen lassen (systemd)

`/etc/systemd/system/forge-backend.service`:

```ini
[Unit]
Description=Forge Fitness Backend
After=network.target mongod.service

[Service]
User=%i
WorkingDirectory=/opt/forge/backend
ExecStart=/opt/forge/backend/.venv/bin/uvicorn server:app --host 0.0.0.0 --port 8001
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now forge-backend
```

## 7. App auf Ihren Server zeigen lassen

In `frontend/.env` (bzw. beim Build) setzen:

```env
EXPO_PUBLIC_BACKEND_URL=http://IHRE-SERVER-IP:8001
```

Für Zugriff von außerhalb empfiehlt sich ein Reverse-Proxy (nginx) mit HTTPS
(Let's Encrypt) auf eine Domain, die auf Ihren Server zeigt.

## 8. Backups (alle Daten sichern)

```bash
# Sicherung
mongodump --db forge_fitness --out /opt/forge/backups/$(date +%F)
# Wiederherstellung
mongorestore --db forge_fitness /opt/forge/backups/DATUM/forge_fitness
```

Damit haben Sie die **volle Kontrolle** über alle App-Daten auf Ihrem Linux-Mint-Server.
