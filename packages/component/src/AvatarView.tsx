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

  // Init Three.js scene
  useEffect(() => {
    initScene(width, height);
  }, [initScene, width, height]);

  // Load avatar model (skip if scene failed to init)
  useEffect(() => {
    if (loaded || sceneError) return;
    loadAvatar(avatarUrl).then(() => onReady?.());
  }, [avatarUrl, loaded, sceneError, loadAvatar, onReady]);

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

  // Report scene errors to parent
  useEffect(() => {
    if (sceneError) onError?.(sceneError);
  }, [sceneError, onError]);

  if (sceneError) {
    return (
      <div
        className={className}
        style={{
          width,
          height,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#1a1a2e",
          color: "#e0e0e0",
          padding: 24,
          textAlign: "center",
          fontFamily: "system-ui, sans-serif",
          borderRadius: 8,
        }}
      >
        <div>
          <div style={{ fontSize: 48, marginBottom: 16 }}>&#x1F3AD;</div>
          <div style={{ fontSize: 14, marginBottom: 8, fontWeight: 600 }}>WebGL Not Available</div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>{sceneError}</div>
        </div>
      </div>
    );
  }

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
        disabled={!connected || !loaded || state === "thinking" || state === "speaking"}
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
          opacity: !connected || !loaded ? 0.5 : 1,
        }}
      >
        {state === "listening" ? "\u25cf" : state === "thinking" ? "\u2026" : "\ud83c\udfa4"}
      </button>
    </div>
  );
}
