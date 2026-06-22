// PX Warm-Up - Content Script
// Performs natural scrolling behavior on visited pages during warm-up

(function () {
  'use strict';

  // Check if warm-up scrolling was requested
  function startWarmupBehavior() {
    const duration = window.__pxWarmupDuration;
    if (!duration || !window.__pxWarmupActive) return;

    // Clear the flag so it doesn't re-trigger
    window.__pxWarmupActive = false;

    const durationMs = duration * 1000;
    const startTime = Date.now();
    const pageHeight = Math.max(
      document.body.scrollHeight,
      document.documentElement.scrollHeight,
      2000
    );

    // Generate random scroll targets
    const scrollCount = Math.max(3, Math.floor(duration / 3));
    const scrollPositions = [];
    for (let i = 0; i < scrollCount; i++) {
      scrollPositions.push(Math.floor(Math.random() * pageHeight * 0.8));
    }

    let currentScroll = 0;

    function performScroll() {
      if (Date.now() - startTime >= durationMs) return;
      if (currentScroll >= scrollPositions.length) return;

      const target = scrollPositions[currentScroll];
      currentScroll++;

      // Smooth scroll to target
      window.scrollTo({
        top: target,
        behavior: 'smooth',
      });

      // Schedule next scroll with random delay
      const minDelay = 1500;
      const maxDelay = Math.min(4000, (durationMs / scrollCount) * 0.9);
      const delay = minDelay + Math.random() * (maxDelay - minDelay);

      setTimeout(performScroll, delay);
    }

    // Small initial delay before first scroll (like a real user reading)
    const initialDelay = 500 + Math.random() * 1500;
    setTimeout(performScroll, initialDelay);
  }

  // Watch for the warm-up signal from background script injection
  // The background script sets window.__pxWarmupActive via scripting API
  // We poll briefly to detect it
  let pollCount = 0;
  const pollInterval = setInterval(() => {
    pollCount++;
    if (window.__pxWarmupActive) {
      clearInterval(pollInterval);
      startWarmupBehavior();
    }
    // Stop polling after 30 seconds
    if (pollCount > 60) {
      clearInterval(pollInterval);
    }
  }, 500);
})();
