import { describe, it, expect } from 'vitest';
import { convertColorString, sanitizeElementColorsForCanvas, createStyleDeclarationProxy } from '../utils/domSanitizer';

describe('domSanitizer', () => {
  it('passes through standard hex, rgb and named colors untouched', () => {
    expect(convertColorString('#ffffff')).toBe('#ffffff');
    expect(convertColorString('rgb(255, 0, 0)')).toBe('rgb(255, 0, 0)');
    expect(convertColorString('transparent')).toBe('transparent');
  });

  it('converts oklch color string when canvas context is available', () => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const result = convertColorString('oklch(0.5 0.2 120)', ctx);
    expect(result).not.toContain('oklch');
  });

  it('converts oklch inside complex strings like box-shadow', () => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const shadow = '0 1px 3px 0 oklch(0.2 0.05 240 / 0.15)';
    const result = convertColorString(shadow, ctx);
    expect(result).not.toContain('oklch');
  });

  it('intercepts getComputedStyle on clonedDocument to convert oklch values', () => {
    const div = document.createElement('div');
    document.body.appendChild(div);

    // Mock getComputedStyle returning an oklch color
    const origGCS = window.getComputedStyle;
    window.getComputedStyle = () => ({
      color: 'oklch(0.7 0.1 200)',
      backgroundColor: 'rgb(255, 255, 255)',
      getPropertyValue: (prop: string) => {
        if (prop === 'color') return 'oklch(0.7 0.1 200)';
        return 'rgb(255, 255, 255)';
      },
    } as any);

    sanitizeElementColorsForCanvas(document, div);

    const computed = window.getComputedStyle(div);
    expect(computed.color).not.toContain('oklch');
    expect(computed.getPropertyValue('color')).not.toContain('oklch');
    expect(computed.backgroundColor).toBe('rgb(255, 255, 255)');

    window.getComputedStyle = origGCS;
    document.body.removeChild(div);
  });

  it('safely proxies CSSStyleDeclaration properties without Illegal invocation errors', () => {
    const el = document.createElement('div');
    el.style.color = 'rgb(0, 0, 0)';
    el.style.backgroundColor = 'rgb(255, 255, 255)';
    document.body.appendChild(el);

    const realDecl = window.getComputedStyle(el);
    const proxied = createStyleDeclarationProxy(realDecl);

    // Native getters like length, item, getPropertyValue must not throw "Illegal invocation"
    expect(typeof proxied.length).toBe('number');
    expect(typeof proxied.getPropertyValue).toBe('function');
    expect(proxied.getPropertyValue('color')).toBeDefined();

    document.body.removeChild(el);
  });
});


