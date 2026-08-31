import { Request, Response } from "express";
import { handleSmsEmergency } from "../services/emergency.service";
import { SmsEmergencyBody } from "../schemas/emergency.schema";

/** POST /api/v1/emergency/sms — 2G SMS distress webhook. */
export async function postSmsEmergency(req: Request, res: Response): Promise<void> {
  const result = await handleSmsEmergency(req.body as SmsEmergencyBody);
  res.status(201).json({ success: true, data: result });
}
