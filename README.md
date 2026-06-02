# LinksInvite

LinksInvite is a golf group coordination app built as a hobby project to practice full-stack product development. The current version focuses on helping a golf group organize recurring games, manage players, request tee times, and keep members informed from one lightweight web app.

Live app: [linksinvite.vercel.app](https://linksinvite.vercel.app)

## Why this project exists

This repo is a learning project. The goal is to build practical skills by evolving a real app over time: starting with group and tee-time coordination, then expanding into richer golf workflows such as nearby course selection and basic score keeping.

## Current features

### Player experience

- **Account sign-up and sign-in** using Supabase authentication.
- **Create or join a golf group** during registration.
- **Group switching** for users who belong to more than one group.
- **Games dashboard** showing scheduled games for the selected group.
- **Game registration** with support for:
  - Registering for an open game
  - Unregistering from a game
  - Joining a waitlist when a game is full
  - Leaving the waitlist
- **Player lists** showing who is registered and who is waitlisted.
- **Game details** including date, day, time, course, description, rules, player count, open slots, and waitlist count.
- **Profile area** for player information.
- **3-day course forecast** for the group’s primary location, including temperature, rain chance, and playability rating.

### Admin experience

- **Admin panel** available to group admins and owners.
- **Game management** for creating, editing, and deleting games.
- **Game configuration** including:
  - Day
  - Date
  - First tee time
  - Course/location
  - Max players
  - Description
  - Rules
  - Player assignment toggle
  - Pairing method
- **Pairing method options** currently include:
  - Balanced — matched by handicap
  - Blind draw — random assignment
  - System pairing — GHIN-based
  - None — admin assigns manually
- **Recurring game configuration** with weekly, biweekly, monthly, and yearly options.
- **Location management** for adding golf courses/locations to a group.
- **Tee-time contact management** for each location, including contact name, email, and phone.
- **Member and role management** for group owners, including owner, admin, and player roles.
- **Group settings** for owner-level group administration.

### Tee-time workflow

- **Tee-time request composer** for admins.
- **Requested tee-time generation** based on the game’s first tee time and number of foursomes.
- **Email preview** before sending a tee-time request.
- **Pro shop response link** that lets a recipient confirm a requested time or suggest alternates.
- **Public tee-time response page** for confirmations and alternate-time responses.
- **Tee-time request tracking** inside the admin panel, including pending/responded status.
- **Demo response simulation** for testing the tee-time workflow.

### Technical foundation

- **React + Vite** front end.
- **Supabase** for authentication and data persistence.
- **Vercel serverless functions** under the `api/` directory.
- **Weather API endpoint** for forecast enrichment.
- **Supabase schema-oriented API structure** aligned to tables such as groups, users, games, registrations, locations, tee times, tee-time requests, and recurring game series.

## Planned functionality

The project is intentionally incremental. Planned additions include:

- **Golf course selection from nearby courses**
  - Use location data to suggest courses near the player or group.
  - Make it easier for admins to choose a course when creating a game.

- **Basic score keeping**
  - Record player scores for a round.
  - Track simple round history.
  - Potentially add handicap-aware summaries over time.

## Tech stack

| Area | Technology |
| --- | --- |
| Front end | React 18, Vite |
| Styling | Inline styles, Tailwind configuration available |
| Backend/API | Vercel serverless functions |
| Database/Auth | Supabase |
| Deployment | Vercel |
| Icons/UI utilities | lucide-react |

## Repository structure

```text
linksinvite/
├── api/                      # Vercel serverless API functions
│   ├── _lib/                 # Shared API helpers
│   ├── tee_time_requests/    # Tee-time response workflow
│   ├── tee_times/            # Tee-time request workflow
│   └── weather.js            # Weather forecast endpoint
├── readme/                   # Architecture and handoff documentation assets
├── src/                      # React application source
│   ├── App.jsx               # Main application UI and workflows
│   ├── main.jsx              # React entry point
│   ├── index.css             # Global styles
│   └── supabaseClient.js     # Supabase client setup
├── .env.example              # Environment variable example
├── package.json              # Scripts and dependencies
├── vite.config.js            # Vite config
└── vercel.json               # Vercel config
```

## Getting started

### Prerequisites

- Node.js
- npm
- Supabase project
- Vercel account, if deploying

### Local setup

1. Clone the repo:

   ```bash
   git clone https://github.com/alherndon/linksinvite.git
   cd linksinvite
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Create a local environment file:

   ```bash
   cp .env.example .env.local
   ```

4. Add your Supabase client variables:

   ```env
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

5. Start the development server:

   ```bash
   npm run dev
   ```

6. For local API function testing with Vercel:

   ```bash
   npm run dev:api
   ```

## Available scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite development server |
| `npm run dev:api` | Start local Vercel dev server for API testing |
| `npm run dev:full` | Start the Vercel dev environment |
| `npm run build` | Build the app for production |
| `npm run preview` | Preview the production build locally |

## Notes for future development

This project is still evolving. A few useful next steps:

- Break `src/App.jsx` into smaller components as the feature set grows.
- Add formal tests for registration, waitlist, admin game management, and tee-time response flows.
- Document Supabase table policies and required seed data.
- Add clearer error handling around email delivery and weather lookup failures.
- Add a product roadmap or GitHub issues for planned golf-course search and score keeping.

## Project status

Active hobby project. Current focus is learning, iteration, and building practical full-stack development skills through a real golf coordination use case.
