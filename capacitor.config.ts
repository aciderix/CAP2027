import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'fr.cap2027.app',
  appName: 'CAP 2027',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
  },
};

export default config;
