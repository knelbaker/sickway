import { z } from "zod";
import {
  demoProfileIdSchema,
  encounterSchema,
  encounterStatusSchema,
  instructionLanguageSchema,
  manufacturerResourceSchema,
  optionRowSchema,
  packetSchema,
  reviewedIntakeSchema,
} from "./schemas";

// ============================================================================
// 1. POST /api/demo-session — Create isolated synthetic session
// ============================================================================

export const demoSessionRequestSchema = z.object({}).default({});
export type DemoSessionRequest = z.infer<typeof demoSessionRequestSchema>;

export const demoSessionResponseSchema = z.object({
  sessionId: z.string().min(1),
  token: z.string().min(1),
  profileId: demoProfileIdSchema,
  fixtureClock: z.string(),
  createdAt: z.string(),
  ttl: z.number(),
});
export type DemoSessionResponse = z.infer<typeof demoSessionResponseSchema>;

export const sampleDemoSessionRequest: DemoSessionRequest = {};

export const sampleDemoSessionResponse: DemoSessionResponse = {
  sessionId: "demo-session-synthetic-01",
  token: "demo-session-synthetic-01.mockhmacsig",
  profileId: "demo-student-01",
  fixtureClock: "2026-09-19T08:00:00.000Z",
  createdAt: "2026-09-19T08:00:00.000Z",
  ttl: 1790000000,
};

// ============================================================================
// 2. POST /api/extract — Extract candidate intake fields for review
// ============================================================================

export const extractRequestSchema = z.object({
  text: z.string().min(1),
});
export type ExtractRequest = z.infer<typeof extractRequestSchema>;

export const candidateIntakeFieldsSchema = z.object({
  symptoms: z.array(z.string()),
  maxTempF: z.number().nullable(),
  onsetPhrase: z.string().nullable(),
  suggestedOnsetIso: z.string().nullable(),
  deadlineToday: z.string().nullable(),
  medsMentioned: z.array(z.string()),
});
export type CandidateIntakeFields = z.infer<typeof candidateIntakeFieldsSchema>;

export const extractSuccessResponseSchema = z.object({
  outsideScenario: z.literal(false),
  transcript: z.string(),
  candidateFields: candidateIntakeFieldsSchema,
});

export const extractOutsideScenarioResponseSchema = z.object({
  outsideScenario: z.literal(true),
  transcript: z.string(),
  message: z.string(),
  candidateFields: z.null().optional(),
});

export const extractResponseSchema = z.discriminatedUnion("outsideScenario", [
  extractSuccessResponseSchema,
  extractOutsideScenarioResponseSchema,
]);
export type ExtractResponse = z.infer<typeof extractResponseSchema>;

export const sampleExtractRequest: ExtractRequest = {
  text: "I woke up with a 102 fever, my whole body aches, it started yesterday morning, and I have an exam at 2.",
};

export const sampleExtractResponse: ExtractResponse = {
  outsideScenario: false,
  transcript:
    "I woke up with a 102 fever, my whole body aches, it started yesterday morning, and I have an exam at 2.",
  candidateFields: {
    symptoms: ["fever", "whole body aches"],
    maxTempF: 102,
    onsetPhrase: "yesterday morning",
    suggestedOnsetIso: "2026-09-18T08:00:00.000Z",
    deadlineToday: "2:00 PM exam",
    medsMentioned: [],
  },
};

export const sampleExtractOutsideScenarioResponse: ExtractResponse = {
  outsideScenario: true,
  transcript: "Where do I park my car for the game?",
  message: "Outside synthetic demo scenario.",
  candidateFields: null,
};

// ============================================================================
// 3. POST /api/intake — Validate reviewed fields & consent; persist encounter
// ============================================================================

export const intakeRequestSchema = z.object({
  intake: reviewedIntakeSchema,
  /** The student's preferred instruction languages, if they chose any (issue #61). */
  preferredInstructionLanguages: z
    .array(instructionLanguageSchema)
    .min(1)
    .refine((languages) => new Set(languages).size === languages.length, "Languages must be unique")
    .optional(),
  consent: z.object({
    shareWithClinic: z.literal(true),
  }),
});
export type IntakeRequest = z.infer<typeof intakeRequestSchema>;

export const intakeResponseSchema = z.object({
  encounterId: z.string().min(1),
  status: encounterStatusSchema,
});
export type IntakeResponse = z.infer<typeof intakeResponseSchema>;

export const sampleIntakeRequest: IntakeRequest = {
  intake: {
    symptoms: ["fever", "body aches"],
    onsetIso: "2026-09-18T08:00:00.000Z",
    onsetConfirmed: true,
    maxTempF: 102,
    medsTaken: null, // null = unanswered
    allergies: [], // [] = explicitly none reported
    redFlags: {
      breathing_chest_pain: false,
      confusion_fainting: false,
      stiff_neck_rash: false,
      high_temperature: false,
      dehydration: false,
      sudden_severe_headache: false,
    },
    deadlineToday: "14:00 exam",
    transcript:
      "I woke up with a 102 fever, my whole body aches, it started yesterday morning, and I have an exam at 2.",
  },
  consent: {
    shareWithClinic: true,
  },
};

export const sampleIntakeResponse: IntakeResponse = {
  encounterId: "enc-demo-001",
  status: "ready",
};

// ============================================================================
// 4. GET /api/encounters — Queue scoped to paired demo session
// ============================================================================

export const encountersQueueRequestSchema = z.object({}).default({});
export type EncountersQueueRequest = z.infer<
  typeof encountersQueueRequestSchema
>;

export const encounterQueueItemSchema = z.object({
  id: z.string().min(1),
  createdAt: z.string(),
  status: encounterStatusSchema,
  displayName: z.string().min(1),
  chiefSymptoms: z.array(z.string()),
});
export type EncounterQueueItem = z.infer<typeof encounterQueueItemSchema>;

export const encountersQueueResponseSchema = z.array(encounterQueueItemSchema);
export type EncountersQueueResponse = z.infer<
  typeof encountersQueueResponseSchema
>;

export const sampleEncountersQueueRequest: EncountersQueueRequest = {};

export const sampleEncountersQueueResponse: EncountersQueueResponse = [
  {
    id: "enc-demo-001",
    createdAt: "2026-09-19T08:05:00.000Z",
    status: "ready",
    displayName: "Alex Demo",
    chiefSymptoms: ["fever", "body aches"],
  },
];

// ============================================================================
// 5. GET /api/encounters/:id — Read current encounter after session check
// ============================================================================

export const encounterDetailRequestSchema = z.object({}).default({});
export type EncounterDetailRequest = z.infer<
  typeof encounterDetailRequestSchema
>;

export const encounterDetailResponseSchema = encounterSchema;
export type EncounterDetailResponse = z.infer<
  typeof encounterDetailResponseSchema
>;

export const sampleEncounterDetailRequest: EncounterDetailRequest = {};

export const sampleEncounterDetailResponse: EncounterDetailResponse = {
  id: "enc-demo-001",
  demoSessionId: "demo-session-synthetic-01",
  profileId: "demo-student-01",
  createdAt: "2026-09-19T08:05:00.000Z",
  status: "ready",
  intake: {
    symptoms: ["fever", "body aches"],
    onsetIso: "2026-09-18T08:00:00.000Z",
    onsetConfirmed: true,
    maxTempF: 102,
    medsTaken: null,
    allergies: [],
    redFlags: {
      breathing_chest_pain: false,
      confusion_fainting: false,
      stiff_neck_rash: false,
      high_temperature: false,
      dehydration: false,
      sudden_severe_headache: false,
    },
    deadlineToday: "14:00 exam",
    transcript:
      "I woke up with a 102 fever, my whole body aches, it started yesterday morning, and I have an exam at 2.",
  },
  consent: {
    shareWithClinic: true,
    capturedAt: "2026-09-19T08:05:00.000Z",
  },
  fieldSources: {
    symptoms: "student_review",
    onsetIso: "student_review",
    onsetConfirmed: "student_review",
    maxTempF: "student_review",
    medsTaken: "student_review",
    allergies: "student_review",
    redFlags: "student_review",
    deadlineToday: "student_review",
    name: "synthetic_profile",
    age: "synthetic_profile",
    plan: "synthetic_profile",
  },
  sbar: {
    situation:
      "Alex Demo, 20yo student presenting with 24h acute fever and body aches before a 2 PM exam.",
    background:
      "Synthetic student profile with fictional out-of-state PPO. No known drug allergies; medications taken not reported.",
    assessment:
      "Demo routine pathway: symptoms consistent with acute flu-like presentation within 48h onset; red flags negative.",
    recommendation:
      "Review demo antiviral options, formulary tier coverage, and fictional pharmacy access.",
    spokenScript:
      "Alex Demo is a 20-year-old student reporting fever and body aches starting yesterday morning, with a 2 PM exam today. No red flags reported. Fictional PPO coverage on file.",
    source: "prepared_fixture",
  },
  unlockedTherapyIds: [],
};

// ============================================================================
// 6. POST /api/encounters/:id/options — Labeled fixture options
// ============================================================================

export const optionsRequestSchema = z.object({
  query: z.string().min(1),
});
export type OptionsRequest = z.infer<typeof optionsRequestSchema>;

export const optionsFoundResponseSchema = z.object({
  found: z.literal(true),
  rows: z.array(optionRowSchema),
});

export const optionsNotFoundResponseSchema = z.object({
  found: z.literal(false),
  message: z.literal("No demo option found"),
  rows: z.array(optionRowSchema).optional(),
});

export const optionsResponseSchema = z.discriminatedUnion("found", [
  optionsFoundResponseSchema,
  optionsNotFoundResponseSchema,
]);
export type OptionsResponse = z.infer<typeof optionsResponseSchema>;

export const sampleOptionsRequest: OptionsRequest = {
  query: "Show antiviral demo options and sample costs",
};

export const sampleOptionsResponse: OptionsResponse = {
  found: true,
  rows: [
    {
      therapyId: "therapy-generic-oseltamivir",
      therapyName: "Fictional Generic Antiviral (Oseltamivir)",
      generic: true,
      formularyTier: "Tier 1 Generic",
      coverageStatus: "Covered (mock formulary)",
      coverageMock: true,
      estimatedCost: 15,
      costMock: true,
      exceedsCostCeiling: false,
      pharmacyId: "pharm-campus-01",
      pharmacyName: "Campus Health Pharmacy (Fictional)",
      stockStatus: "In Stock (mock)",
      stockMock: true,
      hasManufacturerResources: false,
    },
    {
      therapyId: "therapy-brand-demo",
      therapyName: "Brand Antiviral Demo (Fictional Brand)",
      generic: false,
      formularyTier: "Tier 3 Brand",
      coverageStatus: "Prior Auth Required (mock formulary)",
      coverageMock: true,
      estimatedCost: 145,
      costMock: true,
      exceedsCostCeiling: true,
      pharmacyId: "pharm-campus-01",
      pharmacyName: "Campus Health Pharmacy (Fictional)",
      stockStatus: "In Stock (mock)",
      stockMock: true,
      hasManufacturerResources: true,
      resourceMock: true,
    },
  ],
};

export const sampleOptionsNotFoundResponse: OptionsResponse = {
  found: false,
  message: "No demo option found",
};

// ============================================================================
// 7. POST /api/encounters/:id/resources — Validate therapy request & unlock
// ============================================================================

export const resourcesRequestSchema = z
  .object({
    therapyId: z.string().min(1).optional(),
    text: z.string().min(1).optional(),
  })
  .refine((data) => Boolean(data.therapyId || data.text), {
    message: "Either therapyId or text must be provided",
  });
export type ResourcesRequest = z.infer<typeof resourcesRequestSchema>;

export const resourcesUnlockedResponseSchema = z.object({
  unlocked: z.literal(true),
  therapyId: z.string().min(1),
  resources: z.array(manufacturerResourceSchema),
  auditEventId: z.string().optional(),
});

export const resourcesLockedResponseSchema = z.object({
  unlocked: z.literal(false),
  reason: z.string().min(1),
  resources: z.array(manufacturerResourceSchema).optional(),
});

export const resourcesResponseSchema = z.discriminatedUnion("unlocked", [
  resourcesUnlockedResponseSchema,
  resourcesLockedResponseSchema,
]);
export type ResourcesResponse = z.infer<typeof resourcesResponseSchema>;

export const sampleResourcesRequest: ResourcesRequest = {
  therapyId: "therapy-brand-demo",
};

export const sampleResourcesResponse: ResourcesResponse = {
  unlocked: true,
  therapyId: "therapy-brand-demo",
  resources: [
    {
      id: "res-copay-card-01",
      therapyId: "therapy-brand-demo",
      type: "copay_card",
      title: "Demo Fictional Brand Copay Assistance Card",
      description:
        "Sample manufacturer copay card mockup reducing eligible out-of-pocket costs.",
      mockLabel: "Manufacturer resource — fictional demo",
    },
    {
      id: "res-patient-guide-01",
      therapyId: "therapy-brand-demo",
      type: "educational",
      title: "Patient Dosing and Administration Guide (Demo)",
      description:
        "Sample manufacturer instructional sheet for synthetic demonstration.",
      mockLabel: "Manufacturer resource — fictional demo",
    },
  ],
  auditEventId: "evt-unlock-001",
};

export const sampleResourcesLockedResponse: ResourcesResponse = {
  unlocked: false,
  reason: "Ambiguous or non-specific therapy request. Resources remain locked.",
};

// ============================================================================
// 8. POST /api/encounters/:id/attach — Validate confirmation & persist packet
// ============================================================================

export const attachRequestSchema = z.object({
  confirmed: z.literal(true),
  therapyId: z.string().min(1),
  pharmacyId: z.string().min(1),
  mockPrice: z.number().nonnegative(),
  instructionLanguages: z.array(instructionLanguageSchema).min(1),
  resourceIds: z.array(z.string()).default([]),
});
export type AttachRequest = z.infer<typeof attachRequestSchema>;

export const attachResponseSchema = z.object({
  packetId: z.string().min(1),
  encounterId: z.string().min(1),
  status: z.literal("packet_available"),
  packet: packetSchema,
});
export type AttachResponse = z.infer<typeof attachResponseSchema>;

export const sampleAttachRequest: AttachRequest = {
  confirmed: true,
  therapyId: "therapy-generic-oseltamivir",
  pharmacyId: "pharm-campus-01",
  mockPrice: 15,
  instructionLanguages: ["en", "es"],
  resourceIds: [],
};

export const sampleAttachResponse: AttachResponse = {
  packetId: "pkt-enc-demo-001",
  encounterId: "enc-demo-001",
  status: "packet_available",
  packet: {
    id: "pkt-enc-demo-001",
    demoSessionId: "demo-session-synthetic-01",
    encounterId: "enc-demo-001",
    therapyId: "therapy-generic-oseltamivir",
    pharmacyId: "pharm-campus-01",
    mockPrice: 15,
    resourceIds: [],
    instructionLanguages: ["en", "es"],
    createdAt: "2026-09-19T08:10:00.000Z",
    status: "available_in_demo",
  },
};

// ============================================================================
// 9. GET /api/packet/:id — Read packet after session check
// ============================================================================

export const packetDetailRequestSchema = z.object({}).default({});
export type PacketDetailRequest = z.infer<typeof packetDetailRequestSchema>;

export const packetDetailResponseSchema = packetSchema;
export type PacketDetailResponse = z.infer<typeof packetDetailResponseSchema>;

export const samplePacketDetailRequest: PacketDetailRequest = {};

export const samplePacketDetailResponse: PacketDetailResponse = {
  id: "pkt-enc-demo-001",
  demoSessionId: "demo-session-synthetic-01",
  encounterId: "enc-demo-001",
  therapyId: "therapy-generic-oseltamivir",
  pharmacyId: "pharm-campus-01",
  mockPrice: 15,
  resourceIds: [],
  instructionLanguages: ["en", "es"],
  createdAt: "2026-09-19T08:10:00.000Z",
  status: "available_in_demo",
};

// ============================================================================
// 10. POST /api/encounters/:id/followup — Optional simulated self-report
// ============================================================================

export const followUpRequestSchema = z.object({
  simulated: z.literal(true),
  filled: z.boolean(),
  symptomStatus: z.string().min(1),
});
export type FollowUpRequest = z.infer<typeof followUpRequestSchema>;

export const followUpResponseSchema = z.object({
  encounterId: z.string().min(1),
  followUp: z.object({
    simulated: z.literal(true),
    filled: z.boolean(),
    symptomStatus: z.string().min(1),
  }),
});
export type FollowUpResponse = z.infer<typeof followUpResponseSchema>;

export const sampleFollowUpRequest: FollowUpRequest = {
  simulated: true,
  filled: true,
  symptomStatus: "improving",
};

export const sampleFollowUpResponse: FollowUpResponse = {
  encounterId: "enc-demo-001",
  followUp: {
    simulated: true,
    filled: true,
    symptomStatus: "improving",
  },
};

// ============================================================================
// Summary list of all 10 §9 API routes for tests and documentation
// ============================================================================

export interface RouteContractEntry<TReq = unknown, TRes = unknown> {
  name: string;
  method: "GET" | "POST";
  path: string;
  requestSchema: z.ZodType<TReq>;
  responseSchema: z.ZodType<TRes>;
  sampleRequest: TReq;
  sampleResponse: TRes;
}

export const API_ROUTE_CONTRACTS: readonly RouteContractEntry[] = [
  {
    name: "demo-session",
    method: "POST",
    path: "/api/demo-session",
    requestSchema: demoSessionRequestSchema,
    responseSchema: demoSessionResponseSchema,
    sampleRequest: sampleDemoSessionRequest,
    sampleResponse: sampleDemoSessionResponse,
  },
  {
    name: "extract",
    method: "POST",
    path: "/api/extract",
    requestSchema: extractRequestSchema,
    responseSchema: extractResponseSchema,
    sampleRequest: sampleExtractRequest,
    sampleResponse: sampleExtractResponse,
  },
  {
    name: "intake",
    method: "POST",
    path: "/api/intake",
    requestSchema: intakeRequestSchema,
    responseSchema: intakeResponseSchema,
    sampleRequest: sampleIntakeRequest,
    sampleResponse: sampleIntakeResponse,
  },
  {
    name: "encounters-queue",
    method: "GET",
    path: "/api/encounters",
    requestSchema: encountersQueueRequestSchema,
    responseSchema: encountersQueueResponseSchema,
    sampleRequest: sampleEncountersQueueRequest,
    sampleResponse: sampleEncountersQueueResponse,
  },
  {
    name: "encounter-detail",
    method: "GET",
    path: "/api/encounters/:id",
    requestSchema: encounterDetailRequestSchema,
    responseSchema: encounterDetailResponseSchema,
    sampleRequest: sampleEncounterDetailRequest,
    sampleResponse: sampleEncounterDetailResponse,
  },
  {
    name: "encounter-options",
    method: "POST",
    path: "/api/encounters/:id/options",
    requestSchema: optionsRequestSchema,
    responseSchema: optionsResponseSchema,
    sampleRequest: sampleOptionsRequest,
    sampleResponse: sampleOptionsResponse,
  },
  {
    name: "encounter-resources",
    method: "POST",
    path: "/api/encounters/:id/resources",
    requestSchema: resourcesRequestSchema,
    responseSchema: resourcesResponseSchema,
    sampleRequest: sampleResourcesRequest,
    sampleResponse: sampleResourcesResponse,
  },
  {
    name: "encounter-attach",
    method: "POST",
    path: "/api/encounters/:id/attach",
    requestSchema: attachRequestSchema,
    responseSchema: attachResponseSchema,
    sampleRequest: sampleAttachRequest,
    sampleResponse: sampleAttachResponse,
  },
  {
    name: "packet-detail",
    method: "GET",
    path: "/api/packet/:id",
    requestSchema: packetDetailRequestSchema,
    responseSchema: packetDetailResponseSchema,
    sampleRequest: samplePacketDetailRequest,
    sampleResponse: samplePacketDetailResponse,
  },
  {
    name: "encounter-followup",
    method: "POST",
    path: "/api/encounters/:id/followup",
    requestSchema: followUpRequestSchema,
    responseSchema: followUpResponseSchema,
    sampleRequest: sampleFollowUpRequest,
    sampleResponse: sampleFollowUpResponse,
  },
] as const;
