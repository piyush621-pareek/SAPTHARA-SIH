import { query } from "../config/db";

export interface UserRow {
  id: string;
  full_name: string;
  phone: string;
  role: string;
  home_state: string | null;
  password_hash: string | null;
}

export async function createUser(input: {
  fullName: string;
  phone: string;
  passwordHash: string;
  role: string;
  homeState: string | null;
}): Promise<UserRow> {
  const { rows } = await query<UserRow>(
    `INSERT INTO users (full_name, phone, password_hash, role, home_state)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, full_name, phone, role, home_state, password_hash`,
    [input.fullName, input.phone, input.passwordHash, input.role, input.homeState]
  );
  return rows[0];
}

export async function findUserByPhone(phone: string): Promise<UserRow | null> {
  const { rows } = await query<UserRow>(
    `SELECT id, full_name, phone, role, home_state, password_hash
       FROM users WHERE phone = $1`,
    [phone]
  );
  return rows[0] ?? null;
}

export async function findUserById(id: string): Promise<UserRow | null> {
  const { rows } = await query<UserRow>(
    `SELECT id, full_name, phone, role, home_state, password_hash
       FROM users WHERE id = $1`,
    [id]
  );
  return rows[0] ?? null;
}

export interface PublicUser {
  id: string;
  full_name: string;
  phone: string;
  role: string;
  home_state: string | null;
}

export async function listUsers(limit: number, offset: number): Promise<PublicUser[]> {
  const { rows } = await query<PublicUser>(
    `SELECT id, full_name, phone, role, home_state
       FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return rows;
}

export async function updateUser(
  id: string,
  patch: { role?: string; home_state?: string | null; full_name?: string }
): Promise<PublicUser | null> {
  const { rows } = await query<PublicUser>(
    `UPDATE users SET
        role       = COALESCE($2, role),
        home_state = COALESCE($3, home_state),
        full_name  = COALESCE($4, full_name),
        updated_at = now()
      WHERE id = $1
      RETURNING id, full_name, phone, role, home_state`,
    [id, patch.role ?? null, patch.home_state ?? null, patch.full_name ?? null]
  );
  return rows[0] ?? null;
}

export async function deleteUser(id: string): Promise<boolean> {
  const { rowCount } = await query(`DELETE FROM users WHERE id = $1`, [id]);
  return (rowCount ?? 0) > 0;
}
