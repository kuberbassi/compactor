export async function launchBrowser(browserType, options = {}) {
  try {
    return await browserType.launch({ headless: true, ...options });
  } catch (error) {
    console.warn(`[WARNING] Failed to launch browser. Ensure it is installed.`, error.message);
    return null;
  }
}
