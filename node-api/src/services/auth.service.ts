import {
  createUser,
  findUserByPhone,
  findUserById,
  UserRow,
} from "../repositories/user.repository";
import {
  hashPassword,
  comparePassword,
  signAccessToken,
  newRefreshToken,
  hashRefreshToken,
} from "../utils/auth";
import {
  storeRefreshToken,
  findValidRefreshToken,
  revokeRefreshToken,
} from "../repositories/refreshToken.repository";
import { RegisterBody, LoginBody } from "../schemas/auth.schema";
import { env } from "../config/env";
import { AppError } from "../utils/AppError";

export interface AuthResult {
  token: string; // access token (short-lived)
  refreshToken: string; // long-lived, revocable
  user: {
    id: string;
    full_name: string;
    phone: string;
    role: string;
    home_state: string | null;
  };
}

function toPublic(u: UserRow): AuthResult["user"] {
  return {
    id: u.id,
    full_name: u.full_name,
    phone: u.phone,
    role: u.role,
    home_state: u.home_state,
  };
}

async function issue(u: UserRow): Promise<AuthResult> {
  const token = signAccessToken({ sub: u.id, role: u.role, phone: u.phone });
  const refreshToken = newRefreshToken();
  const expires = new Date(Date.now() + env.refreshExpiresDays * 86400_000);
  await storeRefreshToken(u.id, hashRefreshToken(refreshToken), expires);
  return { token, refreshToken, user: toPublic(u) };
}

export async function register(input: RegisterBody): Promise<AuthResult> {
  const existing = await findUserByPhone(input.phone);
  if (existing) {
    throw new AppError("An account with this phone already exists", 409);
  }
  const passwordHash = await hashPassword(input.password);
  const user = await createUser({
    fullName: input.full_name,
    phone: input.phone,
    passwordHash,
    role: input.role,
    homeState: input.home_state ?? null,
  });
  return issue(user);
}

/** Rotates a refresh token: validates, revokes the old, issues a fresh pair. */
export async function refresh(rawToken: string): Promise<AuthResult> {
  const hash = hashRefreshToken(rawToken);
  const row = await findValidRefreshToken(hash);
  if (!row) throw new AppError("Invalid or expired refresh token", 401);
  await revokeRefreshToken(hash); // rotation: single-use refresh tokens
  const user = await findUserById(row.user_id);
  if (!user) throw new AppError("User no longer exists", 401);
  return issue(user);
}

/** Revokes a refresh token (logout). Idempotent. */
export async function logout(rawToken: string): Promise<void> {
  await revokeRefreshToken(hashRefreshToken(rawToken));
}

export async function login(input: LoginBody): Promise<AuthResult> {
  const user = await findUserByPhone(input.phone);
  // Uniform failure so we don't leak whether the phone exists.
  if (!user || !user.password_hash) {
    throw new AppError("Invalid phone or password", 401);
  }
  const ok = await comparePassword(input.password, user.password_hash);
  if (!ok) {
    throw new AppError("Invalid phone or password", 401);
  }
  return issue(user);
}

