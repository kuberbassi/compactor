/*! coi-serviceworker v0.1.7 | MIT License | https://github.com/gzuidhof/coi-serviceworker */
if (typeof window === "undefined") {
    self.addEventListener("install", () => self.skipWaiting());
    self.addEventListener("activate", event => event.waitUntil(self.clients.claim()));

    self.addEventListener("fetch", event => {
        if (event.request.cache === "only-if-cached" && event.request.mode !== "same-origin") {
            return;
        }

        event.respondWith(
            fetch(event.request)
                .then(response => {
                    if (response.status === 0) {
                        return response;
                    }

                    const newHeaders = new Headers(response.headers);
                    newHeaders.set("Cross-Origin-Embedder-Policy", "require-corp");
                    newHeaders.set("Cross-Origin-Opener-Policy", "same-origin");

                    return new Response(response.body, {
                        status: response.status,
                        statusText: response.statusText,
                        headers: newHeaders
                    });
                })
                .catch(e => {
                    console.error("COI service worker fetch error:", e);
                })
        );
    });
} else {
    (() => {
        if (window.COI_DISABLE) return;

        if ("serviceWorker" in navigator) {
            const scriptUrl = window.document.currentScript ? window.document.currentScript.src : "/coi-serviceworker.js";
            navigator.serviceWorker.register(scriptUrl)
                .then(registration => {
                    console.log("COI Service Worker registered with scope:", registration.scope);
                    
                    registration.addEventListener("updatefound", () => {
                        const newWorker = registration.installing;
                        if (newWorker) {
                            newWorker.addEventListener("statechange", () => {
                                if (newWorker.state === "activated") {
                                    window.location.reload();
                                }
                            });
                        }
                    });

                    if (!navigator.serviceWorker.controller) {
                        console.log("Reloading page to apply COI headers...");
                        window.location.reload();
                    }
                })
                .catch(err => {
                    console.error("COI Service Worker registration failed:", err);
                });
        }
    })();
}
