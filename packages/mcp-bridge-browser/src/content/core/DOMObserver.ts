/**
 * DOM Observer
 * Wraps MutationObserver with throttling for performance
 */
export class DOMObserver {
  private observer: MutationObserver;
  private isCheckScheduled = false;
  private pollInterval: number;
  private callback: () => void;
  private isActive = false;

  constructor(callback: () => void, pollInterval = 1000) {
    this.callback = callback;
    this.pollInterval = pollInterval;

    this.observer = new MutationObserver(() => {
      if (!this.isActive) return;

      // Throttle: only schedule one check per interval
      if (!this.isCheckScheduled) {
        this.isCheckScheduled = true;
        setTimeout(() => {
          this.isCheckScheduled = false;
          this.callback();
        }, this.pollInterval);
      }
    });
  }

  /**
   * Start observing the document
   */
  start() {
    this.isActive = true;

    const tryObserve = () => {
      if (document.body) {
        this.observer.observe(document.body, {
          childList: true,
          subtree: true,
        });
        // Initial trigger
        this.callback();
      } else {
        // If body not ready, try again on DOMContentLoaded or next frame
        if (document.readyState === "loading") {
          document.addEventListener("DOMContentLoaded", () => tryObserve(), { once: true });
        } else {
          requestAnimationFrame(() => tryObserve());
        }
      }
    };

    tryObserve();
  }

  /**
   * Stop observing
   */
  stop() {
    this.isActive = false;
    this.observer.disconnect();
  }

  /**
   * Manually trigger a check
   */
  trigger() {
    if (this.isActive) {
      this.callback();
    }
  }

  /**
   * Update poll interval
   */
  setPollInterval(interval: number) {
    this.pollInterval = interval;
  }
}
