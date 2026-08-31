import {
  createTrip,
  getTrip,
  listTrips,
  updateTripStatus,
  getTripTrack,
  TripRow,
} from "../repositories/trip.repository";
import { CreateTripBody } from "../schemas/trip.schema";
import { AppError } from "../utils/AppError";

export async function startTrip(input: CreateTripBody): Promise<TripRow> {
  return createTrip(input);
}

export async function listAllTrips(limit?: number, offset?: number): Promise<TripRow[]> {
  return listTrips(limit, offset);
}

export async function getTripOrThrow(id: string): Promise<TripRow> {
  const trip = await getTrip(id);
  if (!trip) throw AppError.notFound(`Trip ${id} not found`);
  return trip;
}

export async function changeTripStatus(
  id: string,
  status: string
): Promise<TripRow> {
  const updated = await updateTripStatus(id, status);
  if (!updated) throw AppError.notFound(`Trip ${id} not found`);
  return updated;
}

/** Returns the trip plus its telemetry breadcrumb. */
export async function getTripWithTrack(id: string) {
  const trip = await getTripOrThrow(id);
  const track = await getTripTrack({
    id: trip.id,
    vehicle_id: trip.vehicle_id,
    started_at: trip.started_at,
    completed_at: trip.completed_at,
  });
  return { trip, track, points: track.length };
}
