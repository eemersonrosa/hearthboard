// @vitest-environment jsdom
// Dock auto-hide: the TabBar collapses to a slim handle after the idle delay.
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

import TabBar from './components/TabBar.jsx';

describe('TabBar auto-hide', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('minimizes after autoHideDelay seconds of inactivity', async () => {
    const { container } = render(
      <TabBar
        tabs={[{ id: 1, number: 1, name: 'Home', icon: 'home' }]}
        activeTab={1}
        onTabChange={() => {}}
        widgetsLocked
        onAddTab={() => {}}
        onDeleteTab={() => {}}
        onToggleTheme={() => {}}
        onToggleLock={() => {}}
        onOpenSettings={() => {}}
        onRefresh={() => {}}
        theme="dark"
        themeMode="dark"
        autoHide
        autoHideDelay={5}
        screensaverCountdown={null}
      />
    );

    expect(container.querySelector('[aria-label="Show dock"]')).toBeNull();

    await act(async () => {
      vi.advanceTimersByTime(6000);
    });

    expect(container.querySelector('[aria-label="Show dock"]')).not.toBeNull();
  });
});
