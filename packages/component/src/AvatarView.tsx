import { useRef, useEffect, useCallback } from "react";
import { useWebSocket } from "./hooks/useWebSocket.js";
import { useAvatar, type AvatarState } from "./hooks/useAvatar.js";

export interface AvatarViewProps {
  serverUrl: string;
  avatarUrl: string;
  width?: number;
  height?: number;
  onStateChange?: (state: AvatarState) => void;
  onError?: (error: string) => void;
  onReady?: () => void;
  className?: string;
}

const STATE_COLORS: Record<AvatarState, string> = {
  idle: "#3b82f6",
  listening: "#ef4444",
  thinking: "#f59e0b",
  speaking: "#22c55e",
};

const STATE_LABELS: Record<AvatarState, string> = {
  idle: "Ready",
  listening: "Listening...",
  thinking: "Thinking...",
  speaking: "Speaking...",
};

export function AvatarView({
  serverUrl,
  avatarUrl,
  width = 640,
  height = 480,
  onStateChange,
  onError,
  onReady,
  className,
}: AvatarViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const pendingVisemesRef = useRef<any>(null);

  const { state, setState, loaded, error: sceneError, initScene, loadAvatar, queueAudio } =
    useAvatar(canvasRef);

  const is2D = !!sceneError;

  // Notify parent of state changes
  useEffect(() => {
    onStateChange?.(state);
  }, [state, onStateChange]);

  // Handle WebSocket messages
  const handleJson = useCallback(
    (data: any) => {
      switch (data.type) {
        case "assistant.start":
          setState("thinking");
          break;
        case "assistant.audio":
          pendingVisemesRef.current = data.visemes;
          break;
        case "assistant.done":
          // State transitions handled by audio queue
          break;
        case "assistant.empty":
          setState("idle");
          break;
        case "error":
          onError?.(data.message);
          setState("idle");
          break;
      }
    },
    [setState, onError],
  );

  const handleBinary = useCallback(
    (data: ArrayBuffer) => {
      // Binary follows JSON viseme message
      const visemes = pendingVisemesRef.current ?? [];
      pendingVisemesRef.current = null;
      queueAudio(data, visemes);
    },
    [queueAudio],
  );

  const { connected, sendBinary } = useWebSocket({
    url: serverUrl,
    onJsonMessage: handleJson,
    onBinaryMessage: handleBinary,
  });

  // Init Three.js scene (will set sceneError if WebGL fails)
  useEffect(() => {
    initScene(width, height);
  }, [initScene, width, height]);

  // Load avatar model (skip if scene failed to init)
  useEffect(() => {
    if (loaded || sceneError) return;
    loadAvatar(avatarUrl).then(() => onReady?.());
  }, [avatarUrl, loaded, sceneError, loadAvatar, onReady]);

  // In 2D mode, mark as ready immediately
  useEffect(() => {
    if (is2D && connected) onReady?.();
  }, [is2D, connected, onReady]);

  // Push-to-Talk handlers
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, {
        mimeType: "audio/webm;codecs=opus",
      });

      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const buffer = await blob.arrayBuffer();
        sendBinary(buffer);
        setState("thinking");

        // Stop all tracks
        stream.getTracks().forEach((t) => t.stop());
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setState("listening");
    } catch {
      onError?.("Microphone access denied");
    }
  }, [sendBinary, setState, onError]);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
  }, []);

  const pttDisabled = !connected || (!is2D && !loaded) || state === "thinking" || state === "speaking";
  const stateColor = STATE_COLORS[state];

  // ---------- 2D Fallback Mode ----------
  if (is2D) {
    const pulseRing = state === "speaking" || state === "listening";

    return (
      <div
        className={className}
        style={{
          position: "relative",
          width,
          height,
          background: "linear-gradient(135deg, #0f0c29 0%, #1a1a2e 50%, #16213e 100%)",
          borderRadius: 12,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, -apple-system, sans-serif",
          overflow: "hidden",
          userSelect: "none",
        }}
      >
        {/* Connection indicator */}
        <div
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: connected ? "#22c55e" : "#ef4444",
              boxShadow: connected ? "0 0 8px #22c55e80" : "0 0 8px #ef444480",
            }}
          />
          <span style={{ color: "#888", fontSize: 11 }}>
            {connected ? "Connected" : "Disconnected"}
          </span>
        </div>

        {/* Avatar circle */}
        <div style={{ position: "relative", marginBottom: 24 }}>
          {/* Pulse ring */}
          {pulseRing && (
            <div
              style={{
                position: "absolute",
                inset: -12,
                borderRadius: "50%",
                border: `2px solid ${stateColor}60`,
                animation: "avatar-pulse 1.5s ease-in-out infinite",
              }}
            />
          )}
          <div
            style={{
              width: 120,
              height: 120,
              borderRadius: "50%",
              background: `linear-gradient(135deg, ${stateColor}40 0%, ${stateColor}20 100%)`,
              border: `3px solid ${stateColor}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 48,
              transition: "border-color 0.3s, background 0.3s",
              boxShadow: `0 0 30px ${stateColor}30`,
            }}
          >
            {state === "listening"
              ? "\uD83D\uDD34"
              : state === "thinking"
                ? "\uD83E\uDD14"
                : state === "speaking"
                  ? "\uD83D\uDDE3\uFE0F"
                  : "\uD83E\uDD16"}
          </div>
        </div>

        {/* Status */}
        <div
          style={{
            color: stateColor,
            fontSize: 14,
            fontWeight: 600,
            marginBottom: 8,
            transition: "color 0.3s",
          }}
        >
          {STATE_LABELS[state]}
        </div>

        <div style={{ color: "#666", fontSize: 11, marginBottom: 32 }}>
          2D Mode — Hold button to speak
        </div>

        {/* PTT Button */}
        <button
          onPointerDown={startRecording}
          onPointerUp={stopRecording}
          onPointerLeave={stopRecording}
          disabled={pttDisabled}
          style={{
            width: 72,
            height: 72,
            borderRadius: "50%",
            border: "none",
            cursor: pttDisabled ? "not-allowed" : "pointer",
            background: state === "listening"
              ? "#ef4444"
              : state === "thinking"
                ? "#f59e0b"
                : "#3b82f6",
            color: "white",
            fontSize: 28,
            opacity: pttDisabled ? 0.4 : 1,
            transition: "background 0.2s, opacity 0.2s, transform 0.1s",
            transform: state === "listening" ? "scale(1.1)" : "scale(1)",
            boxShadow: state === "listening"
              ? "0 0 20px #ef444480"
              : "0 4px 12px rgba(0,0,0,0.3)",
          }}
        >
          {state === "listening" ? "\u25CF" : state === "thinking" ? "\u2026" : "\uD83C\uDFA4"}
        </button>

        {/* CSS animation */}
        <style>{`
          @keyframes avatar-pulse {
            0%, 100% { transform: scale(1); opacity: 0.6; }
            50% { transform: scale(1.15); opacity: 0; }
          }
        `}</style>
      </div>
    );
  }

  // ---------- 3D WebGL Mode ----------
  return (
    <div className={className} style={{ position: "relative", width, height }}>
      <canvas ref={canvasRef} width={width} height={height} />

      {/* Connection indicator */}
      <div
        style={{
          position: "absolute",
          top: 8,
          right: 8,
          width: 10,
          height: 10,
          borderRadius: "50%",
          background: connected ? "#22c55e" : "#ef4444",
        }}
      />

      {/* PTT Button */}
      <button
        onPointerDown={startRecording}
        onPointerUp={stopRecording}
        onPointerLeave={stopRecording}
        disabled={pttDisabled}
        style={{
          position: "absolute",
          bottom: 16,
          left: "50%",
          transform: "translateX(-50%)",
          width: 64,
          height: 64,
          borderRadius: "50%",
          border: "none",
          cursor: "pointer",
          background:
            state === "listening"
              ? "#ef4444"
              : state === "thinking"
                ? "#f59e0b"
                : "#3b82f6",
          color: "white",
          fontSize: 24,
          opacity: pttDisabled ? 0.5 : 1,
        }}
      >
        {state === "listening" ? "\u25CF" : state === "thinking" ? "\u2026" : "\uD83C\uDFA4"}
      </button>
    </div>
  );
}
