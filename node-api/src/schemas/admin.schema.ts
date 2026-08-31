import { z } from "zod";

export const updateUserSchema = z.object({
  body: z.object({
    role: z.enum(["driver", "dispatcher", "admin", "responder"]).optional(),
    home_state: z.string().max(50).nullish(),
    full_name: z.string().min(2).optional(),
  }),
  query: z.object({}).passthrough().optional(),
  params: z.object({ id: z.string().uuid() }),
});

export const createVehicleSchema = z.object({
  body: z.object({
    registration: z.string().min(3).max(32),
    model: z.string().max(120).nullish(),
    capacity_kg: z.number().min(0).max(100000).nullish(),
    owner_id: z.string().uuid().nullish(),
  }),
  query: z.object({}).passthrough().optional(),
  params: z.object({}).passthrough().optional(),
});

export const updateVehicleSchema = z.object({
  body: z.object({
    registration: z.string().min(3).max(32).optional(),
    model: z.string().max(120).optional(),
    capacity_kg: z.number().min(0).max(100000).optional(),
    status: z.enum(["active", "idle", "maintenance", "offline"]).optional(),
  }),
  query: z.object({}).passthrough().optional(),
  params: z.object({ id: z.string().uuid() }),
});

export const idParamSchema = z.object({
  body: z.object({}).passthrough().optional(),
  query: z.object({}).passthrough().optional(),
  params: z.object({ id: z.string().uuid() }),
});
