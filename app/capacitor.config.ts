import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mtmad.mtmacro',
  appName: 'MT Macro',
  webDir: 'dist',
  backgroundColor: '#10201e',
  plugins: {
    // Fullscreen: hide status + navigation bars; the page draws edge-to-edge (viewport-fit=cover)
    // and pads itself with the injected --safe-area-inset-* CSS vars (camera cutout).
    SystemBars: {
      hidden: true,
      insetsHandling: 'css',
      initialViewportFitValueHint: 'cover',
    },
  },
};

export default config;
