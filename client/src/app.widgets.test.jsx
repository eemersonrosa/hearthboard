// @vitest-environment jsdom
// Regression test for the black-screen-on-enable bug: rendering App with all
// core widgets enabled and assigned must mount every widget without a render
// crash (there is no error boundary, so any widget crash unmounts the app).
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
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

// jsdom lacks ResizeObserver; real browsers all have it.
if (typeof window.ResizeObserver === 'undefined') {
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  globalThis.ResizeObserver = window.ResizeObserver;
}

vi.mock('axios', () => {
  const enabled = { enabled: true, transparent: false, refreshInterval: 0 };
  const widgetSettings = {
    chores: { ...enabled },
    calendar: { ...enabled },
    photos: { ...enabled },
    weather: { ...enabled },
    homeassistant: { ...enabled },
  };
  const tabs = [
    { id: 1, number: 1, name: 'Home', icon: 'Home', config_json: null },
  ];
  const assignments = ['chores', 'calendar', 'photos', 'weather', 'homeassistant'].map(
    (widgetName, index) => ({
      id: index + 1,
      widget_name: widgetName,
      tab_number: 1,
      layout_x: null,
      layout_y: null,
      layout_w: null,
      layout_h: null,
    }),
  );

  const get = vi.fn((url) => {
    if (url.includes('/widget-assignments')) return Promise.resolve({ data: assignments });
    if (url.includes('/tabs')) return Promise.resolve({ data: tabs });
    if (url.endsWith('/settings') && url.includes('/devices/')) {
      return Promise.resolve({ data: { widgetSettings, pluginSettings: {} } });
    }
    if (url.includes('/api/settings')) {
      return Promise.resolve({ data: { WEATHER_API_KEY: '', ICS_CALENDAR_URL: '' } });
    }
    if (url.includes('/api/calendar-sync/status')) return Promise.resolve({ data: [] });
    if (url.includes('/api/connections/google')) return Promise.resolve({ data: {} });
    if (url.includes('/api/home-assistant')) return Promise.resolve({ data: {} });
    // Collection endpoints (users, chores, widgets, calendar/photo sources...).
    return Promise.resolve({ data: [] });
  });

  return {
    default: {
      get,
      post: vi.fn(() => Promise.resolve({ data: {} })),
      put: vi.fn(() => Promise.resolve({ data: {} })),
      patch: vi.fn(() => Promise.resolve({ data: {} })),
      delete: vi.fn(() => Promise.resolve({ data: {} })),
    },
  };
});

import App from './app.jsx';

const flush = () => act(() => new Promise((resolve) => setTimeout(resolve, 25)));

describe('App with widgets enabled', () => {
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
  });

  it('mounts all enabled core widgets without crashing', async () => {
    const errors = [];
    const origError = console.error;
    console.error = (...args) => {
      errors.push(args.map(String).join(' '));
      origError(...args);
    };

    let result;
    try {
      result = render(<App />);
      // Let device settings hydrate and the lazy widget chunks load.
      for (let i = 0; i < 20; i++) await flush();
    } finally {
      console.error = origError;
    }

    const wrappers = result.container.querySelectorAll('.widget-wrapper');
    expect(wrappers.length).toBe(5);
    expect(errors).toEqual([]);
  }, 30000);
});
