# Repository guidance

## Project and scope

Sick Day + Doorway is a synthetic student intake and clinician workflow prototype. Read `README.md`, the assigned GitHub issue, and the relevant sections of `sickway.md` before making changes. `parallel.md` records issue dependencies; check current issue status instead of assuming its status summary is current.

Implement the assigned issue's acceptance criteria and respect its out-of-scope items. Keep changes small, match existing conventions, and leave unrelated code and user edits alone. State assumptions and resolve material ambiguity before implementing. Prefer the simplest solution; avoid speculative features and abstractions. Update documentation when behavior or setup changes.

## Toolchain and layout

- Use Node.js 24 and pnpm 10.3.0, as documented in `README.md` and `package.json`.
- The app uses Next.js App Router, React, TypeScript, Tailwind v4, and shadcn/ui.
- Routes and the shared layout live in `src/app/`; components live in `src/components/`; shared server code lives in `src/lib/`.
- Use the `@/*` alias for imports from `src/`. Fixture JSON belongs in top-level `data/`, and static assets belong in `public/`.
- Reuse `src/components/ui/` components. Add components with `pnpm exec shadcn add <component>`.
- Keep components on the server unless browser state, events, or APIs require a Client Component. Dynamic route parameters are promises and must be awaited in server pages.

## Configuration and data

- Read application environment variables through `src/lib/env.ts`. It is server-only: never import it from a Client Component or log configuration values.
- Keep `.env.example` values empty and synchronized with the validated variables. `.env.local` remains ignored.
- Keep the root `.env` untracked and ignored. Preserve local copies; do not copy credentials into code, documentation, tests, logs, or responses.
- Use synthetic patient data only. Preserve unknown information instead of inventing values or treating unanswered fields as negative findings.
- Every screen must retain the non-dismissible banner: “Synthetic demo patient — fictional profile and access data.”
- Retain the disclaimer: “Prototype workflow. Not medical advice. Do not enter real health information.”
- Clearly label mock costs, coverage, and resources. Do not imply that booking, prescribing, insurance verification, or external transmission occurred.
- For future feature work, enforce consent, session ownership, and therapy-specific manufacturer access on the server, as specified in `sickway.md`.

## Validation and handoff

- Define concrete checks from the issue's acceptance criteria before implementing. Add meaningful tests for changed behavior; avoid tests that merely repeat the implementation.
- For application changes, run `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` as relevant to the change. For UI changes, inspect desktop and phone layouts, including banner visibility and navigation.
- Review the diff for unrelated changes, accidental files, exposed values, and stale documentation. Report the changes, checks, and remaining limitations.
- Use the repository's pull request template when opening a PR. Keep `CLAUDE.md` pointing to this file so both tools share the same guidance.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
