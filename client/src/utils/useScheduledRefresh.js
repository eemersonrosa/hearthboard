import { useEffect, useRef } from 'react';

// Screen-aware refresh scheduling.
//
// Instead of a bare setInterval (which keeps firing while a wall display's
// screen is off), refreshes are scheduled against a next-due timestamp:
//
//   - While the screen is on, the callback fires when the due time arrives
//     and the next due time advances by `intervalMs`.
//   - While the screen is off (the page is hidden), nothing runs.
//   - When the screen comes back on, anything past its due time refreshes
//     immediately and the schedule resumes from now.
//
// "Screen off" is detected via the Page Visibility API, which is what
// browsers report when a kiosk display sleeps or the tab is backgrounded.

export const isScreenOn = () =>
  typeof document === 'undefined' || document.visibilityState !== 'hidden';

/**
 * Runs `callback` every `intervalMs` while the screen is on, pausing while
 * it is off and catching up immediately on wake if a refresh came due.
 * Pass `intervalMs <= 0` to disable.
 */
export function useScheduledRefresh(intervalMs, callback, enabled = true) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    if (!enabled || !intervalMs || intervalMs <= 0) {
      return undefined;
    }

    let timeoutId = null;
    let nextDueAt = Date.now() + intervalMs;

    const clear = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    };

    const schedule = () => {
      clear();
      if (!isScreenOn()) {
        return;
      }
      timeoutId = setTimeout(() => {
        nextDueAt = Date.now() + intervalMs;
        callbackRef.current();
        schedule();
      }, Math.max(0, nextDueAt - Date.now()));
    };

    const handleVisibilityChange = () => {
      if (!isScreenOn()) {
        // Screen went off: freeze. The due timestamp stays put so we can
        // detect an overdue refresh on wake.
        clear();
        return;
      }
      // Screen back on: catch up if we're past due, then resume.
      if (Date.now() >= nextDueAt) {
        nextDueAt = Date.now() + intervalMs;
        callbackRef.current();
      }
      schedule();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    schedule();

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clear();
    };
  }, [intervalMs, enabled]);
}

export default useScheduledRefresh;
