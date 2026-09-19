import { z } from "zod";
import profile from "../../data/demo-profile.json";
import plans from "../../data/plans.json";
import therapies from "../../data/therapies.json";
import pharmacies from "../../data/pharmacies.json";
import resources from "../../data/resources.json";
import instructionsEn from "../../data/instructions.en.json";
import instructionsEs from "../../data/instructions.es.json";
import brief from "../../data/demo-brief.json";
import {
  demoProfileIdSchema,
  instructionLanguageSchema,
  manufacturerResourceSchema,
  reviewedIntakeSchema,
  sbarSchema,
} from "@/lib/schemas";

const id = z.string().min(1);
const text = z.string().min(1);
const timestamp = z.iso.datetime({ offset: true });
const instructionSchema = z.strictObject({
  language: instructionLanguageSchema,
  mockLabel: text,
  therapies: z.record(id, z.strictObject({
    title: text,
    steps: z.array(text).min(1),
    disclaimer: text,
  })),
});

const fixtureSchema = z.strictObject({
  profile: z.strictObject({
    id: demoProfileIdSchema,
    name: z.literal("Alex Demo"),
    age: z.literal(20),
    synthetic: z.literal(true),
    fixtureVersion: text,
    planId: id,
    preferredPharmacyId: id,
    instructionLanguages: z.array(instructionLanguageSchema).length(2),
    costCeiling: z.number().nonnegative().optional(),
    costMock: z.literal(true),
    fixtureClock: timestamp,
    intake: reviewedIntakeSchema.extend({ onsetIso: timestamp }).strict(),
    seedNote: text,
  }),
  plans: z.array(z.strictObject({
    id,
    name: text,
    mockLabel: z.literal("Mock coverage — not verified"),
    formulary: z.array(z.strictObject({
      therapyId: id,
      formularyTier: text,
      coverageStatus: text,
      coverageMock: z.literal(true),
    })).min(1),
  })).length(1),
  therapies: z.array(z.strictObject({
    id,
    name: text,
    generic: z.boolean(),
    category: z.literal("antiviral"),
    manufacturer: text,
    resourceIds: z.array(id),
  })).length(2),
  pharmacies: z.array(z.strictObject({
    id,
    name: text,
    prices: z.array(z.strictObject({
      therapyId: id,
      planId: id,
      estimatedCost: z.number().nonnegative(),
      costMock: z.literal(true),
      stockStatus: text,
      stockMock: z.literal(true),
    })).min(1),
  })).length(2),
  resources: z.array(manufacturerResourceSchema.extend({
    type: z.enum(["copay_card", "educational"]),
  }).strict()).length(2),
  instructionsEn: instructionSchema.extend({ language: z.literal("en") }),
  instructionsEs: instructionSchema.extend({ language: z.literal("es") }),
  brief: z.strictObject({
    profileId: demoProfileIdSchema,
    fixtureVersion: text,
    sbar: sbarSchema.extend({ source: z.literal("prepared_fixture") }).strict(),
  }),
}).superRefine((data, ctx) => {
  const fail = (message: string) => ctx.addIssue({ code: "custom", message });
  const unique = (values: string[], label: string) => {
    if (new Set(values).size !== values.length) fail(`Duplicate ${label}`);
  };
  for (const catalog of ["plans", "therapies", "pharmacies", "resources"] as const) {
    unique(data[catalog].map((row) => row.id), `${catalog} ID`);
  }
  const therapyIds = new Set(data.therapies.map((row) => row.id));
  const planIds = new Set(data.plans.map((row) => row.id));
  if (!planIds.has(data.profile.planId)) fail("Missing profile plan ID");
  if (!data.pharmacies.some((row) => row.id === data.profile.preferredPharmacyId)) {
    fail("Missing profile pharmacy ID");
  }
  for (const plan of data.plans) {
    unique(plan.formulary.map((row) => row.therapyId), "formulary therapy ID");
    for (const row of plan.formulary) {
      if (!therapyIds.has(row.therapyId)) fail("Missing formulary therapy ID");
    }
    for (const therapyId of therapyIds) {
      if (!plan.formulary.some((row) => row.therapyId === therapyId)) {
        fail("Therapy missing from formulary");
      }
    }
  }
  for (const pharmacy of data.pharmacies) {
    unique(pharmacy.prices.map((row) => `${row.planId}/${row.therapyId}`), "pharmacy price");
    for (const row of pharmacy.prices) {
      if (!therapyIds.has(row.therapyId)) fail("Missing pharmacy price therapy ID");
      if (!planIds.has(row.planId)) fail("Missing pharmacy price plan ID");
    }
    for (const therapyId of therapyIds) {
      if (!pharmacy.prices.some((row) => row.therapyId === therapyId)) {
        fail("Therapy missing from pharmacy prices");
      }
    }
  }
  for (const therapy of data.therapies) {
    unique(therapy.resourceIds, "therapy resource ID");
    for (const resourceId of therapy.resourceIds) {
      if (!data.resources.some((row) => row.id === resourceId && row.therapyId === therapy.id)) {
        fail("Missing or mismatched therapy resource ID");
      }
    }
  }
  for (const resource of data.resources) {
    if (!data.therapies.some((row) => row.id === resource.therapyId && row.resourceIds.includes(resource.id))) {
      fail("Missing or mismatched resource therapy ID");
    }
  }
  for (const instructions of [data.instructionsEn, data.instructionsEs]) {
    const keys = Object.keys(instructions.therapies);
    if (keys.length !== therapyIds.size || keys.some((key) => !therapyIds.has(key))) {
      fail("Instruction keys must match every therapy ID in both languages");
    }
  }
  unique(data.profile.instructionLanguages, "instruction language");
  if (data.therapies.filter((row) => row.generic).length !== 1) fail("Expected one generic and one brand");
  unique(data.resources.map((row) => row.type), "resource type");
  if (Date.parse(data.profile.intake.onsetIso) > Date.parse(data.profile.fixtureClock)) {
    fail("Onset must not be later than the fixture clock");
  }
  if (data.brief.fixtureVersion !== data.profile.fixtureVersion) fail("Prepared brief fixture version mismatch");
  const wordCount = data.brief.sbar.spokenScript.trim().split(/\s+/).length;
  if (wordCount < 50 || wordCount > 65) fail("Prepared spoken script must contain 50–65 words");
});

export type Fixtures = z.infer<typeof fixtureSchema>;

/** Validate file shapes and joins together; throw before exposing a partial catalog. */
export function parseFixtures(input: unknown): Fixtures {
  return fixtureSchema.parse(input);
}

/** Static JSON imports work in Next.js bundles without runtime filesystem access. */
export const fixtures = parseFixtures({
  profile, plans, therapies, pharmacies, resources, instructionsEn, instructionsEs, brief,
});
