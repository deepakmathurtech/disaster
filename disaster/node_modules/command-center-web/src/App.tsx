import React, { useState, useEffect } from 'react';
import './App.css';
import AreaIntelligenceMapWorkspace from './components/AreaIntelligenceMapWorkspace';
import GridWorkspace from './components/GridWorkspace';
import WindowManager from './components/WindowManager';
import { WindowId, WindowState, DEFAULT_WINDOWS } from './components/windowTypes';
import CommandAIWindow from './components/windows/CommandAIWindow';
import InspectorWindow from './components/windows/InspectorWindow';
import CommsWindow from './components/windows/CommsWindow';
import MediaWindow from './components/windows/MediaWindow';
import IncidentDetailWindow, { IncidentData } from './components/windows/IncidentDetailWindow';
import AlertFeedWindow from './components/windows/AlertFeedWindow';
import ResourceBoardWindow from './components/windows/ResourceBoardWindow';
import { SCRIPTED_TIMELINE, SimEvent } from './services/DisasterEngine';


/* ── Type Definitions ─────────────────────────────────────────────── */
export interface AreaIntelligence {
  area: {
    id: string;
    name: string;
    center: { lat: number; lng: number };
    boundary_polygon: Array<[number, number]>;
  };
  water_sources: Array<{
    id: string; name: string; type: string;
    location: { lat: number; lng: number };
    risk_radius_meters: number;
  }>;
  infrastructure: Array<{
    id: string; type: string; name: string;
    location: { lat: number; lng: number };
    status: string; last_verified: string; confidence: number;
  }>;
  incidents: Array<{
    id: string; name: string; severity: string;
    location: { lat: number; lng: number };
  }>;
  field_units: Array<{
    id: string; callsign: string;
    location: { lat: number; lng: number };
    status: string;
  }>;
}

export interface Entity {
  id: string;
  type: 'ROAD' | 'BRIDGE' | 'SHELTER' | 'HOSPITAL' | 'INCIDENT';
  name: string;
  current_state: string;
  location: { lat: number; lng: number; address?: string };
  last_observed_at: string;
  valid_until: string;
  confidence: number;
  last_source_id: string;
  is_stale: boolean;
  has_conflict: boolean;
  evidence_ids: string[];
}

export interface Conflict {
  conflict_id: string;
  entity_id: string;
  entity_name: string;
  conflicting_deltas: Array<{
    source_id: string; new_state: string;
    observed_at: string; confidence: number;
  }>;
  detected_at: string;
  status: 'UNRESOLVED' | 'RESOLVED';
}

export interface TaskRecord {
  task_id: string;
  title: string;
  description: string;
  entity_id: string;
  assigned_unit_id: string;
  priority: string;
  status: string;
  created_at: string;
}

/* ── Constants ────────────────────────────────────────────────────── */
const SERVER = 'http://localhost:4000';

const LAYER_META = [
  { key: 'infrastructure' as const, icon: '🏗', label: 'Infrastructure' },
  { key: 'water_sources'  as const, icon: '💧', label: 'Water Sources'  },
  { key: 'flood_exposure' as const, icon: '🌊', label: 'Flood Exposure'  },
  { key: 'incidents'      as const, icon: '🚨', label: 'Incidents'       },
  { key: 'field_units'    as const, icon: '📱', label: 'Field Units'     },
  { key: 'uncertainty'    as const, icon: '⚠',  label: 'Uncertainty'     },
] as const;

const DEMO_INCIDENTS: IncidentData[] = [
  { id: 'i1', sev: 'high',   icon: '🔥', name: 'Structure Fire — 4B',   sub: 'Unit-17 responding',   time: '4m'  },
  { id: 'i2', sev: 'medium', icon: '🌊', name: 'Flood Advisory — Zone C', sub: 'Monitoring active',    time: '12m' },
  { id: 'i3', sev: 'low',    icon: '🚧', name: 'Road Closure — NH 48',   sub: 'Diversion active',     time: '28m' },
];

/* ── Helpers ──────────────────────────────────────────────────────── */
function useClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

function fmtAge(iso: string): string {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60)   return `${Math.floor(s)}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${(s / 3600).toFixed(1)}h ago`;
}

/* ── Awareness Gauge (SVG radial) ────────────────────────────────── */
function AwarenessGauge({ fresh, stale, conflict }: { fresh: number; stale: number; conflict: number }) {
  const total = fresh + stale + conflict;
  const pct   = total ? Math.round((fresh / total) * 100) : 0;
  const r     = 22;
  const circ  = 2 * Math.PI * r;
  const dash  = (pct / 100) * circ;
  const color = pct > 70 ? '#10b981' : pct > 40 ? '#f59e0b' : '#ef4444';

  return (
    <div className="gauge-box">
      <svg width="56" height="56" viewBox="0 0 56 56">
        <circle cx="28" cy="28" r={r} fill="none" stroke="rgba(0,229,255,0.1)" strokeWidth="4.5" />
        <circle
          cx="28" cy="28" r={r} fill="none"
          stroke={color} strokeWidth="4.5"
          strokeDasharray={`${dash} ${circ - dash}`}
          strokeLinecap="round"
          transform="rotate(-90 28 28)"
        />
        <text x="28" y="25" textAnchor="middle" fill="#fff" fontSize="11" fontWeight="800" fontFamily="JetBrains Mono">{pct}%</text>
        <text x="28" y="36" textAnchor="middle" fill="rgba(0,229,255,0.55)" fontSize="6.5" fontWeight="700">AWARE</text>
      </svg>
      <div className="gauge-stats-grid">
        <div className="gs-row">
          <span className="gs-lbl">Verified</span>
          <span className="gs-val" style={{ color: '#10b981' }}>{fresh}</span>
        </div>
        <div className="gs-row">
          <span className="gs-lbl">Stale</span>
          <span className="gs-val" style={{ color: '#f59e0b' }}>{stale}</span>
        </div>
        <div className="gs-row">
          <span className="gs-lbl">Conflict</span>
          <span className="gs-val" style={{ color: '#ef4444' }}>{conflict}</span>
        </div>
      </div>
    </div>
  );
}

/* ── Main App Component ───────────────────────────────────────────── */
export default function App() {
  const now = useClock();

  const [selectedAreaId, setSelectedAreaId] = useState<'sector-4-demo' | 'delhi-demo'>('sector-4-demo');
  const [areaData,    setAreaData]    = useState<AreaIntelligence | null>(null);
  const [entities,    setEntities]    = useState<Entity[]>([]);
  const [conflicts,   setConflicts]   = useState<Conflict[]>([]);
  const [tasks,       setTasks]       = useState<TaskRecord[]>([]);
  const [selEntity,   setSelEntity]   = useState<Entity | null>(null);
  const [selIncident, setSelIncident] = useState<IncidentData | null>(null);
  const [activeTab,   setActiveTab]   = useState<'tactical' | 'uncertainty' | 'grid'>('tactical');
  const [apiOnline,   setApiOnline]   = useState(false);

  const [layers, setLayers] = useState({
    infrastructure: true,
    water_sources:  true,
    flood_exposure: true,
    incidents:      true,
    field_units:    true,
    uncertainty:    true,
  });

  // Windows State Management
  const [windows, setWindows] = useState<Record<WindowId, WindowState>>(DEFAULT_WINDOWS);
  const [topZIndex, setTopZIndex] = useState(2100);

  const [taskTitle,  setTaskTitle]  = useState('');
  const [taskEntity, setTaskEntity] = useState('');

  /* Data fetching */
  const loadArea = async (id: string) => {
    try {
      const r = await fetch(`/data/areas/${id}.json`);
      setAreaData(await r.json());
    } catch { /* dataset not found */ }
  };

  const fetchState = async () => {
    try {
      const [s, u, t] = await Promise.all([
        fetch(`${SERVER}/api/state`).then(r => r.json()),
        fetch(`${SERVER}/api/uncertainty`).then(r => r.json()),
        fetch(`${SERVER}/api/tasks`).then(r => r.json()),
      ]);
      setEntities(s.entities   || []);
      setConflicts(u.conflicts || []);
      setTasks(t.tasks         || []);
      setApiOnline(true);
    } catch { setApiOnline(false); }
  };

  /* Disaster Simulation State */
  const [simRunning, setSimRunning] = useState<boolean>(true);
  const [simSeconds, setSimSeconds] = useState<number>(0);
  const [activeEvents, setActiveEvents] = useState<SimEvent[]>([]);

  // Simulation Clock: 1 real second = 1 sim minute
  useEffect(() => {
    if (!simRunning) return;
    const interval = setInterval(() => {
      setSimSeconds(prev => {
        const next = prev + 1;
        const simMin = Math.floor(next);
        // Check if new scripted event should trigger
        const newEv = SCRIPTED_TIMELINE.find(e => e.simTimeMinutes === simMin);
        if (newEv) {
          setActiveEvents(existing => {
            if (existing.some(x => x.id === newEv.id)) return existing;
            return [newEv, ...existing];
          });
        }
        return next;
      });
    }, 2000); // 2s ticker
    return () => clearInterval(interval);
  }, [simRunning]);

  /* Idle Detection for Fullscreen Map Overview */
  const [isIdle, setIsIdle] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const resetIdle = () => {
      setIsIdle(false);
      clearTimeout(timer);
      timer = setTimeout(() => setIsIdle(true), 3500); // 3.5s idle threshold
    };

    window.addEventListener('mousemove', resetIdle);
    window.addEventListener('keydown', resetIdle);
    window.addEventListener('mousedown', resetIdle);
    window.addEventListener('touchstart', resetIdle);

    timer = setTimeout(() => setIsIdle(true), 3500);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('mousemove', resetIdle);
      window.removeEventListener('keydown', resetIdle);
      window.removeEventListener('mousedown', resetIdle);
      window.removeEventListener('touchstart', resetIdle);
    };
  }, []);

  // Request/Exit HTML5 Browser Fullscreen on idle toggle
  useEffect(() => {
    if (isIdle) {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    } else {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    }
  }, [isIdle]);


  useEffect(() => { loadArea(selectedAreaId); }, [selectedAreaId]);
  useEffect(() => {
    fetchState();
    const i = setInterval(fetchState, 3000);
    return () => clearInterval(i);
  }, []);



  /* Derived */
  const staleList = entities.filter(e => e.is_stale);
  const freshList = entities.filter(e => !e.is_stale && !e.has_conflict);

  /* Window helpers */
  const toggleWindow = (id: WindowId) => {
    setWindows(prev => {
      const target = prev[id];
      if (!target.isOpen) {
        return {
          ...prev,
          [id]: { ...target, isOpen: true, isMinimized: false, zIndex: topZIndex + 1 },
        };
      }
      if (target.isMinimized) {
        return {
          ...prev,
          [id]: { ...target, isMinimized: false, zIndex: topZIndex + 1 },
        };
      }
      return {
        ...prev,
        [id]: { ...target, isMinimized: true },
      };
    });
    setTopZIndex(z => z + 1);
  };

  const openWindow = (id: WindowId) => {
    setWindows(prev => ({
      ...prev,
      [id]: { ...prev[id], isOpen: true, isMinimized: false, zIndex: topZIndex + 1 },
    }));
    setTopZIndex(z => z + 1);
  };

  const closeWindow = (id: WindowId) => {
    setWindows(prev => ({
      ...prev,
      [id]: { ...prev[id], isOpen: false },
    }));
  };

  const focusWindow = (id: WindowId) => {
    setWindows(prev => ({
      ...prev,
      [id]: { ...prev[id], zIndex: topZIndex + 1 },
    }));
    setTopZIndex(z => z + 1);
  };

  const updateWindow = (updated: WindowState) => {
    setWindows(prev => ({ ...prev, [updated.id]: updated }));
  };

  /* Actions */
  const openInspector = (e: Entity) => {
    setSelEntity(e);
    openWindow('inspector');
  };

  const openIncident = (inc: IncidentData) => {
    setSelIncident(inc);
    openWindow('incident');
  };

  const handleDispatch = async (ev?: React.FormEvent, customTitle?: string, customEntity?: string) => {
    if (ev) ev.preventDefault();
    const title = customTitle || taskTitle;
    const entity_id = customEntity || taskEntity;
    if (!title) return;

    try {
      await fetch(`${SERVER}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, entity_id: entity_id || 'general', assigned_unit_id: 'unit-17', priority: 'HIGH' }),
      });
      setTaskTitle(''); setTaskEntity('');
      fetchState();
    } catch {
      // offline fallback local addition
      setTasks(prev => [
        {
          task_id: `task-${Date.now()}`,
          title,
          description: 'Local dispatch task',
          entity_id: entity_id || 'general',
          assigned_unit_id: 'Unit-17',
          priority: 'HIGH',
          status: 'OPEN',
          created_at: new Date().toISOString(),
        },
        ...prev,
      ]);
    }
  };

  const toggleLayer = (k: keyof typeof layers) =>
    setLayers(p => ({ ...p, [k]: !p[k] }));

  /* ────────────────────────────────────────────────────────────────── */
  return (
    <div className={`eoc-root ${isIdle ? 'is-idle' : ''}`}>


      {/* ══ HEADER ══════════════════════════════════════════════════ */}
      <header className="eoc-header">
        <div className="eoc-logo">
          <span className="eoc-logo-icon">🛰</span>
          <div className="eoc-logo-text">
            <div className="eoc-logo-title">DISASTER EOC</div>
            <div className="eoc-logo-sub">Tactical Command & AI Control</div>
          </div>
        </div>

        <div className="h-sep" />

        <div className="area-selector">
          <span className="area-selector-label">AREA</span>
          <select
            value={selectedAreaId}
            onChange={e => setSelectedAreaId(e.target.value as any)}
          >
            <option value="sector-4-demo">📍 Sector 4</option>
            <option value="delhi-demo">📍 Delhi NCR</option>
          </select>
        </div>

        <div className="h-sep" />

        <div className="eoc-telemetry">
          <div className="tel-cell">
            <span className="tel-lbl">System</span>
            <span className={`tel-val ${apiOnline ? 'c-online' : 'c-danger'}`}>
              {apiOnline ? 'ONLINE' : 'OFFLINE'}
            </span>
          </div>
          <div className="tel-cell">
            <span className="tel-lbl">Field Units</span>
            <span className="tel-val c-neutral">{areaData?.field_units.length ?? 0}</span>
          </div>
          <div className="tel-cell">
            <span className="tel-lbl">Entities</span>
            <span className="tel-val c-neutral">{entities.length}</span>
          </div>
          <div className="tel-cell">
            <span className="tel-lbl">Stale</span>
            <span className={`tel-val ${staleList.length > 0 ? 'c-warn' : 'c-online'}`}>
              {staleList.length}
            </span>
          </div>
          <div className="tel-cell">
            <span className="tel-lbl">Conflicts</span>
            <span className={`tel-val ${conflicts.length > 0 ? 'c-danger' : 'c-online'}`}>
              {conflicts.length}
            </span>
          </div>
        </div>

        <div className="h-sep" />

        <div className="eoc-clock">
          <div className="eoc-clock-time">
            {now.toLocaleTimeString('en-IN', { hour12: false })}
          </div>
          <div className="eoc-clock-date">
            {now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
          </div>
        </div>

        <div className="h-sep" />

        <button
          className="btn-sim-toggle"
          title="Toggle Fullscreen"
          onClick={() => {
            if (!document.fullscreenElement) {
              document.documentElement.requestFullscreen().catch(() => {});
            } else {
              document.exitFullscreen().catch(() => {});
            }
          }}
        >
          ⛶ FULLSCREEN
        </button>

        <div className="h-sep" />

        <div className="sim-control-bar">
          <button
            className={`btn-sim-toggle ${simRunning ? 'running' : ''}`}
            onClick={() => setSimRunning(!simRunning)}
          >
            {simRunning ? '⏸ PAUSE SIM' : '▶ START SIM'}
          </button>
          <span className="sim-badge">
            ⚡ SIM T+{(simSeconds * 2).toString().padStart(2, '0')}m
          </span>
        </div>


        <div className="h-sep" />

        <button
          className={`ai-trigger-btn ${windows.alertFeed.isOpen && !windows.alertFeed.isMinimized ? 'active' : ''}`}
          onClick={() => toggleWindow('alertFeed')}
        >
          🚨 ALERTS ({activeEvents.length})
        </button>

        <button
          className={`ai-trigger-btn ${windows.resourceBoard.isOpen && !windows.resourceBoard.isMinimized ? 'active' : ''}`}
          onClick={() => toggleWindow('resourceBoard')}
        >
          📋 RESOURCES
        </button>

        <button
          className={`ai-trigger-btn ${windows.commandAI.isOpen && !windows.commandAI.isMinimized ? 'active' : ''}`}
          onClick={() => toggleWindow('commandAI')}
        >
          <div className="ai-pulse" />
          🤖 CMD AI
        </button>
      </header>


      {/* ══ LEFT SIDEBAR ════════════════════════════════════════════ */}
      <aside className="eoc-left">
        <div className="ps">
          <div className="ps-hdr">Area Intelligence</div>
          <div className="ps-body">
            {(['sector-4-demo', 'delhi-demo'] as const).map(id => (
              <div
                key={id}
                className={`area-item ${selectedAreaId === id ? 'active' : ''}`}
                onClick={() => setSelectedAreaId(id)}
              >
                <div className="area-dot" />
                <div>
                  <div className="area-name">{id === 'sector-4-demo' ? 'Sector 4' : 'Delhi NCR'}</div>
                  <div className="area-sub">{id === 'sector-4-demo' ? 'Local demo dataset' : 'Regional dataset'}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="ps">
          <div className="ps-hdr">Situational Awareness</div>
          <div className="ps-body">
            <AwarenessGauge
              fresh={freshList.length}
              stale={staleList.length}
              conflict={conflicts.length}
            />
          </div>
        </div>

        <div className="ps ps-last">
          <div className="ps-hdr">Map Layers</div>
          <div className="ps-body-scroll">
            <div className="layer-list">
              {LAYER_META.map(({ key, icon, label }) => (
                <div key={key} className="layer-row" onClick={() => toggleLayer(key)}>
                  <span className="layer-ico">{icon}</span>
                  <span className="layer-lbl">{label}</span>
                  <div className={`toggle ${layers[key] ? 'on' : ''}`} />
                </div>
              ))}
            </div>

            {areaData && (
              <div style={{ marginTop: 16 }}>
                <div className="ps-hdr" style={{ padding: '0 0 6px' }}>Area Stats</div>
                <div className="stat-row">
                  <span className="stat-lbl">Infrastructure</span>
                  <span className="stat-val" style={{ color: 'var(--cyan-dim)' }}>{areaData.infrastructure.length}</span>
                </div>
                <div className="stat-row">
                  <span className="stat-lbl">Water Sources</span>
                  <span className="stat-val" style={{ color: 'var(--cyan-dim)' }}>{areaData.water_sources.length}</span>
                </div>
                <div className="stat-row" style={{ borderBottom: 'none' }}>
                  <span className="stat-lbl">Incidents</span>
                  <span className="stat-val" style={{ color: 'var(--red)' }}>{areaData.incidents.length}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* ══ CENTRAL MAP / GRID VIEW ═════════════════════════════════ */}
      <main className="eoc-map">
        {/* Map Tab bar */}
        <div className="map-tabs">
          {(['tactical', 'uncertainty', 'grid'] as const).map(tab => (
            <button
              key={tab}
              className={`map-tab-btn ${activeTab === tab ? 'active' : ''}`}
              onClick={() => {
                setActiveTab(tab);
                if (tab === 'grid') openWindow('grid');
              }}
            >
              {tab === 'tactical' ? '🗺 TACTICAL' : tab === 'uncertainty' ? '⚠ UNCERTAINTY' : '📊 GRID'}
            </button>
          ))}
          <div className="map-tab-spacer" />
          {areaData && (
            <div className="map-tab-coords">
              {areaData.area.center.lat.toFixed(4)}°N&nbsp;{areaData.area.center.lng.toFixed(4)}°E
            </div>
          )}
        </div>

        {/* HUD bracket corners */}
        <div className="hud-br hud-br-tl" />
        <div className="hud-br hud-br-tr" />
        <div className="hud-br hud-br-bl" />
        <div className="hud-br hud-br-br" />

        {/* System tag */}
        <div className="map-sys-tag">
          SYS:&nbsp;<span style={{ color: apiOnline ? 'var(--green)' : 'var(--red)' }}>{apiOnline ? 'ONLINE' : 'OFFLINE'}</span><br />
          AREA:&nbsp;{areaData?.area.name ?? '—'}<br />
          SYNC:&nbsp;{now.toLocaleTimeString('en-IN', { hour12: false })}
        </div>

        {/* Canvas or Grid Workspace */}
        {activeTab === 'grid' ? (
          <div className="map-canvas-area" style={{ background: '#060e1c' }}>
            <GridWorkspace
              entities={entities}
              onSelectEntity={openInspector}
              onRunAITriage={() => openWindow('commandAI')}
            />
          </div>
        ) : (
          <div className="map-canvas-area">
            <AreaIntelligenceMapWorkspace
              areaData={areaData}
              entities={entities}
              conflicts={conflicts}
              activeLayers={{
                ...layers,
                uncertainty: activeTab === 'uncertainty' || layers.uncertainty,
              }}
              onSelectEntity={openInspector}
            />
          </div>
        )}

        {/* Legend */}
        <div className="map-legend">
          <div className="leg-item"><div className="leg-dot" style={{ background: '#10b981' }} /> Operational</div>
          <div className="leg-pipe" />
          <div className="leg-item"><div className="leg-dot" style={{ background: '#ef4444' }} /> Blocked</div>
          <div className="leg-pipe" />
          <div className="leg-item"><div className="leg-ring" style={{ borderColor: '#f59e0b' }} /> Stale Zone</div>
          <div className="leg-pipe" />
          <div className="leg-item"><div className="leg-ring" style={{ borderColor: '#ef4444' }} /> Conflict</div>
          <div className="leg-pipe" />
          <div className="leg-item"><div className="leg-box" style={{ background: '#38bdf8' }} /> Flood Risk</div>
        </div>
      </main>

      {/* ══ RIGHT SIDEBAR ═══════════════════════════════════════════ */}
      <aside className="eoc-right">
        <div className="rp-scroll">

          {/* Uncertainty */}
          <div className="rps">
            <div className="rps-hdr">
              ⚠ Uncertainty Zones
              <span className={`rp-badge ${staleList.length > 0 ? 'rp-badge-warn' : 'rp-badge-cyan'}`}>
                {staleList.length + conflicts.length}
              </span>
            </div>
            <div className="rps-body">
              {staleList.length === 0 && conflicts.length === 0 ? (
                <div className="rp-empty">All entities verified ✓</div>
              ) : null}
              {staleList.map(e => (
                <div key={e.id} className="unc-card" onClick={() => openInspector(e)}>
                  <div className="unc-card-hdr">
                    <span className="unc-name">{e.name}</span>
                    <span className="unc-badge unc-badge-stale">STALE</span>
                  </div>
                  <div className="unc-kv">
                    <span className="unc-key">State</span>
                    <span className="unc-val">{e.current_state}</span>
                    <span className="unc-key">Confidence</span>
                    <span className="unc-val">{(e.confidence * 100).toFixed(0)}%</span>
                    <span className="unc-key">Age</span>
                    <span className="unc-val unc-val-warn">{fmtAge(e.last_observed_at)}</span>
                  </div>
                  <div className="unc-action">→ Click to inspect & dispatch</div>
                </div>
              ))}
              {conflicts.map(c => (
                <div key={c.conflict_id} className="unc-card conflict" onClick={() => openWindow('commandAI')}>
                  <div className="unc-card-hdr">
                    <span className="unc-name">{c.entity_name}</span>
                    <span className="unc-badge unc-badge-conflict">CONFLICT</span>
                  </div>
                  <div className="unc-kv">
                    <span className="unc-key">Reports</span>
                    <span className="unc-val unc-val-danger">{c.conflicting_deltas.length} conflicting</span>
                  </div>
                  <div className="unc-action">→ Run AI Conflict Triage</div>
                </div>
              ))}
            </div>
          </div>

          {/* Active incidents */}
          <div className="rps">
            <div className="rps-hdr">
              🚨 Active Incidents
              <span className="rp-badge rp-badge-danger">{DEMO_INCIDENTS.length}</span>
            </div>
            <div className="rps-body">
              {DEMO_INCIDENTS.map(inc => (
                <div key={inc.id} className={`inc-item inc-sev-${inc.sev}`} onClick={() => openIncident(inc)}>
                  <span className="inc-icon">{inc.icon}</span>
                  <div>
                    <div className="inc-name">{inc.name}</div>
                    <div className="inc-sub">{inc.sub}</div>
                  </div>
                  <span className="inc-time">{inc.time}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Task dispatch */}
          <div className="rps">
            <div className="rps-hdr">
              📋 Task Dispatch
              <span className="rp-badge rp-badge-cyan">{tasks.length}</span>
            </div>
            <div className="rps-body">
              <form onSubmit={e => handleDispatch(e)} className="task-form">
                <input
                  type="text"
                  value={taskTitle}
                  onChange={e => setTaskTitle(e.target.value)}
                  placeholder="Task title — e.g. Verify Bridge B12"
                />
                <div className="task-form-row">
                  <select value={taskEntity} onChange={e => setTaskEntity(e.target.value)}>
                    <option value="">Select entity target</option>
                    {entities.map(e => (
                      <option key={e.id} value={e.id}>{e.name}</option>
                    ))}
                  </select>
                  <button type="submit" className="btn-dispatch">SEND</button>
                </div>
              </form>

              {tasks.length === 0
                ? <div className="rp-empty">No tasks dispatched yet</div>
                : tasks.slice(0, 6).map(t => (
                    <div key={t.task_id} className="task-card">
                      <div className="task-title">{t.title}</div>
                      <div className="task-meta">
                        <span>→ <code>{t.entity_id}</code></span>
                        <span>{t.assigned_unit_id}</span>
                        <span className={t.status === 'OPEN' ? 'task-status-open' : 'task-status-pend'}>
                          {t.status}
                        </span>
                      </div>
                    </div>
                  ))
              }
            </div>
          </div>

        </div>
      </aside>

      {/* ══ BOTTOM DOCK BAR (DYNAMIC WINDOW CONTROLLER) ══════════════ */}
      <footer className="eoc-dock">
        {(['commandAI', 'inspector', 'comms', 'media', 'incident', 'grid'] as const).map(id => {
          const w = windows[id];
          const isActive = w.isOpen && !w.isMinimized;
          return (
            <button
              key={id}
              className={`dock-btn ${isActive ? 'active' : w.isOpen ? 'minimized' : ''}`}
              onClick={() => toggleWindow(id)}
            >
              {w.icon} {w.title.replace(/^(🤖|🔎|📡|📷|🚨|📊)\s*/, '')}
              {id === 'comms' && <span className="dock-badge">3</span>}
              {id === 'media' && <span className="dock-badge">LIVE</span>}
            </button>
          );
        })}

        <div className="dock-sep" />
        <button className="dock-btn" onClick={fetchState}>↺ Sync</button>

        <div className="sync-pill">
          <div className={`sync-dot ${apiOnline ? 'sync-ok' : 'sync-bad'}`} />
          <span className="sync-lbl">API</span>
          <span className={apiOnline ? 'sync-ok-text' : 'sync-bad-text'}>
            {apiOnline ? 'CONNECTED' : 'RETRYING'}
          </span>
        </div>
      </footer>

      {/* ══ FLOATING DRAGGABLE/RESIZABLE WINDOWS ═════════════════════ */}

      {/* 1. Command AI & Local LLM Window */}
      <WindowManager
        win={windows.commandAI}
        onUpdate={updateWindow}
        onClose={() => closeWindow('commandAI')}
        onFocus={() => focusWindow('commandAI')}
      >
        <CommandAIWindow
          areaName={areaData?.area.name || 'Sector 4'}
          verifiedCount={freshList.length}
          staleCount={staleList.length}
          conflictCount={conflicts.length}
          staleEntities={staleList.map(e => ({ name: e.name, current_state: e.current_state, ageStr: fmtAge(e.last_observed_at) }))}
          conflicts={conflicts.map(c => ({ entity_name: c.entity_name, count: c.conflicting_deltas.length }))}
          incidents={DEMO_INCIDENTS}
        />
      </WindowManager>

      {/* 1b. Live Alert Feed Window */}
      <WindowManager
        win={windows.alertFeed}
        onUpdate={updateWindow}
        onClose={() => closeWindow('alertFeed')}
        onFocus={() => focusWindow('alertFeed')}
      >
        <AlertFeedWindow
          events={activeEvents}
          onAskAIAboutAlert={(alert) => {
            openWindow('commandAI');
          }}
          onAcknowledge={(id) => {}}
        />
      </WindowManager>

      {/* 1c. Resource Allocation & Dispatch Window */}
      <WindowManager
        win={windows.resourceBoard}
        onUpdate={updateWindow}
        onClose={() => closeWindow('resourceBoard')}
        onFocus={() => focusWindow('resourceBoard')}
      >
        <ResourceBoardWindow
          onDispatchUnit={(unitId, taskTitle) => handleDispatch(undefined, taskTitle, unitId)}
        />
      </WindowManager>


      {/* 2. Entity Inspector Window */}
      <WindowManager
        win={windows.inspector}
        onUpdate={updateWindow}
        onClose={() => closeWindow('inspector')}
        onFocus={() => focusWindow('inspector')}
      >
        <InspectorWindow
          entity={selEntity}
          onDispatchTask={(title, entityId) => handleDispatch(undefined, title, entityId)}
          onAskAI={() => openWindow('commandAI')}
        />
      </WindowManager>

      {/* 3. Emergency Comms Window */}
      <WindowManager
        win={windows.comms}
        onUpdate={updateWindow}
        onClose={() => closeWindow('comms')}
        onFocus={() => focusWindow('comms')}
      >
        <CommsWindow events={activeEvents} />
      </WindowManager>

      {/* 4. Media & Drone Visuals Window */}
      <WindowManager
        win={windows.media}
        onUpdate={updateWindow}
        onClose={() => closeWindow('media')}
        onFocus={() => focusWindow('media')}
      >
        <MediaWindow />
      </WindowManager>

      {/* 5. Incident Tactical Command Window */}
      <WindowManager
        win={windows.incident}
        onUpdate={updateWindow}
        onClose={() => closeWindow('incident')}
        onFocus={() => focusWindow('incident')}
      >
        <IncidentDetailWindow
          incident={selIncident}
          onDispatch={(title, entityId) => handleDispatch(undefined, title, entityId)}
        />
      </WindowManager>

      {/* 6. Grid Asset Intelligence Window */}
      <WindowManager
        win={windows.grid}
        onUpdate={updateWindow}
        onClose={() => closeWindow('grid')}
        onFocus={() => focusWindow('grid')}
      >
        <GridWorkspace
          entities={entities}
          onSelectEntity={openInspector}
          onRunAITriage={() => openWindow('commandAI')}
        />
      </WindowManager>

    </div>
  );
}
