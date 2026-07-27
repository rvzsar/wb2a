export const CONFIG = {
  wandbBaseUrl: "https://api.inference.wandb.ai",
  apiVersion: "/v1",
  cors: {
    origins: ["*"],
    methods: ["GET", "POST", "OPTIONS"],
    headers: ["Content-Type", "Authorization", "User-Agent"]
  }
} as const;