/// <reference types="@capacitor/background-runner" />
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'fr.cap2027.app',
  appName: 'CAP 2027',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
  },
  plugins: {
    // Wakes ~hourly even with the app killed and asks Supabase if
    // there are new articles. See public/background.js for the logic.
    // Android enforces a minimum interval of 15 minutes; the OS may
    // delay further based on Doze / battery / vendor restrictions.
    BackgroundRunner: {
      label: 'fr.cap2027.app.checkArticles',
      src: 'background.js',
      event: 'checkArticles',
      repeat: true,
      interval: 60,
      autoStart: true,
    },
  },
};

export default config;
