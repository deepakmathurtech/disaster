import React from 'react';
import { Entity } from '../../App';

interface InspectorWindowProps {
  entity: Entity | null;
  onDispatchTask: (title: string, entityId: string) => void;
  onAskAI: (query: string) => void;
}

export default function InspectorWindow({ entity, onDispatchTask, onAskAI }: InspectorWindowProps) {
  if (!entity) {
    return (
      <div className="fw-body-inner flex-center">
        <div className="rp-empty">Select an asset or map marker to view detailed telemetry</div>
      </div>
    );
  }

  const fmtAge = (iso: string) => {
    const s = (Date.now() - new Date(iso).getTime()) / 1000;
    if (s < 60) return `${Math.floor(s)}s ago`;
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    return `${(s / 3600).toFixed(1)}h ago`;
  };

  return (
    <div className="fw-body-inner flex-col">
      <div className="insp-entity-name">{entity.name}</div>
      <div className="insp-entity-meta">
        <code>{entity.id}</code> &middot; {entity.type} &middot; 📍 {entity.location.lat.toFixed(4)}°, {entity.location.lng.toFixed(4)}°
      </div>

      <div className="insp-kv-grid" style={{ margin: '12px 0' }}>
        <div className="insp-kv">
          <span className="insp-key">Status</span>
          <span className={`insp-val ${entity.current_state === 'OPERATIONAL' || entity.current_state === 'OPEN' ? 'insp-val-ok' : 'insp-val-bad'}`}>
            {entity.current_state}
          </span>
        </div>
        <div className="insp-kv">
          <span className="insp-key">Confidence</span>
          <span className="insp-val">{(entity.confidence * 100).toFixed(0)}%</span>
        </div>
        <div className="insp-kv">
          <span className="insp-key">Data Freshness</span>
          <span className={`insp-val ${entity.is_stale ? 'insp-val-warn' : 'insp-val-ok'}`}>
            {entity.is_stale ? '⚠ STALE DATA' : '✓ FRESH'}
          </span>
        </div>
        <div className="insp-kv">
          <span className="insp-key">Last Observation</span>
          <span className="insp-val">{fmtAge(entity.last_observed_at)}</span>
        </div>
        <div className="insp-kv">
          <span className="insp-key">Telemetry Source</span>
          <span className="insp-val"><code>{entity.last_source_id}</code></span>
        </div>
        <div className="insp-kv">
          <span className="insp-key">Conflict Status</span>
          <span className={`insp-val ${entity.has_conflict ? 'insp-val-bad' : 'insp-val-ok'}`}>
            {entity.has_conflict ? 'CONFLICT DETECTED' : 'NORMAL'}
          </span>
        </div>
      </div>

      <div className="insp-pills" style={{ marginBottom: 14 }}>
        <span className={`pill ${entity.current_state === 'OPERATIONAL' || entity.current_state === 'OPEN' ? 'pill-green' : 'pill-red'}`}>
          {entity.current_state}
        </span>
        {entity.is_stale && <span className="pill pill-amber">REVERIFICATION REQUIRED</span>}
        {entity.has_conflict && <span className="pill pill-red">CONFLICT RESOLUTION NEEDED</span>}
      </div>

      {/* AI & Dispatch Controls */}
      <div className="flex-col" style={{ gap: 6, marginTop: 'auto' }}>
        <button
          className="btn-ai-vision"
          onClick={() => onAskAI(`Analyze status and risks for ${entity.name}`)}
        >
          🤖 CONSULT AI ON THIS ASSET
        </button>
        <button
          className="btn-dispatch"
          onClick={() => onDispatchTask(`Physical Verification: ${entity.name}`, entity.id)}
        >
          🚀 DISPATCH REVERIFICATION TASK
        </button>
      </div>
    </div>
  );
}
