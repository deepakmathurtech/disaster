import React from 'react';
import { Radio, CheckCircle2, Clock, MapPin, XCircle } from 'lucide-react';
import { ActiveSignal, cancelSignal } from '../services/api';

interface SignalStatusPanelProps {
  signals: ActiveSignal[];
  onSignalsUpdated: (updated: ActiveSignal[]) => void;
}

export const SignalStatusPanel: React.FC<SignalStatusPanelProps> = ({ signals, onSignalsUpdated }) => {
  if (!signals || signals.length === 0) return null;

  const handleCancelSignal = (id: string) => {
    const updated = cancelSignal(id);
    onSignalsUpdated(updated);
  };

  return (
    <div className="active-signals-card">
      <div className="signals-card-header">
        <Radio size={18} className="pulse-radio-icon" />
        <span className="signals-header-title">ACTIVE EMERGENCY BROADCASTS ({signals.length})</span>
      </div>

      <div className="signals-list">
        {signals.map((sig) => {
          const isSynced = sig.status === 'TRANSMITTED' || sig.status === 'ACKNOWLEDGED';
          return (
            <div key={sig.id} className={`signal-item-card ${isSynced ? 'synced' : 'pending'}`}>
              <div className="sig-item-top">
                <div className="sig-title-row">
                  <span className="sig-type-tag">{sig.type}</span>
                  <span className="sig-title-text">{sig.title}</span>
                </div>
                <button
                  type="button"
                  className="btn-cancel-sig"
                  onClick={() => handleCancelSignal(sig.id)}
                  title="Cancel this signal"
                >
                  <XCircle size={16} /> Cancel Signal
                </button>
              </div>

              <div className="sig-details-text">{sig.details}</div>

              <div className="sig-meta-row">
                <div className="sig-status-badge">
                  {isSynced ? (
                    <>
                      <CheckCircle2 size={14} className="icon-success" />
                      <span className="text-success">RECEIVED BY EOC COMMAND CENTER</span>
                    </>
                  ) : (
                    <>
                      <Clock size={14} className="icon-warn" />
                      <span className="text-warn">SAVED LOCAL · SYNCING TO EOC...</span>
                    </>
                  )}
                </div>

                <div className="sig-loc-badge">
                  <MapPin size={13} />
                  <span>GPS Shared: {sig.location.lat.toFixed(3)}, {sig.location.lng.toFixed(3)}</span>
                </div>

                <div className="sig-time-badge">
                  <Clock size={13} />
                  <span>{sig.timestamp}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
