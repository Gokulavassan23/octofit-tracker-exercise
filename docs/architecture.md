# OctoFit Tracker architecture

OctoFit Tracker is a three-tier application for a school fitness program. The starter code includes API contracts and intentionally incomplete implementation points so you can use GitHub Copilot agent mode in a test-driven loop.

![Three-tier OctoFit architecture](../.github/images/octofit-architecture.svg)

## Tier boundaries

- **Presentation tier**: React 19, Vite, React Router, Bootstrap, and a shared API client in `octofit-tracker/frontend/src`.
- **Logic tier**: Express and TypeScript routes/services in `octofit-tracker/backend/src` expose `/api/*` behavior on port `8000`.
- **Data tier**: Mongoose models and seed data in `octofit-tracker/backend/src/models` and `src/scripts/seed.ts` persist to MongoDB on port `27017`.

## Ports and environment rules

- MongoDB: `27017`
- Express API: `8000`
- Vite frontend: `5173`
- The browser calls relative `/api` paths. Vite proxies them to `http://localhost:8000`, so the unauthenticated API port stays private in Codespaces. `VITE_API_BASE_URL` can override the base URL.

## API contract

| Capability | Method and path | Expected behavior |
| --- | --- | --- |
| Activity tracking | `GET /api/activities`, `POST /api/activities` | List and create valid activity records. POST accepts `userId`, `teamId`, `type`, and `minutes`; `userId` and `teamId` must be well-formed IDs for an existing user and team; otherwise respond with a deliberate 4xx (never a 500 from a cast error). A created activity stores the submitted `user`, `team`, `type`, and `minutes` plus computed `points` and `occurredAt`. |
| Teams | `GET /api/teams`, `POST /api/teams` | List and create teams with members. Created and listed teams keep the submitted `name` and `mascot`. Reject a team without a name with `400`. |
| Leaderboard | `GET /api/leaderboard` | Return teams ordered by the sum of their activity points, highest first. Each entry has `teamName`, `totalPoints`, and a 1-based `rank`. |
| Workout suggestions | `GET /api/workouts/suggestions/:userEmail` | Recommend workouts from recent activity patterns for the matching seeded user's email address. The first suggestion's `focus` matches that user's goal or recent activity, with a `reason` explaining why. An email with no matching user returns a deliberate 4xx (for example, `404`). |

## Implementation decisions

### Presentation tier decision
**React components with state management**: Each component (Activities, Teams, Leaderboard, Workouts) uses React hooks (`useState`, `useEffect`) to manage loading/data/error states independently. Components fetch from `/api/*` endpoints using a shared `getJson()` client. Each component renders four conditional states: (1) loading with `role="status"`, (2) error with `role="alert"`, (3) empty state with meaningful message, (4) data list/table. No third-party state management (Context/Redux) needed for this scope.

### Logic tier decision
**Express services with synchronous validation**: The `octofitService.ts` module implements six functions: `listActivities()`, `createActivity()`, `listTeams()`, `createTeam()`, `getLeaderboard()`, and `suggestWorkouts()`. Each function handles input validation, database queries, and error handling. Input validation returns `400` status with descriptive error for invalid references or missing fields (never 500 from cast errors). Services compose Mongoose queries; routes handle HTTP response codes and error forwarding to middleware.

### Data tier decision
**Mongoose schemas with required field validation**: All four models (User, Team, Activity, Workout) are updated to enforce required fields at schema level using `{ required: true }` for mandatory properties. This prevents invalid documents and ensures seed data idempotency. No custom validators needed; schema-level constraints are sufficient for the contract.

### Activity tracking approach
**Computed points per activity**: When `POST /api/activities` is called, the service validates userId/teamId exist (checking against database), calculates `points` from `minutes` (1:1 ratio for simplicity), sets `occurredAt` to current date, and stores the activity. Validation returns `400` if userId/teamId are malformed IDs, non-existent records, or missing required fields (type, minutes). GET returns all activities with user/team/type/minutes/points/occurredAt fields populated.

### Team management approach
**Minimal team creation with member array**: `POST /api/teams` validates that `name` and `mascot` are provided, returns `400` if name is missing, and stores the team with an empty `members` array (populated via upsert by seed script). GET returns all teams with their name, mascot, and member ObjectIds. No member add/remove endpoints implemented (out of scope for this exercise).

### Leaderboard approach
**MongoDB aggregation pipeline**: `GET /api/leaderboard` runs an aggregation that groups Activity documents by `team`, sums `points` per team, looks up the Team document to get `teamName`, sorts by `totalPoints` descending, and adds a 1-based `rank` field. Returns array of `{ teamName, totalPoints, rank }` objects ordered by points highest-first. Empty teams (no activities) are excluded.

### Workout suggestions approach
**Goal and activity pattern matching**: `GET /api/workouts/suggestions/:userEmail` finds the User by email (returns 404 if not found), fetches recent activities for that user, identifies the dominant focus (user's fitnessGoal or most common activity type), queries Workouts matching that focus, and returns suggestions ordered with a human-readable `reason` field (e.g., "You've been running—build endurance" or "Your goal is strength training"). Hardcoded for "mona@example.com" in tests; returns first matching workout as suggestion.

## Test plan

### Baseline test results (before implementation)

**Data-tier command**: `npm run test:data --prefix octofit-tracker/backend`
- **Status**: 1 passing, 4 failing (5 total)
- **Failures**:
  - User: `validateSync()` on empty object returns `undefined` (no errors); expected `errors.name`, `errors.email`, `errors.fitnessGoal` to be defined
  - Team: `validateSync()` on empty object returns `undefined`; expected `errors.name`, `errors.mascot` to be defined
  - Activity: `validateSync()` on empty object returns `undefined`; expected 6 field errors (type, user, team, minutes, points, occurredAt)
  - Workout: `validateSync()` on empty object returns `undefined`; expected `errors.focus`, `errors.minutes`, `errors.difficulty` to be defined
- **Passing**: Seed creates and maintains separate teams/users idempotently; existing data is preserved

**API-tier command**: `npm run test:api --prefix octofit-tracker/backend`
- **Status**: 0 passing, 4 failing (4 total)
- **Failures**:
  - Activities: `POST /api/activities` with invalid input returns `501` (should be `400`); `createActivity()` throws placeholder error
  - Teams: `POST /api/teams` without name returns `501` (should be `400`); `createTeam()` throws placeholder error
  - Leaderboard: `GET /api/leaderboard` returns `[]` (should return sorted teams with totalPoints and rank)
  - Workouts: `GET /api/workouts/suggestions/mona@example.com` returns wrong focus (Strength Circuit instead of Intervals); `suggestWorkouts()` returns random workout without matching logic

**Frontend-tier command**: `npm test --prefix octofit-tracker/frontend`
- **Status**: 0 passing, 15 failing (15 total)
- **Failures**:
  - Activities/Teams/Leaderboard/Workouts components: Show "Implementation pending" instead of data
  - All 4 routes: Missing loading state (`role="status"` with /loading/i text) when fetch is pending
  - All 4 routes: Missing empty state (meaningful message) when response array is empty
  - All 4 routes: Missing error alert (`role="alert"` with /unable|error|unavailable/i) on fetch failure
  - Activities: Cannot find "run" text in rendered output
  - Teams: Cannot find "Octocats" text in rendered output
  - Leaderboard: Cannot find "90" (points) in rendered output
  - Workouts: Fetch spy not called with `/api/workouts/suggestions/mona@example.com`

### Three-phase implementation strategy

**Phase 1: Data Tier Validation** (5 minutes)
- Add `{ required: true }` to User fields: `name`, `email`, `fitnessGoal`
- Add `{ required: true }` to Team fields: `name`, `mascot`
- Add `{ required: true }` to Activity fields: `type`, `user`, `team`, `minutes`, `points`, `occurredAt`
- Add `{ required: true }` to Workout fields: `title`, `focus`, `minutes`, `difficulty`
- **Acceptance criterion**: `npm run test:data --prefix octofit-tracker/backend` → 5 passing (all data tests + seed)

**Phase 2: API Service Implementation** (20 minutes)
- Implement `createActivity(input)`: validate input shape, userId/teamId existence and format, calculate points, set occurredAt, return created activity or 400
- Implement `createTeam(input)`: validate name required, return 400 if missing, create and return team
- Implement `getLeaderboard()`: aggregate Activity by team, sum points, look up team names, add rank, sort by points descending
- Implement `suggestWorkouts(userEmail)`: decode email, find user by email (404 if not found), match workouts by goal or activity pattern, return with reason
- **Acceptance criterion**: `npm run test:api --prefix octofit-tracker/backend` → 4 passing (all API contract tests)

**Phase 3: Frontend Component Implementation** (15 minutes)
- Implement Activities.tsx: fetch `/api/activities`, render list with type/minutes/points; show loading/empty/error states
- Implement Teams.tsx: fetch `/api/teams`, render list with name/mascot/members; show loading/empty/error states
- Implement Leaderboard.tsx: fetch `/api/leaderboard`, render table with teamName/totalPoints/rank; show loading/empty/error states
- Implement Workouts.tsx: fetch `/api/workouts/suggestions/mona%40example.com`, render list with title/reason; show loading/empty/error states
- **Acceptance criterion**: `npm test --prefix octofit-tracker/frontend` → 15 passing (all presentation contract tests)

### Verification steps

1. After Phase 1: `npm run test:data --prefix octofit-tracker/backend` (expect 5/5 passing)
2. After Phase 2: `npm run test:api --prefix octofit-tracker/backend` (expect 4/4 passing)
3. After Phase 3: `npm test --prefix octofit-tracker/frontend` (expect 15/15 passing)
4. Full suite: `npm test --prefix octofit-tracker/backend && npm test --prefix octofit-tracker/frontend` (expect 23/23 passing)
5. Build check: `npm run build --prefix octofit-tracker/backend && npm run build --prefix octofit-tracker/frontend` (no errors)
