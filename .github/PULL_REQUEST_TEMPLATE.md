## Outcome

<!-- Lead with the resulting behavior. Explain the user or system problem this PR solves. -->

Closes #

## What changed

<!-- Describe the final implementation. Include relevant routes, components, APIs, data shapes, fixtures, and states. -->

-

## Acceptance criteria

<!-- Copy the issue criteria and mark only those demonstrated by this PR. Add any criteria discovered during implementation. -->

- [ ]

## Key decisions and tradeoffs

<!-- Explain choices a future agent or reviewer could not infer from the diff. Note deviations from the issue or `sickway.md`, with reasons. Write "None" if there are none. -->

None.

## Validation evidence

<!-- Give exact commands and results. Then list manual scenarios, devices, and browsers exercised. Do not write only "tested locally." -->

| Check | Result |
| --- | --- |
| `command` | Pass/fail — relevant details |

Manual checks:

1.

## Visual evidence

<!-- For UI changes, add before/after screenshots or a recording for desktop and phone-sized layouts. Use synthetic demo data only. Delete this section when it does not apply. -->

## Product and data guardrails

<!-- Check every applicable item. Explain intentionally inapplicable or failing items below. -->

- [ ] Only synthetic data appears in code, fixtures, tests, logs, and screenshots.
- [ ] Missing or unknown information remains explicit and is not converted to a negative or invented value.
- [ ] Consent and demo-session ownership are enforced on the server for affected flows.
- [ ] Mock costs, coverage, stock, resources, and prepared output are labeled at the point of use.
- [ ] The UI does not imply that booking, prescribing, insurance verification, fulfillment, or external transmission occurred.
- [ ] Manufacturer resources remain locked until an explicit therapy-specific request, including server-side enforcement.
- [ ] Changed success, loading, empty, error, unexpected-input, and reset states were considered.
- [ ] The core flow still works as intake → clinician brief → options → packet.

Guardrail notes:

<!-- List items that do not apply and why, plus any remaining limitation. -->

## Operational impact

<!-- List new or changed environment variables, services, permissions, database records, migrations, cache behavior, deployment steps, or costs. Never paste secret values. Write "None" if there are none. -->

None.

## Reviewer and agent handoff

<!-- Point reviewers to the riskiest code and state any follow-up work. -->

- Review focus:
- Known limitations:
- Follow-up issues:

## Author checklist

- [ ] I read the linked issue, `README.md`, and relevant sections of `sickway.md`.
- [ ] This PR stays within the issue scope; scope changes are documented above.
- [ ] I reviewed my own diff for accidental files, secrets, real personal data, debug code, and stale copy.
- [ ] I added or updated meaningful tests where behavior or risk warrants them.
- [ ] I ran the relevant checks and recorded their exact results above.
- [ ] I updated documentation, fixtures, and types affected by this change.
