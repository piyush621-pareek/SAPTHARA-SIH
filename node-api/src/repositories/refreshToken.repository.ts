import { query } from "../config/db";

export interface RefreshTokenRow {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: string;
  revoked: boolean;
}

export async function storeRefreshToken(
  userId: string,
  tokenHash: string,
  expiresAt: Date
): Promise<void> {
  await query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, tokenHash, expiresAt.toISOString()]
  );
}

/** Returns a valid (not revoked, not expired) token row, or null. */
export async function findValidRefreshToken(
  tokenHash: string
): Promise<RefreshTokenRow | null> {
  const { rows } = await query<RefreshTokenRow>(
    `SELECT id, user_id, token_hash, expires_at, revoked
       FROM refresh_tokens
      WHERE token_hash = $1 AND revoked = FALSE AND expires_at > now()`,
    [tokenHash]
  );
  return rows[0] ?? null;
}

export async function revokeRefreshToken(tokenHash: string): Promise<void> {
  await query(`UPDATE refresh_tokens SET revoked = TRUE WHERE token_hash = $1`, [
    tokenHash,
  ]);
}

/** Revokes every refresh token for a user (e.g. "log out everywhere"). */
export async function revokeAllForUser(userId: string): Promise<void> {
  await query(`UPDATE refresh_tokens SET revoked = TRUE WHERE user_id = $1`, [
    userId,
  ]);
}
