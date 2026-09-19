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

Vitest runs banner, environment, shared-schema, and fixture validation tests without loading real credentials. Use `pnpm exec vitest` for watch mode while developing.

## Shared code

- `src/app/`: routes and the shared shell.
- `src/components/ui/`: shadcn/ui components for Tailwind v4, configured in `components.json`.
- `src/components/synthetic-banner.tsx`: the non-dismissible synthetic-data notice.
- `src/lib/env.ts`: validated server configuration.
- `src/lib/fixtures.ts`: the single entry point for all eight JSON fixtures; exports typed `fixtures` and `parseFixtures` for shape and cross-file validation.

Appendix A in the spec maps `app/`, `components/`, and `lib/` to this repository's `src/` directory. Fixture JSON lives in top-level `data/`. Consumers should import `fixtures` from `@/lib/fixtures`, rather than importing individual JSON files. Keep cost, coverage, stock, and resource mock labels visible when displaying these values.

The prepared Scene 1 case (`scene-1-v1`) uses a displayed fixture clock of September 19, 2026 at 10 AM EDT and an explicit onset of September 18 at 8 AM EDT (26 hours earlier). Its onset confirmation and six negative checklist answers are scripted follow-up responses, not facts inferred from the opening sentence. Medications and allergies remain unanswered (`null`). The preferred fictional pharmacy is only a setup preference; it does not represent a booking or transmission. This approved-case fixture must not prefill user consent, onset confirmation, or checklist responses. Prepared brief use requires an exact current-case match and explicit selection; audio is deferred to #17.

EN and ES instructions are static demo workflow copy, not clinically validated treatment instructions or runtime translations. Spanish-speaker review and a teammate's fictional-name review remain required before sign-off. No real brand, insurer, pharmacy, or manufacturer names are intentionally used.

For additional shadcn components, run `pnpm exec shadcn add <component>` from the repository root. `.npmrc` allows dependency additions at the root of this single-package pnpm workspace.
