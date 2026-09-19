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

Vitest covers the banner, environment validation, shared contracts, and deterministic demo routing without loading real credentials. Use `pnpm exec vitest` for watch mode while developing.

## Shared code

- `src/app/`: routes and the shared shell.
- `src/components/ui/`: shadcn/ui components for Tailwind v4, configured in `components.json`.
- `src/components/synthetic-banner.tsx`: the non-dismissible synthetic-data notice.
- `src/lib/env.ts`: validated server configuration.
- `src/lib/demo-routing.ts`: pure, synchronous demo routing and confirmed elapsed symptom time.

`routeIntake(intake)` accepts a reviewed intake with an optional boolean `outsideScenario` marker and returns `{ branch, reasons }`. Any of the six checklist flags explicitly set to `true` yields `emergency`, even if other fields are invalid. Otherwise, unanswered (`null`) flags, missing or malformed fields, unexpected keys, and `outsideScenario: true` yield `needs_review` with explicit reasons. A valid intake with all six flags `false` yields `ready`. This is a demo routing result, not clinically validated triage or a diagnosis; temperature and other fields do not introduce additional routing rules.

`elapsedSinceOnset(intake, fixtureClock)` returns `{ hours, onsetIso, fixtureClock, source }` only for a confirmed onset and valid ISO timestamps with explicit timezones. `source` identifies `onsetIso` as `student_review` and `fixtureClock` as `demo_fixture`. Unconfirmed, missing, invalid, or future onset times return `null`. Elapsed hours use the supplied fixture clock, preserve fractional values, and never use the system clock or a treatment-window countdown.

Appendix A in the spec maps `app/`, `components/`, and `lib/` to this repository's `src/` directory. Future fixture JSON belongs in top-level `data/`.

For additional shadcn components, run `pnpm exec shadcn add <component>` from the repository root. `.npmrc` allows dependency additions at the root of this single-package pnpm workspace.
