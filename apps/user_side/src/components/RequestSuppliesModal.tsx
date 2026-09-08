import React, { useState } from 'react';
import { Package, X, MapPin, Send } from 'lucide-react';
import { OperationalStateDelta } from '@disaster/protocol';
import { transmitEmergencyDelta, ActiveSignal } from '../services/api';

interface RequestSuppliesModalProps {
  userLocation: { lat: number; lng: number; addressName: string };
  onClose: () => void;
  onSubmitted: () => void;
}

export const RequestSuppliesModal: React.FC<RequestSuppliesModalProps> = ({
  userLocation,
  onClose,
  onSubmitted,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('FOOD_WATER');
  const [peopleCount, setPeopleCount] = useState<number>(2);
  const [hasInfant, setHasInfant] = useState<boolean>(false);
  const [hasMedicalNeed, setHasMedicalNeed] = useState<boolean>(false);
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const handleSubmitSupplyRequest = async () => {
    setIsSubmitting(true);

    const eventId = `sup-req-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    const entityId = `citizen-supply-${Date.now()}`;

    const itemsNeeded = [
      selectedCategory === 'FOOD_WATER' ? 'Rations & Water' : selectedCategory === 'MEDICAL' ? 'First Aid & Meds' : 'Shelter Kit',
      hasInfant ? 'Infant Formula / Diapers' : null,
      hasMedicalNeed ? 'Urgent Prescription Medical Need' : null,
    ].filter(Boolean);

    const deltaPayload = {
      title: `SUPPLY REQUEST: ${itemsNeeded.join(', ')} (${peopleCount} People)`,
      severity: 'HIGH',
      sub_type: 'ESSENTIAL_SUPPLY_REQUEST',
      details: `Requesting essential supplies for ${peopleCount} people. Notes: ${notes || 'None'}`,
      people_count: peopleCount,
      has_infant: hasInfant,
      has_medical: hasMedicalNeed,
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
      type: 'SUPPLY',
      title: `🍞 Supply Request: ${itemsNeeded.join(', ')}`,
      details: `${peopleCount} people · ${userLocation.addressName}`,
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
            <Package size={22} className="icon-blue" />
            <h2>Request Essential Supplies</h2>
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
            <label className="clean-label">Primary Need</label>
            <div className="category-tabs">
              <button
                type="button"
                className={`cat-tab ${selectedCategory === 'FOOD_WATER' ? 'active' : ''}`}
                onClick={() => setSelectedCategory('FOOD_WATER')}
              >
                🍞 Food & Water
              </button>
              <button
                type="button"
                className={`cat-tab ${selectedCategory === 'MEDICAL' ? 'active' : ''}`}
                onClick={() => setSelectedCategory('MEDICAL')}
              >
                💊 Medical Need
              </button>
              <button
                type="button"
                className={`cat-tab ${selectedCategory === 'SHELTER' ? 'active' : ''}`}
                onClick={() => setSelectedCategory('SHELTER')}
              >
                ⛺ Tarps & Blankets
              </button>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="people-count-range" className="clean-label">
              People Needing Supplies: <b>{peopleCount >= 15 ? '15+' : peopleCount}</b>
            </label>
            <input
              id="people-count-range"
              type="range"
              min={1}
              max={15}
              value={peopleCount}
              onChange={(e) => setPeopleCount(parseInt(e.target.value))}
              className="range-input"
              style={{
                background: `linear-gradient(to right, #0284c7 0%, #0284c7 ${((peopleCount - 1) / 14) * 100}%, #e2e8f0 ${((peopleCount - 1) / 14) * 100}%, #e2e8f0 100%)`
              }}
            />
          </div>

          <div className="checkbox-options-row">
            <label className="checkbox-card">
              <input
                type="checkbox"
                checked={hasInfant}
                onChange={(e) => setHasInfant(e.target.checked)}
              />
              <span>Includes Infant</span>
            </label>

            <label className="checkbox-card">
              <input
                type="checkbox"
                checked={hasMedicalNeed}
                onChange={(e) => setHasMedicalNeed(e.target.checked)}
              />
              <span>Urgent Medical Need</span>
            </label>
          </div>

          <div className="form-group">
            <label htmlFor="supply-notes-input" className="clean-label">Additional Notes</label>
            <input
              id="supply-notes-input"
              type="text"
              placeholder="e.g. Need clean drinking water, 2 adult meals..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary-action"
            onClick={handleSubmitSupplyRequest}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Submitting...' : <><Send size={16} /> Submit Request</>}
          </button>
        </div>
      </div>
    </div>
  );
};
