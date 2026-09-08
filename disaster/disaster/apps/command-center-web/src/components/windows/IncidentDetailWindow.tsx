import React, { useState } from 'react';

export interface IncidentData {
  id: string;
  name: string;
  sev: string;
  sub: string;
  time: string;
  icon: string;
}

interface IncidentDetailWindowProps {
  incident: IncidentData | null;
  onDispatch: (title: string, entityId: string) => void;
}

export default function IncidentDetailWindow({ incident, onDispatch }: IncidentDetailWindowProps) {
  const [generating, setGenerating] = useState(false);
  const [tacticalPlan, setTacticalPlan] = useState<string | null>(null);
  const [dispatched, setDispatched] = useState(false);

  if (!incident) {
    return (
      <div className="fw-body-inner flex-center">
        <div className="rp-empty">Select an active incident from the right panel to view details</div>
      </div>
    );
  }

  const handleGeneratePlan = () => {
    setGenerating(true);
    setTacticalPlan(null);
    setTimeout(() => {
      setGenerating(false);
      setTacticalPlan(
        `🚨 **AI TACTICAL INCIDENT RESPONSE PLAN**\n\n` +
        `• **Incident**: ${incident.name}\n` +
        `• **Severity**: ${incident.sev.toUpperCase()}\n\n` +
        `1. **Perimeter Lockdown**: Isolate immediate radius to prevent civilian casualties.\n` +
        `2. **Resource Dispatch**: Deploy Heavy Rescue & Rapid Medical Response Unit-17.\n` +
        `3. **Traffic Diversion**: Broadcast automated detour warnings to all field navigation apps.\n` +
        `4. **Reverification**: Require photo evidence within 15 minutes of arrival.`
      );
    }, 700);
  };

  const handleDispatchTeam = () => {
    onDispatch(`Respond to: ${incident.name}`, incident.id);
    setDispatched(true);
  };

  return (
    <div className="fw-body-inner flex-col">
      <div className="inc-win-hdr">
        <span className="inc-win-icon">{incident.icon}</span>
        <div>
          <div className="inc-win-title">{incident.name}</div>
          <div className="inc-win-sub">{incident.sub} &middot; Reported {incident.time} ago</div>
        </div>
        <span className={`unc-badge ${incident.sev === 'high' ? 'unc-badge-conflict' : 'unc-badge-stale'}`}>
          {incident.sev.toUpperCase()} SEVERITY
        </span>
      </div>

      <div className="inc-win-actions flex-row" style={{ gap: 8, margin: '12px 0' }}>
        <button
          className="btn-ai-vision"
          style={{ flex: 1 }}
          onClick={handleGeneratePlan}
          disabled={generating}
        >
          {generating ? '⌛ GENERATING PLAN...' : '⚡ GENERATE AI ACTION PLAN'}
        </button>
        <button
          className="btn-dispatch"
          onClick={handleDispatchTeam}
          disabled={dispatched}
        >
          {dispatched ? '✓ DISPATCHED' : '🚀 DISPATCH TEAM'}
        </button>
      </div>

      {tacticalPlan && (
        <div className="media-ai-report" style={{ flex: 1, overflowY: 'auto' }}>
          {tacticalPlan.split('\n').map((line, i) => (
            <div key={i}>{line}</div>
          ))}
        </div>
      )}
    </div>
  );
}
