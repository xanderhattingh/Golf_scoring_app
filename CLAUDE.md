# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Golf Scoring is a React TypeScript web application for managing golf scores, courses, players, and rounds. This is a single-user local-only app that stores all data in localStorage (no backend API required).

## Commands

- `npm run dev` - Start development server with hot reload
- `npm run build` - TypeScript compile + Vite production build
- `npm run lint` - Run ESLint on the codebase
- `npm run preview` - Preview production build locally

## Architecture

### Tech Stack
- React 19 with TypeScript
- Vite 7 with SWC plugin
- React Router DOM for routing
- React Hook Form + Zod for form validation
- SCSS for styling
- react-simple-toasts for notifications

### Project Structure

```
src/
├── Contexts/         # React contexts (UserContext for auth state)
├── components/       # Shared UI components (modals, inputs, navigation)
├── pages/
│   ├── Auth/         # Login page (simplified for local-only mode)
│   └── Dashboard/    # Dashboard pages (Courses, Players, Rounds)
├── routes/           # Routing configuration and Protected route wrapper
├── services/         # LocalDataService (localStorage CRUD), StorageService (user data)
└── styles/           # SCSS organized by Components, Pages, Shared
```

### Key Patterns

**Data Storage (LocalDataService):**
- All data stored in localStorage with keys: `golf_scoring_courses`, `golf_scoring_players`, `golf_scoring_rounds`
- `LocalDataService` provides CRUD operations for courses, players, and rounds
- Data persists in browser localStorage between sessions

**Authentication (Local-only):**
- Simplified auth - clicking "Enter App" initializes a local user
- User data stored in localStorage under key `Golf_Scoring_User`
- `Protected` component guards dashboard routes using token check

**Form Handling:**
- Forms use React Hook Form with Zod schemas for validation
- Pattern: define schema → useForm with zodResolver → handleSubmit

**Routing:**
- Entry point: `/` or `/login` shows welcome screen
- Protected routes: `/dashboard/courses`, `/dashboard/players`, `/dashboard/rounds`
- Dashboard component provides UserContext and Navigation to child routes via Outlet

### Data Models

**Course:** id, name, holes (array of 18 holes with hole_number, hole_par, hole_stroke), created_at

**Player:** id, name, handicap (0-54), created_at

**Round:** id, course, players, scoring_method, date, completed, created_at

**Scoring Methods (built-in):** Stroke Play, Stableford, Match Play
