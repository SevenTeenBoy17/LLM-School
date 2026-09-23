import { z } from "zod";

export const ArtifactBody = z.object({
  operationId: z.string().min(8).max(80), artifactId: z.string().min(8).max(100).optional(),
  expectedRevision: z.number().int().min(1).optional(), taskRunId: z.string().min(8).max(100).optional(),
  evidenceId: z.string().min(8).max(100).optional(),
  artifactType: z.enum(["explanation", "observation", "reflection", "expression", "project"]),
  title: z.string().trim().min(2).max(80), content: z.string().trim().min(4).max(2000),
  visibility: z.enum(["private", "class"]).default("private"),
  grantAllocations: z.array(z.object({ grantId: z.string().min(8).max(100), amount: z.number().int().min(1).max(100) }).strict()).max(8).default([]),
}).strict().refine((value) => Boolean(value.artifactId) === (value.expectedRevision !== undefined));
