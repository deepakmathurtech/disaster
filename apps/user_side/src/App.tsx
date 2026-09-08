import React, { useState, useEffect } from 'react';
import { DistressHomeView } from './components/DistressHomeView';
import { MapView } from './components/MapView';
import { ChatView } from './components/ChatView';
import { BottomFloatingDock, UserView } from './components/BottomFloatingDock';
import { getActiveSignals, attemptOfflineSync } from './services/api';
import { PhoneCall, ShieldCheck, HeartPulse, AlertCircle, ArrowLeft } from 'lucide-react';
import './App.css';

export function App() {
  const [currentView, setCurrentView] = useState<UserView>('HOME');
  const [initialChatPrompt, setInitialChatPrompt] = useState<string | undefined>(undefined);
  const [userLocation, setUserLocation] = useState({
    lat: 12.9600,
    lng: 77.5900,
    addressName: 'Sector 4 South Access Point',
  });
  const [activeCount, setActiveCount] = useState<number>(getActiveSignals().length);

  useEffect(() => {
    if (!navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      ({ coords }) => setUserLocation(previous => ({
        ...previous,
        lat: coords.latitude,
        lng: coords.longitude,
        addressName: 'Current device location',
      })),
      () => { /* Keep fallback location */ },
      { enableHighAccuracy: true, maximumAge: 15000, timeout: 10000 },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  // Background offline sync retry listener
  useEffect(() => {
    const handleOnline = () => {
      attemptOfflineSync().then(() => {
        setActiveCount(getActiveSignals().length);
      });
    };

    window.addEventListener('online', handleOnline);
    const interval = setInterval(handleOnline, 10000);

    return () => {
      window.removeEventListener('online', handleOnline);
      clearInterval(interval);
    };
  }, []);

  const handleOpenAIChatWithPrompt = (prompt: string) => {
    setInitialChatPrompt(prompt);
    setCurrentView('CHAT');
  };

  return (
    <div className="user-side-root">
      {/* 1. Distress / Home View */}
      {currentView === 'HOME' && (
        <DistressHomeView
          userLocation={userLocation}
          onNavigate={(v) => {
            setInitialChatPrompt(undefined);
            setCurrentView(v);
          }}
          onOpenAIChatWithPrompt={handleOpenAIChatWithPrompt}
        />
      )}

      {/* 2. Map View (Full Screen Focused — NO Bottom Floating Dock!) */}
      {currentView === 'MAP' && (
        <MapView
          userLocation={userLocation}
          onBack={() => setCurrentView('HOME')}
        />
      )}

      {/* 3. Chat View (Full Screen Focused — NO Bottom Floating Dock!) */}
      {currentView === 'CHAT' && (
        <ChatView
          userLocation={userLocation}
          onBack={() => setCurrentView('HOME')}
          initialPrompt={initialChatPrompt}
        />
      )}

      {/* 4. Emergency Contacts View */}
      {currentView === 'HELP' && (
        <div className="help-contacts-page">
          <div className="help-top-bar">
            <button type="button" className="btn-back-sos" onClick={() => setCurrentView('HOME')}>
              <ArrowLeft size={20} />
              <span>Back to SOS</span>
            </button>
            <div className="help-title">
              <PhoneCall size={20} className="icon-cyan" />
              <span>EMERGENCY HELPLINES</span>
            </div>
          </div>

          <div className="contacts-list-container">
            <div className="contact-card critical-contact">
              <div className="contact-icon-box"><ShieldCheck size={28} /></div>
              <div className="contact-info">
                <h3>NATIONAL EMERGENCY RESPONSE</h3>
                <span className="contact-number">📞 112</span>
                <p>24/7 Universal Emergency & Ambulance Dispatch</p>
              </div>
            </div>

            <div className="contact-card">
              <div className="contact-icon-box icon-red"><HeartPulse size={28} /></div>
              <div className="contact-info">
                <h3>DISASTER RESPONSE FORCE (NDRF)</h3>
                <span className="contact-number">📞 1078</span>
                <p>Rescue boats, helicopter extraction & flood response</p>
              </div>
            </div>

            <div className="contact-card">
              <div className="contact-icon-box icon-blue"><PhoneCall size={28} /></div>
              <div className="contact-info">
                <h3>EOC SECTOR COMMAND CENTER</h3>
                <span className="contact-number">📞 1800-425-001</span>
                <p>Local Sector 4 Control Room Direct Radio Relay</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FLOATING DOCK — Rendered ONLY on HOME or HELP views! Hidden on MAP and CHAT! */}
      <BottomFloatingDock
        currentView={currentView}
        onSelectView={(v) => {
          setInitialChatPrompt(undefined);
          setCurrentView(v);
        }}
        activeSignalsCount={activeCount}
      />
    </div>
  );
}

export default App;
