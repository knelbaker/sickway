# Sick Day + Doorway

A synthetic workflow prototype for student intake, a clinician brief, and a returned patient packet. The product scope and demo scenario are in [sickway.md](sickway.md).

Prototype workflow. Not medical advice. Do not enter real health information.

## Local development

Use Node.js 24 and pnpm 10.3.0 (the version pinned in `package.json`).

```bash
pnpm install
pnpm dev
```

Open [localhost:3000](http://localhost:3000). The foundation includes four stub pages: `/`, `/s` (student), `/hcp` (clinician), and `/packet/test` (an example packet reference). Every page uses the shared layout and persistent synthetic-data banner. The stubs run without credentials; intake, API routes, database access, and AI calls come in later issues.

## Server configuration

The root `.env` is tracked at the repository owner's request and contains shared configuration, including credentials. Keep its contents out of logs and documentation. For local overrides, copy `.env.example` to `.env.local` and fill in the required values. The example intentionally contains empty values only; `.env.local` stays ignored by Git.

Server code must import `env` from `@/lib/env` instead of reading environment variables directly. Importing the module validates all settings and throws an error listing missing or invalid variable names without including their values. The module is marked `server-only`, so it cannot be imported into a Client Component.

Required settings:

- `GOOGLE_GENERATIVE_AI_API_KEY` and `GEMINI_MODEL`
- `AWS_REGION`, `AWS_ACCESS_KEY_ID`, and `AWS_SECRET_ACCESS_KEY`
- `DDB_TABLE` and `DEMO_SESSION_SECRET`

`VOICE_MODE` accepts `baseline` or `live` and defaults to `baseline` when absent or blank. `ELEVENLABS_API_KEY`, `NEXT_PUBLIC_DOORWAY_AGENT_ID`, and `NEXT_PUBLIC_INTAKE_AGENT_ID` are optional and may be blank. Voice integrations are not implemented yet. Only the agent IDs have public names; never put secrets in `NEXT_PUBLIC_` variables.

## Checks

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Vitest covers the banner, environment validation, shared contracts, deterministic demo routing, and AI generation with a mocked model and database without loading real credentials. Use `pnpm exec vitest` for watch mode while developing.

The DynamoDB round trip is opt-in, so `pnpm test` never touches AWS. With the AWS settings in `.env.local` or `.env`, run:

```bash
RUN_DDB_INTEGRATION=1 pnpm test src/lib/__tests__/db.integration.test.ts
```

It writes, reads, updates, lists, and deletes one synthetic item in a throwaway session partition.

## Shared code

- `src/app/`: routes and the shared shell.
- `src/components/ui/`: shadcn/ui components for Tailwind v4, configured in `components.json`.
- `src/components/synthetic-banner.tsx`: the non-dismissible synthetic-data notice.
- `src/lib/env.ts`: validated server configuration.
- `src/lib/db.ts`: session-scoped DynamoDB helpers for the single demo table.
- `src/lib/ai.ts`: server-only Gemini structured generation with schema validation, bounded retries, and session-scoped caching.
- `src/lib/demo-routing.ts`: pure, synchronous demo routing and confirmed elapsed symptom time.

`routeIntake(intake)` accepts a reviewed intake with an optional boolean `outsideScenario` marker and returns `{ branch, reasons }`. Any of the six checklist flags explicitly set to `true` yields `emergency`, even if other fields are invalid. Otherwise, unanswered (`null`) flags, missing or malformed fields, unexpected keys, and `outsideScenario: true` yield `needs_review` with explicit reasons. A valid intake with all six flags `false` yields `ready`. This is a demo routing result, not clinically validated triage or a diagnosis; temperature and other fields do not introduce additional routing rules.

`elapsedSinceOnset(intake, fixtureClock)` returns `{ hours, onsetIso, fixtureClock, source }` only for a confirmed onset and valid ISO timestamps with explicit timezones. `source` identifies `onsetIso` as `student_review` and `fixtureClock` as `demo_fixture`. Unconfirmed, missing, invalid, or future onset times return `null`. Elapsed hours use the supplied fixture clock, preserve fractional values, and never use the system clock or a treatment-window countdown.

## AI generation

Server code calls `generateStructured({ sessionId, schema, system, prompt, promptVersion })` from `@/lib/ai`. Supply a Zod schema and a session ID already verified by the calling endpoint. The helper scopes cache access to that session; endpoint authentication and consent checks belong to the later session/intake issues.

The helper uses the Google provider with `GOOGLE_GENERATIVE_AI_API_KEY` and `GEMINI_MODEL` from `env.ts`; there is no default model. Verify the configured model against the team's key before deployment. Each model attempt has a 12-second timeout. Timeouts and provider-designated transient errors receive at most two retries (three attempts total), with 500 ms and 1 second backoff. Schema-invalid output and permanent provider errors are not retried. SDK retries are disabled so they cannot multiply this bound.

- Success: `{ ok: true, data, cached }`, with `data` validated against the supplied schema. Callers must use `cached` to label reused output.
- Failure: `{ ok: false, reason }`, where `reason` is `timeout`, `invalid_output`, `provider_error`, or `cache_error`. Provider errors and output are not exposed, and fixtures are never substituted. Cache read/write failures are explicit failures; a failed write does not retry generation.

Cache keys hash the whitespace-normalized system and user prompts, configured model, and prompt version under `SESSION#<sessionId>` / `CACHE#<hash>`. Original prompts are passed to Gemini. Records inherit the database helper's 24-hour TTL; expired records are ignored even before DynamoDB removes them. Cached JSON is revalidated on every hit. Bump `promptVersion` whenever the prompt contract or schema changes. Concurrent first requests can each generate output; the cache does not coalesce in-flight requests.

## Data layer

All persistent state lives in one DynamoDB table (`DDB_TABLE`) with partition key `PK` (String), sort key `SK` (String), on-demand capacity, and TTL enabled on the `ttl` attribute. The IAM user needs only `GetItem`, `PutItem`, `UpdateItem`, `DeleteItem`, `Query`, and `BatchWriteItem` on that table; nothing uses `Scan`.

| Record | `PK` | `SK` |
| --- | --- | --- |
| Session metadata | `SESSION#<sessionId>` | `META` |
| Encounter | `SESSION#<sessionId>` | `ENC#<encounterId>` |
| Packet | `SESSION#<sessionId>` | `PKT#<packetId>` |
| Audit event | `SESSION#<sessionId>` | `EVT#<timestamp>#<eventId>` |
| Generation cache | `SESSION#<sessionId>` | `CACHE#<hash>` |

Use the helpers in `@/lib/db` instead of the AWS SDK directly. Build keys with `pk`, `sk`, and `SK_PREFIX`. Every helper takes the demo session ID first and only touches that session's partition, so there is no way to read an encounter or packet by ID alone. Reads take a Zod schema and return validated records with `PK` and `SK` removed.

- `putItem` creates or replaces; `putItemIfAbsent` returns `false` without overwriting when the item exists (for idempotent attach).
- `getItem` returns `null` when the item is not in the session; `queryByPrefix` lists a session's items by sort-key prefix.
- `updateItem` sets fields on an existing item and returns `null` when nothing exists; `appendUniqueToList` adds a value to a list attribute atomically (for resource unlocks).
- Every item gets a `ttl` 24 hours ahead unless the record defines its own, so old sessions expire without a cleanup job.

Appendix A in the spec maps `app/`, `components/`, and `lib/` to this repository's `src/` directory. Future fixture JSON belongs in top-level `data/`.

For additional shadcn components, run `pnpm exec shadcn add <component>` from the repository root. `.npmrc` allows dependency additions at the root of this single-package pnpm workspace.
