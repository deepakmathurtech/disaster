import React, { useState } from 'react';
import { AlertTriangle, X, MapPin, Send } from 'lucide-react';
import { OperationalStateDelta } from '@disaster/protocol';
import { transmitEmergencyDelta, ActiveSignal } from '../services/api';

interface ReportIncidentModalProps {
  userLocation: { lat: number; lng: number; addressName: string };
  onClose: () => void;
  onSubmitted: () => void;
}

export const ReportIncidentModal: React.FC<ReportIncidentModalProps> = ({
  userLocation,
  onClose,
  onSubmitted,
}) => {
  const [incidentType, setIncidentType] = useState<string>('FLOOD');
  const [description, setDescription] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const handleSubmitReport = async () => {
    if (!description.trim()) return;
    setIsSubmitting(true);

    const eventId = `haz-rpt-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    const entityId = `citizen-hazard-${Date.now()}`;

    const deltaPayload = {
      title: `CITIZEN HAZARD REPORT: ${incidentType.replace('_', ' ')}`,
      severity: 'HIGH',
      sub_type: incidentType,
      details: description,
    };

    const delta: OperationalStateDelta = {
      event_id: eventId,
      type: 'INCIDENT_REPORTED',
      entity_id: entityId,
      entity_type: 'INCIDENT',
      previous_state: 'UNKNOWN',
      new_state: 'CRITICAL',
      location: { lat: userLocation.lat, lng: userLocation.lng, address: userLocation.addressName },
      observed_at: new Date().toISOString(),
      source_id: 'citizen-app-user',
      confidence: 1.0,
      freshness: {
        last_observed_at: new Date().toISOString(),
        valid_until: new Date(Date.now() + 86400000).toISOString(),
        is_stale: false,
      },
      evidence: [],
      sync_status: 'PENDING',
      metadata: deltaPayload,
    };

    const signalMeta: ActiveSignal = {
      id: eventId,
      type: 'INCIDENT',
      title: `⚠️ Incident Report: ${incidentType.replace('_', ' ')}`,
      details: description,
      status: 'PENDING_SYNC',
      timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      location: userLocation,
      payload: deltaPayload,
    };

    await transmitEmergencyDelta(delta, signalMeta);

    setIsSubmitting(false);
    onSubmitted();
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <div className="modal-header">
          <div className="modal-title-row">
            <AlertTriangle size={22} className="icon-amber" />
            <h2>Report Dangerous Situation</h2>
          </div>
          <button type="button" className="btn-modal-close" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          <div className="location-badge-box">
            <MapPin size={16} className="loc-icon" />
            <span>{userLocation.addressName}</span>
          </div>

          <div className="form-group">
            <label htmlFor="hazard-type-select" className="clean-label">Hazard Type</label>
            <select
              id="hazard-type-select"
              value={incidentType}
              onChange={(e) => setIncidentType(e.target.value)}
              className="select-input"
            >
              <option value="FLOOD">🌊 Rising Water / Flooding</option>
              <option value="ROAD_BLOCKED">🚧 Road / Pathway Blocked</option>
              <option value="BRIDGE_DAMAGE">🌉 Bridge / Causeway Damaged</option>
              <option value="FIRE">🔥 Active Fire / Explosion</option>
              <option value="POWER_DOWN">⚡ Downed Power Lines / Electrical</option>
              <option value="OTHER">⚠️ Other Hazard</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="hazard-desc-input" className="clean-label">Description of Danger</label>
            <textarea
              id="hazard-desc-input"
              rows={3}
              placeholder="e.g. Water level rising fast near Bridge B12 approach. Road impassable for cars."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-amber-action"
            onClick={handleSubmitReport}
            disabled={isSubmitting || !description.trim()}
          >
            {isSubmitting ? 'Submitting...' : <><Send size={16} /> Submit Report</>}
          </button>
        </div>
      </div>
    </div>
  );
};
