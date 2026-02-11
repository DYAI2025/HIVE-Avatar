"use client";

import { AvatarView } from "@dyai/avatar-component";
import { useState } from "react";

export default function Home() {
  const [status, setStatus] = useState("Loading...");

  // Check for ?mode=2d URL param
  const force2d =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("mode") === "2d";

  return (
    <div style={{ textAlign: "center" }}>
      <h1
        style={{
          color: "white",
          fontFamily: "system-ui",
          fontSize: 24,
          marginBottom: 16,
        }}
      >
        Avatar Realtime
      </h1>

      <AvatarView
        serverUrl={
          process.env.NEXT_PUBLIC_AVATAR_SERVER ?? "ws://localhost:3100/ws"
        }
        avatarUrl="/models/default.vrm"
        width={640}
        height={480}
        force2d={force2d}
        onStateChange={(state) => setStatus(state)}
        onReady={() => setStatus("Ready")}
        onError={(err) => setStatus(`Error: ${err}`)}
        className="avatar-canvas"
      />

      <p
        style={{
          color: "#888",
          fontFamily: "system-ui",
          fontSize: 14,
          marginTop: 12,
        }}
      >
        {status} — Hold the button to speak
      </p>
    </div>
  );
}
