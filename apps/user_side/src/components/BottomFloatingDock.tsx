import React from 'react';
import { AlertOctagon, MapPin, MessageSquare, PhoneCall } from 'lucide-react';

export type UserView = 'HOME' | 'MAP' | 'CHAT' | 'HELP';

interface BottomFloatingDockProps {
  currentView: UserView;
  onSelectView: (view: UserView) => void;
  activeSignalsCount: number;
}

export const BottomFloatingDock: React.FC<BottomFloatingDockProps> = ({
  currentView,
  onSelectView,
  activeSignalsCount,
}) => {
  // Floating dock is hidden on full-screen MAP and CHAT views
  if ((currentView as string) === 'MAP' || (currentView as string) === 'CHAT') {
    return null;
  }

  return (
    <div className="bottom-dock-wrapper">
      <nav className="bottom-dock-container" aria-label="Emergency Navigation Dock">
        <button
          type="button"
          className={`dock-item-btn ${currentView === 'HOME' ? 'active-sos' : ''}`}
          onClick={() => onSelectView('HOME')}
          aria-label="SOS Home"
        >
          <div className="dock-icon-wrapper">
            <AlertOctagon size={20} className="dock-icon" />
            {activeSignalsCount > 0 && <span className="dock-badge-pulse">{activeSignalsCount}</span>}
          </div>
          <span className="dock-label-text">SOS</span>
        </button>

        <button
          type="button"
          className={`dock-item-btn ${currentView === 'MAP' ? 'active-blue' : ''}`}
          onClick={() => onSelectView('MAP')}
          aria-label="Map"
        >
          <div className="dock-icon-wrapper">
            <MapPin size={20} className="dock-icon" />
          </div>
          <span className="dock-label-text">Map</span>
        </button>

        <button
          type="button"
          className={`dock-item-btn ${currentView === 'CHAT' ? 'active-blue' : ''}`}
          onClick={() => onSelectView('CHAT')}
          aria-label="Chat"
        >
          <div className="dock-icon-wrapper">
            <MessageSquare size={20} className="dock-icon" />
          </div>
          <span className="dock-label-text">Chat</span>
        </button>

        <button
          type="button"
          className={`dock-item-btn ${currentView === 'HELP' ? 'active-blue' : ''}`}
          onClick={() => onSelectView('HELP')}
          aria-label="Helplines"
        >
          <div className="dock-icon-wrapper">
            <PhoneCall size={20} className="dock-icon" />
          </div>
          <span className="dock-label-text">Helplines</span>
        </button>
      </nav>
    </div>
  );
};

