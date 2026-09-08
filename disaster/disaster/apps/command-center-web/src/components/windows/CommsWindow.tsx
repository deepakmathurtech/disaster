import React, { useState, useEffect } from 'react';
import { SimEvent } from '../../services/DisasterEngine';

export interface ChannelMsg {
  id: string;
  callsign: string;
  channel: string;
  time: string;
  text: string;
  type: 'FIELD' | 'SOS' | 'COMMAND';
}

const INITIAL_MSGS: ChannelMsg[] = [
  {
    id: 'c1',
    callsign: 'Unit-17 (Alpha Eng)',
    channel: '#TACTICAL-ALPHA',
    time: '11:24:02',
    text: 'Old Yamuna Bridge (Loha Pul) inspection complete. Structural displacement flagged on Pier 4.',
    type: 'SOS',
  },
  {
    id: 'c2',
    callsign: 'Unit-04 (Bravo Relief)',
    channel: '#FIELD-DISPATCH',
    time: '11:22:15',
    text: 'Relief Camp Alpha near 100% capacity. Diverting secondary influx to Relief Camp Beta.',
    type: 'FIELD',
  },
  {
    id: 'c3',
    callsign: 'EOC Command',
    channel: '#TACTICAL-ALPHA',
    time: '11:18:40',
    text: 'Simulation active. All field units switch tactical comms to 142.85 MHz.',
    type: 'COMMAND',
  },
];

interface CommsWindowProps {
  events?: SimEvent[];
}

export default function CommsWindow({ events = [] }: CommsWindowProps) {
  const [activeChannel, setActiveChannel] = useState('#TACTICAL-ALPHA');
  const [messages, setMessages] = useState<ChannelMsg[]>(INITIAL_MSGS);
  const [inputText, setInputText] = useState('');
  const commsEndRef = React.useRef<HTMLDivElement>(null);

  // Sync sim events to comms messages automatically
  useEffect(() => {
    if (!events.length) return;
    const simMsgs: ChannelMsg[] = events
      .filter(e => e.commsMessage)
      .map(e => ({
        id: `sim-${e.id}`,
        callsign: e.commsMessage!.callsign,
        channel: e.commsMessage!.channel,
        time: `Sim T+${e.simTimeMinutes}m`,
        text: e.commsMessage!.text,
        type: e.commsMessage!.type,
      }));

    setMessages(prev => {
      const existingIds = new Set(prev.map(m => m.id));
      const newItems = simMsgs.filter(m => !existingIds.has(m.id));
      if (newItems.length === 0) return prev;
      return [...prev, ...newItems];
    });
  }, [events]);

  useEffect(() => {
    commsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const filtered = messages.filter(m => activeChannel === '#ALL' || m.channel === activeChannel);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const newMsg: ChannelMsg = {
      id: `c-${Date.now()}`,
      callsign: 'EOC Command',
      channel: activeChannel === '#ALL' ? '#TACTICAL-ALPHA' : activeChannel,
      time: new Date().toLocaleTimeString('en-IN', { hour12: false }),
      text: inputText,
      type: 'COMMAND',
    };

    setMessages(prev => [...prev, newMsg]);
    setInputText('');
  };

  return (
    <div className="fw-body-inner flex-col">
      {/* Channel Bar */}
      <div className="comms-channel-bar">
        {['#TACTICAL-ALPHA', '#FIELD-DISPATCH', '#EMERGENCY-SOS', '#ALL'].map(ch => (
          <button
            key={ch}
            className={`channel-tab ${activeChannel === ch ? 'active' : ''}`}
            onClick={() => setActiveChannel(ch)}
          >
            {ch}
            {ch === '#EMERGENCY-SOS' && <span className="channel-badge pulse">SOS</span>}
          </button>
        ))}
      </div>

      {/* Comms Feed */}
      <div className="comms-feed">
        {filtered.map(msg => (
          <div key={msg.id} className={`comms-card comms-${msg.type.toLowerCase()}`}>
            <div className="comms-card-hdr">
              <span className="comms-callsign">
                {msg.type === 'SOS' ? '🚨 ' : msg.type === 'COMMAND' ? '🛰 ' : '📱 '}
                {msg.callsign}
              </span>
              <span className="comms-chan">{msg.channel}</span>
              <span className="comms-time">{msg.time}</span>
            </div>
            <div className="comms-card-text">{msg.text}</div>
          </div>
        ))}
        <div ref={commsEndRef} />
      </div>

      {/* Broadcast Transmitter Form */}
      <form onSubmit={handleSend} className="comms-input-bar">
        <input
          type="text"
          value={inputText}
          onChange={e => setInputText(e.target.value)}
          placeholder={`Broadcast message to ${activeChannel}...`}
        />
        <button type="submit" className="btn-transmit">TRANSMIT</button>
      </form>
    </div>
  );
}
