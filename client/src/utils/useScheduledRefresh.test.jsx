// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useScheduledRefresh, isScreenOn } from './useScheduledRefresh.js';

const setVisibility = (state) => {
    Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => state,
    });
    document.dispatchEvent(new Event('visibilitychange'));
};

describe('useScheduledRefresh', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        setVisibility('visible');
    });

    afterEach(() => {
        vi.useRealTimers();
        setVisibility('visible');
    });

    it('fires on the interval while the screen is on', () => {
        const callback = vi.fn();
        renderHook(() => useScheduledRefresh(1000, callback));

        act(() => vi.advanceTimersByTime(3100));
        expect(callback).toHaveBeenCalledTimes(3);
    });

    it('does nothing when disabled or interval is zero', () => {
        const callback = vi.fn();
        renderHook(() => useScheduledRefresh(0, callback));
        renderHook(() => useScheduledRefresh(1000, callback, false));

        act(() => vi.advanceTimersByTime(5000));
        expect(callback).not.toHaveBeenCalled();
    });

    it('pauses while the screen is off and catches up on wake when overdue', () => {
        const callback = vi.fn();
        renderHook(() => useScheduledRefresh(1000, callback));

        // Screen goes off before the first refresh is due.
        act(() => {
            vi.advanceTimersByTime(500);
            setVisibility('hidden');
        });

        // Time passes well beyond the due timestamp with the screen off.
        act(() => vi.advanceTimersByTime(10000));
        expect(callback).not.toHaveBeenCalled();

        // Screen back on: the overdue refresh fires immediately.
        act(() => setVisibility('visible'));
        expect(callback).toHaveBeenCalledTimes(1);

        // And the schedule resumes from now.
        act(() => vi.advanceTimersByTime(1000));
        expect(callback).toHaveBeenCalledTimes(2);
    });

    it('does not fire early on wake when the refresh is not yet due', () => {
        const callback = vi.fn();
        renderHook(() => useScheduledRefresh(10000, callback));

        act(() => {
            vi.advanceTimersByTime(1000);
            setVisibility('hidden');
        });
        act(() => {
            vi.advanceTimersByTime(1000);
            setVisibility('visible');
        });

        expect(callback).not.toHaveBeenCalled();

        act(() => vi.advanceTimersByTime(8100));
        expect(callback).toHaveBeenCalledTimes(1);
    });

    it('stops firing after unmount', () => {
        const callback = vi.fn();
        const { unmount } = renderHook(() => useScheduledRefresh(1000, callback));

        act(() => vi.advanceTimersByTime(1100));
        expect(callback).toHaveBeenCalledTimes(1);

        unmount();
        act(() => vi.advanceTimersByTime(5000));
        expect(callback).toHaveBeenCalledTimes(1);
    });
});

describe('isScreenOn', () => {
    it('reflects document visibility', () => {
        setVisibility('visible');
        expect(isScreenOn()).toBe(true);
        setVisibility('hidden');
        expect(isScreenOn()).toBe(false);
        setVisibility('visible');
    });
});
