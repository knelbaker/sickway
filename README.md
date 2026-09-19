# Sick Day + Doorway

A synthetic workflow prototype for student intake, a clinician brief, and a returned patient packet. The product scope and demo scenario are in [sickway.md](sickway.md).

Prototype workflow. Not medical advice. Do not enter real health information.

## What it does

One synthetic scenario, end to end, on two paired devices: **intake → clinician brief → options → packet**.

1. **Student (`/s`, phone).** Sees the synthetic profile and where each field comes from, types what is wrong, answers three follow-up groups, reviews and corrects every field, confirms the onset, and gives separate explicit consent. Declining keeps everything on the phone.
2. **Clinician (`/hcp`, laptop).** The shared intake appears in the queue on its own. The clinician reads a traceable SBAR brief (with audio and the source values beside it), asks for the mock options, opens one named therapy's manufacturer resources if they choose to, selects an option, reviews a confirmation, and attaches a packet.
3. **Student again.** “Your demo packet is ready” appears without a refresh and links to `/packet/<id>`.

**Reset demo** in the header starts a clean run. Nothing is booked, prescribed, verified, or sent anywhere.

## Architecture

| Piece | Where | Notes |
| --- | --- | --- |
| Screens | `src/app/{page,join,s,hcp,packet/[id]}` + `src/components/` | Next.js App Router, React, Tailwind v4, shadcn/ui. Server pages pass only a profile summary to client components; catalogs and manufacturer resources never enter a client bundle. |
| API routes | `src/app/api/` | All ten §9 routes (including the optional `followup`) plus `demo-session/reset` and `health`. Every session-scoped route starts with `requireSession`. |
| Persistence | `src/lib/db.ts` → one DynamoDB table | `SESSION#<id>` partition per demo session; items expire by `ttl`. No in-memory fallback. |
| Generation | `src/lib/ai.ts` → Gemini via the AI SDK | Schema-validated output, timeout, bounded retries, session-scoped cache. Used for extraction and the brief only. |
| Rules | `demo-routing.ts`, `options.ts`, `resources.ts`, `packet.ts`, `sbar.ts` | Routing, option matching, the resource gate, attach validation, and the brief's guardrails and fallback are deterministic code, never the model. |
| Fixtures | `data/*.json` via `src/lib/fixtures.ts` | The synthetic profile, plan, two therapies, two pharmacies, two resources, EN/ES copy, and the prepared brief. |
| Sync | `src/lib/client/use-polling.ts` | Two-second polling, paused while a tab is hidden. No websockets, Lambda, S3, or second app. |

## Implemented and mocked

| Piece | What the demo establishes | Label or limitation shown |
| --- | --- | --- |
| Intake extraction and review | Typed text becomes candidate fields; the student reviews, corrects, and confirms | Synthetic patient; gaps stay “not reported”; onset is unconfirmed until ticked |
| Demo routing | `emergency` / `needs_review` / `ready` decided by server rules | “Demo routing result, not a diagnosis”; not clinically validated triage |
| Clinician brief (SBAR) | Generated from reviewed facts, or assembled deterministically when generation fails | Source badge on both screens: generated, deterministic summary, or prepared fixture |
| Brief audio | The current brief is played or spoken, with its text always visible | “Prepared recording … Not live voice” only for the matching prepared case; otherwise “Browser speech” |
| Options | Catalog join, generic-first sort, cost-ceiling marker | “Mock cost”, “Mock coverage — not verified”, “Mock stock” inside every cell |
| Manufacturer resources | Locked until an explicit request for one named therapy's resources; enforced and audited on the server | “Manufacturer resource — fictional demo”; a demonstrated rule, not proof of neutrality; nothing is sent to a manufacturer |
| Packet | The confirmed selection is stored once and appears on the paired student screen | “Available in demo”; no prescription, pharmacy, or clinic contact |
| EN/ES instructions | Prewritten copy renders for the selected languages | Not live translation; “not clinically validated” |
| Sessions, consent, reset | Signed pairing token, server-checked consent, per-session isolation, clean reset | Not production authentication, anonymity, or compliance |
| Simulated follow-up (optional) | A two-tap made-up self-report updates an outcome chip on both screens | “Simulated self-report”; not evidence of fulfilment or a health outcome |
| Voice agents (optional) | **Not implemented** | — |

Everything about the patient, plan, prices, stock, pharmacies, therapies, and resources is fictional fixture data.

## Limitations

- **Not a connected service.** No booking, EHR, insurance, pharmacy, prescribing, email, or SMS. No real patient data may be entered.
- **Not validated.** The checklist, routing, brief, and instructions have had no clinical review. Emergency wording is prototype copy.
- **Not secure in a production sense.** The join link is a bearer token in a URL; there are no accounts, rate limits, or data-governance controls.
- **Generation depends on Gemini.** When it is slow or unavailable the demo continues with labelled fallbacks (deterministic brief, manual entry). Cached generations are not labelled as cached.
- **One scenario.** One profile, one plan, one therapy category. Anything else returns “outside this demo scenario” or “No demo option found”.
- **Student language preference is display-only**; the clinician chooses packet languages, defaulting to the profile.
- **Optional scope not built:** clinician voice and student voice. The shared ElevenLabs key is currently rejected as invalid.

## Local development

Use Node.js 24 and pnpm 10.3.0 (the version pinned in `package.json`).

```bash
pnpm install
pnpm dev
```

Open [localhost:3000](http://localhost:3000). The home page starts or resumes a demo session; `/join` pairs a second device; `/s` is the student intake and returned-packet status; `/hcp` is the clinician workspace; `/packet/<id>` shows a returned packet inside its own session. Every page uses the shared layout and persistent synthetic-data banner. The stubs run without credentials; intake, API routes, database access, and AI calls come in later issues.

## Server configuration

The root `.env` is tracked at the repository owner's request and contains shared configuration, including credentials. Keep its contents out of logs and documentation. For local overrides, copy `.env.example` to `.env.local` and fill in the required values. The example intentionally contains empty values only; `.env.local` stays ignored by Git.

Server code must import `env` from `@/lib/env` instead of reading environment variables directly. Importing the module validates all settings and throws an error listing missing or invalid variable names without including their values. The module is marked `server-only`, so it cannot be imported into a Client Component.

Required settings:

- `GOOGLE_GENERATIVE_AI_API_KEY` and `GEMINI_MODEL`
- `AWS_REGION`, `AWS_ACCESS_KEY_ID`, and `AWS_SECRET_ACCESS_KEY`
- `DDB_TABLE` and `DEMO_SESSION_SECRET`

`DEMO_SIMULATE_AI_FAILURE` is optional and for rehearsal only (see Fallbacks). `VOICE_MODE` accepts `baseline` or `live` and defaults to `baseline` when absent or blank. `ELEVENLABS_API_KEY`, `NEXT_PUBLIC_DOORWAY_AGENT_ID`, and `NEXT_PUBLIC_INTAKE_AGENT_ID` are optional and may be blank. Voice integrations are not implemented yet. Only the agent IDs have public names; never put secrets in `NEXT_PUBLIC_` variables.

## Deployment and health check

The repository is connected to a Vercel project owned by one teammate, and production is live at <https://vthacks-14.vercel.app>. **Known issue (September 19):** Vercel reports “Deployment was blocked” for every commit not authored by the project owner, which is how the Hobby plan treats private repositories, so production can lag `main` until the project owner redeploys from the Vercel dashboard (or pushes a commit themselves). Preview URLs sit behind Vercel login and cannot be used on a judge's device. `vercel.json` pins the Next.js framework preset and runs functions in `iad1`, next to the DynamoDB table in `us-east-1`. Use one Vercel project and one set of accounts for judging; do not migrate configuration late (sickway.md §4.1).

Server settings must exist in the Vercel project for Production, Preview, and Development. With the Vercel CLI linked to the project, teammates can fetch them instead of passing keys around:

```bash
vercel env pull .env.local
```

`GET /api/health` is the integration checkpoint from sickway.md §14. It performs one DynamoDB write/read/delete in a throwaway partition and one minimal Gemini structured call, then reports per-service `ok` and latency. It requires the `x-health-key` header to equal `DEMO_SESSION_SECRET`; any other request gets a 404 before a service is touched, so the route cannot be used to spend model quota. Responses never include keys, ARNs, or raw provider errors.

```bash
curl -s -H "x-health-key: $DEMO_SESSION_SECRET" https://vthacks-14.vercel.app/api/health
# {"dynamodb":{"ok":true,"latencyMs":…},"gemini":{"ok":true,"latencyMs":…}}  → 200, or 503 if either fails
```

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

### Acceptance run

`pnpm acceptance [base-url]` (default `http://localhost:3000`) drives the seven acceptance checks from sickway.md §14 over HTTP as two separate clients that share only the join token: the two-device packet round trip; declined consent; an unknown checklist answer; a changed symptom; the resource gate; repeat attach and reset; and the labelled fallbacks. It uses the real services behind that URL and creates its own throwaway sessions. It complements the run on two physical devices; it does not replace it.

## Shared code

- `src/app/`: routes and the shared shell.
- `src/components/ui/`: shadcn/ui components for Tailwind v4, configured in `components.json`.
- `src/components/synthetic-banner.tsx`: the non-dismissible synthetic-data notice.
- `src/components/session/`: session start, join, and the `SessionGate` wrapper for paired screens.
- `src/components/hcp/`: the `/hcp` queue, SBAR brief with its source badge and audio, options table with inline mock labels, locked manufacturer drawer, and the source-values panel.
- `src/components/packet/`: the `/packet/<id>` view.
- `src/components/student/`: the `/s` intake flow; the draft lives in `use-intake-draft.ts` and stays in browser memory.
- `src/lib/voice.ts`: brief audio rules — when the prepared recording may play, and the labelled fallbacks.
- `src/lib/format.ts`: browser-safe display helpers (fixture wall-clock times, “not reported”, mock dollars).
- `src/lib/env.ts`: validated server configuration.
- `src/lib/db.ts`: session-scoped DynamoDB helpers for the single demo table.
- `src/lib/session.ts`: demo session tokens, session creation, and the `requireSession` route guard.
- `src/lib/client/use-polling.ts`: two-second polling that pauses while the tab is hidden and keeps the last good data on errors.
- `src/lib/client/session-store.ts`: browser token store and `apiFetch`, which attaches the token to API calls.
- `src/lib/http.ts`: `json` / `errorJson` responses with `Cache-Control: no-store`.
- `src/lib/ai.ts`: server-only Gemini structured generation with schema validation, bounded retries, and session-scoped caching.
- `src/lib/demo-routing.ts`: pure, synchronous demo routing and confirmed elapsed symptom time.
- `src/lib/intake.ts`: candidate-field extraction from the student's text and the onset suggestion.
- `src/lib/encounters.ts`: server-side routing, field sources, brief, and persistence for a consented intake.
- `src/lib/options.ts`: deterministic join of the fixture catalogs into labelled mock option rows.
- `src/lib/packet.ts`: selection validation, idempotent packet persistence, and the packet read model.
- `src/lib/packet-view.ts`: browser-safe shape of `GET /api/packet/:id` (stored packet plus display text).
- `src/lib/resources.ts`: the manufacturer resource gate decision, atomic unlock, and audit events.
- `src/lib/sbar.ts`: clinician brief generation with a deterministic fallback and the prepared fixture.

`routeIntake(intake)` accepts a reviewed intake with an optional boolean `outsideScenario` marker and returns `{ branch, reasons }`. Any of the six checklist flags explicitly set to `true` yields `emergency`, even if other fields are invalid. Otherwise, unanswered (`null`) flags, missing or malformed fields, unexpected keys, and `outsideScenario: true` yield `needs_review` with explicit reasons. A valid intake with all six flags `false` yields `ready`. This is a demo routing result, not clinically validated triage or a diagnosis; temperature and other fields do not introduce additional routing rules.

`elapsedSinceOnset(intake, fixtureClock)` returns `{ hours, onsetIso, fixtureClock, source }` only for a confirmed onset and valid ISO timestamps with explicit timezones. `source` identifies `onsetIso` as `student_review` and `fixtureClock` as `demo_fixture`. Unconfirmed, missing, invalid, or future onset times return `null`. Elapsed hours use the supplied fixture clock, preserve fractional values, and never use the system clock or a treatment-window countdown.

## AI generation

Server code calls `generateStructured({ sessionId, schema, system, prompt, promptVersion })` from `@/lib/ai`. Supply a Zod schema and a session ID already verified by the calling endpoint. The helper scopes cache access to that session; endpoint authentication and consent checks belong to the later session/intake issues.

The helper uses the Google provider with `GOOGLE_GENERATIVE_AI_API_KEY` and `GEMINI_MODEL` from `env.ts`; there is no default model. Verify the configured model against the team's key before deployment. Each model attempt has a 12-second timeout. Timeouts and provider-designated transient errors receive at most two retries (three attempts total), with 500 ms and 1 second backoff. Schema-invalid output and permanent provider errors are not retried. SDK retries are disabled so they cannot multiply this bound.

- Success: `{ ok: true, data, cached }`, with `data` validated against the supplied schema. Callers must use `cached` to label reused output.
- Failure: `{ ok: false, reason }`, where `reason` is `timeout`, `invalid_output`, `provider_error`, or `cache_error`. Provider errors and output are not exposed, and fixtures are never substituted. Cache read/write failures are explicit failures; a failed write does not retry generation.

Cache keys hash the whitespace-normalized system and user prompts, configured model, and prompt version under `SESSION#<sessionId>` / `CACHE#<hash>`. Original prompts are passed to Gemini. Records inherit the database helper's 24-hour TTL; expired records are ignored even before DynamoDB removes them. Cached JSON is revalidated on every hit. Bump `promptVersion` whenever the prompt contract or schema changes. Concurrent first requests can each generate output; the cache does not coalesce in-flight requests.

`buildSbar({ sessionId, intake, profile, routing, usePrepared })` returns the clinician brief with its `source` always set. It asks Gemini for a draft (`generated`) from pre-rendered facts in which every gap already reads “not reported”. If generation fails, or the draft mentions a therapy or manufacturer, claims coverage was verified, or turns an unanswered field into a negative (`sbarGuardrailViolation`), it falls back to `deterministicSbar`, which assembles the same sections from the current fields with no model call. The prepared Scene 1 brief (`prepared_fixture`) is returned only when `usePrepared` is `true`, which must come from an explicit user action; a changed or failing input never selects it.

`POST /api/extract` (session-guarded) turns the student's free text into candidate fields for the review form and writes nothing: no encounter and no queue entry. Anything the student did not say stays `null`; a temperature is kept only if that number appears in the text; profile fields are never read from the sentence. The onset phrase is returned as written, and `suggestOnsetIso` derives a suggested timestamp from the phrase and the session's fixture clock in code (never the system clock, never the model), which the student must still confirm. Unrelated input returns `outsideScenario: true` with no fields. If generation fails the route returns `503 extraction_unavailable` so the student can enter fields manually; it never substitutes the seeded case.

`POST /api/intake` (session-guarded) is the hand-off from student to clinic. It stores nothing unless `consent.shareWithClinic` is literally `true` (`400 consent_required` otherwise), validates the reviewed intake including every checklist key, and then runs `routeIntake` on the server: any status sent by the client is ignored. A positive item is stored as `emergency` with no brief; an unanswered item is stored as `needs_review`; otherwise `ready`. `ready` and `needs_review` encounters get a brief from `buildSbar`, falling back to the deterministic summary. Each encounter records `fieldSources`, server-time consent, and `unlockedTherapyIds: []`, under `SESSION#<id>` / `ENC#<id>`. The response is only `{ encounterId, status }`.

`GET /api/encounters` returns the caller's session queue, newest first, in a compact shape for two-second polling; `GET /api/encounters/:id` returns one full encounter. Both are session-guarded, read only the caller's partition with a single `Query` or `GetItem`, and send `Cache-Control: no-store`. An encounter ID from another session is a 404, exactly like an ID that does not exist.

`POST /api/encounters/:id/options` (session-guarded, read-only) matches the clinician's query against the fixtures with plain keywords — no model call. “antiviral” or “flu” lists every therapy × pharmacy row for the profile's plan, generic first and then by mock cost; naming one fixture therapy lists only that therapy; anything else returns `{ found: false, message: "No demo option found" }`. Every cost, coverage, and stock value carries a mock flag, rows above the profile's cost ceiling are marked, and rows only say whether manufacturer resources exist. The route never changes `unlockedTherapyIds` and refuses `emergency` encounters with 409.

`POST /api/encounters/:id/resources` is the only route that ever returns manufacturer resources. `decideUnlock` unlocks on an explicit `therapyId`, or on text that both names exactly one fixture therapy by its full name and asks for its manufacturer resources; category text, a therapy's options or price, vague references, several names, and unknown IDs stay locked with a reason. The `/hcp` options box therefore sends every typed question to both the options and resources routes and holds no unlock logic of its own. An unlock appends the therapy to `unlockedTherapyIds` with an atomic, unique list append, returns only that therapy's resources (each labelled “Manufacturer resource — fictional demo”), and writes an `EVT#` audit event with therapy ID, resource IDs, action, and reason; a repeat is audited as a view and never duplicates the ID. If the unlock cannot be recorded, nothing is returned. This demonstrates a UI and server rule; it does not by itself establish the absence of commercial influence, and no data is sent to any manufacturer.

`POST /api/encounters/:id/attach` stores the clinician's confirmed selection as the encounter's packet. It requires `confirmed: true` (`400 confirmation_required`), validates every ID against the fixtures, requires the price to equal the fixture price for that therapy, pharmacy, and plan, and re-applies the resource gate: a resource whose therapy is not in `unlockedTherapyIds` is `403 resource_locked`, and a resource must belong to the chosen therapy. `emergency` and `needs_review` encounters are refused with 409. There is one packet per encounter (`PKT#<encounterId>`, conditional write), so a double click, a retry, or two simultaneous confirms all return the same packet. The encounter then gets `chosenTherapyId`, `packetId`, and `status: "packet_available"`. Nothing is transmitted to a pharmacy, clinic, email, or SMS.

### Brief audio

`public/demo-brief.mp3` is a prepared recording of the exact `spokenScript` in `data/demo-brief.json` (52 words, 23.9 s). “Play brief” on `/hcp` uses it only when the brief on screen would say the same words (`matchesPreparedScript` compares normalised script text, never encounter IDs). Any other brief is read by the browser's Speech Synthesis API, and if that is missing the screen says “Audio unavailable — read the brief below”. The mode is always labelled — “Prepared recording” or “Browser speech” — so a prepared clip is never mistaken for live voice, playback is always manual, and the SBAR text stays visible.

The current file was generated once with ElevenLabs text-to-speech (voice “Sarah”, model `eleven_multilingual_v2`, `mp3_44100_128`) from that exact text. It is a static asset: the app never calls ElevenLabs at runtime, so judging does not depend on the key or on credits. If `spokenScript` changes, regenerate the file from the new text and keep the filename, otherwise the recording will no longer match and the player will correctly fall back to browser speech:

```bash
node -e '
process.loadEnvFile(".env.local");
const fs = require("fs");
const text = require("./data/demo-brief.json").sbar.spokenScript;
const voiceId = process.argv[1]; // from GET https://api.elevenlabs.io/v1/voices
fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
  method: "POST",
  headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY, "content-type": "application/json" },
  body: JSON.stringify({ text, model_id: "eleven_multilingual_v2" }),
}).then(async (r) => fs.writeFileSync("public/demo-brief.mp3", Buffer.from(await r.arrayBuffer())));
' <voice-id>
```

Without a key, the macOS system voice works too: `say -v Samantha -r 175 -f brief.txt -o brief.aiff && ffmpeg -y -i brief.aiff -codec:a libmp3lame -b:a 96k -ac 1 public/demo-brief.mp3`.

`GET /api/packet/:id` (session-guarded, `no-store`) returns the stored packet in the §9 contract shape plus a `display` object resolved on the server from the fixtures: names, mock labels, the prewritten instruction copy for the selected languages only, and only the resources attached to that packet. The price is the one stored at attach time. A packet from another session, or an unknown ID, is a 404. `/packet/<id>` renders it with a synthetic or mock label beside every value and the status “Available in demo”; the student screen polls its shared encounter and shows an “Open demo packet” link once the status is `packet_available`.

### Fallbacks and failure rehearsal

Nothing prepared is ever substituted silently (sickway.md §4.1, §15):

- **Brief.** If generation fails, or a draft breaks a guardrail, the brief is the deterministic summary of the *current* input. Both screens label the brief's source: “Generated from the reviewed intake”, “Deterministic summary — assembled without the model”, or “Prepared fixture output”.
- **Extraction.** If it fails, the student is offered “Enter details myself”; nothing is pre-filled.
- **Prepared demo.** “Use prepared demo instead” on `/s` is the only way to the scripted case. The browser sends `{ usePreparedDemo: true, consent }` and no intake; the server stores the fixture intake and the fixture brief with every student field sourced as `demo_fixture`. Consent is still a separate, unticked control. This is also the one case whose audio uses the prepared recording.
- **Polling views** (`/hcp` queue and encounter, the student status, the packet page) share `PollStatus`: “Live · updated 2:05:11 PM”, or an amber “Reconnecting… showing data from 2:05:11 PM” when a request fails or no fresh data has arrived for six seconds. The last good data stays on screen and polling recovers on its own.

To rehearse a model outage, set `DEMO_SIMULATE_AI_FAILURE=1` in `.env.local` and restart `pnpm dev`: every generation then fails immediately and the flow must complete through the labelled fallbacks. The switch is ignored when `VERCEL_ENV` is `production`, so it cannot fire on the judging deployment; leave it unset there anyway.

## Demo sessions and pairing

The home page starts an isolated synthetic session (`POST /api/demo-session`) and shows a join link. Opening `/join?t=<token>` on the second device confirms the token with `GET /api/demo-session`, stores it, and offers the student and clinician screens. Both devices then read the same `SESSION#<id>` partition. The browser keeps the token in `localStorage` and `apiFetch` sends it as the `x-demo-session` header.

The token is `<sessionId>.<HMAC-SHA256(sessionId)>` signed with `DEMO_SESSION_SECRET`. Every session-scoped route must start with the guard and use only `auth.session.id` for database calls, never an ID supplied by the client:

```ts
const auth = await requireSession(request);
if (!auth.ok) return auth.response; // 401 invalid_session or expired_session
```

Missing, malformed, tampered, swapped, unknown, and expired tokens all return 401 before any session data is read.

**Reset.** “Reset demo” in the header (always behind a confirmation) calls `POST /api/demo-session/reset`, which creates a fresh session and marks the old `META` with the new token. From then on every route answers the old token with `409 { error: "session_superseded", joinToken }` and no data, so the paired device shows “The demo was reset on the other device” with a one-tap “Join the new session”; old join links follow the same pointer. The student and clinician screens are keyed by session ID, so a new token clears the draft, consent, selections, the open encounter, audio, and polled data, and per-session browser storage keys mean nothing from an earlier run can render. Old sessions are not deleted; they expire by `ttl` and are never reused. Sessions expire after 24 hours. This limits casual cross-session access between demo runs; it is not production authentication or a claim of medical-data security (sickway.md §8, §11).

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

Appendix A in the spec maps `app/`, `components/`, and `lib/` to this repository's `src/` directory. Fixture JSON lives in top-level `data/`. Consumers should import `fixtures` from `@/lib/fixtures`, rather than importing individual JSON files. Keep cost, coverage, stock, and resource mock labels visible when displaying these values.

The prepared Scene 1 case (`scene-1-v1`) uses a displayed fixture clock of September 19, 2026 at 10 AM EDT and an explicit onset of September 18 at 8 AM EDT (26 hours earlier). Its onset confirmation and six negative checklist answers are scripted follow-up responses, not facts inferred from the opening sentence. Medications and allergies remain unanswered (`null`). The preferred fictional pharmacy is only a setup preference; it does not represent a booking or transmission. This approved-case fixture must not prefill user consent, onset confirmation, or checklist responses. Prepared brief use requires an exact current-case match and explicit selection; audio is deferred to #17.

EN and ES instructions are static demo workflow copy, not clinically validated treatment instructions or runtime translations. Spanish-speaker review and a teammate's fictional-name review remain required before sign-off. No real brand, insurer, pharmacy, or manufacturer names are intentionally used.

For additional shadcn components, run `pnpm exec shadcn add <component>` from the repository root. `.npmrc` allows dependency additions at the root of this single-package pnpm workspace.
