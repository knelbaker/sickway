import { describe, expect, it } from "vitest";
import {
  API_ROUTE_CONTRACTS,
  sampleAttachRequest,
  sampleAttachResponse,
  sampleDemoSessionRequest,
  sampleDemoSessionResponse,
  sampleEncounterDetailRequest,
  sampleEncounterDetailResponse,
  sampleEncountersQueueRequest,
  sampleEncountersQueueResponse,
  sampleExtractOutsideScenarioResponse,
  sampleExtractRequest,
  sampleExtractResponse,
  sampleFollowUpRequest,
  sampleFollowUpResponse,
  sampleIntakeRequest,
  sampleIntakeResponse,
  sampleOptionsNotFoundResponse,
  sampleOptionsRequest,
  sampleOptionsResponse,
  samplePacketDetailRequest,
  samplePacketDetailResponse,
  sampleResourcesLockedResponse,
  sampleResourcesRequest,
  sampleResourcesResponse,
} from "../api-contracts";
import {
  RED_FLAG_DEFINITIONS,
  RED_FLAG_KEYS,
  RED_FLAG_LABELS,
  RedFlagKey,
} from "../red-flags";
import {
  answerSchema,
  auditEventSchema,
  demoSessionSchema,
  encounterSchema,
  followUpSchema,
  manufacturerResourceSchema,
  optionRowSchema,
  packetSchema,
  redFlagsSchema,
  reviewedIntakeSchema,
  type Encounter,
  type ReviewedIntake,
} from "../schemas";

describe("Red-flag checklist constants (§6.3)", () => {
  it("contains exactly the six required categories", () => {
    expect(RED_FLAG_KEYS).toEqual([
      "breathing_chest_pain",
      "confusion_fainting",
      "stiff_neck_rash",
      "high_temperature",
      "dehydration",
      "sudden_severe_headache",
    ]);
    expect(RED_FLAG_KEYS).toHaveLength(6);
  });

  it("provides human-readable labels and descriptions for all six keys", () => {
    for (const key of RED_FLAG_KEYS) {
      expect(RED_FLAG_LABELS[key]).toBeDefined();
      expect(typeof RED_FLAG_LABELS[key]).toBe("string");
      expect(RED_FLAG_LABELS[key].length).toBeGreaterThan(0);

      const def = RED_FLAG_DEFINITIONS.find((d) => d.key === key);
      expect(def).toBeDefined();
      expect(def?.label).toBe(RED_FLAG_LABELS[key]);
      expect(def?.description.length).toBeGreaterThan(0);
    }
  });
});

describe("Answer schema and missing-vs-negative semantics (§8)", () => {
  it("validates true, false, and null, but rejects undefined or coerced types", () => {
    expect(answerSchema.parse(true)).toBe(true);
    expect(answerSchema.parse(false)).toBe(false);
    expect(answerSchema.parse(null)).toBeNull();

    expect(answerSchema.safeParse(undefined).success).toBe(false);
    expect(answerSchema.safeParse("true").success).toBe(false);
    expect(answerSchema.safeParse(0).success).toBe(false);
    expect(answerSchema.safeParse({}).success).toBe(false);
  });

  it("preserves medsTaken: null when parsed and re-serialized without coercing to []", () => {
    const intakeInput: ReviewedIntake = {
      symptoms: ["fever", "cough"],
      onsetIso: "2026-09-18T08:00:00.000Z",
      onsetConfirmed: true,
      maxTempF: 101.5,
      medsTaken: null, // null = unanswered
      allergies: [], // [] = explicitly none
      redFlags: {
        breathing_chest_pain: false,
        confusion_fainting: false,
        stiff_neck_rash: false,
        high_temperature: false,
        dehydration: false,
        sudden_severe_headache: false,
      },
      deadlineToday: null,
      transcript: "Feeling sick since yesterday morning.",
    };

    const parsed = reviewedIntakeSchema.parse(intakeInput);
    expect(parsed.medsTaken).toBeNull();
    expect(parsed.medsTaken).not.toEqual([]);

    const reSerialized = JSON.parse(JSON.stringify(parsed));
    expect(reSerialized.medsTaken).toBeNull();
    expect(reSerialized.medsTaken).not.toEqual([]);
  });

  it("preserves medsTaken: [] when parsed and re-serialized without coercing to null", () => {
    const intakeInput: ReviewedIntake = {
      symptoms: ["fever"],
      onsetIso: null,
      onsetConfirmed: false,
      maxTempF: null,
      medsTaken: [], // explicitly none
      allergies: null, // unanswered
      redFlags: {
        breathing_chest_pain: false,
        confusion_fainting: false,
        stiff_neck_rash: false,
        high_temperature: false,
        dehydration: false,
        sudden_severe_headache: false,
      },
      deadlineToday: null,
      transcript: "Woke up feverish.",
    };

    const parsed = reviewedIntakeSchema.parse(intakeInput);
    expect(parsed.medsTaken).toEqual([]);
    expect(parsed.allergies).toBeNull();

    const reSerialized = JSON.parse(JSON.stringify(parsed));
    expect(reSerialized.medsTaken).toEqual([]);
    expect(reSerialized.allergies).toBeNull();
  });
});

describe("Red-flag checklist validation in intake schema", () => {
  const validBaseIntake = {
    symptoms: ["fever"],
    onsetIso: null,
    onsetConfirmed: false,
    maxTempF: null,
    medsTaken: null,
    allergies: null,
    deadlineToday: null,
    transcript: "Test transcript",
  };

  it("accepts an intake when every red-flag key is present as true, false, or null", () => {
    const intakeWithAllFlags = {
      ...validBaseIntake,
      redFlags: {
        breathing_chest_pain: true,
        confusion_fainting: false,
        stiff_neck_rash: null,
        high_temperature: false,
        dehydration: false,
        sudden_severe_headache: null,
      },
    };

    const result = reviewedIntakeSchema.safeParse(intakeWithAllFlags);
    expect(result.success).toBe(true);
  });

  it("fails validation and names the missing key when any red-flag key is omitted", () => {
    const allFlags: Record<RedFlagKey, boolean | null> = {
      breathing_chest_pain: false,
      confusion_fainting: false,
      stiff_neck_rash: false,
      high_temperature: false,
      dehydration: false,
      sudden_severe_headache: false,
    };

    for (const missingKey of RED_FLAG_KEYS) {
      const incompleteFlags = { ...allFlags };
      delete (incompleteFlags as Record<string, unknown>)[missingKey];

      const result = reviewedIntakeSchema.safeParse({
        ...validBaseIntake,
        redFlags: incompleteFlags,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const matchingIssue = result.error.issues.find(
          (issue) =>
            issue.path.includes(missingKey) ||
            issue.path.includes("redFlags") && issue.message.includes(missingKey)
        );
        expect(matchingIssue).toBeDefined();
        expect(matchingIssue?.path).toContain(missingKey);
      }
    }
  });

  it("rejects non-Answer values for red-flag keys", () => {
    const invalidFlags = {
      breathing_chest_pain: "yes", // string is invalid
      confusion_fainting: false,
      stiff_neck_rash: false,
      high_temperature: false,
      dehydration: false,
      sudden_severe_headache: false,
    };

    const result = redFlagsSchema.safeParse(invalidFlags);
    expect(result.success).toBe(false);
  });
});

describe("Encounter consent validation (§8)", () => {
  const baseEncounter: Encounter = {
    id: "enc-001",
    demoSessionId: "session-001",
    profileId: "demo-student-01",
    createdAt: "2026-09-19T08:00:00.000Z",
    status: "ready",
    intake: {
      symptoms: ["fever"],
      onsetIso: null,
      onsetConfirmed: false,
      maxTempF: null,
      medsTaken: null,
      allergies: null,
      redFlags: {
        breathing_chest_pain: false,
        confusion_fainting: false,
        stiff_neck_rash: false,
        high_temperature: false,
        dehydration: false,
        sudden_severe_headache: false,
      },
      deadlineToday: null,
      transcript: "Feeling warm.",
    },
    consent: {
      shareWithClinic: true,
      capturedAt: "2026-09-19T08:00:00.000Z",
    },
    fieldSources: {
      symptoms: "student_review",
    },
    unlockedTherapyIds: [],
  };

  it("validates successfully when consent.shareWithClinic is true", () => {
    const result = encounterSchema.safeParse(baseEncounter);
    expect(result.success).toBe(true);
  });

  it("fails validation when consent.shareWithClinic is false", () => {
    const invalidEncounter = {
      ...baseEncounter,
      consent: {
        shareWithClinic: false,
        capturedAt: "2026-09-19T08:00:00.000Z",
      },
    };

    const result = encounterSchema.safeParse(invalidEncounter);
    expect(result.success).toBe(false);
  });

  it("fails validation when consent or shareWithClinic is absent", () => {
    const encounterMissingFlag = {
      ...baseEncounter,
      consent: {
        capturedAt: "2026-09-19T08:00:00.000Z",
      },
    };
    expect(encounterSchema.safeParse(encounterMissingFlag).success).toBe(false);

    const encounterMissingConsent = {
      ...baseEncounter,
    };
    delete (encounterMissingConsent as Record<string, unknown>).consent;
    expect(encounterSchema.safeParse(encounterMissingConsent).success).toBe(false);
  });

  it("only accepts the synthetic profile ID demo-student-01", () => {
    const wrongProfile = {
      ...baseEncounter,
      profileId: "real-student-123",
    };
    expect(encounterSchema.safeParse(wrongProfile).success).toBe(false);
  });
});

describe("Entity schemas: Packet, DemoSession, AuditEvent, OptionRow, ManufacturerResource", () => {
  it("validates Packet schema", () => {
    const packet = {
      id: "pkt-01",
      demoSessionId: "session-01",
      encounterId: "enc-01",
      therapyId: "therapy-generic",
      pharmacyId: "pharmacy-campus",
      mockPrice: 20.0,
      resourceIds: ["res-01"],
      instructionLanguages: ["en", "es"],
      createdAt: "2026-09-19T08:15:00.000Z",
      status: "available_in_demo",
    };
    expect(packetSchema.safeParse(packet).success).toBe(true);

    // Negative price rejected
    expect(packetSchema.safeParse({ ...packet, mockPrice: -5 }).success).toBe(
      false
    );

    // Invalid status rejected
    expect(
      packetSchema.safeParse({ ...packet, status: "prescription_sent" }).success
    ).toBe(false);
  });

  it("validates DemoSession schema", () => {
    const session = {
      id: "session-01",
      profileId: "demo-student-01",
      fixtureClock: "2026-09-19T08:00:00.000Z",
      createdAt: "2026-09-19T08:00:00.000Z",
      ttl: 1790000000,
    };
    expect(demoSessionSchema.safeParse(session).success).toBe(true);

    // Non-demo profile rejected
    expect(
      demoSessionSchema.safeParse({ ...session, profileId: "other" }).success
    ).toBe(false);
  });

  it("validates AuditEvent schema", () => {
    const event = {
      id: "evt-01",
      demoSessionId: "session-01",
      encounterId: "enc-01",
      timestamp: "2026-09-19T08:10:00.000Z",
      action: "unlock_manufacturer_resources",
      therapyId: "therapy-brand",
      resourceIds: ["res-copay"],
      reason: "Explicit clinician button click for brand resources",
    };
    expect(auditEventSchema.safeParse(event).success).toBe(true);
  });

  it("validates OptionRow schema with mock metadata flags", () => {
    const row = {
      therapyId: "therapy-01",
      therapyName: "Generic Antiviral",
      generic: true,
      formularyTier: "Tier 1",
      coverageStatus: "Covered (mock)",
      coverageMock: true,
      estimatedCost: 15,
      costMock: true,
      exceedsCostCeiling: false,
      pharmacyId: "pharm-01",
      pharmacyName: "Campus Pharmacy",
      stockStatus: "In Stock (mock)",
      stockMock: true,
      hasManufacturerResources: false,
    };
    expect(optionRowSchema.safeParse(row).success).toBe(true);

    // Setting mock flag to false fails literal requirement
    expect(
      optionRowSchema.safeParse({ ...row, costMock: false }).success
    ).toBe(false);
  });

  it("validates ManufacturerResource schema", () => {
    const resource = {
      id: "res-01",
      therapyId: "therapy-brand",
      type: "copay_card",
      title: "Sample Copay Card",
      description: "Fictional copay card for demo",
      mockLabel: "Manufacturer resource — fictional demo",
    };
    expect(manufacturerResourceSchema.safeParse(resource).success).toBe(true);

    // Missing required fictional label rejected
    expect(
      manufacturerResourceSchema.safeParse({
        ...resource,
        mockLabel: "Official Manufacturer Copay",
      }).success
    ).toBe(false);
  });

  it("validates FollowUp schema", () => {
    const followUp = {
      simulated: true,
      filled: true,
      symptomStatus: "improving",
    };
    expect(followUpSchema.safeParse(followUp).success).toBe(true);

    // simulated must be true literal
    expect(
      followUpSchema.safeParse({ ...followUp, simulated: false }).success
    ).toBe(false);
  });
});

describe("API contracts for all §9 routes", () => {
  it("has exactly 10 routes defined in API_ROUTE_CONTRACTS", () => {
    expect(API_ROUTE_CONTRACTS).toHaveLength(10);
  });

  for (const contract of API_ROUTE_CONTRACTS) {
    it(`validates ${contract.method} ${contract.path} (${contract.name}) sample request and response`, () => {
      const parsedReq = contract.requestSchema.safeParse(contract.sampleRequest);
      expect(
        parsedReq.success,
        `Sample request failed for ${contract.name}: ${JSON.stringify(
          parsedReq.error?.issues
        )}`
      ).toBe(true);

      const parsedRes = contract.responseSchema.safeParse(
        contract.sampleResponse
      );
      expect(
        parsedRes.success,
        `Sample response failed for ${contract.name}: ${JSON.stringify(
          parsedRes.error?.issues
        )}`
      ).toBe(true);
    });
  }

  it("validates auxiliary sample responses (outside-scenario, not found, locked)", () => {
    const extractOutsideParsed =
      API_ROUTE_CONTRACTS.find((c) => c.name === "extract")?.responseSchema.safeParse(
        sampleExtractOutsideScenarioResponse
      );
    expect(extractOutsideParsed?.success).toBe(true);

    const optionsNotFoundParsed =
      API_ROUTE_CONTRACTS.find((c) => c.name === "encounter-options")?.responseSchema.safeParse(
        sampleOptionsNotFoundResponse
      );
    expect(optionsNotFoundParsed?.success).toBe(true);

    const resourcesLockedParsed =
      API_ROUTE_CONTRACTS.find(
        (c) => c.name === "encounter-resources"
      )?.responseSchema.safeParse(sampleResourcesLockedResponse);
    expect(resourcesLockedParsed?.success).toBe(true);
  });

  it("verifies individual exported sample payloads match their schemas", () => {
    expect(sampleDemoSessionRequest).toBeDefined();
    expect(sampleDemoSessionResponse).toBeDefined();
    expect(sampleExtractRequest).toBeDefined();
    expect(sampleExtractResponse).toBeDefined();
    expect(sampleIntakeRequest).toBeDefined();
    expect(sampleIntakeResponse).toBeDefined();
    expect(sampleEncountersQueueRequest).toBeDefined();
    expect(sampleEncountersQueueResponse).toBeDefined();
    expect(sampleEncounterDetailRequest).toBeDefined();
    expect(sampleEncounterDetailResponse).toBeDefined();
    expect(sampleOptionsRequest).toBeDefined();
    expect(sampleOptionsResponse).toBeDefined();
    expect(sampleResourcesRequest).toBeDefined();
    expect(sampleResourcesResponse).toBeDefined();
    expect(sampleAttachRequest).toBeDefined();
    expect(sampleAttachResponse).toBeDefined();
    expect(samplePacketDetailRequest).toBeDefined();
    expect(samplePacketDetailResponse).toBeDefined();
    expect(sampleFollowUpRequest).toBeDefined();
    expect(sampleFollowUpResponse).toBeDefined();
  });
});
