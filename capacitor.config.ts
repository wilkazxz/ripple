import type { CapacitorConfig } from "@capacitor/cli";

// appId = ID unik aplikasi di HP (huruf kecil + titik). appName = nama di bawah ikon.
const config: CapacitorConfig = {
  appId: "com.wilka.app",
  appName: "RIPPLE",
  webDir: "dist",
  android: { allowMixedContent: false },
};

export default config;
