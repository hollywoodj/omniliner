/// <reference types="vite/client" />

interface OmniLinerDesktop {
  platform: string;
  isElectron?: boolean;
  openExternal?: (url: string) => Promise<void> | void;
  onOpenUrl?: (cb: (url: string) => void) => () => void;
}

interface Window {
  omnilinerDesktop?: OmniLinerDesktop;
}
