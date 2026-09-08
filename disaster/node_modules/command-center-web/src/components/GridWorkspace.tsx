import React, { useState } from 'react';
import { Entity } from '../App';

interface GridWorkspaceProps {
  entities: Entity[];
  onSelectEntity: (e: Entity) => void;
  onRunAITriage?: () => void;
}

export default function GridWorkspace({ entities, onSelectEntity, onRunAITriage }: GridWorkspaceProps) {
  const [filter, setFilter] = useState<'ALL' | 'VERIFIED' | 'STALE' | 'CONFLICT' | 'BRIDGE' | 'ROAD' | 'SHELTER'>('ALL');
  const [search, setSearch] = useState('');

  const filtered = entities.filter(e => {
    if (filter === 'VERIFIED' && (e.is_stale || e.has_conflict)) return false;
    if (filter === 'STALE' && !e.is_stale) return false;
    if (filter === 'CONFLICT' && !e.has_conflict) return false;
    if (filter === 'BRIDGE' && e.type !== 'BRIDGE') return false;
    if (filter === 'ROAD' && e.type !== 'ROAD') return false;
    if (filter === 'SHELTER' && e.type !== 'SHELTER') return false;

    if (search) {
      const q = search.toLowerCase();
      return e.name.toLowerCase().includes(q) || e.id.toLowerCase().includes(q) || e.current_state.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="grid-workspace-container">
      {/* Top Filter Bar */}
      <div className="grid-filter-bar">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Filter entities by name, ID or status..."
          className="grid-search-input"
        />
        <div className="grid-filter-chips">
          {(['ALL', 'VERIFIED', 'STALE', 'CONFLICT', 'BRIDGE', 'ROAD', 'SHELTER'] as const).map(f => (
            <button
              key={f}
              className={`chip ${filter === f ? 'active' : ''}`}
              onClick={() => setFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>
        {onRunAITriage && (
          <button className="btn-ai-vision" style={{ padding: '4px 10px', fontSize: 11 }} onClick={onRunAITriage}>
            ⚡ AI TRIAGE
          </button>
        )}
      </div>

      {/* Entity Table */}
      <div className="grid-table-wrapper">
        <table className="grid-table">
          <thead>
            <tr>
              <th>ENTITY NAME</th>
              <th>TYPE</th>
              <th>STATE</th>
              <th>CONFIDENCE</th>
              <th>FRESHNESS</th>
              <th>CONFLICT</th>
              <th>SOURCE</th>
              <th>ACTION</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', color: '#64748b', padding: '24px 0' }}>
                  No matching entity records found
                </td>
              </tr>
            ) : (
              filtered.map(e => (
                <tr key={e.id} onClick={() => onSelectEntity(e)} className="grid-row-interactive">
                  <td className="font-bold">{e.name}</td>
                  <td><code>{e.type}</code></td>
                  <td>
                    <span className={`pill ${e.current_state === 'OPERATIONAL' || e.current_state === 'OPEN' ? 'pill-green' : 'pill-red'}`}>
                      {e.current_state}
                    </span>
                  </td>
                  <td>{(e.confidence * 100).toFixed(0)}%</td>
                  <td>
                    <span className={e.is_stale ? 'c-warn' : 'c-online'}>
                      {e.is_stale ? '⚠ STALE' : '✓ FRESH'}
                    </span>
                  </td>
                  <td>
                    <span className={e.has_conflict ? 'c-danger' : 'c-online'}>
                      {e.has_conflict ? 'YES' : 'NO'}
                    </span>
                  </td>
                  <td><code style={{ fontSize: 10 }}>{e.last_source_id}</code></td>
                  <td>
                    <button className="btn-inspect-small" onClick={(ev) => { ev.stopPropagation(); onSelectEntity(e); }}>
                      INSPECT
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
