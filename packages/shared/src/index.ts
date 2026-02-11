// WebSocket message types between server and component

export interface VisemeCue {
  time: number;
  shape: string;
  weight: number;
  duration: number;
}

export interface AssistantAudioMessage {
  type: "assistant.audio";
  audio: ArrayBuffer;
  visemes: VisemeCue[];
  sentenceIndex: number;
  isFinal: boolean;
}

export interface AssistantStartMessage {
  type: "assistant.start";
}

export interface AssistantDoneMessage {
  type: "assistant.done";
}

export interface AssistantEmptyMessage {
  type: "assistant.empty";
}

export interface ErrorMessage {
  type: "error";
  message: string;
  recoverable: boolean;
}

export type ServerMessage =
  | AssistantAudioMessage
  | AssistantStartMessage
  | AssistantDoneMessage
  | AssistantEmptyMessage
  | ErrorMessage;

export interface UserAudioMessage {
  type: "user.audio";
  audio: ArrayBuffer;
}

export type ClientMessage = UserAudioMessage;

export interface Message {
  role: "user" | "assistant";
  content: string;
}

// Rhubarb shape to ARKit blendshape mapping
export const RHUBARB_TO_ARKIT: Record<string, Record<string, number>> = {
  X: {},
  A: { jawOpen: 0, mouthClose: 1 },
  B: { jawOpen: 0.2, mouthClose: 0 },
  C: { jawOpen: 0.5, mouthFunnel: 0.3, mouthOpen: 0.7 },
  D: { jawOpen: 0.8, mouthOpen: 1.0 },
  E: { jawOpen: 0.4, mouthPucker: 0.6 },
  F: { jawOpen: 0.2, mouthPucker: 0.9 },
  G: { jawOpen: 0.1, mouthFunnel: 0.5, mouthClose: 0.3 },
  H: { jawOpen: 0.3, mouthOpen: 0.4 },
};

export { mapRhubarbToVisemes, interpolateVisemes } from "./viseme-mapper.js";
