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
  private backgroundInterval: any = null;
  private idleCheckCount = 0;
  private readonly MAX_IDLE_BEFORE_SLOW = 12; // 12 * 5s = 60s

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

    // Force check when tab becomes visible
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && this.isActive) {
        this.trigger();
      }
    });

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

    // Background heartbeat with power saving:
    // We force a check every 5 seconds if we are in the background.
    // If we've been idle for too long, we slow down the check to save power.
    if (this.backgroundInterval) clearInterval(this.backgroundInterval);
    
    const runHeartbeat = () => {
      if (!this.isActive) return;
      
      if (document.hidden) {
        this.idleCheckCount++;
        
        // If idle for more than 1 minute, slow down to 30 seconds
        const currentInterval = this.idleCheckCount > this.MAX_IDLE_BEFORE_SLOW ? 30000 : 5000;
        
        this.trigger();
        
        // Reschedule with dynamic interval
        this.backgroundInterval = setTimeout(runHeartbeat, currentInterval);
      } else {
        this.idleCheckCount = 0;
        this.backgroundInterval = setTimeout(runHeartbeat, 5000);
      }
    };

    this.backgroundInterval = setTimeout(runHeartbeat, 5000);
  }

  /**
   * Stop observing
   */
  stop() {
    this.isActive = false;
    this.observer.disconnect();
    if (this.backgroundInterval) {
      clearTimeout(this.backgroundInterval);
      this.backgroundInterval = null;
    }
  }

  /**
   * Manually trigger a check
   */
  trigger() {
    if (this.isActive) {
      this.idleCheckCount = 0; // Reset idle counter on any trigger
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
