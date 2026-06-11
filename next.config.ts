import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // The Agent SDK spawns its bundled Claude Code CLI as a subprocess;
  // bundling it would break the executable's path resolution.
  serverExternalPackages: ["@anthropic-ai/claude-agent-sdk"],
}

export default nextConfig
