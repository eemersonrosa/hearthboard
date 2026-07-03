import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getDeviceName, setDeviceName, getDeviceApiBase } from './deviceName.js';

function createLocalStorageMock() {
    const store = new Map();
    return {
        getItem: (key) => store.has(key) ? store.get(key) : null,
        setItem: (key, value) => store.set(key, String(value)),
        removeItem: (key) => store.delete(key),
        clear: () => store.clear(),
    };
}

describe('deviceName utilities', () => {
    // Node 25's built-in localStorage getter throws unless started with
    // --localstorage-file, so capture the descriptor instead of the value.
    const originalLocalStorageDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');

    beforeEach(() => {
        Object.defineProperty(globalThis, 'localStorage', {
            value: createLocalStorageMock(),
            configurable: true,
            writable: true,
        });
    });

    afterEach(() => {
        if (originalLocalStorageDescriptor) {
            Object.defineProperty(globalThis, 'localStorage', originalLocalStorageDescriptor);
        } else {
            delete globalThis.localStorage;
        }
        vi.restoreAllMocks();
    });

    it('defaults to the shared profile when no device name is stored', () => {
        const name = getDeviceName();

        expect(name).toBe('shared');
        expect(globalThis.localStorage.getItem('hearthboard_device_name')).toBe('shared');
    });

    it('returns stored device name without generating a new value', () => {
        globalThis.localStorage.setItem('hearthboard_device_name', 'existing-device');
        const randomUuidSpy = vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue('new-uuid-should-not-be-used');

        const name = getDeviceName();

        expect(name).toBe('existing-device');
        expect(randomUuidSpy).not.toHaveBeenCalled();
    });

    it('setDeviceName updates localStorage key', () => {
        setDeviceName('kitchen-hub');

        expect(globalThis.localStorage.getItem('hearthboard_device_name')).toBe('kitchen-hub');
    });

    it('getDeviceApiBase encodes device name in URL path', () => {
        setDeviceName('Kitchen Display/West');

        const apiBase = getDeviceApiBase('http://localhost:5001');

        expect(apiBase).toBe('http://localhost:5001/api/devices/Kitchen%20Display%2FWest');
    });
});
