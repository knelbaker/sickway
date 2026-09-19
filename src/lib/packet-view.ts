import { z } from "zod";
import { instructionLanguageSchema, manufacturerResourceSchema, packetSchema } from "@/lib/schemas";

/**
 * What `GET /api/packet/:id` returns: the stored packet (the §9 contract shape)
 * plus the display text the packet page needs. Browser-safe. The names, labels,
 * and instruction copy are resolved on the server from the fixtures, so the
 * catalogs and manufacturer resources never ship in a client bundle; a packet
 * only carries the resources the clinician unlocked and chose to include.
 */
export const packetViewSchema = packetSchema.extend({
  display: z.object({
    patientName: z.string(),
    therapyName: z.string(),
    generic: z.boolean(),
    pharmacyName: z.string(),
    planName: z.string(),
    coverageStatus: z.string(),
    coverageMockLabel: z.string(),
    stockStatus: z.string(),
    instructions: z.array(
      z.object({
        language: instructionLanguageSchema,
        mockLabel: z.string(),
        title: z.string(),
        steps: z.array(z.string()),
        disclaimer: z.string(),
      }),
    ),
    resources: z.array(manufacturerResourceSchema),
  }),
});
export type PacketView = z.infer<typeof packetViewSchema>;
