import express from 'express';
import cors from 'cors';

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
  confidence: number;
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
  const isExistingFresh = !calculateFreshness(existingEntity.last_observed_at, 60).is_stale;
  return isExistingFresh;
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

let entities: Map<string, OperationalEntity> = new Map();
let deltasHistory: OperationalStateDelta[] = [];
let conflicts: ConflictRecord[] = [];
let tasks: TaskRecord[] = [];
let auditLogs: Array<{ timestamp: string; action: string; details: any }> = [];

function seedInitialData() {
  const seedEntities: OperationalEntity[] = [
    {
      id: 'road-b12',
      type: 'ROAD',
      name: 'Bridge B12 (Main Access)',
      current_state: 'OPEN',
      location: { lat: 12.9716, lng: 77.5946, address: 'Sector 4 River Crossing' },
      last_observed_at: new Date(Date.now() - 3600000 * 2.5).toISOString(), // 2.5 hrs ago -> STALE
      valid_until: new Date(Date.now() - 3600000 * 0.5).toISOString(),
      confidence: 0.95,
      last_source_id: 'unit-12',
      is_stale: true,
      has_conflict: false,
      evidence_ids: ['ev-01']
    },
    {
      id: 'shelter-alpha',
      type: 'SHELTER',
      name: 'Central High Shelter',
      current_state: 'OPERATIONAL',
      location: { lat: 12.9785, lng: 77.5980, address: 'North Avenue' },
      last_observed_at: new Date().toISOString(),
      valid_until: new Date(Date.now() + 7200000).toISOString(),
      confidence: 0.98,
      last_source_id: 'unit-01',
      is_stale: false,
      has_conflict: false,
      evidence_ids: []
    },
    {
      id: 'road-c05',
      type: 'ROAD',
      name: 'Coastal Road C05',
      current_state: 'BLOCKED',
      location: { lat: 12.9650, lng: 77.5900, address: 'South Coast' },
      last_observed_at: new Date(Date.now() - 1800000).toISOString(),
      valid_until: new Date(Date.now() + 1800000).toISOString(),
      confidence: 0.90,
      last_source_id: 'unit-17',
      is_stale: false,
      has_conflict: false,
      evidence_ids: []
    }
  ];

  seedEntities.forEach(e => entities.set(e.id, e));

  tasks.push({
    task_id: 'task-101',
    title: 'Verify Bridge B12 Accessibility',
    description: 'Inspect Bridge B12 structural integrity and clear debris if needed.',
    entity_id: 'road-b12',
    assigned_unit_id: 'unit-17',
    priority: 'HIGH',
    status: 'IN_PROGRESS',
    required_evidence_type: 'PHOTO',
    created_at: new Date().toISOString()
  });
}

seedInitialData();

app.get('/api/state', (req, res) => {
  const entityList = Array.from(entities.values()).map(e => {
    const freshness = calculateFreshness(e.last_observed_at, 60);
    return { ...e, is_stale: freshness.is_stale };
  });

  res.json({
    entities: entityList,
    total: entityList.length,
    timestamp: new Date().toISOString()
  });
});

app.get('/api/uncertainty', (req, res) => {
  const allEntities = Array.from(entities.values());
  const stale = allEntities.filter(e => calculateFreshness(e.last_observed_at, 60).is_stale);
  const activeConflicts = conflicts.filter(c => c.status === 'UNRESOLVED');
  const unknownOrDamaged = allEntities.filter(e => e.current_state === 'DAMAGED' || e.current_state === 'UNKNOWN');

  res.json({
    stale_entities: stale,
    conflicts: activeConflicts,
    critical_uncertainty_zones: unknownOrDamaged,
    summary: {
      stale_count: stale.length,
      conflict_count: activeConflicts.length,
      unknown_count: unknownOrDamaged.length
    }
  });
});

app.get('/api/tasks', (req, res) => {
  res.json({ tasks });
});

app.post('/api/tasks', (req, res) => {
  const newTask: TaskRecord = {
    task_id: `task-${Date.now()}`,
    title: req.body.title || 'Operational Inspection',
    description: req.body.description || '',
    entity_id: req.body.entity_id,
    assigned_unit_id: req.body.assigned_unit_id || 'unit-17',
    priority: req.body.priority || 'MEDIUM',
    status: 'PENDING',
    required_evidence_type: req.body.required_evidence_type || 'PHOTO',
    created_at: new Date().toISOString()
  };
  tasks.unshift(newTask);
  res.json({ success: true, task: newTask });
});

app.post('/api/sync', (req, res) => {
  const body: SyncBatchRequest = req.body;
  const ackEventIds: string[] = [];
  const rejected: Array<{ event_id: string; reason: string }> = [];
  const newConflicts: ConflictRecord[] = [];

  if (!body.deltas || !Array.isArray(body.deltas)) {
    return res.status(400).json({ error: 'Invalid payload: deltas array expected' });
  }

  for (const delta of body.deltas) {
    if (deltasHistory.some(d => d.event_id === delta.event_id)) {
      ackEventIds.push(delta.event_id);
      continue;
    }

    const existing = entities.get(delta.entity_id);
    const conflictDetected = detectConflict(existing, delta);

    if (conflictDetected && existing) {
      const conflictRecord: ConflictRecord = {
        conflict_id: `conflict-${Date.now()}-${Math.floor(Math.random()*1000)}`,
        entity_id: delta.entity_id,
        entity_name: existing.name || delta.entity_id,
        conflicting_deltas: [
          {
            event_id: `historical-${existing.id}`,
            type: delta.type,
            entity_id: existing.id,
            entity_type: existing.type,
            previous_state: existing.current_state,
            new_state: existing.current_state,
            location: existing.location,
            observed_at: existing.last_observed_at,
            source_id: existing.last_source_id,
            confidence: existing.confidence,
            freshness: calculateFreshness(existing.last_observed_at, 60),
            evidence: [],
            sync_status: 'SYNCED'
          },
          delta
        ],
        detected_at: new Date().toISOString(),
        status: 'UNRESOLVED'
      };
      conflicts.unshift(conflictRecord);
      newConflicts.push(conflictRecord);

      existing.has_conflict = true;
    }

    const updatedEntity: OperationalEntity = {
      id: delta.entity_id,
      type: delta.entity_type || (existing ? existing.type : 'INCIDENT'),
      name: existing ? existing.name : `Entity ${delta.entity_id}`,
      current_state: delta.new_state,
      location: delta.location,
      last_observed_at: delta.observed_at,
      valid_until: delta.freshness.valid_until || new Date(Date.now() + 3600000).toISOString(),
      confidence: delta.confidence,
      last_source_id: delta.source_id,
      is_stale: false,
      has_conflict: conflictDetected,
      evidence_ids: [...(existing?.evidence_ids || []), ...(delta.evidence || []).map(e => e.id)]
    };

    entities.set(delta.entity_id, updatedEntity);
    deltasHistory.push({ ...delta, sync_status: 'SYNCED' });
    ackEventIds.push(delta.event_id);

    auditLogs.push({
      timestamp: new Date().toISOString(),
      action: 'STATE_DELTA_APPLIED',
      details: { delta_id: delta.event_id, entity_id: delta.entity_id, new_state: delta.new_state }
    });
  }

  const response: SyncBatchResponse = {
    success: true,
    acknowledged_event_ids: ackEventIds,
    rejected_event_ids: rejected,
    conflicts_detected: newConflicts,
    server_timestamp: new Date().toISOString()
  };

  res.json(response);
});

app.get('/api/audit', (req, res) => {
  res.json({ logs: auditLogs, deltas: deltasHistory });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`[API Server] Running on http://localhost:${PORT}`);
});
