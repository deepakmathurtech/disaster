import { describe, it, expect } from 'vitest';

export function calculateFreshness(observedAtIso: string, validDurationMinutes: number = 60) {
  const observedTime = new Date(observedAtIso).getTime();
  const validUntilTime = observedTime + validDurationMinutes * 60 * 1000;
  const now = Date.now();
  return {
    last_observed_at: observedAtIso,
    valid_until: new Date(validUntilTime).toISOString(),
    is_stale: now > validUntilTime,
  };
}

export function detectConflict(existingEntity: any, newDelta: any) {
  if (!existingEntity) return false;
  if (existingEntity.current_state === newDelta.new_state) return false;
  const isExistingFresh = !calculateFreshness(existingEntity.last_observed_at, 60).is_stale;
  return isExistingFresh;
}

describe('Operational Awareness Protocol & Data Model Tests', () => {
  it('should correctly calculate observation staleness based on validity window', () => {
    const freshTime = new Date().toISOString();
    const staleTime = new Date(Date.now() - 3600000 * 3).toISOString();

    const freshnessFresh = calculateFreshness(freshTime, 60);
    const freshnessStale = calculateFreshness(staleTime, 60);

    expect(freshnessFresh.is_stale).toBe(false);
    expect(freshnessStale.is_stale).toBe(true);
  });

  it('should detect conflicting operational state deltas from different units', () => {
    const existingEntity = {
      id: 'road-b12',
      type: 'ROAD',
      name: 'Bridge B12',
      current_state: 'OPEN',
      location: { lat: 12.9716, lng: 77.5946 },
      last_observed_at: new Date().toISOString(),
      valid_until: new Date(Date.now() + 3600000).toISOString(),
      confidence: 0.95,
      last_source_id: 'unit-01',
      is_stale: false,
      has_conflict: false,
      evidence_ids: []
    };

    const conflictingDelta = {
      event_id: 'evt-999',
      type: 'BRIDGE_STATUS_CHANGED',
      entity_id: 'road-b12',
      entity_type: 'BRIDGE',
      previous_state: 'OPEN',
      new_state: 'BLOCKED',
      location: { lat: 12.9716, lng: 77.5946 },
      observed_at: new Date().toISOString(),
      source_id: 'unit-17',
      confidence: 0.94,
      freshness: calculateFreshness(new Date().toISOString()),
      evidence: [],
      sync_status: 'PENDING'
    };

    const hasConflict = detectConflict(existingEntity, conflictingDelta);
    expect(hasConflict).toBe(true);
  });
});
