import { OperationalStateDelta, SyncBatchRequest, RouteSearchResponse, RoadNode } from '@disaster/protocol';

const API_BASE_URL = 'http://localhost:4000';
const LOCAL_STORAGE_KEY = 'user_side_emergency_queue_v1';
const CITIZEN_DEVICE_ID = 'citizen-device-' + Math.random().toString(36).substring(2, 9);

export interface ActiveSignal {
  id: string;
  type: 'SOS' | 'SUPPLY' | 'INCIDENT' | 'HELP';
  title: string;
  details: string;
  status: 'PENDING_SYNC' | 'TRANSMITTED' | 'DISPATCHED' | 'ACKNOWLEDGED';
  timestamp: string;
  location: { lat: number; lng: number; addressName?: string };
  payload: Record<string, any>;
}

// In-memory + localStorage signal tracker
let activeSignals: ActiveSignal[] = [];

try {
  const saved = localStorage.getItem('user_side_active_signals');
  if (saved) activeSignals = JSON.parse(saved);
} catch {
  activeSignals = [];
}

function saveSignals() {
  try {
    localStorage.setItem('user_side_active_signals', JSON.stringify(activeSignals));
  } catch { /* ignore */ }
}

export function getActiveSignals(): ActiveSignal[] {
  return activeSignals;
}

export function cancelSignal(id: string): ActiveSignal[] {
  activeSignals = activeSignals.filter(s => s.id !== id);
  saveSignals();
  return activeSignals;
}

// ─── API Connection & Sync Functions ──────────────────────────────────────────

export async function fetchServerState() {
  try {
    const res = await fetch(`${API_BASE_URL}/api/state`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) throw new Error('State fetch failed');
    return await res.json();
  } catch {
    return null;
  }
}

export async function fetchRouteNodes(areaId: string = 'sector-4-demo'): Promise<RoadNode[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/routes/nodes?area=${areaId}`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) throw new Error('Nodes fetch failed');
    const data = await res.json();
    return data.nodes || [];
  } catch {
    return [];
  }
}

export async function fetchSafeRoutes(
  areaId: string = 'sector-4-demo',
  fromId: string,
  toId: string
): Promise<RouteSearchResponse | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/routes?area=${areaId}&from=${fromId}&to=${toId}`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error('Routes fetch failed');
    return await res.json();
  } catch {
    return null;
  }
}

export async function transmitEmergencyDelta(delta: OperationalStateDelta, signalMeta: ActiveSignal): Promise<{ success: boolean; synced: boolean }> {
  // Store signal locally first
  activeSignals.unshift(signalMeta);
  saveSignals();

  const batch: SyncBatchRequest = {
    device_id: CITIZEN_DEVICE_ID,
    timestamp: new Date().toISOString(),
    deltas: [delta],
  };

  try {
    const res = await fetch(`${API_BASE_URL}/api/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(batch),
      signal: AbortSignal.timeout(4000),
    });

    if (res.ok) {
      // Mark as transmitted & acknowledged by EOC Command Center
      signalMeta.status = 'TRANSMITTED';
      saveSignals();
      return { success: true, synced: true };
    } else {
      signalMeta.status = 'PENDING_SYNC';
      saveSignals();
      return { success: true, synced: false };
    }
  } catch {
    // Save to local offline queue for sync retry
    queueOfflineDelta(delta);
    signalMeta.status = 'PENDING_SYNC';
    saveSignals();
    return { success: true, synced: false };
  }
}

function queueOfflineDelta(delta: OperationalStateDelta) {
  try {
    const currentQueue: OperationalStateDelta[] = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '[]');
    currentQueue.push(delta);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(currentQueue));
  } catch { /* ignore */ }
}

export async function attemptOfflineSync(): Promise<number> {
  let queue: OperationalStateDelta[] = [];
  try {
    queue = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '[]');
  } catch {
    return 0;
  }

  if (queue.length === 0) return 0;

  const batch: SyncBatchRequest = {
    device_id: CITIZEN_DEVICE_ID,
    timestamp: new Date().toISOString(),
    deltas: queue,
  };

  try {
    const res = await fetch(`${API_BASE_URL}/api/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(batch),
      signal: AbortSignal.timeout(5000),
    });

    if (res.ok) {
      const count = queue.length;
      localStorage.setItem(LOCAL_STORAGE_KEY, '[]');
      activeSignals.forEach(s => {
        if (s.status === 'PENDING_SYNC') s.status = 'TRANSMITTED';
      });
      saveSignals();
      return count;
    }
  } catch { /* offline */ }

  return 0;
}
