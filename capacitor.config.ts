import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.recordbook.app',
  appName: 'Record Book',
  webDir: 'out',
  server: {
    url: 'https://aikhata.vercel.app',
    cleartext: false,
    androidScheme: 'https',
  },
};

export default config;
