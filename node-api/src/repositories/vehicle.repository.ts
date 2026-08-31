import { query } from "../config/db";

export interface VehicleRow {
  id: string;
  registration: string;
  model: string | null;
  capacity_kg: number | null;
  status: string;
  owner_id: string | null;
}

export async function createVehicle(input: {
  registration: string;
  model: string | null;
  capacityKg: number | null;
  ownerId: string | null;
}): Promise<VehicleRow> {
  const { rows } = await query<VehicleRow>(
    `INSERT INTO vehicles (registration, model, capacity_kg, owner_id, status)
     VALUES ($1, $2, $3, $4, 'idle')
     RETURNING id, registration, model, capacity_kg, status, owner_id`,
    [input.registration, input.model, input.capacityKg, input.ownerId]
  );
  return rows[0];
}

export async function listVehicles(limit: number, offset: number): Promise<VehicleRow[]> {
  const { rows } = await query<VehicleRow>(
    `SELECT id, registration, model, capacity_kg, status, owner_id
       FROM vehicles ORDER BY registration ASC LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return rows;
}

export async function updateVehicle(
  id: string,
  patch: { registration?: string; model?: string; capacityKg?: number; status?: string }
): Promise<VehicleRow | null> {
  const { rows } = await query<VehicleRow>(
    `UPDATE vehicles SET
        registration = COALESCE($2, registration),
        model        = COALESCE($3, model),
        capacity_kg  = COALESCE($4, capacity_kg),
        status       = COALESCE($5::vehicle_status, status)
      WHERE id = $1
      RETURNING id, registration, model, capacity_kg, status, owner_id`,
    [id, patch.registration ?? null, patch.model ?? null, patch.capacityKg ?? null, patch.status ?? null]
  );
  return rows[0] ?? null;
}

export async function deleteVehicle(id: string): Promise<boolean> {
  const { rowCount } = await query(`DELETE FROM vehicles WHERE id = $1`, [id]);
  return (rowCount ?? 0) > 0;
}
