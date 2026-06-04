# Systems Architecture Document: LinksInvite

**Prepared artifact version:** 2026-06-02 deliverable generated from the uploaded architecture draft, uploaded Supabase public schema CSV, and public GitHub repository landing page.


## 1. Executive Summary

**Status legend:**

- **Confirmed** — directly supported by repository evidence.
- **Inferred** — strongly suggested by code or configuration, but not explicitly documented.
- **Assumed** — reasonable interpretation requiring validation.
- **Unknown** — not found in the repository evidence reviewed.

### Summary

LinksInvite is a golf game invitation and tee-time coordination application. The repository describes it as a “Golf game invitation app” that sends invitations, tracks players, allows unregister, and provides notifications.

**Confirmed architecture:**

- A **React 18 single-page application** built with **Vite**.
- A **Vercel-hosted frontend and serverless API** model.
- A **Supabase backend** used for authentication, database access, and Row Level Security-aware data operations.
- A public tee-time response workflow that uses opaque response tokens, hashes those tokens server-side, stores only token hashes, and exposes `/respond/:token` through a Vercel rewrite.
- A weather API function that calls OpenStreetMap Nominatim for geocoding and Open-Meteo for forecast data.

**Primary users / consumers:**

- Golf group administrators / superadmins.
- Golf group players.
- Pro-shop recipients responding to tee-time requests through a public response link.

**Major technologies:**

- React, React DOM, Vite.
- Supabase JavaScript SDK.
- Vercel serverless functions.
- Tailwind/PostCSS build tooling.
- Node.js runtime for serverless API functions.
- OpenStreetMap Nominatim and Open-Meteo as weather-related integrations.

**Evidence:**

- `package.json` — `react`, `react-dom`, `vite`, `@supabase/supabase-js`, scripts `dev`, `dev:api`, `build`, `preview`.
- `api/README.md` — Vercel function convention and Supabase client guidance.
- `src/App.jsx` — main application workflow implementation.
- `src/supabaseClient.js` — browser Supabase client.
- `api/_lib/supabase.js` — server-side Supabase client factory.
- `api/tee_times/request.js` — authenticated tee-time request API.
- `api/tee_time_requests/respond.js` — public tee-time response API.
- `api/weather.js` — weather API integration.
- `vercel.json` — rewrite from `/respond/:token` to `/`.
- `.linksInvite-supabase/public-schema.csv` — exported Supabase public schema.

---

## 2. System Context

### Context Narrative

LinksInvite sits between golf group users, Supabase, Vercel serverless functions, and external weather/geocoding services. Users interact primarily with the React SPA. Authenticated workflows use Supabase Auth and Supabase database tables. Select server-side workflows use Vercel functions to handle operations that require server-side token handling or API integrations.

### External Actors and Systems

| Actor / System | Role | Status | Evidence |
|---|---|---:|---|
| Golf group admin / superadmin | Creates groups, manages games, tee-time requests, players, locations | Confirmed | `src/App.jsx`, `users`, `groups`, `group_memberships`, `games`, `locations` tables |
| Golf player | Registers/waitlists for games and belongs to groups | Confirmed | `game_registrations`, `group_memberships`, `users` tables |
| Pro shop / tee-time contact | Receives a public response link and confirms or suggests alternate tee times | Confirmed | `api/tee_times/request.js`, `api/tee_time_requests/respond.js` |
| Supabase | Auth, Postgres database, RLS-aware client access | Confirmed | `package.json`, `api/_lib/supabase.js`, `api/README.md`, `.env.example` |
| Vercel | Hosts SPA and serverless API functions | Confirmed | `api/README.md`, `vercel.json`, `package.json` scripts |
| OpenStreetMap Nominatim | Geocodes weather locations | Confirmed | `api/weather.js` |
| Open-Meteo | Returns forecast data | Confirmed | `api/weather.js` |
| Email provider / notification system | Sends invitations or tee-time request links | Unknown | Repository describes invitations/notifications, but no email provider or outbound email implementation was found |

### System Context Diagram

![Figure 1. System Context Diagram](diagrams/01_system_context.png){width=6.5in}

---

## 3. High-Level Architecture

### Major Components

| Component | Responsibility | Status | Evidence |
|---|---|---:|---|
| React SPA | Primary user interface, auth screens, public response page, group/game administration workflows | Confirmed | `src/App.jsx`, `src/main.jsx`, `src/supabaseClient.js` |
| Browser Supabase client | Client-side auth and direct database access | Confirmed | `src/supabaseClient.js`, `src/App.jsx` |
| Vercel API functions | Server-side APIs for tee-time requests, public response handling, weather forecast | Confirmed | `api/tee_times/request.js`, `api/tee_time_requests/respond.js`, `api/weather.js` |
| Server Supabase helper | Creates user-scoped and admin Supabase clients | Confirmed | `api/_lib/supabase.js` |
| Supabase database | Persists users, groups, memberships, games, registrations, tee-time requests, tee times, locations, invite records, recurring game series | Confirmed | `.linksInvite-supabase/public-schema.csv` |
| Vercel routing | Rewrites public response links to SPA root | Confirmed | `vercel.json` |

### High-Level Architecture Diagram

![Figure 2. High-Level Architecture Diagram](diagrams/02_high_level_architecture.png){width=6.5in}

### Key Architectural Observations

- The frontend appears to be a **single-module-heavy SPA**. `src/App.jsx` is approximately 1,510 lines / 87.7 KB in the GitHub view, suggesting substantial UI, state, workflow, and data transformation logic are co-located in one file.
- Server-side functions are minimal and endpoint-specific, following the repository’s API convention that each executable API file exports a default Vercel handler.
- The application uses both direct browser-to-Supabase access and server-side API-mediated access, depending on the workflow.

---

## 4. Application Architecture

### Repository Structure Summary

```text
linksinvite/
├── .linksInvite-supabase/
│   ├── .gitkeep
│   └── public-schema.csv
├── api/
│   ├── _lib/
│   │   └── supabase.js
│   ├── group_invites/
│   │   └── .gitkeep
│   ├── recurring_game_series/
│   │   └── .gitkeep
│   ├── tee_time_requests/
│   │   ├── .gitkeep
│   │   └── respond.js
│   ├── tee_times/
│   │   └── request.js
│   ├── README.md
│   └── weather.js
├── readme/
├── src/
│   ├── App.jsx
│   ├── index.css
│   ├── main.jsx
│   └── supabaseClient.js
├── .env.example
├── index.html
├── package.json
├── package-lock.json
├── postcss.config.js
├── tailwind.config.js
├── vercel.json
└── vite.config.js
```

### Application Layers

| Layer | Confirmed Implementation | Notes |
|---|---|---|
| Presentation layer | React components inside `src/App.jsx` | UI components, pages, and domain workflows are largely co-located. |
| Client state / workflow layer | React `useState` / `useEffect` in `src/App.jsx` | No separate state-management library found. |
| Client data access | Browser Supabase client and `fetch` calls to Vercel APIs | Confirmed through `src/App.jsx` imports and API calls. |
| Server API layer | Vercel function handlers under `api/` | `weather.js`, `tee_times/request.js`, `tee_time_requests/respond.js`. |
| Server data access | `api/_lib/supabase.js` | Provides RLS-scoped user client and admin client. |
| Persistence | Supabase Postgres public schema | Exported at `.linksInvite-supabase/public-schema.csv`. |

### Module / Component Diagram

![Figure 3. Module / Component Diagram](diagrams/03_module_component.png){width=6.5in}

### Configuration Management

- `.env.example` defines `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and `SUPABASE_SECRET_KEY`.
- `api/_lib/supabase.js` also supports alternate names `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY`.
- `api/README.md` instructs developers to copy `.env.example` to `.env.local` and configure the same values in Vercel.

### Error Handling Patterns

- API functions return JSON error objects with appropriate HTTP status codes.
- Common API statuses observed: `400`, `401`, `404`, `405`, `409`, `410`, `500`.
- Client-side flows surface errors in local component state.

### Cross-Cutting Concerns

| Concern | Implementation | Status |
|---|---|---:|
| Authentication | Supabase Auth in client; bearer token validation server-side | Confirmed |
| Authorization | Supabase RLS for normal user client; admin client available with caution | Confirmed in API README and `api/_lib/supabase.js` comments |
| CORS | API handlers set permissive `Access-Control-Allow-Origin: *` | Confirmed |
| Token security | Tee-time response raw token is hashed before storage | Confirmed |
| Styling | Inline styles in `src/App.jsx`, Tailwind/PostCSS config present | Confirmed |

---

## 5. Data Architecture

### Database

**Confirmed:** The application uses Supabase, which exposes a Postgres-backed public schema. The schema export is stored in `.linksInvite-supabase/public-schema.csv`.

### Primary Tables

| Table | Purpose | Key Columns Shown in Export |
|---|---|---|
| `users` | User profiles | `id`, `first_name`, `last_name`, `email`, `phone`, `password_hash`, `handicap`, `ghin`, timestamps |
| `groups` | Golf groups | Confirmed in API README but not visible in raw CSV text excerpt reviewed; used in `src/App.jsx` |
| `group_memberships` | User roles within groups | `group_id`, `user_id`, `role` |
| `group_invites` | Group invitation lifecycle | `group_id`, `user_id`, `email`, `expires_at`, `accepted_at` |
| `locations` | Golf courses and tee-time contacts | `location_id`, `group_id`, `name`, `address`, `tee_time_contact`, `is_active`, timestamps |
| `games` | Scheduled golf games | `id`, `group_id`, `location_id`, `description`, `rules`, `max_players`, `pairing_method`, `assign_players`, `recurring`, `recurrence`, `day_of_week`, `first_tee_time`, `scheduled_date`, `is_active`, timestamps |
| `game_registrations` | Registered and waitlisted players | `game_id`, `user_id`, `status`, `position`, timestamps |
| `tee_time_requests` | Pro-shop tee-time request/response lifecycle | `game_id`, `requested_time`, `to_pro_shop_name`, `to_pro_shop_email`, `status`, `response`, `response_token_hash`, `expires_at`, `responded_at`, timestamps |
| `tee_times` | Tee-time slots | `tee_times_id`, `game_id`, `slots`, `start_time`, `day_of_week`, timestamps |
| `recurring_game_series` | Recurring game templates | `id`, `group_id`, `recurrence`, `template_fields`, `next_run_at`, `is_active` |

### Data Model ERD

The schema export does not include explicit foreign key constraints. The relationships below are **inferred from column names and application usage**, not confirmed FK constraints.

![Figure 4. Data Model ERD](diagrams/04_data_model_erd.png){width=6.5in}



### Uploaded Schema CSV Summary

| Table | Column Count |
|---|---:|
| `game_registrations` | 6 |
| `games` | 16 |
| `group_invites` | 6 |
| `group_memberships` | 3 |
| `groups` | 6 |
| `locations` | 8 |
| `recurring_game_series` | 6 |
| `tee_time_requests` | 13 |
| `tee_times` | 6 |
| `users` | 9 |


### Data Access Patterns

- The browser app directly inserts and queries Supabase tables for profile/group workflows.
- Authenticated server functions use `createUserSupabaseClient(accessToken)`, preserving Supabase RLS behavior.
- Public response flow uses `getAdminSupabaseClient()` because pro-shop recipients do not authenticate through Supabase; the endpoint instead validates the opaque token hash and expiration before updating `tee_time_requests`.

### Data Validation

Confirmed validation is largely procedural in API handlers and UI code:

- `api/tee_times/request.js` validates required fields: `gameId`, non-empty `requestedTimes`, and `toProShopEmail`.
- `api/tee_time_requests/respond.js` validates token presence, expiry, duplicate responses, response type, and required response payload fields.
- `src/App.jsx` validates registration profile fields and password length in client-side registration flow.

### Known Data Architecture Gaps

- No migration files were found.
- No explicit FK/index/constraint definitions were found beyond the schema export columns.
- The uploaded schema CSV presents `tee_time_requests.response_token_hash` as `text`, which is consistent with storing a SHA-256 hex string. Production schema should still be validated during deployment review.
- `users.password_hash` appears in the schema export, but the app uses Supabase Auth sign-up and does not appear to write a password hash in application code. This may be legacy or unused.

---

## 6. API Architecture

### API Style

**Confirmed:** API files use Vercel serverless functions and default exported handlers. The API README explicitly says not to use Express routers or CommonJS `module.exports` in `api/`.

### Public / Serverless API Route Table

| Route | Method(s) | Auth Model | Purpose | Evidence |
|---|---:|---|---|---|
| `/api/tee_times/request` | `POST`, `OPTIONS` | Bearer Supabase access token | Create tee-time request, generate raw response token, store hashed token, return public response URL | `api/tee_times/request.js` |
| `/api/tee_time_requests/respond?token=...` | `GET`, `POST`, `OPTIONS` | Public opaque token | GET loads request; POST stores confirmed/alternate response | `api/tee_time_requests/respond.js` |
| `/api/weather?location=...` | `GET`, `OPTIONS` | None found | Geocode a location and return a 3-day weather/playability summary | `api/weather.js` |
| `/respond/:token` | N/A browser route | Public URL rewrite | Routes public response URL to SPA root | `vercel.json` |

### API Request / Response Patterns

- API responses are JSON.
- Error responses use `{ error: string }`, sometimes with `details`.
- `tee_times/request` returns `201` with `{ data, responseUrl }`.
- `tee_time_requests/respond` returns `{ data: publicRequest(...) }`.
- `weather` returns `{ courseName, location, days, overallAdvice }`.

### Authentication and Authorization

- Authenticated server endpoint extracts bearer token from `Authorization: Bearer <token>`.
- `createUserSupabaseClient(accessToken)` creates a request-scoped Supabase client with the bearer token in the global authorization header.
- `getAdminSupabaseClient()` uses a service secret and is documented as bypassing RLS; comments warn to validate signed-in user permissions before use.
- Public response endpoint uses admin client but gates access through hashed response token, expiry check, request existence, and duplicate-response status.

### Versioning Strategy

**Unknown.** No API versioning strategy was found.

### Webhooks / GraphQL / RPC

**Unknown / Not found.** No GraphQL schema, RPC interface, or webhook receiver was found in the reviewed repository evidence.

---

## 7. Key Workflows

### Workflow 1: User Registration and Group Creation / Join

**Trigger:** User submits registration from `AuthPage` in the React app.

**Actor:** New user.

**Major steps:**

1. Client validates profile fields and password length.
2. Client calls `supabase.auth.signUp` with email/password.
3. Client inserts a profile into `users`.
4. If creating a group, client inserts into `groups`, optionally inserts a `locations` record, then inserts `group_memberships` with `role='superadmin'`.
5. If joining a group, client searches `groups` by name and inserts a `group_memberships` row with `role='player'`.
6. If no session is returned, UI asks user to check email for confirmation.

![Figure 5. Workflow 1: User Registration and Group Creation / Join](diagrams/05_user_registration_sequence.png){width=6.5in}

**Error paths / edge cases visible in code:**

- Missing required fields.
- Invalid email.
- Non-numeric handicap.
- Password shorter than six characters.
- Group not found when joining.
- Supabase errors surfaced to user.

### Workflow 2: Authenticated Tee-Time Request Creation

**Trigger:** Authenticated user requests tee times for a game.

**Actor:** Admin/user with valid Supabase session.

**Major steps:**

1. Client calls `POST /api/tee_times/request` with bearer token and request body.
2. API validates method, bearer token, required fields.
3. API validates the Supabase user via `supabase.auth.getUser()`.
4. API generates a 32-byte random raw token.
5. API hashes the raw token with SHA-256 and stores only the hash in `tee_time_requests`.
6. API returns a public response URL containing the raw token.

![Figure 6. Workflow 2: Authenticated Tee-Time Request Creation](diagrams/06_tee_time_request_sequence.png){width=6.5in}

**Error paths / edge cases visible in code:**

- Non-POST method returns `405`.
- Missing bearer token returns `401`.
- Invalid token returns `401`.
- Missing `gameId`, `requestedTimes`, or `toProShopEmail` returns `400`.
- Insert failure returns `500` with details.

### Workflow 3: Public Tee-Time Response

**Trigger:** Pro shop opens `/respond/:token` and submits confirmation or alternates.

**Actor:** Pro-shop recipient.

**Major steps:**

1. Vercel rewrites `/respond/:token` to `/`, allowing the SPA to render the public response page.
2. Client calls `GET /api/tee_time_requests/respond?token=...`.
3. API hashes token and looks up `tee_time_requests.response_token_hash`.
4. API checks request existence and expiration.
5. Client renders request details.
6. Pro shop submits confirmed time or alternate times.
7. Client calls `POST /api/tee_time_requests/respond` with token and response payload.
8. API validates status, type, required fields, and updates row to `status='responded'`.

![Figure 7. Workflow 3: Public Tee-Time Response](diagrams/07_public_response_sequence.png){width=6.5in}

**Error paths / edge cases visible in code:**

- Missing token returns `400`.
- Invalid response link returns `404`.
- Expired link returns `410`.
- Duplicate response returns `409`.
- Invalid response type returns `400`.
- Missing confirmed/alternate data returns `400`.
- Update failure returns `500`.

### Workflow 4: Weather Forecast Lookup

**Trigger:** Client requests weather by location.

**Actor:** Auth status not required by API code.

**Major steps:**

1. Client calls `GET /api/weather?location=...`.
2. API geocodes the location through OpenStreetMap Nominatim.
3. API falls back to default coordinates if no geocoding result is found.
4. API requests a daily forecast from Open-Meteo.
5. API maps WMO weather codes and derives golf playability.
6. API returns 3-day forecast and overall advice.

![Figure 8. Workflow 4: Weather Forecast Lookup](diagrams/08_weather_sequence.png){width=6.5in}

---

## 8. Infrastructure and Deployment Architecture

### Runtime Environment

**Confirmed:**

- Frontend is built with Vite.
- Server-side APIs are Vercel functions in `api/`.
- `package.json` includes `dev:api` and `dev:full` scripts using `vercel dev`.
- `vercel.json` contains a rewrite for `/respond/:token` to `/`.

### Build and Local Development Commands

| Command | Purpose | Evidence |
|---|---|---|
| `npm run dev` | Run Vite dev server | `package.json` |
| `npm run dev:api` | Run Vercel dev | `package.json` |
| `npm run dev:full` | Run Vercel dev | `package.json` |
| `npm run build` | Build Vite app | `package.json` |
| `npm run preview` | Preview Vite build | `package.json` |

### Environment Variables

| Variable | Purpose | Status |
|---|---|---:|
| `SUPABASE_URL` | Supabase project URL | Confirmed |
| `SUPABASE_PUBLISHABLE_KEY` | Browser/user Supabase key | Confirmed |
| `SUPABASE_SECRET_KEY` | Server-side/admin Supabase key | Confirmed |
| `SUPABASE_ANON_KEY` | Alternate publishable key name supported by server helper | Confirmed |
| `SUPABASE_SERVICE_ROLE_KEY` | Alternate secret key name supported by server helper | Confirmed |

### Deployment Flow

**Confirmed:** Vercel is implied by `api/` function convention, `vercel.json`, and `vercel dev` scripts. The exact production deployment pipeline is **unknown** because no CI/CD workflow file was found in the repository listing reviewed.

### Infrastructure Diagram

![Figure 9. Infrastructure Diagram](diagrams/09_infrastructure.png){width=6.5in}

### Scaling Model

- **Inferred:** Static assets scale through Vercel’s edge/CDN model; serverless APIs scale per Vercel serverless function behavior.
- **Unknown:** No explicit scaling, concurrency, rate limiting, or capacity configuration was found.

### Scheduled Jobs

**Unknown / Not found.** No cron configuration or scheduled job definitions were found. The `recurring_game_series` table suggests recurring game generation may be planned, but no worker/cron implementation was found.

---

## 9. Security Architecture

### Authentication

- Supabase Auth is used client-side for sign-in and sign-up.
- Authenticated server-side request flow expects `Authorization: Bearer <Supabase access token>` and verifies the user through `supabase.auth.getUser()`.

### Authorization

- The API README explicitly instructs normal API requests to use `createUserSupabaseClient(accessToken)` so Supabase applies the signed-in user’s RLS policies.
- Admin Supabase client exists for workflows that must bypass RLS, with comments warning to validate permissions before use.
- The public response endpoint uses the admin client because the pro-shop recipient is not authenticated; it compensates through random token hashing, expiration checks, and duplicate response checks.

### Token Handling

- `api/tee_times/request.js` generates a random 32-byte token, hashes it with SHA-256, stores `response_token_hash`, and returns the raw token in a public URL.
- `api/tee_time_requests/respond.js` hashes the supplied raw token and queries by the stored hash.
- This avoids storing raw response tokens in the database.

### Session Handling

- Server Supabase clients disable `autoRefreshToken`, `detectSessionInUrl`, and `persistSession`.
- Client session management is handled by Supabase Auth in the React app.

### Input Validation

Confirmed validation is present in API handlers for:

- HTTP method constraints.
- Missing bearer token.
- Invalid access token.
- Required tee-time request fields.
- Missing/invalid response token.
- Expired response link.
- Duplicate response submission.
- Required confirmed/alternate response fields.
- Missing weather location parameter.

### Security-Sensitive Configuration

- `.env.example` contains a concrete Supabase project URL and blank keys.
- Secret values are expected to be configured in `.env.local` and Vercel.
- `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY` must be protected because the admin client bypasses RLS.

### Known Security Risks / Gaps

| Risk / Gap | Severity | Status | Notes |
|---|---:|---:|---|
| Permissive CORS on APIs | Medium | Confirmed | APIs set `Access-Control-Allow-Origin: *`. Public endpoints may tolerate this, but authenticated endpoints should be reviewed. |
| Admin client in public response endpoint | Medium | Confirmed | Token checks mitigate risk; rate limiting and audit logging should be added for defense in depth. |
| No rate limiting found | Medium | Unknown | Public response and weather endpoints could be abused. |
| No CSRF strategy documented | Low/Medium | Unknown | API relies on JSON/fetch and bearer tokens; public POST token endpoint still deserves review. |
| No dependency/security scanning config found | Medium | Unknown | No GitHub workflow or Dependabot config found in reviewed listing. |
| Client-heavy direct database access | Medium | Confirmed/Inferred | Relies heavily on Supabase RLS correctness, which is not exported in the schema CSV. |
| `users.password_hash` column | Medium | Confirmed/Unknown | Present in schema export but not used by Supabase Auth flow; validate whether legacy sensitive data exists. |

---

## 10. Observability and Operations

### Logging

**Unknown / minimal evidence.** The reviewed code returns errors but does not show structured logging, request IDs, tracing, metrics, or external error reporting integrations.

### Metrics and Tracing

**Unknown / not found.** No metrics or tracing implementation was found.

### Health Checks

**Unknown / not found.** No health-check endpoint was found.

### Error Reporting

**Unknown / not found.** No Sentry, Logtail, Datadog, OpenTelemetry, or equivalent integration was found.

### Audit Logging

**Unknown / not found.** No audit-log table or explicit audit trail implementation was found.

### Backup / Restore

**Unknown / not found.** No Supabase backup/restore documentation or scripts were found.

### Admin Tooling

**Inferred:** Admin/superadmin capabilities exist in the React app, based on role helpers such as `canEdit` and `isSA` and group membership roles. No separate admin console or operational tooling was found.

---

## 11. Architecture Decisions and Tradeoffs

### Decision 1: React SPA with Vite

- **Decision:** Use a React single-page app built by Vite.
- **Evidence:** `package.json`, `src/main.jsx`, `src/App.jsx`, `vite.config.js`.
- **Rationale:** Fast frontend iteration and simple deployment to Vercel static hosting.
- **Tradeoffs:** The current application appears heavily centralized in `App.jsx`, increasing maintainability risk as features grow.

### Decision 2: Supabase for Auth and Database

- **Decision:** Use Supabase SDK for client and server data access.
- **Evidence:** `@supabase/supabase-js` dependency; `src/supabaseClient.js`; `api/_lib/supabase.js`; `.env.example`.
- **Rationale:** Combines auth, database, and RLS policies in a managed service.
- **Tradeoffs:** Strong security depends on RLS policies that are not included in the repository export; local development depends on remote/managed Supabase unless additional local setup exists elsewhere.

### Decision 3: Vercel Functions Instead of Express

- **Decision:** Use file-based Vercel serverless functions in `api/`.
- **Evidence:** `api/README.md` handler convention and `package.json` `vercel dev` scripts.
- **Rationale:** Simple deployment model aligned with Vercel hosting.
- **Tradeoffs:** Cross-cutting concerns such as auth, validation, rate limiting, and logging must be repeated or abstracted manually.

### Decision 4: Use RLS-Scoped Client for Normal Server Requests

- **Decision:** Use `createUserSupabaseClient(accessToken)` for normal API calls.
- **Evidence:** `api/_lib/supabase.js`, `api/README.md`, `api/tee_times/request.js`.
- **Rationale:** Keeps authorization in Supabase RLS instead of duplicating all checks in API code.
- **Tradeoffs:** RLS policies become critical infrastructure; absence of policy definitions in repo makes review incomplete.

### Decision 5: Store Hashed Public Response Tokens

- **Decision:** Generate a raw response token, store only its SHA-256 hash, and use the raw token in public response URLs.
- **Evidence:** `api/tee_times/request.js`, `api/tee_time_requests/respond.js`.
- **Rationale:** Reduces impact if database contents are exposed.
- **Tradeoffs:** Public URL itself is bearer-like; expiration and rate limiting are important. Current schema export shows a possible type mismatch for `response_token_hash`.

### Decision 6: Weather API Aggregation in Serverless Function

- **Decision:** Server-side function proxies geocoding and weather forecast calls.
- **Evidence:** `api/weather.js`.
- **Rationale:** Hides external API composition from the client and centralizes weather-to-golf playability logic.
- **Tradeoffs:** No auth/rate limiting found; external API availability affects UX.

---

## 12. Risks, Gaps, and Open Questions

### Confirmed Risks

1. **Large monolithic frontend module:** `src/App.jsx` is large and appears to contain UI components, data transforms, auth flows, admin workflows, and public response flow in one file.
2. **Permissive CORS:** Serverless functions set `Access-Control-Allow-Origin: *`.
3. **Response token hash type validated in uploaded schema:** `tee_time_requests.response_token_hash` appears as `text` in the supplied CSV, consistent with SHA-256 hex storage. Validate the production schema before release.
4. **No migrations found:** Database evolution is not reproducible from repository evidence.
5. **No formal CI/CD found:** No GitHub Actions workflow or deployment pipeline config was visible in the reviewed repository listing.

### Likely Risks

1. **RLS policy opacity:** RLS is central to authorization, but RLS policies are not included in the schema export.
2. **No rate limiting:** Public response and weather endpoints may be subject to abuse.
3. **Operational blind spots:** No metrics, tracing, or error reporting integrations were found.
4. **Domain model drift:** API folders exist for many tables but several contain only `.gitkeep`, suggesting partially implemented server API coverage.

### Documentation Gaps

- No ADRs found.
- No deployment runbook found.
- No local Supabase setup or migration guide found.
- No test strategy found.
- No environment variable security handling beyond `.env.example` and API README.
- No notification/email provider documentation found.

### Open Questions

1. What Supabase RLS policies are configured for each table?
2. Does the production schema match the uploaded CSV, especially for `tee_time_requests.response_token_hash` as `text`?
3. What service sends invitations and notifications?
4. Should `/api/weather` and public response endpoints be rate-limited?
5. Is `users.password_hash` still required, and does it contain sensitive legacy data?
6. Are database migrations maintained outside this repository?
7. What monitoring/error-reporting platform is used in production?
8. Are recurring game series implemented yet, or only represented in the schema?
9. Should server-side APIs be expanded for all table operations instead of direct browser Supabase access?
10. Is `https://linksinvite.com/respond/...` the canonical production URL, while the GitHub repo links to `linksinvite.vercel.app`?

### Suggested Follow-Up Analysis

1. Export and review Supabase RLS policies, indexes, constraints, triggers, and functions.
2. Validate the production schema for `tee_time_requests.response_token_hash`.
3. Add database migrations and seed/sample data for local development.
4. Split `src/App.jsx` into domain modules, components, hooks, and API/data-access services.
5. Add unit/integration tests for tee-time request/response flows and security edge cases.
6. Add rate limiting and structured logging to serverless API functions.
7. Document deployment, rollback, secrets, and incident response procedures.

---

## 13. Appendix

### Key Files Reviewed

| File / Folder | Importance |
|---|---|
| `package.json` | Technology inventory and commands |
| `api/README.md` | API convention and Supabase usage guidance |
| `.env.example` | Required Supabase environment variables |
| `vercel.json` | Public response route rewrite |
| `src/App.jsx` | Main application and workflows |
| `src/main.jsx` | SPA entry point |
| `src/supabaseClient.js` | Browser Supabase client |
| `api/_lib/supabase.js` | Server-side Supabase clients and bearer token extraction |
| `api/tee_times/request.js` | Authenticated tee-time request creation |
| `api/tee_time_requests/respond.js` | Public tee-time response handling |
| `api/weather.js` | Weather/geocoding serverless function |
| `.linksInvite-supabase/public-schema.csv` | Supabase public schema export |

### Technology Inventory

| Category | Technology |
|---|---|
| Frontend | React 18, React DOM, Vite |
| Styling/build | Tailwind CSS, PostCSS, Autoprefixer, inline styles |
| Backend/API | Vercel serverless functions, Node.js ESM |
| Database/Auth | Supabase, Supabase JS SDK |
| External APIs | OpenStreetMap Nominatim, Open-Meteo |
| Icons | Lucide React |

### Important Commands

```bash
npm run dev
npm run dev:api
npm run dev:full
npm run build
npm run preview
```

### Environment Variables

```bash
SUPABASE_URL=https://ihoretjurcfxvrhmxies.supabase.co
SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
```

Additional server helper fallbacks:

```bash
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

### API Summary

| API | Methods | Auth | Data Store |
|---|---:|---|---|
| `/api/tee_times/request` | POST, OPTIONS | Supabase bearer token | `tee_time_requests` |
| `/api/tee_time_requests/respond` | GET, POST, OPTIONS | Opaque response token | `tee_time_requests` |
| `/api/weather` | GET, OPTIONS | None found | External APIs only |

### Glossary

| Term | Meaning |
|---|---|
| RLS | Row Level Security; Supabase/Postgres authorization policies applied at database level |
| Pro shop | Golf course staff/contact receiving tee-time requests |
| Response token | Opaque public token embedded in tee-time response URL |
| Superadmin | Highest group role in application logic |
| Tee-time request | Request sent to course/pro shop for one or more possible tee times |
| Waitlist | Overflow list for players when a game exceeds max player capacity |


### Artifact Source Notes

- Public repository page reviewed: `https://github.com/alherndon/linksinvite`
- Uploaded architecture source: `linksinvite_systems_architecture(1).md`
- Uploaded schema source: `Supabase Snippet Inspect Public Schema Columns.csv`

