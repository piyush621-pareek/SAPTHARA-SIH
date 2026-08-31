-- Add 'congestion' to the hazard_type enum so traffic-congestion zones can be
-- geofenced and rerouted around like any other disruption (PS 26002 b).
ALTER TYPE hazard_type ADD VALUE IF NOT EXISTS 'congestion';
