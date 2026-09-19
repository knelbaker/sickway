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

Vitest runs the banner smoke test and environment validation tests without loading real credentials. Use `pnpm exec vitest` for watch mode while developing.

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
