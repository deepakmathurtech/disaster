"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateFreshness = calculateFreshness;
exports.detectConflict = detectConflict;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
function calculateFreshness(observedAtIso, validDurationMinutes = 60) {
    const observedTime = new Date(observedAtIso).getTime();
    const validUntilTime = observedTime + validDurationMinutes * 60 * 1000;
    const now = Date.now();
    return {
        last_observed_at: observedAtIso,
        valid_until: new Date(validUntilTime).toISOString(),
        is_stale: now > validUntilTime,
    };
}
function detectConflict(existingEntity, newDelta) {
    if (!existingEntity)
        return false;
    if (existingEntity.current_state === newDelta.new_state)
        return false;
    const isExistingFresh = !calculateFreshness(existingEntity.last_observed_at, 60).is_stale;
    return isExistingFresh;
}
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json({ limit: '10mb' }));
let entities = new Map();
let deltasHistory = [];
let conflicts = [];
let tasks = [];
let auditLogs = [];
const acknowledgedAlerts = new Set();
function seedInitialData() {
    const seedEntities = [
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
app.get('/api/alerts', (req, res) => {
    const alerts = deltasHistory
        .filter(delta => delta.type === 'INCIDENT_REPORTED')
        .map(delta => ({
        id: delta.event_id,
        title: delta.metadata?.title || `Incident reported at ${delta.location.address || 'unknown location'}`,
        severity: delta.metadata?.severity || 'HIGH',
        category: delta.metadata?.sub_type || 'INCIDENT',
        description: delta.metadata?.details || 'Citizen incident report received.',
        suggestedAction: 'Review location and dispatch the nearest available unit.',
        affectedEntityId: delta.entity_id,
        observedAt: delta.observed_at,
        location: delta.location,
        acknowledged: acknowledgedAlerts.has(delta.event_id),
        sourceId: delta.source_id,
    }))
        .sort((a, b) => new Date(b.observedAt).getTime() - new Date(a.observedAt).getTime());
    res.json({ alerts });
});
app.post('/api/alerts/:id/acknowledge', (req, res) => {
    const alert = deltasHistory.find(delta => delta.event_id === req.params.id && delta.type === 'INCIDENT_REPORTED');
    if (!alert)
        return res.status(404).json({ error: 'Alert not found' });
    acknowledgedAlerts.add(alert.event_id);
    auditLogs.push({
        timestamp: new Date().toISOString(),
        action: 'ALERT_ACKNOWLEDGED',
        details: { event_id: alert.event_id, acknowledged_by: req.body?.acknowledged_by || 'command-center' },
    });
    res.json({ success: true, alert_id: alert.event_id });
});
app.get('/api/tasks', (req, res) => {
    res.json({ tasks });
});
app.post('/api/tasks', (req, res) => {
    const newTask = {
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
app.patch('/api/conflicts/:id', (req, res) => {
    const conflict = conflicts.find(item => item.conflict_id === req.params.id);
    if (!conflict)
        return res.status(404).json({ error: 'Conflict not found' });
    if (conflict.status === 'RESOLVED')
        return res.json({ success: true, conflict });
    const resolvedState = req.body?.resolved_state;
    if (!resolvedState)
        return res.status(400).json({ error: 'resolved_state is required' });
    const entity = entities.get(conflict.entity_id);
    if (entity) {
        entity.current_state = resolvedState;
        entity.has_conflict = false;
        entity.last_observed_at = new Date().toISOString();
        entity.is_stale = false;
    }
    conflict.status = 'RESOLVED';
    conflict.resolved_state = resolvedState;
    conflict.resolution_notes = req.body?.resolution_notes || '';
    auditLogs.push({
        timestamp: new Date().toISOString(),
        action: 'CONFLICT_RESOLVED',
        details: { conflict_id: conflict.conflict_id, entity_id: conflict.entity_id, resolved_state: resolvedState },
    });
    res.json({ success: true, conflict });
});
app.post('/api/sync', (req, res) => {
    const body = req.body;
    const ackEventIds = [];
    const rejected = [];
    const newConflicts = [];
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
            const conflictRecord = {
                conflict_id: `conflict-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
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
        const updatedEntity = {
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
    const response = {
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
/* ── Route Engine APIs ───────────────────────────────────────────────── */
const graphData_1 = require("./routing/graphData");
const trafficProvider_1 = require("./routing/trafficProvider");
const pathfinding_1 = require("./routing/pathfinding");
const aiRouteService_1 = require("./routing/aiRouteService");
app.get('/api/routes/nodes', (req, res) => {
    const areaId = req.query.area;
    const { nodes } = (0, graphData_1.getGraphForArea)(areaId);
    res.json({
        nodes,
        total: nodes.length,
    });
});
app.get('/api/routes', (req, res) => {
    const areaId = req.query.area;
    const { nodes, edges } = (0, graphData_1.getGraphForArea)(areaId);
    const nodesMap = new Map(nodes.map(n => [n.id, n]));
    const edgesMap = new Map(edges.map(e => [e.id, e]));
    const defaultFrom = nodes[0]?.id || 'node-south-entry';
    const defaultTo = nodes[3]?.id || 'node-shelter-alpha';
    const fromId = req.query.from || defaultFrom;
    const toId = req.query.to || defaultTo;
    const sourceNode = nodesMap.get(fromId) || nodes[0];
    const destNode = nodesMap.get(toId) || nodes[nodes.length - 1];
    if (!sourceNode || !destNode) {
        return res.status(400).json({ error: 'Invalid source or destination node ID' });
    }
    if (sourceNode.id === destNode.id) {
        const response = {
            sourceNode,
            destNode,
            routes: [],
            aiAnalysis: {
                overview: `Origin and Destination locations are identical (${sourceNode.name}). No route calculation required as dispatch target is already at the target location.`,
                insights: [],
                generatedAt: new Date().toISOString(),
            },
            totalRoutesFound: 0,
            calculatedAt: new Date().toISOString(),
        };
        return res.json(response);
    }
    // Evaluate dynamic weights based on current server entities state
    const trafficProvider = new trafficProvider_1.SimulatedTrafficProvider(entities);
    // Compute top 5 alternative routes via Yen's K-Shortest Path algorithm
    const paths = (0, pathfinding_1.runYensKShortestPaths)(nodesMap, edgesMap, sourceNode.id, destNode.id, trafficProvider, 5);
    const routes = (0, pathfinding_1.buildRouteDetails)(paths, nodesMap, edgesMap, trafficProvider);
    // Generate AI Route Analysis
    const aiAnalysis = (0, aiRouteService_1.generateAIRouteAnalysis)(routes, sourceNode.name, destNode.name);
    const response = {
        sourceNode,
        destNode,
        routes,
        aiAnalysis,
        totalRoutesFound: routes.length,
        calculatedAt: new Date().toISOString(),
    };
    res.json(response);
});
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log(`[API Server] Running on http://localhost:${PORT}`);
});
