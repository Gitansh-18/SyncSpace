# Collab Editor

Local-first collaborative document editor built for the House of Edtech fullstack assignment.

## Stack

- Next.js 16 (App Router, TypeScript)
- PostgreSQL + Prisma
- Tailwind CSS

## Prerequisites

- Node.js 20+
- PostgreSQL running locally (or a hosted Postgres URL)

## Setup

1. Install dependencies:

```bash
npm install
```

2. Copy environment variables:

```bash
cp .env.example .env
```

Update `DATABASE_URL` and `AUTH_SECRET` in `.env`.

Generate a secret with:

```bash
openssl rand -base64 32
```

3. Create the database (if it does not exist):

```bash
createdb collab_editor
```

4. Run migrations:

```bash
npm run db:migrate
```

5. Start the dev server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Auth (Module 2)

- Register at `/register`
- Log in at `/login`
- Protected dashboard at `/dashboard`

## Documents (Module 3)

- Create documents from the dashboard
- Open a document at `/documents/[id]`
- Roles: **Owner**, **Editor**, **Viewer**
- Owners can add members by email and delete documents
- Editors can edit (once the editor module lands); viewers are read-only

## Local-first editing (Module 4)

- Document content loads from **IndexedDB** first (no network wait)
- Typing saves locally with a short debounce
- Offline indicator shows when the browser loses connection
- Server sync is added in Module 6

## Editor experience (Module 5)

- Local save status distinguishes unsaved, saving, saved, and failed states
- Use **Ctrl/Cmd + S** or the **Save now** button to save immediately
- The browser warns before closing while a local save is pending or has failed

## Offline synchronization (Module 6)

- Local edits are stored as compact text patches in an IndexedDB operation queue
- Sync runs after local saves, when the browser reconnects, and every five seconds
- Operations use stable IDs and server revisions so retries are idempotent
- Non-overlapping concurrent edits merge automatically
- Overlapping edits preserve both versions with visible conflict markers
- Failed operations retry with bounded exponential backoff
- Sync requests and documents have strict size limits

## Version history (Module 7)

- Every successful synced operation stores the authoritative document content for that revision
- The document page shows a version timeline with revision, author, timestamp, size, and conflict metadata
- Owners and editors can restore an older revision
- Restores are saved as new document operations, so other clients receive them through normal sync

## Security hardening (Module 8)

- Document and member IDs are validated as CUIDs before database writes
- Server actions avoid redirects based on untrusted raw form values
- Sync requests require `application/json`, enforce payload limits, and validate the route document ID
- Document restore, delete, sharing, and sync operations all re-check membership and role permissions on the server

## AI assistant (Module 9)

- Document pages include an assistant for summarize, improve writing, and rewrite actions
- The AI API reuses existing document membership checks; viewers can summarize only
- `GEMINI_API_KEY` enables Gemini-backed suggestions, while empty keys use deterministic local fallback output
- AI suggestions are shown separately and are not auto-applied, keeping local/offline sync behavior predictable

## Deployment readiness (Module 10)

- The auth gate uses the Next.js 16 `proxy.ts` convention instead of deprecated middleware
- Required production environment variables: `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET`, and `AUTH_URL`
- For Supabase on Vercel, use the transaction pooler on port `6543` for `DATABASE_URL` and include `pgbouncer=true`
- For Prisma migrations, use a direct connection or session pooler on port `5432` for `DIRECT_URL`
- Optional production environment variables: `GEMINI_API_KEY` and `GEMINI_MODEL`
- Run production migrations with `npm run db:deploy`
- Verify a release with:

```bash
npm test
npm run lint
npx tsc --noEmit
npm run build
```

Before deploying, confirm the production database is reachable from the hosting provider and `AUTH_URL` matches the public domain exactly.

Supabase production connection example:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://USER:PASSWORD@HOST.pooler.supabase.com:5432/postgres"
AUTH_URL="https://your-project.vercel.app"
```

If your `DATABASE_URL` already contains a query string such as `?sslmode=require`, add `pgbouncer=true` with `&`:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST.pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true"
```

## Database scripts

| Command | Description |
|---------|-------------|
| `npm run db:generate` | Generate Prisma client |
| `npm run db:migrate` | Run migrations in development |
| `npm run db:deploy` | Apply committed migrations in production |
| `npm run db:push` | Push schema without migration files |
| `npm run db:studio` | Open Prisma Studio |

## Project structure

```
app/              Next.js routes and layouts
auth.ts           Auth.js configuration
components/       Shared UI components
lib/              Server utilities (db client, etc.)
lib/local-db/     IndexedDB layer (Dexie)
prisma/           Schema and migrations
```
