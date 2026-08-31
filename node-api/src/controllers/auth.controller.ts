import { Request, Response } from "express";
import { register, login, refresh, logout } from "../services/auth.service";
import { RegisterBody, LoginBody, RefreshBody } from "../schemas/auth.schema";

/** POST /api/v1/auth/register */
export async function postRegister(req: Request, res: Response): Promise<void> {
  const result = await register(req.body as RegisterBody);
  res.status(201).json({ success: true, data: result });
}

/** POST /api/v1/auth/login */
export async function postLogin(req: Request, res: Response): Promise<void> {
  const result = await login(req.body as LoginBody);
  res.json({ success: true, data: result });
}

/** POST /api/v1/auth/refresh — rotate a refresh token for a new token pair. */
export async function postRefresh(req: Request, res: Response): Promise<void> {
  const { refresh_token } = req.body as RefreshBody;
  const result = await refresh(refresh_token);
  res.json({ success: true, data: result });
}

/** POST /api/v1/auth/logout — revoke a refresh token. */
export async function postLogout(req: Request, res: Response): Promise<void> {
  const { refresh_token } = req.body as RefreshBody;
  await logout(refresh_token);
  res.json({ success: true });
}

/** GET /api/v1/auth/me — returns the authenticated user's token claims. */
export async function getMe(req: Request, res: Response): Promise<void> {
  res.json({ success: true, data: req.user });
}
