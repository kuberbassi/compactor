import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Automatically unmount React trees after each test
afterEach(() => {
  cleanup();
});

// Mock window.scrollTo
Object.defineProperty(window, 'scrollTo', {
  writable: true,
  value: () => {},
});

// Mock requestAnimationFrame & cancelAnimationFrame
if (!window.requestAnimationFrame) {
  window.requestAnimationFrame = (callback: FrameRequestCallback) => setTimeout(callback, 0) as unknown as number;
}
if (!window.cancelAnimationFrame) {
  window.cancelAnimationFrame = (id: number) => clearTimeout(id);
}

// Polyfill DOMMatrix & Path2D for PDF.js under JSDOM
if (typeof globalThis.DOMMatrix === 'undefined') {
  globalThis.DOMMatrix = class DOMMatrix {
    a = 1; b = 0; c = 0; d = 1; e = 0; f = 0;
    m11 = 1; m12 = 0; m13 = 0; m14 = 0;
    m21 = 0; m22 = 1; m23 = 0; m24 = 0;
    m31 = 0; m32 = 0; m33 = 1; m34 = 0;
    m41 = 0; m42 = 0; m43 = 0; m44 = 1;
    is2D = true;
    isIdentity = true;
    transformPoint(point?: any) { return point || { x: 0, y: 0, z: 0, w: 1 }; }
  } as any;
}

if (typeof globalThis.Path2D === 'undefined') {
  globalThis.Path2D = class Path2D {} as any;
}
