import { describe, expect, it } from "vitest";
import { draftReducer, emptyDraft } from "@/components/student/use-intake-draft";
import { sampleExtractResponse } from "@/lib/api-contracts";
import { RED_FLAG_KEYS } from "@/lib/red-flags";

const fields = sampleExtractResponse.outsideScenario ? null : sampleExtractResponse.candidateFields;

describe("intake draft", () => {
  it("starts with every checklist item unknown and both lists unanswered", () => {
    const draft = emptyDraft();

    expect(RED_FLAG_KEYS.map((key) => draft.redFlags[key])).toEqual(RED_FLAG_KEYS.map(() => null));
    expect(draft.medsTaken).toBeNull();
    expect(draft.allergies).toBeNull();
    expect(draft.onsetConfirmed).toBe(false);
  });

  it("takes candidate fields but leaves the suggested onset unconfirmed", () => {
    const draft = draftReducer(emptyDraft(), { type: "extracted", transcript: "t", fields });

    expect(draft).toMatchObject({
      transcript: "t",
      extracted: true,
      symptoms: ["fever", "whole body aches"],
      maxTempF: 102,
      onsetPhrase: "yesterday morning",
      onsetIso: "2026-09-18T08:00:00.000Z",
      onsetConfirmed: false,
      medsTaken: null,
      allergies: null,
    });
  });

  it("keeps the transcript and invents nothing when extraction was unavailable", () => {
    const draft = draftReducer(emptyDraft(), { type: "extracted", transcript: "I feel awful", fields: null });

    expect(draft).toEqual({ ...emptyDraft(), transcript: "I feel awful", extracted: false });
  });

  it("records each checklist answer, keeping Not sure as unknown rather than false", () => {
    let draft = draftReducer(emptyDraft(), { type: "redFlag", key: "dehydration", answer: false });
    draft = draftReducer(draft, { type: "redFlag", key: "confusion_fainting", answer: null });
    draft = draftReducer(draft, { type: "redFlag", key: "breathing_chest_pain", answer: true });

    expect(draft.redFlags).toMatchObject({
      dehydration: false,
      confusion_fainting: null,
      breathing_chest_pain: true,
      stiff_neck_rash: null,
    });
  });

  it("keeps explicitly none distinct from unanswered", () => {
    let draft = draftReducer(emptyDraft(), { type: "set", field: "medsTaken", value: [] });
    draft = draftReducer(draft, { type: "set", field: "allergies", value: null });

    expect(draft.medsTaken).toEqual([]);
    expect(draft.allergies).toBeNull();
  });

  it("a new description discards the previous answers", () => {
    let draft = draftReducer(emptyDraft(), { type: "redFlag", key: "dehydration", answer: true });
    draft = draftReducer(draft, { type: "extracted", transcript: "again", fields });

    expect(draft.redFlags.dehydration).toBeNull();
  });
});
