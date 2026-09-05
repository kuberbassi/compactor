import html2canvas from 'html2canvas';

/**
 * Converts an OKLCH color string into an rgb(...) or rgba(...) string via exact colorimetry math.
 */
export const oklchToRgbString = (oklchStr: string): string => {
  try {
    const match = oklchStr.match(/oklch\(\s*([\d.]+%?)\s+([\d.]+%?)\s+([\d.]+(?:deg|rad|turn)?)\s*(?:\/\s*([\d.]+%?))?\s*\)/i);
    if (!match) return 'rgb(0, 0, 0)';

    const L_raw = match[1];
    const C_raw = match[2];
    const H_raw = match[3];
    const A_raw = match[4];

    // Lightness: 0..1 or 0..100%
    let L = L_raw.endsWith('%') ? parseFloat(L_raw) / 100 : parseFloat(L_raw);
    // Chroma: 0..0.4 or percentage (100% = 0.4)
    let C = C_raw.endsWith('%') ? (parseFloat(C_raw) / 100) * 0.4 : parseFloat(C_raw);
    // Hue: degrees (default), rad, or turn
    let H = 0;
    if (H_raw.endsWith('deg')) H = parseFloat(H_raw);
    else if (H_raw.endsWith('rad')) H = parseFloat(H_raw) * (180 / Math.PI);
    else if (H_raw.endsWith('turn')) H = parseFloat(H_raw) * 360;
    else H = parseFloat(H_raw);

    // Alpha: 0..1 or 0..100%
    let A = 1;
    if (A_raw) {
      A = A_raw.endsWith('%') ? parseFloat(A_raw) / 100 : parseFloat(A_raw);
    }

    if (isNaN(L)) L = 0;
    if (isNaN(C)) C = 0;
    if (isNaN(H)) H = 0;
    if (isNaN(A)) A = 1;

    const hRad = (H * Math.PI) / 180;
    const a = C * Math.cos(hRad);
    const b = C * Math.sin(hRad);

    const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
    const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
    const s_ = L - 0.0894841775 * a - 1.2914855480 * b;

    const l = l_ * l_ * l_;
    const m = m_ * m_ * m_;
    const s = s_ * s_ * s_;

    const r_lin = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
    const g_lin = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
    const b_lin = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;

    const gamma = (x: number) => {
      if (x <= 0) return 0;
      if (x >= 1) return 1;
      return x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055;
    };

    const r = Math.min(255, Math.max(0, Math.round(gamma(r_lin) * 255)));
    const g = Math.min(255, Math.max(0, Math.round(gamma(g_lin) * 255)));
    const b_val = Math.min(255, Math.max(0, Math.round(gamma(b_lin) * 255)));

    if (A < 1) {
      return `rgba(${r}, ${g}, ${b_val}, ${Math.round(A * 1000) / 1000})`;
    }
    return `rgb(${r}, ${g}, ${b_val})`;
  } catch {
    return 'rgb(0, 0, 0)';
  }
};

/**
 * Converts any modern color function (oklch, lab, lch, color) in a CSS value string to sRGB rgb/rgba/hex.
 */
export const convertColorString = (str: string, ctx?: CanvasRenderingContext2D | null): string => {
  if (!str || typeof str !== 'string') return str;
  if (!str.includes('oklch') && !str.includes('color(') && !str.includes('lab(') && !str.includes('lch(')) {
    return str;
  }

  // Handle oklch
  let converted = str.replace(/oklch\([^()]*(?:\([^()]*\)[^()]*)*\)/gi, (match) => {
    if (ctx) {
      try {
        ctx.fillStyle = '#000000';
        ctx.fillStyle = match;
        if (ctx.fillStyle && !ctx.fillStyle.includes('oklch')) {
          return ctx.fillStyle;
        }
      } catch {
        // use math fallback
      }
    }
    return oklchToRgbString(match);
  });

  // Handle color(), lab(), lch()
  converted = converted.replace(/(?:lab|lch|color)\([^()]*(?:\([^()]*\)[^()]*)*\)/gi, (match) => {
    if (ctx) {
      try {
        ctx.fillStyle = '#000000';
        ctx.fillStyle = match;
        if (ctx.fillStyle && !ctx.fillStyle.includes('color(') && !ctx.fillStyle.includes('lab') && !ctx.fillStyle.includes('lch')) {
          return ctx.fillStyle;
        }
      } catch {
        // fallback
      }
    }
    return 'rgb(0, 0, 0)';
  });

  return converted;
};

export const createStyleDeclarationProxy = (decl: CSSStyleDeclaration, ctx?: CanvasRenderingContext2D | null): CSSStyleDeclaration => {
  return new Proxy(decl, {
    get(target, prop) {
      if (prop === 'getPropertyValue') {
        return (propName: string) => {
          const val = target.getPropertyValue(propName);
          return convertColorString(val, ctx);
        };
      }
      if (prop === 'item') {
        return (index: number) => target.item(index);
      }
      try {
        const val = (target as any)[prop];
        if (typeof val === 'function') {
          return val.bind(target);
        }
        if (typeof val === 'string') {
          return convertColorString(val, ctx);
        }
        return val;
      } catch {
        return (target as any)[prop];
      }
    },
  });
};

/**
 * Sanitizes all elements, styles, and computed declarations within a cloned document before html2canvas processes it.
 */
export const sanitizeElementColorsForCanvas = (clonedDocument: Document, rootElement?: HTMLElement | null): void => {
  try {
    let ctx: CanvasRenderingContext2D | null = null;
    try {
      const canvas = clonedDocument.createElement('canvas');
      canvas.width = 1;
      canvas.height = 1;
      ctx = canvas.getContext('2d');
    } catch {
      // ctx can be null, fallback will use math parser
    }

    const win = clonedDocument.defaultView || (typeof window !== 'undefined' ? window : null);
    if (win && win.getComputedStyle) {
      const origGetComputedStyle = win.getComputedStyle.bind(win);
      win.getComputedStyle = function (elt: Element, pseudoElt?: string | null) {
        const originalDecl = origGetComputedStyle(elt, pseudoElt);
        return createStyleDeclarationProxy(originalDecl, ctx);
      };
    }

    // Sanitize style tags
    const styleTags = Array.from(clonedDocument.querySelectorAll<HTMLStyleElement>('style'));
    for (const tag of styleTags) {
      if (tag.textContent && (tag.textContent.includes('oklch') || tag.textContent.includes('color(') || tag.textContent.includes('lab(') || tag.textContent.includes('lch('))) {
        tag.textContent = convertColorString(tag.textContent, ctx);
      }
    }

    // Walk all elements and normalize any inline style attributes
    const target = rootElement || clonedDocument.body;
    if (target) {
      const elements = [target, ...Array.from(target.querySelectorAll<HTMLElement>('*'))];
      for (const el of elements) {
        if (!el.style) continue;
        for (let i = 0; i < el.style.length; i++) {
          const propName = el.style[i];
          const val = el.style.getPropertyValue(propName);
          if (val && (val.includes('oklch') || val.includes('color(') || val.includes('lab(') || val.includes('lch('))) {
            const converted = convertColorString(val, ctx);
            el.style.setProperty(propName, converted, el.style.getPropertyPriority(propName));
          }
        }
      }
    }
  } catch {
    // Non-fatal safety guard
  }
};

/**
 * Drop-in replacement for html2canvas that completely shields against modern CSS color crashes (oklch, color, lab, lch).
 */
export const safeHtml2Canvas = async (element: HTMLElement, options: any = {}): Promise<HTMLCanvasElement> => {
  const win = typeof window !== 'undefined' ? window : null;
  const origGetComputedStyle = win?.getComputedStyle;

  let ctx: CanvasRenderingContext2D | null = null;
  if (typeof document !== 'undefined') {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 1;
      canvas.height = 1;
      ctx = canvas.getContext('2d');
    } catch {
      // ignore
    }
  }

  if (win && origGetComputedStyle) {
    win.getComputedStyle = function (elt: Element, pseudoElt?: string | null) {
      const originalDecl = origGetComputedStyle.call(win, elt, pseudoElt);
      return createStyleDeclarationProxy(originalDecl, ctx);
    };
  }

  const originalOnClone = options.onclone;
  const mergedOptions = {
    ...options,
    onclone: (clonedDoc: Document, clonedEl: HTMLElement) => {
      sanitizeElementColorsForCanvas(clonedDoc, clonedEl);
      if (originalOnClone) {
        originalOnClone(clonedDoc, clonedEl);
      }
    },
  };

  try {
    return await html2canvas(element, mergedOptions);
  } finally {
    if (win && origGetComputedStyle) {
      win.getComputedStyle = origGetComputedStyle;
    }
  }
};
