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

  // Full width live audio waveform bars
  const numBars = 36;
  const targetAmplitudesRef = useRef<Float32Array>(new Float32Array(numBars));
  const currentAmplitudesRef = useRef<Float32Array>(new Float32Array(numBars));
  const frameCounterRef = useRef<number>(0);

  // Clean up all audio, MediaRecorder, and animation resources
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
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // Ignore recorder stop errors
      }
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
        // 1. Request real microphone MediaStream
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (!isMounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        mediaStreamRef.current = stream;

        // 2. Initialize MediaRecorder for actual audio Blob recording
        audioChunksRef.current = [];
        let mimeType = '';
        const candidateTypes = [
          'audio/webm;codecs=opus',
          'audio/webm',
          'audio/ogg;codecs=opus',
          'audio/mp4',
        ];
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

        // 3. Setup Web Audio API Analyser for real-time RMS amplitude analysis
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        const audioCtx = new AudioCtx();
        audioCtxRef.current = audioCtx;

        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.5;
        source.connect(analyser);

        const timeData = new Uint8Array(analyser.fftSize);

        // 4. Real Microphone Waveform Render Loop
        const canvas = canvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext('2d');

          const render = () => {
            if (!isMounted || !canvas || !ctx) return;

            // Handle canvas high-DPI scaling
            const rect = canvas.getBoundingClientRect();
            if (canvas.width !== rect.width || canvas.height !== rect.height) {
              canvas.width = rect.width;
              canvas.height = rect.height;
            }

            // Real Time-Domain RMS Amplitude calculation
            analyser.getByteTimeDomainData(timeData);
            let sumSquares = 0;
            for (let i = 0; i < timeData.length; i++) {
              const norm = (timeData[i] - 128) / 128; // -1.0 to +1.0
              sumSquares += norm * norm;
            }
            const rms = Math.sqrt(sumSquares / timeData.length); // Real mic volume 0.0 to ~1.0

            // Slow down right-to-left wave travel speed (shift target buffer every 4 frames ~ 66ms)
            frameCounterRef.current += 1;
            if (frameCounterRef.current >= 4) {
              frameCounterRef.current = 0;
              const targets = targetAmplitudesRef.current;
              for (let i = 0; i < numBars - 1; i++) {
                targets[i] = targets[i + 1];
              }
              // Push latest real mic volume amplitude to rightmost end of waveform
              targets[numBars - 1] = Math.min(1.0, rms * 3.5);
            }

            // Smoothly interpolate current bar heights towards targets for fluid 60fps motion
            const current = currentAmplitudesRef.current;
            const target = targetAmplitudesRef.current;
            for (let i = 0; i < numBars; i++) {
              current[i] += (target[i] - current[i]) * 0.15;
            }

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            const width = canvas.width;
            const height = canvas.height;
            const centerY = height / 2;
            const barGap = 3.5;
            const totalGap = (numBars - 1) * barGap;
            const barWidth = Math.max(3, Math.min(6, (width - totalGap) / numBars));
            const startX = (width - (numBars * barWidth + totalGap)) / 2;

            // Render Live Audio Waveform across full width (from leftmost bar to rightmost bar)
            for (let i = 0; i < numBars; i++) {
              const x = startX + i * (barWidth + barGap);
              const liveAmp = current[i];
              const minH = 4;
              const maxH = height * 0.88;
              const barH = Math.max(minH, liveAmp * maxH);
              const y = centerY - barH / 2;

              // Audio-reactive blue gradient
              const gradient = ctx.createLinearGradient(0, y, 0, y + barH);
              if (liveAmp > 0.12) {
                gradient.addColorStop(0, '#60a5fa');
                gradient.addColorStop(0.5, '#3b9eff');
                gradient.addColorStop(1, '#1d4ed8');
              } else {
                gradient.addColorStop(0, 'rgba(59, 158, 255, 0.35)');
                gradient.addColorStop(1, 'rgba(29, 78, 216, 0.35)');
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

        // 5. Timer Counter
        timerRef.current = window.setInterval(() => {
          if (isMounted) {
            setRecordingTime((t) => t + 1);
          }
        }, 1000);
      } catch (err: any) {
        if (isMounted) {
          console.error('Microphone access error:', err);
          setErrorMsg('Microphone access denied or unavailable.');
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
    const recognizedText = 'Voice note recorded.';

    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = () => {
        const mimeType = recorder.mimeType || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        const audioUrl = URL.createObjectURL(audioBlob);

        cleanup();
        onConfirm({
          text: recognizedText,
          audioBlob,
          audioUrl,
          durationSeconds: duration,
        });
      };
      recorder.stop();
    } else {
      const mimeType = 'audio/webm';
      const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
      const audioUrl = audioBlob.size > 0 ? URL.createObjectURL(audioBlob) : undefined;

      cleanup();
      onConfirm({
        text: recognizedText,
        audioBlob: audioBlob.size > 0 ? audioBlob : undefined,
        audioUrl,
        durationSeconds: duration,
      });
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
      <div className="voice-waveform-container voice-error">
        <div className="voice-error-text">
          <AlertCircle size={16} className="error-icon" />
          <span>{errorMsg}</span>
        </div>
        <button type="button" className="voice-ctrl-btn btn-cancel-voice" onClick={handleCancelClick} title="Close">
          <X size={18} />
        </button>
      </div>
    );
  }

  return (
    <div className="voice-waveform-container">
      <div className="voice-status-badge">
        <span className="recording-dot" />
        <span className="recording-time">{formatTime(recordingTime)}</span>
      </div>

      <div className="waveform-canvas-wrapper">
        <canvas ref={canvasRef} className="waveform-canvas" />
      </div>

      <div className="voice-controls">
        <button
          type="button"
          className="voice-ctrl-btn btn-cancel-voice"
          onClick={handleCancelClick}
          title="Cancel recording"
          aria-label="Cancel recording"
        >
          <X size={18} />
        </button>

        <button
          type="button"
          className="voice-ctrl-btn btn-stop-voice"
          onClick={handleStopAndConfirm}
          title="Stop & save audio"
          aria-label="Stop & save audio"
        >
          <Square size={15} />
        </button>

        <button
          type="button"
          className="voice-ctrl-btn btn-confirm-voice"
          onClick={handleStopAndConfirm}
          title="Submit voice message"
          aria-label="Submit voice message"
        >
          <ArrowUp size={18} />
        </button>
      </div>
    </div>
  );
};
