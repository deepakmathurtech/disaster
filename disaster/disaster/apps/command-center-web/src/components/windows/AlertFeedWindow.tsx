import React, { useState } from 'react';
import { SimEvent } from '../../services/DisasterEngine';

interface AlertFeedWindowProps {
  events: SimEvent[];
  onAskAIAboutAlert: (alert: SimEvent) => void;
  onAcknowledge: (id: string) => void;
}

export default function AlertFeedWindow({ events, onAskAIAboutAlert, onAcknowledge }: AlertFeedWindowProps) {
  const [filter, setFilter] = useState<'ALL' | 'CRITICAL' | 'HIGH' | 'MEDIUM'>('ALL');
  const [ackMap, setAckMap] = useState<Record<string, boolean>>({});
  const alertEndRef = React.useRef<HTMLDivElement>(null);

  const handleAck = (id: string) => {
    setAckMap(prev => ({ ...prev, [id]: true }));
    onAcknowledge(id);
  };

  const filteredEvents = events.filter(e => {
    if (filter === 'ALL') return true;
    return e.severity === filter;
  });

  React.useEffect(() => {
    alertEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events.length]);


  return (
    <div className="fw-body-inner flex-col" style={{ gap: '10px' }}>
      {/* Alert Header Filters */}
      <div className="alert-filter-bar">
        <span className="llm-label">SEVERITY:</span>
        {(['ALL', 'CRITICAL', 'HIGH', 'MEDIUM'] as const).map(sev => (
          <button
            key={sev}
            className={`chip ${filter === sev ? 'active' : ''} ${sev !== 'ALL' ? `sev-${sev.toLowerCase()}` : ''}`}
            onClick={() => setFilter(sev)}
          >
            {sev}
          </button>
        ))}
      </div>

      {/* Alert List */}
      <div className="alert-list-container">
        {filteredEvents.length === 0 ? (
          <div className="empty-state">No alerts in queue for selected severity filter.</div>
        ) : (
          filteredEvents.map(evt => {
            const isAck = ackMap[evt.id];
            return (
              <div key={evt.id} className={`alert-card sev-${evt.severity.toLowerCase()} ${isAck ? 'ack' : ''}`}>
                <div className="alert-hdr">
                  <span className={`alert-badge badge-${evt.severity.toLowerCase()}`}>
                    {evt.severity === 'CRITICAL' ? '🚨 CRITICAL' : evt.severity === 'HIGH' ? '⚠️ HIGH' : 'ℹ️ MEDIUM'}
                  </span>
                  <span className="alert-time">Sim T+{evt.simTimeMinutes}m</span>
                  <span className="alert-cat">{evt.category}</span>
                </div>

                <div className="alert-title">{evt.title}</div>
                <div className="alert-desc">{evt.description}</div>

                <div className="alert-action-box">
                  <span className="alert-action-label">RECOMMENDED ACTION:</span>
                  <div className="alert-action-text">{evt.suggestedAction}</div>
                </div>

                <div className="alert-btn-row">
                  <button
                    className="btn-alert-ai"
                    onClick={() => onAskAIAboutAlert(evt)}
                  >
                    🧠 Ask AI Response
                  </button>
                  <button
                    className={`btn-alert-ack ${isAck ? 'done' : ''}`}
                    onClick={() => handleAck(evt.id)}
                    disabled={isAck}
                  >
                    {isAck ? '✓ ACKNOWLEDGED' : 'ACKNOWLEDGE'}
                  </button>
                </div>
              </div>
            );
          })
        )}
        <div ref={alertEndRef} />
      </div>
    </div>
  );
}
