# Parallel issue plan

This is the original dependency plan, not a current status report. Check the linked issues for their present state. The issue descriptions say “complete issues in numeric order,” which technically implies serial work, but their explicit dependency graph supports the following parallel work waves.

| Wave | Issues that can run in parallel |
| --- | --- |
| 1 | [#2 Project foundation](https://github.com/knelbaker/sickway/issues/2) alone |
| 2 | [#3 Shared schemas](https://github.com/knelbaker/sickway/issues/3) alone |
| 3 | [#4 Fixture data](https://github.com/knelbaker/sickway/issues/4), [#5 DynamoDB layer](https://github.com/knelbaker/sickway/issues/5), [#10 Demo routing](https://github.com/knelbaker/sickway/issues/10) |
| 4 | [#6 AI layer](https://github.com/knelbaker/sickway/issues/6) alone |
| 5 | [#7 Deploy/health](https://github.com/knelbaker/sickway/issues/7), [#11 SBAR generation](https://github.com/knelbaker/sickway/issues/11) |
| 6 | [#8 Sessions/pairing](https://github.com/knelbaker/sickway/issues/8) alone |
| 7 | [#9 Extraction endpoint](https://github.com/knelbaker/sickway/issues/9), [#12 Intake submission endpoint](https://github.com/knelbaker/sickway/issues/12) |
| 8 | [#13 Student screen part 1](https://github.com/knelbaker/sickway/issues/13), [#15 Encounter read APIs](https://github.com/knelbaker/sickway/issues/15) |
| 9 | [#14 Student screen part 2](https://github.com/knelbaker/sickway/issues/14), [#16 Clinician queue](https://github.com/knelbaker/sickway/issues/16), [#18 Options endpoint](https://github.com/knelbaker/sickway/issues/18) |
| 10 | [#17 Brief audio](https://github.com/knelbaker/sickway/issues/17), [#19 Manufacturer resource gate](https://github.com/knelbaker/sickway/issues/19) |
| 11 | [#20 Clinician options UI](https://github.com/knelbaker/sickway/issues/20), [#21 Attach endpoint](https://github.com/knelbaker/sickway/issues/21) |
| 12 | [#22 Clinician attach UI](https://github.com/knelbaker/sickway/issues/22), [#23 Packet/student return flow](https://github.com/knelbaker/sickway/issues/23) |
| 13 | [#24 Reset flow](https://github.com/knelbaker/sickway/issues/24) alone |
| 14 | [#25 Fallback/failure states](https://github.com/knelbaker/sickway/issues/25) alone |
| 15 | [#26 Core acceptance pass](https://github.com/knelbaker/sickway/issues/26) alone |
| 16 | [#27 Clinician voice](https://github.com/knelbaker/sickway/issues/27), [#29 Simulated follow-up](https://github.com/knelbaker/sickway/issues/29), and preparatory parts of [#30 Submission](https://github.com/knelbaker/sickway/issues/30) |
| 17 | [#28 Student voice](https://github.com/knelbaker/sickway/issues/28); final #30 work continues after the feature freeze |

## Recommended initial split

After the foundation and schema issues are complete, the strongest immediate three-person split is:

- Person A: #4 fixture data
- Person B: #5 DynamoDB layer
- Person C: #10 deterministic routing

The highest-value later parallel groups are #14/#16/#18 and #20/#21 because they divide cleanly across student UI, clinician UI, and server endpoints.

## Coordination note

Parallel means implementation can overlap, not necessarily that changes should be merged blindly. Any wave consuming shared schemas or API payloads should agree on the contract first. Changes to `schemas.ts`, `api-contracts.ts`, `/s`, or `/hcp` should have a single designated owner.
