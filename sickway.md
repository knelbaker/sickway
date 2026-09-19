# Sick Day + Doorway — Design Spec

VTHacks 14 · Code for the Cup · Sept 18–20, 2026
Status: draft v3 — core demo scoped · Owner: whole team · Submission deadline from the original plan: **Sunday 8:00 AM** (treat **Saturday night** as the real deadline; verify organizer details)

> A synthetic workflow prototype that turns student intake into a concise clinician brief, lets the clinician inspect clearly labeled mock access options, and returns a patient packet. The clinician brief is the centerpiece. No appointment is booked, prescription transmitted, insurance checked, or real patient treated.

### What changed in v3

- Removed the outbreak map, Side Kick, background jobs, S3, and their prize dependencies from hackathon scope.
- Made a typed end-to-end flow the first milestone. Voice is added only after that flow works on two devices.
- Added an explicit synthetic patient profile, separate consent, field provenance, and handling for missing or unexpected answers.
- Replaced broad automation and privacy promises with claims the demo can substantiate. Mock labels appear at the point of use.
- Distributed backend ownership and made team assignment an immediate prerequisite.

---

## 1. Problem and users

### 1.1 Student — Sick Day
A fictional student has a fever and an exam today. While sick, they must explain symptoms, understand next steps, and keep track of visit instructions. This prototype demonstrates intake and a returned packet. Booking, transportation, food delivery, insurance verification, and prescription fulfillment remain outside the product demonstrated here.

### 1.2 Clinician — Doorway (primary user)
A fictional college-health nurse practitioner needs a concise intake summary and a convenient way to inspect access resources after choosing what to investigate. The demo tests whether a brief plus an options table makes that workflow understandable. It does not establish measured time savings, reduced prescription abandonment, or demand from clinicians or manufacturers.

The campus health map is a future research idea, not a third user surface for this hackathon.

---

## 2. Goals and non-goals

### Required deliverable
1. One synthetic scenario works end to end on a phone and laptop: **intake → clinician brief → options → packet**.
2. The brief plays as audio, with matching visible text and a manual Play button.
3. A clinician can use typed questions or explicit controls to inspect mock options and attach a packet.
4. Manufacturer resources unlock only after an explicit therapy-specific request, enforced on the server.
5. Missing information stays missing; synthetic profile fields and mock transactions are visibly labeled.
6. The same demo can be reset and repeated without leaking state between runs.

### Optional, only after the required flow passes rehearsal
- One clinician voice agent using the same working endpoints as typed controls.
- Student voice intake after clinician voice works reliably.
- A two-tap simulated follow-up and outcome chip.

### Not in hackathon scope
- Map, dorm signals, time slider, aggregate manufacturer dashboard, or privacy analytics.
- Cloudforce Side Kick or any separate mini-app.
- Lambda, EventBridge, S3, background audio pipelines, generated PA forms, or MSL requests.
- Real insurance, pharmacy, booking, EHR, prescribing, email, or SMS integrations.
- Accounts, production authentication, payments, or real patient data.
- Runtime medical translation: use reviewed demo copy in EN and ES; do not claim clinical validation.
- Additional illness scenarios or infrastructure added solely for a prize.

---

## 3. The demo — this section defines scope

### Setup, visible before the timer starts
- Open the student and clinician screens in the same isolated demo session.
- Show **“Synthetic demo patient — fictional profile and access data.”**
- Load `demo-student-01`: Alex Demo, age 20, fictional out-of-state PPO, English and Spanish instruction preferences, and an optional fictional cost ceiling. The profile contains no dorm.
- Show the profile fields and their source. They are not extracted from the opening sentence.
- Load a displayed fixture clock and explicit symptom onset for the scripted case. Do not interpret “yesterday morning” as an exact timestamp silently.
- Consent begins unchecked on every reset.

### Scene 1 — Student intake (about 60 seconds)
1. Student enters: “I woke up with a 102 fever, my whole body aches, it started yesterday morning, and I have an exam at 2.” Typed input is the baseline; voice is optional.
2. Three compact follow-up groups collect the red-flag checklist, medications taken, and allergies. A checklist is not presented as one answered yes/no question. Unknown answers remain unknown.
3. Student reviews the extracted fields and confirms the displayed onset. If needed, clarifications occur here; the three-group target is not a hard limit on required clarification.
4. A **separate consent control** asks permission to share this synthetic intake with the demo clinic. Declining leaves the intake on the student screen and does not create a queue entry.
5. Student submits. Show “Demo next step: campus clinic” and “Booking not connected.” Show any sample visit cost beside **“Mock coverage — not verified.”** No slot is described as held.

### Scene 2 — Clinician brief and options (about 90 seconds)
1. The encounter appears in the paired clinician queue. The judge opens it and presses **Play brief** (about 20 seconds); SBAR text remains visible.
2. Judge types or says: “Show the antiviral demo options and sample costs.” The table shows a generic fixture first and a fictional brand fixture, with mock cost and coverage labels.
3. A category request does **not** unlock manufacturer resources. The judge selects a named fictional therapy and clicks “Show manufacturer resources,” or explicitly requests that therapy by name.
4. The judge chooses the generic fixture, selects the prewritten Spanish instructions, reviews a confirmation, and attaches the packet.
5. Status becomes **“Packet available in demo.”** Nothing is transmitted to a pharmacy or external clinic.

### Scene 3 — Returned packet (about 30 seconds)
1. The student screen shows the packet: chosen demo option, fictional pharmacy, mock price, and EN + ES demo instructions.
2. Presenter points out which parts executed and which data are fixtures.
3. Only if completed before feature freeze: “Simulate follow-up” updates a self-reported outcome chip. This is not evidence of real prescription fulfillment or improved health.

### What the judge should understand
- Intake becomes a concise, traceable brief.
- The clinician remains responsible for selection; the app presents demo access data.
- A packet returns to the paired student screen.
- This is a working synthetic workflow, not a connected healthcare service.

---

## 4. System overview

| Component | Responsibility |
|---|---|
| Next.js + TypeScript + Tailwind + shadcn/ui on Vercel | Student and clinician screens, packet page, all API routes |
| AI SDK + Gemini | Structured intake extraction and SBAR drafting; never invent missing fields |
| DynamoDB, one table | Demo sessions, encounters, packets, resource audit events, cached generation |
| Static files in `/data` and `/public` | Synthetic profile, mock catalogs, approved demo copy, prerecorded brief |
| Browser speech synthesis | Audio for changed briefs when live TTS is unavailable |
| ElevenLabs, optional integration | Clinician voice first; student voice only after core completion |

No Lambda, S3, scheduled jobs, map, websockets, or second application. Poll the active encounter and queue every two seconds during the demo. Stop polling on inactive screens.

DynamoDB is the only persistent backend. Do not replace it with server-process memory on Vercel: both devices must read the same durable state. If it is not connected within the initial integration checkpoint, stop optional work and fix persistence before proceeding.

### 4.1 Budget and service readiness
- Target $0 spend; verify actual account entitlements and quotas before relying on any service. Do not present unverified free-tier allowances as guarantees.
- Make one deployed Gemini call, one database round trip, and one paired-device read before building optional features.
- Cache generated output by normalized input, model, and prompt version. A cached fixture response is visibly labeled as such.
- Use typed input and browser speech during development. Reserve available ElevenLabs usage for integration and rehearsal within account terms.
- Use one tested judging configuration. Do not migrate accounts or agent configurations on Saturday night.
- If live generation is unavailable, expose “Use prepared demo” explicitly. Never silently substitute a fixture for a judge's different input.
- Default Vercel URL is sufficient. A custom domain is optional polish, not a prerequisite.

---

## 5. Screens

### `/s` — Student
- Persistent synthetic-data banner and visible profile summary.
- Text input first; optional microphone and transcript.
- Review form: extracted symptoms, temperature, onset, deadline, medications, allergies, red-flag answers, and profile language preferences.
- Separate unchecked consent control, followed by Submit.
- Status and packet view. No simulated booking success message.
- “Prototype workflow. Not medical advice. Do not enter real health information.”

### `/hcp` — Clinician
- Queue scoped to the paired demo session; only consented submissions appear.
- SBAR text and manual audio playback. Autoplay may be attempted but is never required.
- Missing information displayed as “not reported”; no implied negative findings.
- Typed query plus option buttons; optional clinician voice.
- Generic-first fixture table, explicit mock labels, and locked manufacturer drawer.
- Review and confirm before attaching the packet.

### `/packet/:id` — Packet
- Available only within the paired session.
- Clearly labeled synthetic therapy, pharmacy, prices, and educational demo text.
- “Available in demo” status, not “prescription sent” or “appointment confirmed.”
- No QR code required; the student screen links directly to the packet.

---

## 6. Intake, provenance, and voice

### 6.1 Where each field comes from

| Field | Source | Missing or ambiguous behavior |
|---|---|---|
| Name, age, plan, optional cost ceiling | Visible synthetic profile | Block fixture setup if required profile fields are absent |
| Preferred languages | Visible profile, editable in review | Default to the explicitly displayed profile selection |
| Symptoms, temperature, exam/deadline | Student text or transcript | Mark not reported; do not infer absent facts |
| Onset | Student statement plus explicit review confirmation | Ask for clarification or leave unknown; omit elapsed-time claims |
| Medications and allergies | Follow-up groups | Distinguish “none reported” from unanswered |
| Red flags | Per-item checklist | Store true, false, or unknown; never coerce unknown to false |
| Consent | Separate unchecked control | No clinician sharing unless explicitly true |
| Dorm | Not collected | No map or dorm analytics |

No voice agent can supply consent on the user's behalf or overwrite the synthetic profile silently. A three-question target cannot override missing-data handling.

### 6.2 Baseline flow before voice
1. Load synthetic profile.
2. Extract candidate fields from text.
3. Review and correct fields, including onset and unknown answers.
4. Capture sharing consent separately.
5. Submit the reviewed payload to the server.

Voice is an input layer over this flow. The clinician agent uses the same options and attach endpoints as buttons. Every spoken cost comes from a labeled tool result. Confirmation is required before attach. If speech recognition fails, the judge continues with the visible typed controls.

### 6.3 Red-flag demo checklist
Retain the original scenario's checklist categories: breathing/chest pain, confusion/fainting, stiff neck/rash, high temperature, dehydration, and sudden severe headache. These are prototype fields, not a validated clinical screening instrument.

- A positive flag takes the emergency branch and bypasses the routine demo flow.
- An unknown flag keeps the intake in `needs_review`; do not display “no red flags.”
- Check the reviewed values on the server as well as in the UI.
- Emergency messaging and any broader triage rules require clinical review before real-world use. A disclaimer does not make them validated.

### 6.4 Brief audio
- Keep a prerecorded brief for the exact seeded case under `/public`.
- Use it only when the current approved brief matches that fixture.
- For changed inputs, speak the current brief using browser speech synthesis; otherwise show the text with an explicit audio-unavailable state.
- Optional live TTS is added only after rehearsal. No background generation service is required.
- Aim for 50–65 words, but time the actual recording. Never sacrifice factual completeness solely to hit 20 seconds.

---

## 7. Core logic

### 7.1 Demo routing
Use deterministic branches for the synthetic scenario: emergency, needs review, or routine clinic demo. Keep routing separate from the LLM's prose. This demonstrates rule execution, not clinically validated triage.

Remove the binary “antiviral window closes” countdown from the UI and pitch. If onset is confirmed, show elapsed symptom time with its source. Clinical treatment guidance is outside the claim made by this prototype.

Unexpected inputs must produce a visible review state or an explicit “outside this demo scenario” response, never an invented successful outcome.

### 7.2 SBAR generation
Input: reviewed intake, synthetic profile, and deterministic routing result.
Output: `situation`, `background`, `assessment`, `recommendation`, and `spokenScript`, validated with a schema.

- No diagnosis, drug recommendation, invented negatives, or claims that insurance was verified.
- Describe the assessment as a demo routing result.
- Preserve unanswered fields as “not reported.”
- Display source values alongside the brief so the judge can inspect grounding.
- On generation failure, offer a deterministic summary of the current fields. Prepared fixture output requires explicit selection and a label.

### 7.3 Options
Join the small therapy, plan, and pharmacy fixture catalogs. Sort generic entries first, then mock estimated cost. Label every cost, coverage, stock, and resource value as mock data at the point of display.

Return “No demo option found” for unsupported queries. Do not fabricate a catalog match. Limit resources to a static fictional copay card and sample educational resource; no generated PA forms.

### 7.4 Manufacturer resource gate
- SBAR contains no manufacturer promotion.
- A category query lists options without unlocking resources.
- Unlock a therapy only on an explicit therapy-specific action or unambiguous named request.
- Enforce the gate on the server, including attachment of resource IDs.
- Label every item “Manufacturer resource — fictional demo.”
- Log therapy ID, resource ID, action, and unlock reason.
- Describe this as a demonstrated UI and server rule. It does not establish absence of commercial influence or prove an ethical system by itself.
- No data is sent to manufacturers.

### 7.5 Packet
After explicit confirmation, store the selected fixture therapy, fictional pharmacy, mock price, attached resources, and selected prewritten EN/ES demo instructions. Both devices read the same packet record. Attaching is idempotent so a repeated click does not create duplicate packets.

### 7.6 Optional follow-up
A “Simulate follow-up” control records a synthetic self-report and updates an outcome chip. No map signals, pharmacy confirmation, or claims of improved outcomes are derived from it.

---

## 8. Data and state

```ts
type Answer = true | false | null; // null = unknown

type ReviewedIntake = {
  symptoms: string[];
  onsetIso: string | null;
  onsetConfirmed: boolean;
  maxTempF: number | null;
  medsTaken: string[] | null;      // [] = explicitly none; null = unanswered
  allergies: string[] | null;
  redFlags: Record<string, Answer>; // runtime schema requires every checklist key
  deadlineToday: string | null;
  transcript: string;
};

type Encounter = {
  id: string;
  demoSessionId: string;
  profileId: "demo-student-01";
  createdAt: string;
  status: "needs_review" | "emergency" | "ready" | "in_visit" | "packet_available";
  intake: ReviewedIntake;
  consent: { shareWithClinic: true; capturedAt: string };
  fieldSources: Record<string, "synthetic_profile" | "student_review" | "demo_fixture">;
  sbar?: {
    situation: string;
    background: string;
    assessment: string;
    recommendation: string;
    spokenScript: string;
    source: "generated" | "deterministic" | "prepared_fixture";
  };
  unlockedTherapyIds: string[];
  chosenTherapyId?: string;
  packetId?: string;
  followUp?: { simulated: true; filled: boolean; symptomStatus: string };
};
```

Before consent, the draft stays in the student UI; only consented submissions create clinician-visible records. Pair the two devices with an unguessable demo session token checked by every endpoint. This limits casual cross-session access; it is not production authentication or a claim of medical-data security.

DynamoDB keys: `SESSION#<id>` for session metadata; `SESSION#<id>` / `ENC#<id>` for encounters; `SESSION#<id>` / `PKT#<id>` for packets; session-scoped event and cache records. Queue reads are scoped to the active session. Reset creates a fresh session and clears both UIs; old sessions expire and are not reused in judging.

### Fixture files
- `demo-profile.json`: explicit fictional profile and displayed fixture clock/onset.
- `plans.json`: one fictional plan and mock formulary entries.
- `therapies.json`: one generic fixture and one fictional brand fixture.
- `pharmacies.json`: two fictional pharmacies and mock prices/stock.
- `resources.json`: minimal fictional resources linked to therapy IDs.
- `instructions.en.json`, `instructions.es.json`: prewritten demo instructions.
- `demo-brief.json` and `/public/demo-brief.mp3`: exact matching prepared brief.

No dorm catalog, signals table, or outbreak history.

---

## 9. API routes

| Route | Purpose |
|---|---|
| `POST /api/demo-session` | Create an isolated synthetic session and fixture profile |
| `POST /api/extract` | Extract candidate intake fields for review; no queue entry |
| `POST /api/intake` | Validate reviewed fields and explicit consent; persist encounter and brief |
| `GET /api/encounters` | Queue scoped to paired demo session |
| `GET /api/encounters/:id` | Read current encounter after session check |
| `POST /api/encounters/:id/options` | Return labeled fixture options; category lookup does not unlock |
| `POST /api/encounters/:id/resources` | Validate explicit therapy request, unlock, and audit |
| `POST /api/encounters/:id/attach` | Validate confirmation and resource gates; persist packet |
| `GET /api/packet/:id` | Read packet after session check |
| `POST /api/encounters/:id/followup` | Optional simulated self-report |

Keep model configuration, timeouts, schema validation, and bounded retries in `lib/ai.ts`. Keep generation caches session-scoped and keyed by actual input plus model/prompt version. Every endpoint validates session ownership and runtime schemas. No arbitrary encounter or packet reads by ID alone.

---

## 10. Real vs. mocked — visible in the product and pitch

| Piece | What the demo establishes | Required label or limitation |
|---|---|---|
| Intake extraction and review | Fields move into a reviewable form | Synthetic patient; missing values preserved |
| Demo routing | Deterministic branches execute | Not clinically validated triage |
| SBAR | Summary generated or assembled from reviewed input | Identify generated, deterministic, or prepared source |
| Brief audio | Current brief is played or spoken | Prepared recording only for matching fixture |
| Options and resources | Catalog join, sort, unlock, and audit execute | All coverage, prices, stock, and resources mocked |
| Packet | Selection is stored and appears on paired student screen | No prescription or external delivery |
| EN/ES copy | Prewritten demo text renders | Not live translation or clinically validated instructions |
| Optional voice | Speech operates the same tools, if implemented | Do not claim live voice for prerecorded segments |
| Optional follow-up | Synthetic self-report updates a chip | No verified fulfillment or health outcome |
| Privacy/security | Synthetic-only input, consent gate, session checks | No anonymity, compliance, or production-security claim |

---

## 11. Safety, privacy, and claims

- Synthetic data only, including during judge interaction. Ask judges to use fictional answers.
- No real health, insurance, or financial data; no manufacturer data sharing.
- Consent is a separate explicit action, checked on the server before queue inclusion.
- Missing answers are not negative answers. Review unexpected input visibly.
- Keep secrets in environment variables and out of the public repo.
- Show mock labels beside values and actions; a disclosure slide alone is insufficient.
- Do not claim that the app “handles the whole sick day,” books appointments, verifies coverage, prescribes, or improves outcomes.
- Do not claim “nobody's identity leaked,” anonymity, or production readiness. Removing names or applying a count threshold would not prove anonymity; no map is shipped here.
- Before real use, clinical review, validated translations, authentication/access controls, data governance, and appropriate service integrations are separate workstreams.

---

## 12. Tracks and prizes

Focus the story on Impiricus and overall judging. Consider Gemini and ElevenLabs categories only when the implemented use qualifies. Confirm current rules, sponsor caps, deadlines, and eligibility with organizers; the original plan's event details are planning inputs, not verified facts in this revision.

Do not pursue Cloudforce Side Kick or a map-based Peraton pitch. Do not add features to increase the category count. A custom-domain prize is optional only if setup is already complete and costs nothing.

Commercial fit is a hypothesis: a patient-context brief might be a useful channel for clinician-requested access resources. Sponsor interest and clinician demand must be established through feedback, not asserted in the pitch.

---

## 13. Deferred ideas — after the hackathon

Map/outbreak analytics, Side Kick, background audio generation, dynamic translation, generated PA forms, manufacturer analytics, and real integrations are deferred. They are not stretch goals for the remaining build window.

A future map would require a separate privacy and usefulness assessment, including re-identification and changes between successive aggregate views. Do not revive the original per-student live-dot demonstration.

---

## 14. Build plan and ownership

Assign actual names before further feature work. Plan for three builders; if fewer are available, remove all optional voice and follow-up work. A fourth person improves polish and rehearsal rather than expanding scope.

| Owner | Responsibility, including integration |
|---|---|
| A — Intake | Student UI, synthetic profile, review/consent, extraction and intake endpoints, SBAR generation |
| B — Clinician | Queue, brief playback, options/resource endpoints and gate, attach endpoint, optional clinician voice |
| C — Shared state and packet | Deploy, DynamoDB/session helper, paired-device setup, packet read/UI, reset, optional follow-up |
| D — If available | Visual consistency, fixtures and copy review, pitch, Devpost, backup video, stranger rehearsal |

A–C agree on schemas and sample endpoint responses first, then each owns their vertical flow. Story/submission work is shared if D is absent. C is not responsible for every API route.

### Milestones

Original calendar targets are retained below. If a target has passed, complete its gate immediately and cut optional work; do not compress integration and rehearsal to preserve features.

| When | Exit condition |
|---|---|
| Initial checkpoint, within first hour of adopting v3 | Owners assigned; deployed app, database round trip, paired session, and one Gemini request work |
| Saturday noon | **Typed flow works on both devices:** reviewed intake → queue → brief → options → attached packet |
| Saturday 1 PM | Consent decline, unknown answers, named resource unlock, changed input, and reset have been checked |
| Saturday 2 PM | Brief audio and visible mock/source labels work; core demo passes twice |
| Saturday 4 PM | Optional clinician voice integrated only if baseline remains reliable; otherwise retain typed controls |
| Saturday 6 PM | **Feature freeze.** Student voice/follow-up included only if already working; no deferred systems added |
| Saturday 6–9 PM | Polish, backup video, README, Devpost, stranger rehearsal |
| Saturday 9–10:30 PM | Repeat demo with reset; submit before closing; Sunday is buffer only |

### Cut order
1. Student voice and simulated follow-up.
2. Clinician voice input; retain typed controls and brief audio.
3. Live TTS; retain matching prepared brief plus browser speech/text for changed input.
4. Custom domain and decorative polish.

Never cut the typed end-to-end flow, reviewed intake and consent, traceable brief, mock labels, server-enforced resource gate, or returned packet. Map, Side Kick, and background jobs are already cut, not late fallbacks.

### Acceptance checks before polish
- Submit fictional intake on phone; open and attach packet on laptop; packet appears on phone.
- Decline consent; verify no queue entry is created.
- Leave a red-flag answer unknown; verify the system does not show a clean screen or routine completion.
- Change a symptom; verify the brief and audio do not silently reuse the seeded case.
- Ask a category question; resources stay locked. Request a named therapy; only its resources unlock.
- Repeat attach and reset; verify no duplicate packet or previous patient's state appears.
- Simulate generation/voice failure; continue through a labeled fallback.

---

## 15. Risks and fallbacks

| Risk | Response |
|---|---|
| Shared integration is late | Stop optional work; all owners complete the typed flow first |
| Loud room or voice failure | Visible typed controls and manual Play brief |
| Model timeout/quota | Current-field deterministic summary or explicitly selected prepared case |
| Unexpected judge answer | Review or unsupported-scenario state; never force it into the fixture |
| Browser blocks autoplay | Manual Play button is the normal path |
| Venue network failure | Hotspot or clearly labeled backup recording |
| Two devices show stale state | Visible status, scoped polling, refresh and repeatable reset |
| Mock data mistaken for real service | Labels beside every cost, resource, and completion state |
| Account/configuration changes break judging | Freeze tested configuration; no last-night account migration |

---

## 16. Pitches

### Overall judges — 4 minutes
1. **20 s:** A sick student should not have to repeat their story at every handoff. Show the synthetic-data banner.
2. **60 s:** Reviewed intake and separate consent on the phone.
3. **90 s:** Clinician brief, mock options, explicit resource gate, and confirmed attachment.
4. **30 s:** Packet appears back on the student screen.
5. **40 s:** Explain implemented workflow vs. mock services, limitations, and the next validation step: feedback from clinicians.

### Impiricus — 5 minutes
1. **40 s:** Introduce the fictional college-health clinician and the handoff problem as a design hypothesis.
2. **140 s:** Start with the brief and resource workflow, then show where intake came from and how the packet returns.
3. **60 s:** Explain the patient-context channel and demonstrate the therapy-specific resource gate. No claim of measured time saved or guaranteed neutrality.
4. **60 s:** Show what is real/mocked, describe commercial fit as a hypothesis, and ask which resource interactions matter most.

### Q&A
- **What is real?** Extraction/review, summary, data flow, resource gate, audit, and packet persistence. Identify the actual voice mode used.
- **What is mocked?** Patient, plan, prices, stock, resources, and any prepared content. No appointments or prescriptions are transmitted.
- **Is it private?** Only synthetic data is used; consent and session checks are demonstrated. Production privacy and security are not established.
- **Does it improve clinical outcomes?** Not evaluated. The demo demonstrates a workflow.
- **How is it different from existing products?** Present the proposed patient-context interaction and ask the sponsor to validate differentiation; do not assert knowledge of unverified product capabilities.

---

## 17. Submission checklist

- [ ] Required typed flow passes on two devices after a fresh reset
- [ ] Mock labels and synthetic profile are visible in screenshots and video
- [ ] Declined consent, missing answers, resource gate, and fallback behavior checked
- [ ] README: setup, architecture, implemented-vs-mocked table, limitations
- [ ] Working demo URL; no custom domain required
- [ ] Devpost: description, screenshots, backup video, libraries and prior work disclosed
- [ ] Actual implemented features match prize selections and pitch claims
- [ ] Organizer deadline, category cap, and attendance requirements verified
- [ ] Every contributor added and registered; submit Saturday night
- [ ] Tested configuration frozen and reset rehearsed before judging

---

## 18. Open questions

### Resolve immediately
1. Who are A, B, and C? Is there a fourth person for story/polish?
2. What already works on the deployed URL, and which integration gate is next?
3. What model/voice quota is actually available in the chosen accounts?

### Ask sponsor/organizers without blocking the core build
4. Is a patient-context brief differentiated and useful for the sponsor's intended clinicians?
5. Which one resource type best demonstrates value?
6. Do MLH prizes count toward the sponsor-track cap? What are the confirmed submission and judging requirements?
7. Are a second screen, headset, and power available at the table?

---

## Appendix A — Repo layout

```text
app/
  s/
  hcp/
  packet/[id]/
  api/
components/
lib/
  ai.ts
  intake.ts
  demo-routing.ts
  options.ts
  db.ts
  session.ts
  voice.ts
  packet.ts
data/
  demo-profile.json
  plans.json
  therapies.json
  pharmacies.json
  resources.json
  instructions.en.json
  instructions.es.json
  demo-brief.json
public/
  demo-brief.mp3
```

## Appendix B — Environment variables

```dotenv
GOOGLE_GENERATIVE_AI_API_KEY=
GEMINI_MODEL=                  # verified available model
AWS_REGION=
AWS_ACCESS_KEY_ID=             # least privilege for the demo table
AWS_SECRET_ACCESS_KEY=
DDB_TABLE=sickday
DEMO_SESSION_SECRET=
VOICE_MODE=baseline           # baseline or live; baseline uses typed input + browser/static audio
# Optional only after baseline works:
ELEVENLABS_API_KEY=
NEXT_PUBLIC_DOORWAY_AGENT_ID=
NEXT_PUBLIC_INTAKE_AGENT_ID=
```

## Appendix C — Glossary

- **HCP:** healthcare professional.
- **SBAR:** Situation, Background, Assessment, Recommendation.
- **PA:** prior authorization; form generation is deferred.
- **Copay card:** manufacturer assistance resource; fictional in this demo.
- **Formulary:** a plan's drug coverage list; mocked in this demo.
