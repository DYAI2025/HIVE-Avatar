import { useRef, useCallback, useState, useEffect } from "react";
import { AvatarScene } from "../three/AvatarScene.js";
import { interpolateVisemes, type VisemeCue } from "@dyai/avatar-shared";

export type AvatarState = "idle" | "listening" | "thinking" | "speaking";

export function useAvatar(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  const sceneRef = useRef<AvatarScene | null>(null);
  const [state, setState] = useState<AvatarState>("idle");
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Audio playback
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioQueueRef = useRef<{ buffer: AudioBuffer; visemes: VisemeCue[] }[]>([]);
  const playingRef = useRef(false);
  const visemesRef = useRef<VisemeCue[]>([]);
  const audioStartTimeRef = useRef(0);

  const initScene = useCallback(
    (width: number, height: number) => {
      if (!canvasRef.current || sceneRef.current) return;
      try {
        sceneRef.current = new AvatarScene(canvasRef.current, width, height);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to initialize 3D scene");
      }
    },
    [canvasRef],
  );

  const loadAvatar = useCallback(async (url: string) => {
    if (!sceneRef.current) return;
    await sceneRef.current.loadAvatar(url);
    setLoaded(true);
  }, []);

  const queueAudio = useCallback(
    async (audioData: ArrayBuffer, visemes: VisemeCue[]) => {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContext();
      }
      const ctx = audioCtxRef.current;
      const buffer = await ctx.decodeAudioData(audioData.slice(0));
      audioQueueRef.current.push({ buffer, visemes });
      playNextInQueue();
    },
    [],
  );

  const playNextInQueue = useCallback(() => {
    if (playingRef.current || audioQueueRef.current.length === 0) return;
    if (!audioCtxRef.current) return;

    const ctx = audioCtxRef.current;
    const { buffer, visemes } = audioQueueRef.current.shift()!;

    playingRef.current = true;
    visemesRef.current = visemes;
    audioStartTimeRef.current = ctx.currentTime;
    setState("speaking");

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.onended = () => {
      playingRef.current = false;
      visemesRef.current = [];
      if (audioQueueRef.current.length > 0) {
        playNextInQueue();
      } else {
        setState("idle");
      }
    };
    source.start();
  }, []);

  // Animation loop
  useEffect(() => {
    let animFrame: number;

    const animate = () => {
      animFrame = requestAnimationFrame(animate);
      if (!sceneRef.current) return;

      // Apply lipsync visemes if speaking
      if (playingRef.current && audioCtxRef.current) {
        const elapsed =
          audioCtxRef.current.currentTime - audioStartTimeRef.current;
        const shapes = interpolateVisemes(visemesRef.current, elapsed);
        sceneRef.current.setBlendshapes(shapes);
      } else {
        sceneRef.current.setBlendshapes({});
      }

      sceneRef.current.update();
    };

    animate();
    return () => cancelAnimationFrame(animFrame);
  }, []);

  return {
    state,
    setState,
    loaded,
    error,
    initScene,
    loadAvatar,
    queueAudio,
  };
}
