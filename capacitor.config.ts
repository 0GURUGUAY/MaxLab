import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.maxpatissier.maxlab",
  appName: "MaxLab",
  webDir: "dist",
  android: {
    allowMixedContent: false,
  },
  plugins: {
    SystemBars: {
      insetsHandling: "native",
      hidden: false,
    },
  },
};

export default config;
