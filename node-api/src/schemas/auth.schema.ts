import { z } from "zod";

export const registerSchema = z.object({
  body: z.object({
    full_name: z.string().min(2),
    phone: z.string().min(8).max(20),
    password: z.string().min(6, "password must be at least 6 characters"),
    role: z
      .enum(["driver", "dispatcher", "admin", "responder"])
      .default("driver"),
    home_state: z.string().max(50).nullish(),
  }),
  query: z.object({}).passthrough().optional(),
  params: z.object({}).passthrough().optional(),
});

export const loginSchema = z.object({
  body: z.object({
    phone: z.string().min(8).max(20),
    password: z.string().min(1),
  }),
  query: z.object({}).passthrough().optional(),
  params: z.object({}).passthrough().optional(),
});

export const refreshSchema = z.object({
  body: z.object({ refresh_token: z.string().min(1) }),
  query: z.object({}).passthrough().optional(),
  params: z.object({}).passthrough().optional(),
});

export type RegisterBody = z.infer<typeof registerSchema>["body"];
export type LoginBody = z.infer<typeof loginSchema>["body"];
export type RefreshBody = z.infer<typeof refreshSchema>["body"];
