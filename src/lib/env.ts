import "server-only";
import { z } from "zod";

function blankToUndefined(value: unknown) {
  return typeof value === "string" && value.trim() === "" ? undefined : value;
}

const requiredString = z.string().trim().min(1);
const optionalString = z.preprocess(blankToUndefined, z.string().optional());

const envSchema = z.object({
  GOOGLE_GENERATIVE_AI_API_KEY: requiredString,
  GOOGLE_GENERATIVE_AI_API_KEY_FALLBACK: z.preprocess(blankToUndefined, requiredString.optional()),
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

type Env = z.infer<typeof envSchema>;
let validatedEnv: Env | undefined;

function getEnv(): Env {
  if (validatedEnv) return validatedEnv;
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    // Report names only: Zod errors can contain the rejected input.
    const names = result.error.issues.map((issue) => issue.path.join("."));
    throw new Error(`Missing or invalid environment variables: ${names.join(", ")}`);
  }

  validatedEnv = result.data;
  return validatedEnv;
}

// Next.js imports route modules during builds. Require credentials only when
// server code reads configuration, then reuse the validated runtime snapshot.
export const env = Object.defineProperties(
  {},
  Object.fromEntries(
    Object.keys(envSchema.shape).map((key) => [key, {
      enumerable: true,
      get: () => getEnv()[key as keyof Env],
    }]),
  ),
) as Env;
