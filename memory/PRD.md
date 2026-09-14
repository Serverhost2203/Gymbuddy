# Forge Fitness — PRD

## Original Problem Statement
Modern, premium dark fitness & gym app (Android + iOS). Progress-tracking focused. Full scope: profile/BMI/calories, food tracking (Open Food Facts + barcode), workout system, equipment profile, workout plans, weekly training cycle, progress & statistics, gamification, notifications, admin system, multi-language (DE/EN/ES/FR/IT).

## User Choices
- Auth: JWT email + password
- Food data: Open Food Facts (barcode + search)
- Scope: full incl. admin & notifications
- Progress photos: Emergent Managed Object Storage (backend portable to self-host Linux Mint later)
- Default language: system auto-detect

## Architecture
- Frontend: Expo Router (React Native), react-query, i18next, react-native-gifted-charts, react-native-svg progress rings, reanimated, keyboard-controller, phosphor icons. Dark-only theme in src/theme.ts.
- Backend: FastAPI + Motor/MongoDB, JWT (bcrypt+pyjwt), Open Food Facts proxy, Emergent object storage for photos.
- Collections: users, weight_entries, measurements, progress_photos, foods, diary_entries, water_entries, exercises, workout_plans, workout_sessions, personal_records, weekly_cycle, achievements, user_achievements, challenges, translations.

## Personas
- Gym-goer tracking lifts, nutrition and body progress.
- Admin managing users/content.

## Implemented (2026-06-14)
- Auth: register/login/me (JWT). Admin seeded admin@forge.app / Admin123!.
- Onboarding + profile, computed metrics (BMI, Mifflin-St Jeor TDEE, calorie target, macros, realistic weeks-to-goal).
- Dashboard: today's workout, weight/BMI, calorie ring, macro rings, weekly dots, weight trend chart, quick actions, level/streak.
- Nutrition: diary (4 meals), macros bars, water tracker, food search (local + OFF), barcode scanner (expo-camera), manual + custom foods, recent, weekly overview.
- Workout: muscle-group browse, 6 seeded plan templates + equipment filter, custom plan builder, active session logging with rest timer + PR detection, weekly training cycle editor.
- Progress: weight/BMI charts, measurements, progress photos (object storage), stats (volume/frequency/muscle groups), PRs, gamification (XP/levels/achievements/challenges/streaks).
- Profile: edit profile/goals, equipment selection, settings (language switch DE/EN/ES/FR/IT + notification toggles), admin dashboard (stats + user management).
- i18n: 5 languages, device auto-detect, persisted override.
- Backend tests: 32/32 pass.

## Backlog / Remaining
- P1: Push notifications (workout/meal/water/PR reminders) — requires Emergent push integration + build; not in Expo Go.
- P1: Admin content editors (exercises/foods/achievements/translations) — endpoints exist, UI is stats + user mgmt only.
- P2: Progressive-overload suggestions, favorites (separate from recent), imperial units conversion, offline cache layer.
- P2: BMI history chart, monthly/yearly stat ranges.

## Next Tasks
- Wire push notifications on user request.
- Expand admin UI to CRUD exercises/foods/translations.

## Iteration 2 (2026-06-14)
- FIXED: Food database now browsable — /api/foods/search accepts empty query and returns built-in DB (~84 foods, all with macros); text search switched to search.openfoodfacts.org (old cgi API returned 503). Food add screen shows the database immediately.
- FIXED: Training set input boxes redesigned in workout/session.tsx — uniform SET/KG/REPS columns with aligned boxes and done check.
- ADDED: Admin content management UI (admin/index.tsx) with tabs Stats/Users/Exercises/Foods/Achievements — add/edit/delete via backend admin endpoints (+ new GET list & DELETE achievement endpoints).
- ADDED: /app/SELF_HOSTING.md — full guide to run backend + MongoDB on the user's Linux Mint server (systemd, backups, EXPO_PUBLIC_BACKEND_URL).
- Backend tests: 48/48 pass.

## Iteration 3 (2026-06-14)
- ADDED: Progressive overload — POST /api/exercises/suggestions returns last performance + next-target suggestion per exercise; active session shows "Last: … · Target: …" with an Apply button that fills all sets.
- ADDED: User-configurable training settings — default rest time (60/90/120/180s chips), auto-start-rest toggle, daily water goal; persisted in user.settings and honored across session rest timer & nutrition water card. Rest is also editable per-exercise (±15s) live in a session.
- Backend tests: 64/64 pass.

## Iteration 4 (2026-06-14)
- ADDED: Super-admin — email myscraptv@gmail.com is auto-granted is_admin on register/login (and on startup). Only admins see the "Admin Panel" row.
- ADDED: Admin Panel user-detail — GET /api/admin/users/{id}/detail returns profile (incl. birthdate/Geb.), computed BMI/calories, full training history (date, name, duration, volume, sets, per-set weights & reps), PRs, weight history, totals. New screen app/admin/user/[id].tsx; user rows in admin are tappable. Access limited to admins (401/403 otherwise).
- ADDED: birthdate field in profile editor.
- Backend tests: 76/76 pass.
