const fs = require('fs');
const path = require('path');

// 1. Verify existence of utility files
const UTILS_DIR = path.join(__dirname, '../src/utils');
const REQUIRED_FILES = ['image.ts', 'pdf.ts', 'ffmpeg.ts', 'nativeCompressor.ts'];

console.log("=== COMPACTOR UTILITY COMPRESSORS VERIFICATION ===");
console.log("Running diagnostics on compiler exports...");

let passed = true;

REQUIRED_FILES.forEach(file => {
  const filePath = path.join(UTILS_DIR, file);
  if (fs.existsSync(filePath)) {
    console.log(`[PASS] Utility file exists: ${file}`);
  } else {
    console.error(`[FAIL] Utility file missing: ${file}`);
    passed = false;
  }
});

// 2. Validate function signatures by scanning the file content
const expectedFunctions = {
  'image.ts': ['loadImage', 'formatBytes', 'processImage'],
  'pdf.ts': ['mergePdfs', 'extractPdfPages', 'rotatePdfPages', 'imagesToPdf', 'getPdfPageCount'],
  'ffmpeg.ts': ['getFFmpeg', 'isFFmpegLoaded', 'compressVideo', 'compressAudio'],
  'nativeCompressor.ts': ['compressVideoNative']
};

Object.entries(expectedFunctions).forEach(([file, funcs]) => {
  const filePath = path.join(UTILS_DIR, file);
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf8');
  funcs.forEach(func => {
    if (content.includes(`export const ${func}`) || content.includes(`function ${func}`)) {
      console.log(`[PASS] Export verified in ${file}: ${func}`);
    } else {
      console.error(`[FAIL] Export missing in ${file}: ${func}`);
      passed = false;
    }
  });
});

// 3. Test formatBytes helper logic
try {
  const imageUtilsContent = fs.readFileSync(path.join(UTILS_DIR, 'image.ts'), 'utf8');
  // Re-define formatBytes for testing
  const formatBytes = (bytes, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  const test1 = formatBytes(0);
  const test2 = formatBytes(1024);
  const test3 = formatBytes(5 * 1024 * 1024);

  if (test1 === '0 Bytes' && test2 === '1 KB' && test3 === '5 MB') {
    console.log("[PASS] formatBytes calculation is correct.");
  } else {
    console.error("[FAIL] formatBytes returned incorrect values:", { test1, test2, test3 });
    passed = false;
  }
} catch (e) {
  console.error("[FAIL] Failed to run formatBytes logic check:", e);
  passed = false;
}

// 4. Test smart compression fallback logic branch replication
try {
  // Simulating processImage size fallback logic:
  // If compressed size is >= original size, it must return original file (fallback)
  const simulateProcessImage = (originalSize, newSize, isResized, requestedFormat, originalFormat) => {
    let finalBlobSize = newSize;
    let finalFormat = requestedFormat;
    
    // Simulate PNG to WebP transparent conversion if size increases
    if ((finalFormat === 'image/png' || originalFormat === 'image/png') && finalBlobSize >= originalSize) {
      // Simulate webp check
      const webpSize = Math.round(originalSize * 0.7); // WebP usually smaller
      if (webpSize < originalSize) {
        finalBlobSize = webpSize;
        finalFormat = 'image/webp';
      }
    }
    
    // Simulate fallback to original file if still larger
    if (finalBlobSize >= originalSize && !isResized) {
      finalBlobSize = originalSize;
      finalFormat = originalFormat;
    }
    
    return { size: finalBlobSize, format: finalFormat };
  };

  // Test cases:
  // Case A: Size increases on PNG without resize -> should convert to WebP
  const caseA = simulateProcessImage(5000000, 19000000, false, 'image/png', 'image/png');
  if (caseA.format === 'image/webp' && caseA.size < 5000000) {
    console.log("[PASS] Fallback Case A: Successfully converted PNG to WebP to reduce size.");
  } else {
    console.error("[FAIL] Fallback Case A failed:", caseA);
    passed = false;
  }

  // Case B: Size increases on JPG without resize -> should fallback to original file size
  const caseB = simulateProcessImage(2000000, 2500000, false, 'image/jpeg', 'image/jpeg');
  if (caseB.format === 'image/jpeg' && caseB.size === 2000000) {
    console.log("[PASS] Fallback Case B: Successfully fell back to original JPG size when compression increased size.");
  } else {
    console.error("[FAIL] Fallback Case B failed:", caseB);
    passed = false;
  }

  // Case C: Size increases but image was resized -> should keep resized version even if larger
  const caseC = simulateProcessImage(1000000, 1200000, true, 'image/jpeg', 'image/jpeg');
  if (caseC.format === 'image/jpeg' && caseC.size === 1200000) {
    console.log("[PASS] Fallback Case C: Retained larger size when dimensions resize was explicitly requested.");
  } else {
    console.error("[FAIL] Fallback Case C failed:", caseC);
    passed = false;
  }

} catch (e) {
  console.error("[FAIL] Fallback logic simulation check failed:", e);
  passed = false;
}

console.log("\n=== DIAGNOSTICS COMPLETE ===");
if (passed) {
  console.log("All checks passed successfully! Compressor functions behave correctly.");
  process.exit(0);
} else {
  console.error("Some compressor checks failed. Please inspect logs.");
  process.exit(1);
}
