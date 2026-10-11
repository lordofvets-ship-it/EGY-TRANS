import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  if (typeof document !== 'undefined') cleanup();
});

if (typeof window !== 'undefined') {
  if (!window.matchMedia) {
    window.matchMedia = ((q: string) => ({ matches: false, media: q, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; } })) as any;
  }
  (window as any).scrollTo = () => {};
  if (!(window as any).URL.createObjectURL) (window as any).URL.createObjectURL = () => 'blob:mock';
  if (!(window as any).URL.revokeObjectURL) (window as any).URL.revokeObjectURL = () => {};
  (window.HTMLElement.prototype as any).scrollIntoView = function () {};
  (window.HTMLMediaElement.prototype as any).play = function () { return Promise.resolve(); };
  (window.HTMLMediaElement.prototype as any).pause = function () {};
  // jsdom does not implement media timing; emulate a settable currentTime so seek behaviour can be asserted
  Object.defineProperty(window.HTMLMediaElement.prototype, 'currentTime', {
    configurable: true,
    get() { return (this as any).__t || 0; },
    set(v: number) { (this as any).__t = v; },
  });
}
