/**
 * Pure client-side raster-to-SVG vector contour tracer (simplified Potrace trace helper)
 */

interface Point {
  x: number;
  y: number;
}

/**
 * Traces contours from an HTMLImageElement and compiles a valid scale-independent SVG string
 */
export const traceImageToSvg = async (imageFile: File, options = { threshold: 128, scale: 1.0 }): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(imageFile);
    
    img.onload = () => {
      URL.revokeObjectURL(url);
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error("Could not construct 2D canvas context"));
        return;
      }
      
      canvas.width = w;
      canvas.height = h;
      ctx.drawImage(img, 0, 0);
      
      const imgData = ctx.getImageData(0, 0, w, h);
      const data = imgData.data;
      
      // 1. Create a binary mask (visited map and black/white grid)
      const binaryGrid = new Uint8Array(w * h);
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i+1];
        const b = data[i+2];
        const a = data[i+3];
        
        // If transparent or bright, treat as white (0). If dark, treat as black (1)
        const gray = 0.299 * r + 0.587 * g + 0.114 * b;
        binaryGrid[i / 4] = (a > 50 && gray < options.threshold) ? 1 : 0;
      }
      
      // Visited array to prevent infinite re-tracing
      const visited = new Uint8Array(w * h);
      const paths: string[] = [];
      
      // 2. Moore-Neighbor boundary tracing algorithm
      const getPixel = (x: number, y: number): number => {
        if (x < 0 || x >= w || y < 0 || y >= h) return 0;
        return binaryGrid[y * w + x];
      };
      
      const traceContour = (startX: number, startY: number): Point[] => {
        const contour: Point[] = [];
        let currX = startX;
        let currY = startY;
        
        // Directions clockwise: North, NorthEast, East, SouthEast, South, SouthWest, West, NorthWest
        const dx = [0, 1, 1, 1, 0, -1, -1, -1];
        const dy = [-1, -1, 0, 1, 1, 1, 0, -1];
        
        // Start scanning neighborhoods
        contour.push({ x: currX, y: currY });
        visited[currY * w + currX] = 1;
        
        let backDir = 4; // opposite direction
        let limit = 0;
        
        while (limit < 8000) {
          limit++;
          let found = false;
          let searchDir = (backDir + 1) % 8;
          
          for (let i = 0; i < 8; i++) {
            const nextDir = (searchDir + i) % 8;
            const nx = currX + dx[nextDir];
            const ny = currY + dy[nextDir];
            
            if (getPixel(nx, ny) === 1) {
              currX = nx;
              currY = ny;
              contour.push({ x: currX, y: currY });
              visited[currY * w + currX] = 1;
              backDir = (nextDir + 4) % 8;
              found = true;
              break;
            }
          }
          
          // Reached back to start?
          if (!found || (currX === startX && currY === startY)) {
            break;
          }
        }
        
        return contour;
      };
      
      // 3. Scan the grid row by row
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          if (binaryGrid[y * w + x] === 1 && visited[y * w + x] === 0) {
            // Found a contour starting boundary edge
            if (binaryGrid[y * w + (x - 1)] === 0) {
              const points = traceContour(x, y);
              if (points.length > 3) {
                // Simplify path points to reduce nodes size: keep every 3rd point or do Ramer-Douglas-Peucker
                let d = `M ${points[0].x} ${points[0].y}`;
                for (let k = 1; k < points.length; k += 2) {
                  d += ` L ${points[k].x} ${points[k].y}`;
                }
                d += ' Z';
                paths.push(`<path d="${d}" fill="#040608" />`);
              }
            }
          }
        }
      }
      
      // If no contours detected, output a simple fallback shape
      if (paths.length === 0) {
        paths.push(`<rect x="0" y="0" width="${w}" height="${h}" fill="#f4f4f5" />`);
        paths.push(`<text x="${w/2}" y="${h/2}" font-family="sans-serif" font-size="20" fill="#a1a1aa" text-anchor="middle">No shapes traced</text>`);
      }
      
      // 4. Compile final SVG code
      const svg = `<?xml version="1.0" encoding="utf-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="100%" height="100%">
  <rect width="100%" height="100%" fill="none" />
  <g>
    ${paths.join('\n    ')}
  </g>
</svg>`;
      
      resolve(svg);
    };
    
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    
    img.src = url;
  });
};
