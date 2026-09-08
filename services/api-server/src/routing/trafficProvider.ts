import { OperationalEntity, OperationalStateValue, TrafficLevel, SafetyCondition } from '../server';

export interface DynamicEdgeEvaluation {
  effectiveSpeedKmh: number;
  travelTimeMin: number;
  penaltyMultiplier: number;
  trafficLevel: TrafficLevel;
  safetyCondition: SafetyCondition;
  entityState?: OperationalStateValue;
  entityName?: string;
  isBlocked: boolean;
}

export interface ITrafficProvider {
  evaluateEdge(
    edgeId: string,
    roadName: string,
    distanceKm: number,
    baseSpeedKmh: number,
    entityId?: string
  ): DynamicEdgeEvaluation;
}

export class SimulatedTrafficProvider implements ITrafficProvider {
  private entitiesMap: Map<string, OperationalEntity>;

  constructor(entitiesMap: Map<string, OperationalEntity>) {
    this.entitiesMap = entitiesMap;
  }

  public evaluateEdge(
    edgeId: string,
    roadName: string,
    distanceKm: number,
    baseSpeedKmh: number,
    entityId?: string
  ): DynamicEdgeEvaluation {
    let stateMultiplier = 1.0;
    let trafficLevel: TrafficLevel = 'low';
    let safetyCondition: SafetyCondition = 'safe';
    let entityState: OperationalStateValue | undefined = undefined;
    let entityName: string | undefined = undefined;
    let isBlocked = false;

    if (entityId && this.entitiesMap.has(entityId)) {
      const entity = this.entitiesMap.get(entityId)!;
      entityState = entity.current_state;
      entityName = entity.name;

      switch (entity.current_state) {
        case 'BLOCKED':
          stateMultiplier = Infinity;
          isBlocked = true;
          trafficLevel = 'heavy';
          safetyCondition = 'dangerous';
          break;
        case 'DAMAGED':
          stateMultiplier = 3.5;
          trafficLevel = 'heavy';
          safetyCondition = 'dangerous';
          break;
        case 'CRITICAL':
        case 'OVERCROWDED':
          stateMultiplier = 2.5;
          trafficLevel = 'heavy';
          safetyCondition = 'cautious';
          break;
        case 'UNKNOWN':
          stateMultiplier = 1.5;
          trafficLevel = 'moderate';
          safetyCondition = 'cautious';
          break;
        default:
          if (entity.is_stale) {
            stateMultiplier = 1.25;
            trafficLevel = 'moderate';
            safetyCondition = 'cautious';
          }
          break;
      }
    }

    // Dynamic traffic heuristics based on edge characteristics
    if (!isBlocked && stateMultiplier < 2.0) {
      if (edgeId.includes('c05') || edgeId.includes('east')) {
        trafficLevel = 'moderate';
      } else if (edgeId.includes('bridge')) {
        trafficLevel = 'low';
      }
    }

    if (trafficLevel === 'moderate' && safetyCondition === 'safe') {
      safetyCondition = 'cautious';
    }

    const effectiveSpeed = isBlocked ? 0 : Math.max(5, baseSpeedKmh / stateMultiplier);
    const travelTimeMin = isBlocked
      ? Infinity
      : (distanceKm / effectiveSpeed) * 60;

    return {
      effectiveSpeedKmh: Math.round(effectiveSpeed * 10) / 10,
      travelTimeMin: Math.round(travelTimeMin * 10) / 10,
      penaltyMultiplier: Math.round(stateMultiplier * 100) / 100,
      trafficLevel,
      safetyCondition,
      entityState,
      entityName,
      isBlocked,
    };
  }
}
