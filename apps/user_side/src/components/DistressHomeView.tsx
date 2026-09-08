import React, { useState } from 'react';
import { AlertOctagon, Package, AlertTriangle, LifeBuoy, MapPin, Sparkles, ArrowRight, CheckCircle, ChevronRight } from 'lucide-react';
import { SOSConfirmationModal } from './SOSConfirmationModal';
import { RequestSuppliesModal } from './RequestSuppliesModal';
import { ReportIncidentModal } from './ReportIncidentModal';
import { SignalStatusPanel } from './SignalStatusPanel';
import { ActiveSignal, getActiveSignals } from '../services/api';
import { UserView } from './BottomFloatingDock';

interface DistressHomeViewProps {
  userLocation: { lat: number; lng: number; addressName: string };
  onNavigate: (view: UserView) => void;
  onOpenAIChatWithPrompt?: (prompt: string) => void;
}

export const DistressHomeView: React.FC<DistressHomeViewProps> = ({
  userLocation,
  onNavigate,
  onOpenAIChatWithPrompt,
}) => {
  const [showSOSModal, setShowSOSModal] = useState(false);
  const [showSupplyModal, setShowSupplyModal] = useState(false);
  const [showIncidentModal, setShowIncidentModal] = useState(false);
  const [activeSignals, setActiveSignals] = useState<ActiveSignal[]>(getActiveSignals());
  const [flashSuccessMsg, setFlashSuccessMsg] = useState<string | null>(null);

  const handleSignalSent = () => {
    setShowSOSModal(false);
    setShowSupplyModal(false);
    setShowIncidentModal(false);
    setActiveSignals(getActiveSignals());
    setFlashSuccessMsg('✅ Emergency broadcast transmitted successfully to Command Center.');
    setTimeout(() => setFlashSuccessMsg(null), 5000);
  };

  return (
    <div className="home-view-container">
      {/* Top Emergency Status Header */}
      <div className="home-top-bar">
        <div className="app-brand-row">
          <div className="location-pill">
            <MapPin size={15} strokeWidth={2.2} className="loc-dot" />
            <span>{userLocation.addressName}</span>
          </div>
        </div>

        {flashSuccessMsg && (
          <div className="flash-success-banner">
            <CheckCircle size={18} />
            <span>{flashSuccessMsg}</span>
          </div>
        )}
      </div>

      <div className="home-scroll-body">
        {/* Main Emergency Callout */}
        <div className="need-help-header">
          <h1>Need Help?</h1>
        </div>

        {/* 🚨 Visually Prominent Main SOS Trigger Button */}
        <div className="sos-hero-card">
          <button
            type="button"
            className="sos-hero-button"
            onClick={() => setShowSOSModal(true)}
            aria-label="Send Emergency SOS Signal"
          >
            <div className="sos-pulse-ring" />
            <div className="sos-pulse-ring delay" />
            <div className="sos-content-box">
              <AlertTriangle size={34} className="sos-icon-glow" />
              <span className="sos-primary-text">SEND SOS DISTRESS<br />SIGNAL</span>
              <span className="sos-sub-text">BROADCASTS YOUR LIVE GPS LOCATION TO<br />COMMAND CENTER</span>
            </div>
          </button>
        </div>

        {/* 4 Main Action Cards List */}
        <div className="action-cards-grid">
          <button
            type="button"
            className="action-card card-supplies"
            onClick={() => setShowSupplyModal(true)}
          >
            <div className="card-left-content">
              <div className="card-icon-wrapper icon-bg-blue">
                <Package size={24} />
              </div>
              <div className="card-text-group">
                <h3>Request Supplies</h3>
                <p>Food, water, first-aid, or blankets</p>
              </div>
            </div>
            <ChevronRight size={18} className="card-chevron" />
          </button>

          <button
            type="button"
            className="action-card card-report"
            onClick={() => setShowIncidentModal(true)}
          >
            <div className="card-left-content">
              <div className="card-icon-wrapper icon-bg-amber">
                <AlertTriangle size={24} />
              </div>
              <div className="card-text-group">
                <h3>Report Situation</h3>
                <p>Fire, structural danger, or blockades</p>
              </div>
            </div>
            <ChevronRight size={18} className="card-chevron" />
          </button>

          <button
            type="button"
            className="action-card card-help"
            onClick={() => {
              if (onOpenAIChatWithPrompt) {
                onOpenAIChatWithPrompt("I am injured or need medical help");
              } else {
                onNavigate('CHAT');
              }
            }}
          >
            <div className="card-left-content">
              <div className="card-icon-wrapper icon-bg-red">
                <LifeBuoy size={24} />
              </div>
              <div className="card-text-group">
                <h3>Request Help</h3>
                <p>Medical evacuation or physical rescue</p>
              </div>
            </div>
            <ChevronRight size={18} className="card-chevron" />
          </button>

          <button
            type="button"
            className="action-card card-shelter"
            onClick={() => onNavigate('MAP')}
          >
            <div className="card-left-content">
              <div className="card-icon-wrapper icon-bg-emerald">
                <MapPin size={24} />
              </div>
              <div className="card-text-group">
                <h3>Find Safe Route</h3>
                <p>AI guided navigation around hazards</p>
              </div>
            </div>
            <ChevronRight size={18} className="card-chevron" />
          </button>
        </div>

        {/* Quick AI Assistant Banner - Entire Box Clickable */}
        <div className="ai-calming-banner" onClick={() => onNavigate('CHAT')}>
          <div className="ai-banner-left">
            <div className="ai-banner-icon-box">
              <Sparkles size={20} className="ai-banner-icon" />
            </div>
            <div className="ai-banner-text-group">
              <h4>AI Emergency Assistant</h4>
              <p>"I am scared, what should I do?" · Ask...</p>
            </div>
          </div>
          <ArrowRight size={18} className="ai-banner-arrow" />
        </div>

        {/* Active Signal Status Panel */}
        <SignalStatusPanel signals={activeSignals} onSignalsUpdated={(updated) => setActiveSignals(updated)} />
      </div>

      {/* Modals */}
      {showSOSModal && (
        <SOSConfirmationModal
          userLocation={userLocation}
          onClose={() => setShowSOSModal(false)}
          onSignalTransmitted={handleSignalSent}
        />
      )}

      {showSupplyModal && (
        <RequestSuppliesModal
          userLocation={userLocation}
          onClose={() => setShowSupplyModal(false)}
          onSubmitted={handleSignalSent}
        />
      )}

      {showIncidentModal && (
        <ReportIncidentModal
          userLocation={userLocation}
          onClose={() => setShowIncidentModal(false)}
          onSubmitted={handleSignalSent}
        />
      )}
    </div>
  );
};
