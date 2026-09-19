import "server-only";
import { z } from "zod";

function blankToUndefined(value: unknown) {
  return typeof value === "string" && value.trim() === "" ? undefined : value;
}

const requiredString = z.string().trim().min(1);
const optionalString = z.preprocess(blankToUndefined, z.string().optional());

const envSchema = z.object({
  GOOGLE_GENERATIVE_AI_API_KEY: requiredString,
  GEMINI_MODEL: requiredString,
  AWS_REGION: requiredString,
  AWS_ACCESS_KEY_ID: requiredString,
  AWS_SECRET_ACCESS_KEY: requiredString,
  DDB_TABLE: requiredString,
  DEMO_SESSION_SECRET: requiredString,
  VOICE_MODE: z.preprocess(
    blankToUndefined,
    z.enum(["baseline", "live"]).default("baseline"),
  ),
  ELEVENLABS_API_KEY: optionalString,
  NEXT_PUBLIC_DOORWAY_AGENT_ID: optionalString,
  NEXT_PUBLIC_INTAKE_AGENT_ID: optionalString,
  // Rehearsal only: "1" makes every generation fail. Ignored on production deployments.
  DEMO_SIMULATE_AI_FAILURE: optionalString,
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
  // Report names only: Zod errors can contain the rejected input.
  const names = result.error.issues.map((issue) => issue.path.join("."));
  throw new Error(`Missing or invalid environment variables: ${names.join(", ")}`);
}

export const env = result.data;
