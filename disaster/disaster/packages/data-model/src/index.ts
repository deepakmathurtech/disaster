import { OperationalStateDelta, OperationalEntity, FreshnessInfo } from '@disaster/protocol';

export * from '@disaster/protocol';

export function calculateFreshness(observedAtIso: string, validDurationMinutes: number = 60): FreshnessInfo {
  const observedTime = new Date(observedAtIso).getTime();
  const validUntilTime = observedTime + validDurationMinutes * 60 * 1000;
  const now = Date.now();

  return {
    last_observed_at: observedAtIso,
    valid_until: new Date(validUntilTime).toISOString(),
    is_stale: now > validUntilTime,
  };
}

export function detectConflict(
  existingEntity: OperationalEntity | undefined,
  newDelta: OperationalStateDelta
): boolean {
  if (!existingEntity) return false;
  if (existingEntity.current_state === newDelta.new_state) return false;
  
  // If state is different and existing observation is still fresh, it's a conflict
  const isExistingFresh = !calculateFreshness(existingEntity.last_observed_at, 60).is_stale;
  return isExistingFresh;
}
