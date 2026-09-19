# Language access: English and Spanish (issue #61)

Students who are not native English speakers are a target audience. The first supported pair is **English and Spanish**. This is not a claim to serve every non-native English speaker, and it is not validated translation.

## What is localized

| Area | English | Español |
| --- | --- | --- |
| Header, language selector, reset dialog, “demo was reset” notice | ✓ | ✓ |
| Home / pairing, join, “not paired” gate | ✓ | ✓ |
| Student intake: profile, description, follow-ups, review, onset confirmation, consent, status, prepared demo, dictation, simulated follow-up | ✓ | ✓ |
| Returned packet page, including loading, unavailable, and reconnecting states | ✓ | ✓ |
| Packet instructions | `data/instructions.en.json` | `data/instructions.es.json` |
| Required banner and disclaimer | exact English, always | Spanish equivalent shown underneath |
| Clinician workspace (`/hcp`) | ✓ | English only (out of scope) |
| Fixture names and labels (plan, therapies, pharmacies, “Mock coverage — not verified”) | ✓ | English; explained in plain Spanish beside them |

All Spanish lives in `src/lib/i18n/messages.ts` and `data/instructions.es.json`. `es` is typed against `en`, so a missing string fails `pnpm typecheck`, and a test fails if any Spanish string is empty.

## Rules the implementation follows

- **No runtime translation, in either direction.** What a student types or dictates is shared in their own words. The extraction prompt is told to keep phrases in the student's language; the clinician brief is written in English and may quote Spanish phrases as written. The prepared demo case is English and says so in Spanish.
- **Language is a choice, never an inference.** “English” and “Español” are always visible in the header, each named in its own language. Nothing is assumed from the profile, the browser, or the instruction-language preference, and choosing Español does not change that preference.
- **Session-scoped.** The choice is stored per demo session (`sickday.language.<sessionId>`), survives navigation and refresh, and is not reused after a reset. A choice made on the entry screen before pairing is carried into the session that device starts or joins.
- **Switching changes text only.** The draft, answers, unknowns, and consent live in component state and are untouched; switching never submits and never ticks or clears consent. Error messages are stored as keys, so they follow the switch too.
- **Plain language.** Short sentences; terms explained where they first appear: plan (seguro médico), cost ceiling, consent, generic, coverage, the fixture clock.
- **Instruction-language preference.** The student can edit it in review (it starts from the displayed profile selection). It is sent as `preferredInstructionLanguages`, stored on the encounter with source `student_review`, shown to the clinician, and used as the default for the packet's language checkboxes (“student's preference”). The clinician still reviews and confirms; the packet matches what the clinician confirmed. If the packet lacks the screen's language, the packet page says so instead of translating.
- **Onset phrases.** `suggestOnsetIso` understands common Spanish phrases (“ayer por la mañana”, “anoche”, “hace dos días”, “hace 3 horas”, “anteayer”) the same way as English ones, and does not mistake “mañana” (tomorrow) for a past morning. Anything else gives no suggestion and the student enters the time.
- **Page language.** `<html lang>` follows the selector; English-only regions (required notices, brand, clinician workspace, English instructions) carry `lang="en"`, and each instruction block carries its own `lang`.

## Walkthrough (run once in each language)

Use fictional details only. Start on the home screen.

1. **Choose the language** in the header (English or Español). Start a demo session; open the join link on the second device. The student device keeps the chosen language after a refresh.
2. **Unknown answer.** On `/s`, describe feeling sick (in Spanish, for example: “Me desperté con fiebre de 102, me duele todo el cuerpo, empezó ayer por la mañana y tengo un examen a las 2”). Answer five checklist items “No” and one “Not sure / No estoy seguro/a”. Continue to review: that item reads “Not sure”, never “No”. Confirm the suggested onset or edit it.
3. **Language switching.** On the review screen, switch language. Every label changes; the typed text, the answers, the unknown, the onset confirmation, and the (unticked) consent box do not. Nothing is sent.
4. **Declined consent.** Press Decline / No aceptar. “Not shared / No se compartió” appears and the clinician queue stays empty.
5. **Share.** Tick consent and submit. The status says the intake needs review (because of the unknown answer) and never reads as an all-clear.
6. **Instruction-language preference.** Start over, answer every item, and in review choose only Español under “Instruction languages / Idiomas de las instrucciones”. Submit. On `/hcp` the source panel shows Spanish as the student's choice, and after selecting an option the language checkboxes default to Spanish (“student's preference”). Confirm and attach.
7. **Packet.** The student screen shows “Your demo packet is ready / Su paquete de demostración está listo”. The packet page is in the chosen language with the Spanish instructions. If the clinician had chosen English only, the Spanish page says the instructions are shown in the available language and that the demo does not translate.
8. **Extraction failure.** Set `DEMO_SIMULATE_AI_FAILURE=1`, restart `pnpm dev`, and describe symptoms again. The screen explains, in the chosen language, that nothing was filled in, and offers “Enter details myself / Escribir los datos yo mismo/a”. Every field reads “not reported / no informado”.
9. **Reset.** “Reset demo / Reiniciar demostración” starts a new session in English: the previous session's language is not reused.

Status of this walkthrough: steps 2–6 and 8–9 are covered by automated tests (`src/components/language-access.test.tsx`, the intake route tests, `pnpm acceptance`); both languages pass `pnpm check:responsive` (add `--lang es`) at 320–1280 px. A teammate has gone through the student flow in Spanish in the running app; the edge cases (declined consent, an unknown answer, a mid-intake language switch, extraction failure, reset) have automated coverage and belong in the #30 rehearsal to be repeated by hand.

## Spanish wording: review status and open questions

The Spanish was written by an AI assistant, not by a professional translator. **A Spanish-speaking member of the team read it in the running app on September 19, 2026 and requested no changes.** That is a teammate's read-through, not a professional or clinical translation review, so the copy must still not be described as validated. Questions that remain open for a future, more formal review:

1. Register: the copy uses **usted**, matching `data/instructions.es.json`. Would **tú** suit students better?
2. “Profesional clínico” for *clinician*; “admisión” for *intake*; “compromiso de hoy” for *deadline today*; “dato fijo de la demostración” for *demo fixture*; “resultado preparado” for *prepared fixture output*. Natural? Regional alternatives?
3. Inclusive forms such as “seguro/a”, “enfermo/a”, “yo mismo/a”: keep, or rephrase to avoid gendered endings?
4. Checklist descriptions (for example “silbidos al respirar” for *wheezing*, “sarpullido” for *rash*): clear across regions?
5. Temperatures stay in °F because the fixture and the seeded sentence use °F. Should °C be shown alongside?
6. “La reserva de citas no está conectada” for *Booking not connected*.

Known limitations: fixture names and the label “Mock coverage — not verified” remain in English (explained in Spanish beside them); the clinician workspace, the clinician brief, and the voice agent are English only; dictation listens in the selected language but nothing is translated.
