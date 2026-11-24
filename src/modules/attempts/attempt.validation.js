import { z } from "zod";

export const answersSchema = z.object({
  answers: z.record(z.string().max(64), z.array(z.string().max(64)).max(20)),
  revision: z.number().int().min(0),
});
