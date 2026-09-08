import React, { useEffect, useRef, useState } from 'react';
import { X, Square, ArrowUp, AlertCircle } from 'lucide-react';

export interface VoiceConfirmData {
  text: string;
  audioBlob?: Blob;
  audioUrl?: string;
  durationSeconds: number;
}

interface VoiceWaveformInputProps {
  onConfirm: (data: VoiceConfirmData) => void;
  onCancel: () => void;
}

export const VoiceWaveformInput: React.FC<VoiceWaveformInputProps> = ({ onConfirm, onCancel }) => {
  const [recordingTime, setRecordingTime] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  const numBars = 32;
  const targetAmplitudesRef = useRef<Float32Array>(new Float32Array(numBars));
  const currentAmplitudesRef = useRef<Float32Array>(new Float32Array(numBars));
  const frameCounterRef = useRef<number>(0);

  const cleanup = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try { mediaRecorderRef.current.stop(); } catch { /* ignore */ }
      mediaRecorderRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
  };

  useEffect(() => {
    let isMounted = true;

    const startRecording = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (!isMounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        mediaStreamRef.current = stream;

        audioChunksRef.current = [];
        let mimeType = '';
        const candidateTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
        for (const t of candidateTypes) {
          if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) {
            mimeType = t;
            break;
          }
        }

        const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
        mediaRecorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };
        mediaRecorder.start(100);
        mediaRecorderRef.current = mediaRecorder;

        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        const audioCtx = new AudioCtx();
        audioCtxRef.current = audioCtx;

        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.5;
        source.connect(analyser);

        const timeData = new Uint8Array(analyser.fftSize);

        const canvas = canvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext('2d');
          const render = () => {
            if (!isMounted || !canvas || !ctx) return;

            const rect = canvas.getBoundingClientRect();
            if (canvas.width !== rect.width || canvas.height !== rect.height) {
              canvas.width = rect.width;
              canvas.height = rect.height;
            }

            analyser.getByteTimeDomainData(timeData);
            let sumSquares = 0;
            for (let i = 0; i < timeData.length; i++) {
              const norm = (timeData[i] - 128) / 128;
              sumSquares += norm * norm;
            }
            const rms = Math.sqrt(sumSquares / timeData.length);

            frameCounterRef.current += 1;
            if (frameCounterRef.current >= 4) {
              frameCounterRef.current = 0;
              const targets = targetAmplitudesRef.current;
              for (let i = 0; i < numBars - 1; i++) {
                targets[i] = targets[i + 1];
              }
              targets[numBars - 1] = Math.min(1.0, rms * 3.5);
            }

            const current = currentAmplitudesRef.current;
            const target = targetAmplitudesRef.current;
            for (let i = 0; i < numBars; i++) {
              current[i] += (target[i] - current[i]) * 0.15;
            }

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            const width = canvas.width;
            const height = canvas.height;
            const centerY = height / 2;
            const barGap = 3;
            const totalGap = (numBars - 1) * barGap;
            const barWidth = Math.max(3, Math.min(6, (width - totalGap) / numBars));
            const startX = (width - (numBars * barWidth + totalGap)) / 2;

            for (let i = 0; i < numBars; i++) {
              const x = startX + i * (barWidth + barGap);
              const liveAmp = current[i];
              const minH = 4;
              const maxH = height * 0.85;
              const barH = Math.max(minH, liveAmp * maxH);
              const y = centerY - barH / 2;

              const gradient = ctx.createLinearGradient(0, y, 0, y + barH);
              if (liveAmp > 0.1) {
                gradient.addColorStop(0, '#38bdf8');
                gradient.addColorStop(0.5, '#00e5ff');
                gradient.addColorStop(1, '#0284c7');
              } else {
                gradient.addColorStop(0, 'rgba(56, 189, 248, 0.3)');
                gradient.addColorStop(1, 'rgba(2, 132, 199, 0.3)');
              }

              ctx.fillStyle = gradient;
              ctx.beginPath();
              if (ctx.roundRect) {
                ctx.roundRect(x, y, barWidth, barH, barWidth / 2);
              } else {
                ctx.rect(x, y, barWidth, barH);
              }
              ctx.fill();
            }

            animFrameRef.current = requestAnimationFrame(render);
          };

          animFrameRef.current = requestAnimationFrame(render);
        }

        timerRef.current = window.setInterval(() => {
          if (isMounted) setRecordingTime((t) => t + 1);
        }, 1000);
      } catch (err: any) {
        if (isMounted) {
          console.error('Microphone access error:', err);
          setErrorMsg('Microphone unavailable or permission denied.');
        }
      }
    };

    startRecording();

    return () => {
      isMounted = false;
      cleanup();
    };
  }, []);

  const handleStopAndConfirm = () => {
    const duration = recordingTime;
    const recognizedText = 'Voice message recorded.';

    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = () => {
        const mimeType = recorder.mimeType || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        const audioUrl = URL.createObjectURL(audioBlob);

        cleanup();
        onConfirm({ text: recognizedText, audioBlob, audioUrl, durationSeconds: duration });
      };
      recorder.stop();
    } else {
      const mimeType = 'audio/webm';
      const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
      const audioUrl = audioBlob.size > 0 ? URL.createObjectURL(audioBlob) : undefined;

      cleanup();
      onConfirm({ text: recognizedText, audioBlob: audioBlob.size > 0 ? audioBlob : undefined, audioUrl, durationSeconds: duration });
    }
  };

  const handleCancelClick = () => {
    cleanup();
    audioChunksRef.current = [];
    onCancel();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (errorMsg) {
    return (
      <div className="chat-input-wrapper">
        <div className="chat-input-pill voice-error-pill">
          <AlertCircle size={18} color="#ef4444" />
          <span className="voice-error-text">{errorMsg}</span>
          <button type="button" className="voice-pill-btn btn-cancel" onClick={handleCancelClick} title="Close">
            <X size={18} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-input-wrapper">
      <div className="chat-input-pill voice-recording-pill">
        <div className="voice-rec-timer">
          <span className="rec-dot" />
          <span className="rec-time-text">{formatTime(recordingTime)}</span>
        </div>

        <div className="voice-canvas-container">
          <canvas ref={canvasRef} className="voice-waveform-canvas" />
        </div>

        <div className="voice-pill-actions">
          <button type="button" className="voice-pill-btn btn-cancel" onClick={handleCancelClick} title="Cancel Recording">
            <X size={18} />
          </button>

          <button type="button" className="voice-pill-btn btn-stop" onClick={handleStopAndConfirm} title="Stop Recording">
            <Square size={14} fill="currentColor" />
          </button>

          <button type="button" className="voice-pill-send-btn" onClick={handleStopAndConfirm} title="Send Voice Message">
            <ArrowUp size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};
