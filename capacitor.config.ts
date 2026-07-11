import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.zhulin.chronicle",
  appName: "三国：残卷定乾坤",
  webDir: process.env.CAP_WEB_DIR ?? "dist-ios",
  bundledWebRuntime: false,
  ios: { contentInset: "automatic" }
};

export default config;
