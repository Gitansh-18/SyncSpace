import { z } from "zod";

export const aiActionSchema = z.enum(["summarize", "improve", "rewrite"]);

export const aiRequestSchema = z
  .object({
    action: aiActionSchema,
  })
  .strict();

export type AiAction = z.infer<typeof aiActionSchema>;
