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
