// Local AI Intent Parser — runs 100% offline
// Simulates a quantized function-calling local LLM
// The deterministic app layer retains authority; AI only extracts structured intent.

export type IntentType =
  | 'ROAD_STATUS_CHANGED'
  | 'BRIDGE_STATUS_CHANGED'
  | 'SHELTER_CAPACITY_CHANGED'
  | 'INCIDENT_REPORTED'
  | 'SEARCH_SHELTERS'
  | 'UNKNOWN';

export type StateValue =
  | 'OPEN' | 'BLOCKED' | 'DAMAGED' | 'SAFE'
  | 'OPERATIONAL' | 'CRITICAL' | 'UNKNOWN';

export type FieldEntityType = 'ROAD' | 'BRIDGE' | 'SHELTER' | 'HOSPITAL' | 'INCIDENT';

export type IntentResult = {
  intent: IntentType;
  entity_id: string;
  entity_type: FieldEntityType;
  new_state: StateValue;
  confidence: number;
  extracted_params: {
    location_description?: string;
    casualties?: number;
    raw_text: string;
  };
  followup_question?: string;
};

export function parseLocalIntent(text: string): IntentResult {
  const lower = text.toLowerCase();

  if (
    lower.includes('bridge') &&
    (lower.includes('damaged') || lower.includes('collapsed') || lower.includes('broken') || lower.includes('destroyed'))
  ) {
    const hasCasualties = lower.includes('stranded') || lower.includes('civilian') || lower.includes('trapped');
    const result: IntentResult = {
      intent: 'BRIDGE_STATUS_CHANGED',
      entity_id: 'road-b12',
      entity_type: 'BRIDGE',
      new_state: 'DAMAGED',
      confidence: 0.94,
      extracted_params: {
        location_description: 'Sector 4 River Crossing',
        raw_text: text,
      },
      followup_question: hasCasualties
        ? undefined
        : 'Are there stranded civilians or urgent medical requirements? Can you capture a photo as evidence?',
    };
    return result;
  }

  if (lower.includes('road') || lower.includes('route')) {
    const isBlocked = lower.includes('blocked') || lower.includes('closed') || lower.includes('impassable');
    const isClear = lower.includes('clear') || lower.includes('open') || lower.includes('passable');
    if (isBlocked || isClear) {
      const result: IntentResult = {
        intent: 'ROAD_STATUS_CHANGED',
        entity_id: 'road-c05',
        entity_type: 'ROAD',
        new_state: isBlocked ? 'BLOCKED' : 'OPEN',
        confidence: 0.91,
        extracted_params: { raw_text: text },
      };
      return result;
    }
  }

  if (lower.includes('shelter') && (lower.includes('full') || lower.includes('overcrowded') || lower.includes('capacity'))) {
    const result: IntentResult = {
      intent: 'SHELTER_CAPACITY_CHANGED',
      entity_id: 'shelter-alpha',
      entity_type: 'SHELTER',
      new_state: 'CRITICAL',
      confidence: 0.95,
      extracted_params: { raw_text: text },
      followup_question: 'How many civilians are currently at the shelter?',
    };
    return result;
  }

  const casualtyMatch = lower.match(/(\d+)\s*(civilian|people|person|stranded|injured)/);
  const fallback: IntentResult = {
    intent: 'INCIDENT_REPORTED',
    entity_id: 'inc-' + Date.now(),
    entity_type: 'INCIDENT',
    new_state: 'CRITICAL',
    confidence: 0.72,
    extracted_params: {
      raw_text: text,
      casualties: casualtyMatch ? parseInt(casualtyMatch[1]) : undefined,
    },
    followup_question: 'Could you specify the exact location or entity identifier (e.g. Bridge B12, Road C05)?',
  };
  return fallback;
}
