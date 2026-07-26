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
