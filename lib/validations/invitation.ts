import { z } from "zod";

export const invitationTokenSchema = z
  .string()
  .trim()
  .min(1, "This invitation link is invalid.")
  .max(256, "This invitation link is invalid.");