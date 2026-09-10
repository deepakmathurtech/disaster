import { useEffect, useRef, useState } from 'react';

interface VoiceWaveformInputProps {
  onConfirm: (data: {
    text: string;
    durationSeconds: number;
    audioUrl?: string;
  }) => void;
  onCancel: () => void;
}

export function VoiceWaveformInput({
  onConfirm,
  onCancel,
}: VoiceWaveformInputProps) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [text, setText] = useState('');

  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (recording) {
      timerRef.current = window.setInterval(() => {
        setSeconds((s) => s + 1);
      }, 1000);
    }

    return () => {
      if (timerRef.current !== null) {
        clearInterval(timerRef.current);
      }
    };
  }, [recording]);

  const startRecording = () => {
    setRecording(true);
    setSeconds(0);
  };

  const stopRecording = () => {
    setRecording(false);
  };

  const confirmRecording = () => {
    onConfirm({
      text: text.trim() || 'Voice note recorded.',
      durationSeconds: seconds,
    });
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        width: '100%',
        padding: '12px',
      }}
    >
      <button type="button" onClick={onCancel}>
        Cancel
      </button>

      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '13px', marginBottom: '6px' }}>
          {recording ? `🎙 Recording ${seconds}s` : '🎙 Voice Input'}
        </div>

        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Enter voice transcript..."
          style={{
            width: '100%',
            padding: '10px',
            borderRadius: '8px',
            border: '1px solid #ccc',
          }}
        />
      </div>

      {!recording ? (
        <button type="button" onClick={startRecording}>
          🎙 Start
        </button>
      ) : (
        <button type="button" onClick={stopRecording}>
          ⏹ Stop
        </button>
      )}

      <button type="button" onClick={confirmRecording}>
        ✓ Confirm
      </button>
    </div>
  );
}
