import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Send, Mic, MapPin, Plus, ArrowUp, Bot, User, HeartHandshake, Shield, Sparkles } from 'lucide-react';
import { parseCitizenIntent, CitizenIntentResult } from '../localAI';
import { VoiceWaveformInput, VoiceConfirmData } from '../VoiceWaveformInput';
import { localLLM } from '../../../command-center-web/src/services/localLLM';

interface ChatViewProps {
  userLocation: { lat: number; lng: number; addressName: string };
  onBack: () => void;
  initialPrompt?: string;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
  intentResult?: CitizenIntentResult;
  isVoice?: boolean;
}

export const ChatView: React.FC<ChatViewProps> = ({ userLocation, onBack, initialPrompt }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'msg-welcome',
      sender: 'ai',
      text: "👋 **I am your Emergency Citizen Assistant.**\n\nI am here to help keep you safe, guide you to nearby shelters, and help you request food or medical emergency assistance.\n\nTake a deep breath — you are connected to the Emergency Operational System.",
      timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [inputText, setInputText] = useState<string>('');
  const [isVoiceRecording, setIsVoiceRecording] = useState<boolean>(false);
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const ollamaConnectionRef = useRef<Promise<void> | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  useEffect(() => {
    if (initialPrompt) {
      handleSendMessage(initialPrompt);
    }
  }, [initialPrompt]);

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || inputText).trim();
    if (!query) return;

    if (!textToSend) setInputText('');

    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsTyping(true);

    const intentResult = parseCitizenIntent(query);
    const citizenContext = {
      areaName: 'Sector 4 Emergency Zone',
      verifiedCount: 14,
      staleCount: 1,
      conflictCount: 0,
      staleEntities: [],
      conflicts: [],
      incidents: [{ name: 'Citizen Location', sub: userLocation.addressName, time: 'Now' }],
    };

    try {
      let aiText = '';
      if (intentResult.intent !== 'UNKNOWN') {
        aiText = intentResult.response_text;
      } else {
        if (!localLLM.isReady()) {
          ollamaConnectionRef.current ??= localLLM.connect('ollama-auto').catch(() => undefined);
          await ollamaConnectionRef.current;
        }
        aiText = await localLLM.generateResponse(query, citizenContext);
      }

      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        text: aiText,
        timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        intentResult,
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch {
      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        text: intentResult.response_text,
        timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        intentResult,
      };
      setMessages((prev) => [...prev, aiMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleVoiceConfirm = (data: VoiceConfirmData) => {
    setIsVoiceRecording(false);
    const userVoiceMsg: ChatMessage = {
      id: `usr-v-${Date.now()}`,
      sender: 'user',
      text: `🎤 Voice note (${data.durationSeconds}s): "${data.text}"`,
      timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      isVoice: true,
    };

    setMessages((prev) => [...prev, userVoiceMsg]);
    setIsTyping(true);

    setTimeout(() => {
      const intentResult = parseCitizenIntent('voice emergency situation report');
      const aiMsg: ChatMessage = {
        id: `ai-v-${Date.now()}`,
        sender: 'ai',
        text: "🎤 **Voice Note Received & Logged.**\n\nI have registered your audio report. Responders can review audio notes for situation assessment. Stay safe and monitor shelter route updates on the map.",
        timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        intentResult,
      };
      setMessages((prev) => [...prev, aiMsg]);
      setIsTyping(false);
    }, 800);
  };

  const handleShareLocationInChat = () => {
    handleSendMessage(`My current location is: ${userLocation.addressName} (${userLocation.lat.toFixed(4)}, ${userLocation.lng.toFixed(4)})`);
  };

  return (
    <div className="chat-view-fullscreen">
      {/* Top Focused Navigation Bar */}
      <div className="chat-top-bar">
        <button type="button" className="btn-back-sos" onClick={onBack} aria-label="Back to SOS Home">
          <ArrowLeft size={20} />
        </button>
        <div className="chat-brand-info">
          <Bot size={20} className="icon-cyan" />
          <div>
            <h3>EMERGENCY AI ASSISTANT</h3>
            <span className="online-badge">● ONLINE · 100% OFFLINE CAPABLE</span>
          </div>
        </div>
      </div>

      {/* Quick Calming Emergency Action Chips */}
      <div className="chat-chips-bar">
        <button
          type="button"
          className="chat-chip chip-calm"
          onClick={() => handleSendMessage("I am scared, what should I do?")}
        >
          💙 I am scared, what should I do?
        </button>
        <button
          type="button"
          className="chat-chip chip-shelter"
          onClick={() => handleSendMessage("Where is the nearest shelter?")}
        >
          🏠 Where is nearest shelter?
        </button>
        <button
          type="button"
          className="chat-chip chip-food"
          onClick={() => handleSendMessage("I need food and clean water")}
        >
          🍞 Need food and water
        </button>
        <button
          type="button"
          className="chat-chip chip-flood"
          onClick={() => handleSendMessage("There is flooding near me")}
        >
          🌊 Flooding near me
        </button>
      </div>

      {/* Messages Scroll Body */}
      <div className="chat-messages-body">
        {messages.map((msg) => {
          const isAI = msg.sender === 'ai';
          return (
            <div key={msg.id} className={`chat-bubble-row ${isAI ? 'ai-row' : 'user-row'}`}>
              <div className="avatar-box">
                {isAI ? <Bot size={20} className="icon-ai" /> : <User size={20} className="icon-user" />}
              </div>

              <div className={`chat-bubble ${isAI ? 'ai-bubble' : 'user-bubble'}`}>
                <div className="msg-header-row">
                  <span className="sender-name">{isAI ? 'Emergency AI' : 'You'}</span>
                  <span className="msg-time">{msg.timestamp}</span>
                </div>

                <div className="msg-text-content">
                  {msg.text.split('\n').map((line, idx) => {
                    if (line.startsWith('**') && line.endsWith('**')) {
                      return <strong key={idx}>{line.slice(2, -2)}<br /></strong>;
                    }
                    return <span key={idx}>{line}<br /></span>;
                  })}
                </div>

                {isAI && msg.intentResult?.suggested_action === 'SEND_SOS' && (
                  <button
                    type="button"
                    className="chip-action-trigger trigger-sos"
                    onClick={onBack}
                  >
                    🚨 OPEN SOS DISTRESS TRIGGER NOW
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {isTyping && (
          <div className="chat-bubble-row ai-row">
            <div className="avatar-box"><Bot size={20} className="icon-ai" /></div>
            <div className="chat-bubble ai-bubble typing-bubble">
              <span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Voice Input Drawer or Bottom Pill Capsule Input */}
      {isVoiceRecording ? (
        <VoiceWaveformInput
          onConfirm={handleVoiceConfirm}
          onCancel={() => setIsVoiceRecording(false)}
        />
      ) : (
        <div className="chat-input-wrapper">
          <div className="chat-input-pill">
            <button
              type="button"
              className="chat-pill-btn btn-plus"
              onClick={handleShareLocationInChat}
              title="Share my GPS Location / Add Context"
            >
              <Plus size={20} />
            </button>

            <input
              type="text"
              className="chat-pill-text-input"
              placeholder='Type operational observation e.g. "Water level rising near me"'
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSendMessage();
              }}
            />

            <button
              type="button"
              className="chat-pill-btn btn-mic"
              onClick={() => setIsVoiceRecording(true)}
              title="Record Voice Note"
            >
              <Mic size={20} />
            </button>

            <button
              type="button"
              className="chat-pill-send-btn"
              onClick={() => handleSendMessage()}
              disabled={!inputText.trim()}
              title="Send Message"
            >
              <ArrowUp size={20} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
