import type { NextConfig } from "next";
import path from "node:path";

const config: NextConfig = {
  transpilePackages: ["@dyai/avatar-component", "@dyai/avatar-shared"],
  turbopack: {
    root: path.resolve(__dirname, "../.."),
  },
};

export default config;
