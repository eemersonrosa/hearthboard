// @vitest-environment jsdom
// The dock auto-hides by default: with no saved dock settings, an idle
// display must collapse the dock to its slim handle after the default delay.
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';

const storage = new Map();
Object.defineProperty(window, 'localStorage', {
  configurable: true,
  value: {
    getItem: (k) => (storage.has(k) ? storage.get(k) : null),
    setItem: (k, v) => storage.set(k, String(v)),
    removeItem: (k) => storage.delete(k),
    clear: () => storage.clear(),
  },
});

if (typeof window.ResizeObserver === 'undefined') {
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  globalThis.ResizeObserver = window.ResizeObserver;
}

vi.mock('axios', () => ({
  default: {
    get: vi.fn((url) => {
      if (url.includes('/tabs')) {
        return Promise.resolve({ data: [{ id: 1, number: 1, name: 'Home', icon: 'home', config_json: null }] });
      }
      if (url.endsWith('/settings') && url.includes('/devices/')) {
        return Promise.resolve({ data: { widgetSettings: {}, pluginSettings: {} } });
      }
      if (url.includes('/api/settings')) {
        return Promise.resolve({ data: { WEATHER_API_KEY: '', ICS_CALENDAR_URL: '' } });
      }
      return Promise.resolve({ data: [] });
    }),
    post: vi.fn(() => Promise.resolve({ data: {} })),
    put: vi.fn(() => Promise.resolve({ data: {} })),
    patch: vi.fn(() => Promise.resolve({ data: {} })),
    delete: vi.fn(() => Promise.resolve({ data: {} })),
  },
}));

import App from './app.jsx';

describe('App dock auto-hide', () => {
  beforeEach(() => {
    storage.clear();
    window.matchMedia = window.matchMedia || ((query) => ({
      matches: false,
      media: query,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }));
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('collapses the dock after the default idle delay with no saved settings', async () => {
    const { container } = render(<App />);

    // Flush hydration fetches and effects.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(container.querySelector('[aria-label="Show dock"]')).toBeNull();

    // Default delay is 10s; the 500ms flush above already counts toward it.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(11000);
    });

    expect(container.querySelector('[aria-label="Show dock"]')).not.toBeNull();
  }, 30000);
});
