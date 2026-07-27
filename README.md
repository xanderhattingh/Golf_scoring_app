# Golf Scoring

Golf Scoring is a React + Capacitor app for tracking rounds, running club tournaments, and settling arguments about who owes drinks. It talks to a companion Laravel API for storage, auth, and multi-player sync.

Currently targeting Android via Capacitor; the same codebase runs as a web app for development and browser use.

## Features

- **Courses** — add courses by hand or import them from `golfcourseapi.com` (tees, holes, pars, stroke indices).
- **Friends & players** — invite friends by phone number, add guests, share handicaps.
- **Rounds** — a 5-step wizard (course → players → handicaps → scoring method → format) covering ten scoring methods:
  Stroke Play, Stableford, Match Play, Stableford with Pink, Stableford with Animals (Tree/Water/Bunker/3-Putt), Stableford Animals + Pink, Medal (net), Four Ball Alliance, Two Ball Alliance, Betterball Stableford, Worst Ball Stableford.
- **Tournaments** — one invite code, many fourballs/twoballs, leaderboard, per-player scorecards.
- **PDF export** — themed round + tournament scorecards via jsPDF; native share sheet on Android.
- **Password reset by email** — link opens the app via a deep link (`golfscoring://reset?token=…`) and drops the user on the new-password screen.

## Tech stack

- React 19 + TypeScript + Vite 7 (SWC)
- React Router DOM · React Hook Form + Zod
- SCSS (Clubhouse design language — fairway emerald, championship gold, cream)
- Capacitor 8 (Android target, iOS ready)
- Axios · react-simple-toasts · jsPDF + jspdf-autotable

## Getting started

Prerequisites: **Node 22+** and **npm**.

```bash
git clone git@github.com:xanderhattingh/Golf_scoring_app.git
cd Golf_scoring_app
npm install
cp .env.example .env.development   # fill in the two env vars
npm run dev
```

Open the URL Vite prints (typically `http://localhost:5173`). The app expects the Laravel API to be running — either against your local `php artisan serve` on port 8000 or a deployed instance.

### Environment variables

Copy `.env.example` and fill in:

| Var | Purpose |
|---|---|
| `VITE_API_BASE_URL` | URL of the Laravel API (`http://127.0.0.1:8000/api/` for local dev). |
| `VITE_GOLF_COURSE_API_KEY` | API key for [golfcourseapi.com](https://golfcourseapi.com), used by the *Import course from API* flow. |

Both `.env` and `.env.development` are git-ignored.

## Scripts

- `npm run dev` — Vite dev server with HMR
- `npm run build` — TypeScript project build (`tsc -b`) + Vite production build to `dist/`
- `npm run preview` — serve the production build locally
- `npm run lint` — ESLint over `src/`

Type-checking is done by the build (`tsc -b`) — the root `tsconfig.json` uses project references, so `tsc --noEmit` on it alone checks nothing.

## Android build

```bash
npm run build
npx cap sync android
npx cap open android         # opens Android Studio for signed build / device install
```

The Android manifest is set up for the `golfscoring://` custom-scheme deep link used by the password-reset email flow.

## Project structure

```
src/
├── assets/           # backgrounds, images
├── components/       # shared UI (modals, nav, crest, deep-link listener)
├── Contexts/         # UserContext
├── pages/
│   ├── Auth/         # Login, Register, ForgotPassword, ResetPassword
│   └── Dashboard/    # Courses, Players, Rounds, RoundDetail, Tournament, Profile
├── routes/           # router config + Protected wrapper
├── services/         # HttpService, StorageService, GolfCourseApiService
└── styles/           # SCSS: Components, Pages, Shared, theme.scss
```

## Related

The companion Laravel 12 + PostgreSQL API (Sanctum auth, course/round/tournament CRUD, password reset via Brevo SMTP) lives in the sibling `API/golf_scoring` project.
