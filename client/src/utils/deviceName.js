const DEVICE_NAME_STORAGE_KEY = 'hearthboard_device_name';

// Every display uses the single shared profile until it is explicitly
// personalized (Admin > Widgets > Devices). Personalized displays keep their
// own tabs, widgets, and settings under their chosen device name.
export const SHARED_DEVICE_NAME = 'shared';

export const getDeviceName = () => {
    let deviceName = localStorage.getItem(DEVICE_NAME_STORAGE_KEY);

    if (!deviceName) {
        deviceName = SHARED_DEVICE_NAME;
        localStorage.setItem(DEVICE_NAME_STORAGE_KEY, deviceName);
    }

    return deviceName;
};

export const isSharedProfile = () => getDeviceName() === SHARED_DEVICE_NAME;

export const setDeviceName = (deviceName) => {
    localStorage.setItem(DEVICE_NAME_STORAGE_KEY, deviceName);
};

export const getDeviceApiBase = (apiBaseUrl) => {
    const deviceName = getDeviceName();
    return `${apiBaseUrl}/api/devices/${encodeURIComponent(deviceName)}`;
};
