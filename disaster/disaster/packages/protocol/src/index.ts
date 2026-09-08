export type EntityType = 'ROAD' | 'BRIDGE' | 'SHELTER' | 'HOSPITAL' | 'INCIDENT' | 'RESPONDER_UNIT';

export type OperationalStateValue = 
  | 'OPEN' 
  | 'BLOCKED' 
  | 'DAMAGED' 
  | 'SAFE' 
  | 'OPERATIONAL' 
  | 'OVERCROWDED' 
  | 'CRITICAL' 
  | 'ACTIVE' 
  | 'RESOLVED' 
  | 'UNKNOWN';

export interface LocationCoordinates {
  lat: number;
  lng: number;
  address?: string;
}

export interface EvidenceMetadata {
  id: string;
  type: 'PHOTO' | 'AUDIO' | 'GPS' | 'SENSOR' | 'TEXT_NOTE';
  url?: string;
  data_base64?: string;
  captured_at: string;
  captured_by: string;
  notes?: string;
}

export interface FreshnessInfo {
  last_observed_at: string;
  valid_until: string;
  is_stale: boolean;
}

export type SyncStatus = 'PENDING' | 'SYNCED' | 'FAILED' | 'CONFLICT';

export interface OperationalStateDelta {
  event_id: string;
  type: 'ROAD_STATUS_CHANGED' | 'BRIDGE_STATUS_CHANGED' | 'SHELTER_CAPACITY_CHANGED' | 'INCIDENT_REPORTED' | 'UNIT_LOCATION_UPDATED' | 'TASK_STATUS_UPDATED';
  entity_id: string;
  entity_type: EntityType;
  previous_state: OperationalStateValue;
  new_state: OperationalStateValue;
  location: LocationCoordinates;
  observed_at: string;
  source_id: string;
  confidence: number; // 0.0 to 1.0
  freshness: FreshnessInfo;
  evidence: EvidenceMetadata[];
  sync_status: SyncStatus;
  metadata?: Record<string, any>;
}

export interface OperationalEntity {
  id: string;
  type: EntityType;
  name: string;
  current_state: OperationalStateValue;
  location: LocationCoordinates;
  last_observed_at: string;
  valid_until: string;
  confidence: number;
  last_source_id: string;
  is_stale: boolean;
  has_conflict: boolean;
  evidence_ids: string[];
}

export interface ConflictRecord {
  conflict_id: string;
  entity_id: string;
  entity_name: string;
  conflicting_deltas: OperationalStateDelta[];
  detected_at: string;
  status: 'UNRESOLVED' | 'RESOLVED';
  resolved_state?: OperationalStateValue;
  resolution_notes?: string;
}

export interface TaskRecord {
  task_id: string;
  title: string;
  description: string;
  entity_id: string;
  assigned_unit_id: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  required_evidence_type?: string;
  created_at: string;
}

export interface SyncBatchRequest {
  device_id: string;
  timestamp: string;
  deltas: OperationalStateDelta[];
}

export interface SyncBatchResponse {
  success: boolean;
  acknowledged_event_ids: string[];
  rejected_event_ids: Array<{ event_id: string; reason: string }>;
  conflicts_detected: ConflictRecord[];
  server_timestamp: string;
}
