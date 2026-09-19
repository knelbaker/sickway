#!/usr/bin/env node
/**
 * Scripted run of the seven acceptance checks in sickway.md §14, over HTTP,
 * as two separate clients ("phone" and "laptop") that share only the join token.
 *
 *   pnpm acceptance                                  # http://localhost:3000
 *   pnpm acceptance https://<deployed-url>
 *
 * Synthetic data only. Each run creates its own demo sessions, which expire by
 * ttl. It complements, and does not replace, the run on two physical devices.
 */
import { readFileSync } from "node:fs";

const base = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const preparedScript = JSON.parse(readFileSync(new URL("../data/demo-brief.json", import.meta.url), "utf8")).sbar.spokenScript;

const GENERIC = "therapy-generic-demo";
const BRAND = "therapy-brand-demo";
const BRAND_NAME = "Fictional Brand Antiviral Demo";
const NO_FLAGS = Object.fromEntries(
  ["breathing_chest_pain", "confusion_fainting", "stiff_neck_rash", "high_temperature", "dehydration", "sudden_severe_headache"].map((key) => [key, false]),
);
const seeded = {
  symptoms: ["fever", "whole-body aches"],
  onsetIso: "2026-09-18T08:00:00-04:00",
  onsetConfirmed: true,
  maxTempF: 102,
  medsTaken: null,
  allergies: null,
  redFlags: NO_FLAGS,
  deadlineToday: "Exam at 2 PM",
  transcript: "I woke up with a 102 fever, my whole body aches, it started yesterday morning, and I have an exam at 2.",
};
const genericAtA = { confirmed: true, therapyId: GENERIC, pharmacyId: "pharmacy-demo-a", mockPrice: 12, instructionLanguages: ["es"], resourceIds: [] };

/** One client with its own token, like one browser. */
function device(token) {
  return async (method, path, body) => {
    const response = await fetch(base + path, {
      method,
      headers: { ...(token ? { "x-demo-session": token } : {}), ...(body ? { "content-type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: response.status, body: await response.json().catch(() => null) };
  };
}

async function pairedDevices() {
  const { status, body } = await device(null)("POST", "/api/demo-session");
  if (status !== 201) throw new Error(`could not start a session (${status})`);
  const phone = device(body.token);
  const laptop = device(body.token); // the laptop "opens the join link"
  const joined = await laptop("GET", "/api/demo-session");
  if (joined.body?.sessionId !== body.sessionId) throw new Error("laptop did not join the same session");
  return { phone, laptop, token: body.token };
}

const results = [];
function expect(ok, message) {
  if (!ok) throw new Error(message);
}
async function check(name, run) {
  const started = Date.now();
  try {
    const note = await run();
    results.push({ name, ok: true, note, ms: Date.now() - started });
  } catch (error) {
    results.push({ name, ok: false, note: error.message, ms: Date.now() - started });
  }
}

await check("1. Two-device packet round trip", async () => {
  const { phone, laptop } = await pairedDevices();
  const intake = await phone("POST", "/api/intake", { intake: seeded, consent: { shareWithClinic: true } });
  expect(intake.status === 201 && intake.body.status === "ready", `intake → ${intake.status} ${JSON.stringify(intake.body)}`);
  const id = intake.body.encounterId;

  const queue = await laptop("GET", "/api/encounters");
  expect(queue.body?.some((item) => item.id === id), "laptop queue does not list the phone's submission");
  const detail = await laptop("GET", `/api/encounters/${id}`);
  expect(detail.body?.sbar?.spokenScript, "encounter has no brief");

  const options = await laptop("POST", `/api/encounters/${id}/options`, { query: "Show the antiviral demo options and sample costs" });
  expect(options.body?.found && options.body.rows[0].generic === true, "options are not generic-first");
  expect(options.body.rows.every((row) => row.costMock && row.coverageMock && row.stockMock), "an option value lacks its mock flag");

  const attached = await laptop("POST", `/api/encounters/${id}/attach`, genericAtA);
  expect(attached.status === 200, `attach → ${attached.status} ${JSON.stringify(attached.body)}`);

  const polled = await phone("GET", `/api/encounters/${id}`);
  expect(polled.body?.status === "packet_available" && polled.body.packetId, "phone does not see packet_available");
  const packet = await phone("GET", `/api/packet/${polled.body.packetId}`);
  expect(packet.status === 200 && packet.body.status === "available_in_demo", "phone cannot open the packet");
  expect(packet.body.display.instructions.map((item) => item.language).join() === "es", "packet languages differ from the selection");
  return `brief source: ${detail.body.sbar.source}; packet ${packet.body.display.therapyName} at $${packet.body.mockPrice} (mock)`;
});

await check("2. Declined consent creates no queue entry", async () => {
  const { phone, laptop } = await pairedDevices();
  for (const consent of [{ shareWithClinic: false }, undefined]) {
    const declined = await phone("POST", "/api/intake", { intake: seeded, consent });
    expect(declined.status === 400 && declined.body?.error === "consent_required", `decline → ${declined.status}`);
  }
  const queue = await laptop("GET", "/api/encounters");
  expect(Array.isArray(queue.body) && queue.body.length === 0, `queue has ${queue.body?.length} entries after a decline`);
  return "400 consent_required; queue empty";
});

await check("3. Unknown red flag never yields a clean or routine result", async () => {
  const { phone, laptop } = await pairedDevices();
  const intake = await phone("POST", "/api/intake", {
    intake: { ...seeded, redFlags: { ...NO_FLAGS, dehydration: null } },
    consent: { shareWithClinic: true },
    status: "ready",
  });
  expect(intake.body?.status === "needs_review", `status is ${intake.body?.status}, expected needs_review`);
  const detail = await laptop("GET", `/api/encounters/${intake.body.encounterId}`);
  expect(detail.body.intake.redFlags.dehydration === null, "unknown was coerced");
  expect(!/no red flags/i.test(JSON.stringify(detail.body.sbar ?? {})), "brief claims no red flags");
  const attach = await laptop("POST", `/api/encounters/${intake.body.encounterId}/attach`, genericAtA);
  expect(attach.status === 409, `attach on needs_review → ${attach.status}, expected 409`);

  const emergency = await phone("POST", "/api/intake", { intake: { ...seeded, redFlags: { ...NO_FLAGS, breathing_chest_pain: true } }, consent: { shareWithClinic: true } });
  expect(emergency.body?.status === "emergency", "a positive flag did not take the emergency branch");
  const emergencyDetail = await laptop("GET", `/api/encounters/${emergency.body.encounterId}`);
  expect(emergencyDetail.body?.sbar?.assessment?.includes("Answered yes: Breathing difficulty or chest pain"), "emergency SBAR is missing the positive answer");
  expect(emergencyDetail.body?.sbar?.spokenScript?.includes("Breathing difficulty or chest pain"), "emergency audio is missing the positive answer");
  return "needs_review stored; attach refused (409); positive flag → emergency with SBAR and current audio";
});

await check("4. A changed symptom does not reuse the seeded brief or audio", async () => {
  const { phone, laptop } = await pairedDevices();
  const intake = await phone("POST", "/api/intake", { intake: { ...seeded, symptoms: ["sore throat"], maxTempF: 100.4 }, consent: { shareWithClinic: true } });
  const { sbar } = (await laptop("GET", `/api/encounters/${intake.body.encounterId}`)).body;
  expect(sbar.source !== "prepared_fixture", "changed input produced the prepared fixture");
  expect(sbar.spokenScript !== preparedScript, "changed input reused the prepared spoken script (the recording would play)");
  expect(JSON.stringify(sbar).includes("100.4"), "brief does not reflect the changed temperature");
  return `brief source: ${sbar.source}; script differs from the prepared recording's`;
});

await check("5. Category question stays locked; a named therapy unlocks only its own", async () => {
  const { phone, laptop } = await pairedDevices();
  const { encounterId: id } = (await phone("POST", "/api/intake", { intake: seeded, consent: { shareWithClinic: true } })).body;

  const category = await laptop("POST", `/api/encounters/${id}/resources`, { text: "Show the antiviral demo options and sample costs" });
  expect(category.body?.unlocked === false && !category.body.resources?.length, "a category question unlocked resources");
  const priceOnly = await laptop("POST", `/api/encounters/${id}/resources`, { text: `What does ${BRAND_NAME} cost?` });
  expect(priceOnly.body?.unlocked === false, "asking a therapy's price unlocked its resources");
  const locked = await laptop("POST", `/api/encounters/${id}/attach`, { ...genericAtA, therapyId: BRAND, mockPrice: 45, resourceIds: ["resource-demo-copay"] });
  expect(locked.status === 403, `attaching a locked resource → ${locked.status}, expected 403`);

  const named = await laptop("POST", `/api/encounters/${id}/resources`, { text: `Show manufacturer resources for ${BRAND_NAME}` });
  expect(named.body?.unlocked === true && named.body.therapyId === BRAND, "a named request did not unlock");
  expect(named.body.resources.every((resource) => resource.therapyId === BRAND && resource.mockLabel === "Manufacturer resource — fictional demo"), "wrong or unlabelled resources returned");
  const after = (await laptop("GET", `/api/encounters/${id}`)).body;
  expect(JSON.stringify(after.unlockedTherapyIds) === JSON.stringify([BRAND]), `unlockedTherapyIds is ${JSON.stringify(after.unlockedTherapyIds)}`);
  return `${named.body.resources.length} labelled resources for the brand only`;
});

await check("6. Repeat attach and reset: no duplicate packet, no leaked state", async () => {
  const { phone, laptop } = await pairedDevices();
  const { encounterId: id } = (await phone("POST", "/api/intake", { intake: seeded, consent: { shareWithClinic: true } })).body;
  const [a, b] = await Promise.all([laptop("POST", `/api/encounters/${id}/attach`, genericAtA), laptop("POST", `/api/encounters/${id}/attach`, genericAtA)]);
  const again = await laptop("POST", `/api/encounters/${id}/attach`, { ...genericAtA, pharmacyId: "pharmacy-demo-b", mockPrice: 18 });
  expect(a.body.packetId === b.body.packetId && again.body.packet.createdAt === a.body.packet.createdAt, "repeat attach created or changed a packet");

  const reset = await laptop("POST", "/api/demo-session/reset");
  expect(reset.status === 201, `reset → ${reset.status}`);
  const fresh = device(reset.body.token);
  expect((await fresh("GET", "/api/encounters")).body.length === 0, "new session queue is not empty");
  expect((await fresh("GET", `/api/encounters/${id}`)).status === 404, "old encounter visible in the new session");
  expect((await fresh("GET", `/api/packet/${a.body.packetId}`)).status === 404, "old packet visible in the new session");
  const stale = await phone("GET", "/api/encounters");
  expect(stale.status === 409 && stale.body.joinToken === reset.body.token, "old token was not pointed at the new session");
  return "one packet across three attaches; after reset: empty queue, old IDs 404, old token → 409 with join token";
});

await check("7. Generation failure continues through a labelled fallback", async () => {
  const { phone, laptop } = await pairedDevices();
  const typed = await phone("POST", "/api/intake", { intake: seeded, consent: { shareWithClinic: true } });
  const typedBrief = (await laptop("GET", `/api/encounters/${typed.body.encounterId}`)).body.sbar;
  expect(["generated", "deterministic"].includes(typedBrief.source), `typed seeded case got source ${typedBrief.source}`);

  const prepared = await phone("POST", "/api/intake", { usePreparedDemo: true, consent: { shareWithClinic: true } });
  const preparedEncounter = (await laptop("GET", `/api/encounters/${prepared.body.encounterId}`)).body;
  expect(preparedEncounter.sbar.source === "prepared_fixture" && preparedEncounter.sbar.spokenScript === preparedScript, "explicit prepared demo is not the fixture brief");
  expect(preparedEncounter.fieldSources.symptoms === "demo_fixture", "prepared case is not sourced as demo_fixture");
  const noConsent = await phone("POST", "/api/intake", { usePreparedDemo: true });
  expect(noConsent.status === 400, "prepared demo was accepted without consent");

  const extract = await phone("POST", "/api/extract", { text: seeded.transcript });
  expect(extract.status === 200 || (extract.status === 503 && extract.body?.error === "extraction_unavailable"), `extract → ${extract.status}`);
  return `typed brief: ${typedBrief.source}${typedBrief.source === "deterministic" ? " (model unavailable, labelled fallback used)" : ""}; extraction: ${extract.status === 200 ? "live" : "unavailable → manual entry"}; prepared demo only by explicit flag`;
});

console.log(`\nAcceptance run against ${base}\n`);
for (const result of results) {
  console.log(`${result.ok ? "PASS" : "FAIL"}  ${result.name}  (${(result.ms / 1000).toFixed(1)}s)\n      ${result.note}`);
}
const failed = results.filter((result) => !result.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed.`);
process.exit(failed === 0 ? 0 : 1);
