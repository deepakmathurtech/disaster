import React, { useState } from 'react';
import { AlertOctagon, X, MapPin, Radio } from 'lucide-react';
import { OperationalStateDelta } from '@disaster/protocol';
import { transmitEmergencyDelta, ActiveSignal } from '../services/api';

interface SOSConfirmationModalProps {
  userLocation: { lat: number; lng: number; addressName: string };
  onClose: () => void;
  onSignalTransmitted: () => void;
}

export const SOSConfirmationModal: React.FC<SOSConfirmationModalProps> = ({
  userLocation,
  onClose,
  onSignalTransmitted,
}) => {
  const [isTransmitting, setIsTransmitting] = useState(false);
  const [emergencyDetails, setEmergencyDetails] = useState('');
  const [selectedUrgency, setSelectedUrgency] = useState<'CRITICAL_HELP' | 'TRAPPED' | 'INJURED'>('CRITICAL_HELP');

  const handleConfirmSOS = async () => {
    setIsTransmitting(true);

    const eventId = `sos-evt-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    const entityId = `citizen-sos-${Date.now()}`;

    const deltaPayload = {
      title: `CRITICAL CITIZEN SOS: ${selectedUrgency.replace('_', ' ')}`,
      severity: 'CRITICAL',
      sub_type: 'CITIZEN_DISTRESS_SOS',
      details: emergencyDetails || 'Citizen triggered emergency SOS distress beacon.',
      urgency: selectedUrgency,
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
      type: 'SOS',
      title: `🚨 SOS Emergency Signal (${selectedUrgency.replace('_', ' ')})`,
      details: emergencyDetails || 'Urgent distress beacon active',
      status: 'PENDING_SYNC',
      timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      location: userLocation,
      payload: deltaPayload,
    };

    await transmitEmergencyDelta(delta, signalMeta);

    setIsTransmitting(false);
    onSignalTransmitted();
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-card sos-modal-card">
        <div className="modal-header sos-modal-header">
          <div className="sos-header-title">
            <AlertOctagon size={24} className="sos-title-icon" />
            <h2>Confirm Emergency SOS</h2>
          </div>
          <button type="button" className="btn-modal-close" onClick={onClose} aria-label="Cancel">
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          <div className="location-badge-box">
            <MapPin size={16} className="loc-icon" />
            <span>{userLocation.addressName}</span>
          </div>

          <div className="form-group">
            <label className="clean-label">Emergency Type</label>
            <div className="urgency-options-grid">
              <button
                type="button"
                className={`urgency-opt-btn ${selectedUrgency === 'CRITICAL_HELP' ? 'selected' : ''}`}
                onClick={() => setSelectedUrgency('CRITICAL_HELP')}
              >
                🚨 Critical Urgent Help
              </button>
              <button
                type="button"
                className={`urgency-opt-btn ${selectedUrgency === 'TRAPPED' ? 'selected' : ''}`}
                onClick={() => setSelectedUrgency('TRAPPED')}
              >
                🌊 Trapped in Water / Debris
              </button>
              <button
                type="button"
                className={`urgency-opt-btn ${selectedUrgency === 'INJURED' ? 'selected' : ''}`}
                onClick={() => setSelectedUrgency('INJURED')}
              >
                🚑 Medical Injury / Bleeding
              </button>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="sos-details-input" className="clean-label">Additional Details (Optional)</label>
            <textarea
              id="sos-details-input"
              rows={2}
              placeholder="e.g. 2 adults, 1 child on roof near flooded road..."
              value={emergencyDetails}
              onChange={(e) => setEmergencyDetails(e.target.value)}
            />
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={isTransmitting}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-danger-sos-action"
            onClick={handleConfirmSOS}
            disabled={isTransmitting}
          >
            {isTransmitting ? (
              <>
                <Radio size={18} className="spin-icon" /> Transmitting...
              </>
            ) : (
              <>Transmit SOS Signal</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
