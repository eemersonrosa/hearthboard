const axios = require('axios');
const { encrypt, decrypt, isEncryptionConfigured } = require('../utils/encryption');

// Settings keys. The token is encrypted at rest when ENCRYPTION_KEY is
// configured; the plain key is used otherwise so a homelab without the key
// still works. Both token keys are excluded from the generic settings API.
const HA_BASE_URL_KEY = 'HA_BASE_URL';
const HA_TOKEN_ENC_KEY = 'HA_TOKEN_ENC';
const HA_TOKEN_PLAIN_KEY = 'HA_TOKEN_PLAIN';
const HA_WEATHER_ENTITY_KEY = 'HA_WEATHER_ENTITY';
const HA_ALERT_RULES_KEY = 'HA_ALERT_RULES';

const SECRET_SETTING_KEYS = [HA_TOKEN_ENC_KEY, HA_TOKEN_PLAIN_KEY];

const REQUEST_TIMEOUT_MS = 10000;

// HA weather entity conditions -> OpenWeatherMap icon codes, so the existing
// weather widget can render Home Assistant data without a separate code path.
const CONDITION_TO_OWM_ICON = {
    'clear-night': '01n',
    cloudy: '04d',
    exceptional: '11d',
    fog: '50d',
    hail: '13d',
    lightning: '11d',
    'lightning-rainy': '11d',
    partlycloudy: '02d',
    pouring: '09d',
    rainy: '10d',
    snowy: '13d',
    'snowy-rainy': '13d',
    sunny: '01d',
    windy: '03d',
    'windy-variant': '04d',
};

function getSetting(db, key) {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
    return row ? row.value : null;
}

function setSetting(db, key, value) {
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
}

function deleteSetting(db, key) {
    db.prepare('DELETE FROM settings WHERE key = ?').run(key);
}

function getBaseUrl(db) {
    const raw = getSetting(db, HA_BASE_URL_KEY);
    return raw ? raw.replace(/\/+$/, '') : null;
}

function getToken(db) {
    const encrypted = getSetting(db, HA_TOKEN_ENC_KEY);
    if (encrypted) {
        try {
            return decrypt(encrypted);
        } catch (error) {
            console.error('Failed to decrypt Home Assistant token:', error.message);
            return null;
        }
    }
    return getSetting(db, HA_TOKEN_PLAIN_KEY);
}

function saveConfig(db, { baseUrl, token, weatherEntity }) {
    if (baseUrl !== undefined) {
        if (baseUrl) {
            setSetting(db, HA_BASE_URL_KEY, String(baseUrl).trim().replace(/\/+$/, ''));
        } else {
            deleteSetting(db, HA_BASE_URL_KEY);
        }
    }

    if (token !== undefined && token !== null && token !== '') {
        if (isEncryptionConfigured()) {
            setSetting(db, HA_TOKEN_ENC_KEY, encrypt(String(token).trim()));
            deleteSetting(db, HA_TOKEN_PLAIN_KEY);
        } else {
            setSetting(db, HA_TOKEN_PLAIN_KEY, String(token).trim());
            deleteSetting(db, HA_TOKEN_ENC_KEY);
        }
    }

    if (weatherEntity !== undefined) {
        if (weatherEntity) {
            setSetting(db, HA_WEATHER_ENTITY_KEY, String(weatherEntity).trim());
        } else {
            deleteSetting(db, HA_WEATHER_ENTITY_KEY);
        }
    }
}

function isConfigured(db) {
    return Boolean(getBaseUrl(db) && getToken(db));
}

function getStatus(db) {
    const token = getToken(db);
    return {
        configured: isConfigured(db),
        base_url: getBaseUrl(db) || '',
        has_token: Boolean(token),
        token_encrypted: Boolean(getSetting(db, HA_TOKEN_ENC_KEY)),
        weather_entity: getSetting(db, HA_WEATHER_ENTITY_KEY) || '',
    };
}

function haClient(db) {
    const baseUrl = getBaseUrl(db);
    const token = getToken(db);
    if (!baseUrl || !token) {
        const error = new Error('Home Assistant is not configured');
        error.statusCode = 400;
        throw error;
    }

    return axios.create({
        baseURL: `${baseUrl}/api`,
        timeout: REQUEST_TIMEOUT_MS,
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
    });
}

async function testConnection(db) {
    try {
        const response = await haClient(db).get('/config');
        return {
            ok: true,
            message: `Connected to ${response.data?.location_name || 'Home Assistant'}`,
            version: response.data?.version || null,
        };
    } catch (error) {
        return {
            ok: false,
            message: error.response?.status === 401
                ? 'Unauthorized: check the access token'
                : (error.message || 'Connection failed'),
            version: null,
        };
    }
}

function mapState(state) {
    return {
        entity_id: state.entity_id,
        state: state.state,
        friendly_name: state.attributes?.friendly_name || state.entity_id,
        icon: state.attributes?.icon || null,
        unit_of_measurement: state.attributes?.unit_of_measurement || null,
        device_class: state.attributes?.device_class || null,
        last_changed: state.last_changed,
        supported_features: state.attributes?.supported_features || 0,
    };
}

async function getEntities(db, domains = null) {
    const response = await haClient(db).get('/states');
    let states = Array.isArray(response.data) ? response.data : [];

    if (domains && domains.length > 0) {
        const domainSet = new Set(domains);
        states = states.filter((state) => domainSet.has(state.entity_id.split('.')[0]));
    }

    return states.map(mapState);
}

async function callService(db, { domain, service, entityId, data }) {
    const payload = { ...(data || {}) };
    if (entityId) {
        payload.entity_id = entityId;
    }
    const response = await haClient(db).post(`/services/${domain}/${service}`, payload);
    return Array.isArray(response.data) ? response.data.map(mapState) : response.data;
}

function celsiusToFahrenheit(value) {
    return (value * 9) / 5 + 32;
}

function normalizeTemperature(value, entityUnit, wantUnit) {
    if (typeof value !== 'number') return null;
    const entityIsF = (entityUnit || '').includes('F');
    if (wantUnit === 'F' && !entityIsF) return celsiusToFahrenheit(value);
    if (wantUnit === 'C' && entityIsF) return ((value - 32) * 5) / 9;
    return value;
}

async function findWeatherEntity(db) {
    const configured = getSetting(db, HA_WEATHER_ENTITY_KEY);
    if (configured) return configured;

    const response = await haClient(db).get('/states');
    const weatherState = (response.data || []).find((state) => state.entity_id.startsWith('weather.'));
    return weatherState ? weatherState.entity_id : null;
}

async function getForecast(db, entityId) {
    // Modern HA serves forecasts via the weather.get_forecasts service; older
    // versions exposed a `forecast` attribute. Try the service first.
    try {
        const response = await haClient(db).post(
            '/services/weather/get_forecasts?return_response',
            { entity_id: entityId, type: 'daily' },
        );
        const serviceResponse = response.data?.service_response || response.data;
        const forecast = serviceResponse?.[entityId]?.forecast;
        if (Array.isArray(forecast)) return forecast;
    } catch {
        // Fall through to the attribute-based approach.
    }

    try {
        const response = await haClient(db).get(`/states/${entityId}`);
        const forecast = response.data?.attributes?.forecast;
        if (Array.isArray(forecast)) return forecast;
    } catch {
        // No forecast available.
    }

    return [];
}

// Returns a payload shaped like the weather widget's OpenWeatherMap payload
// so the client can render Home Assistant data with the same components.
async function getWeatherPayload(db, wantUnit = 'C') {
    const entityId = await findWeatherEntity(db);
    if (!entityId) {
        const error = new Error('No weather entity found in Home Assistant');
        error.statusCode = 404;
        throw error;
    }

    const stateResponse = await haClient(db).get(`/states/${entityId}`);
    const state = stateResponse.data;
    const attrs = state.attributes || {};
    const entityUnit = attrs.temperature_unit || '°C';

    const condition = state.state;
    const icon = CONDITION_TO_OWM_ICON[condition] || '02d';
    const description = String(condition || '').replace(/-/g, ' ');

    const temp = normalizeTemperature(attrs.temperature, entityUnit, wantUnit);
    const feelsLike = normalizeTemperature(
        typeof attrs.apparent_temperature === 'number' ? attrs.apparent_temperature : attrs.temperature,
        entityUnit,
        wantUnit,
    );

    const weatherData = {
        name: attrs.friendly_name || entityId,
        weather: [{ icon, description, main: description }],
        main: {
            temp: temp ?? 0,
            feels_like: feelsLike ?? temp ?? 0,
            humidity: typeof attrs.humidity === 'number' ? attrs.humidity : null,
        },
        wind: {
            speed: typeof attrs.wind_speed === 'number' ? attrs.wind_speed : 0,
        },
    };

    const rawForecast = await getForecast(db, entityId);
    const forecastData = rawForecast.slice(0, 3).map((item) => {
        const date = new Date(item.datetime);
        const high = normalizeTemperature(item.temperature, entityUnit, wantUnit);
        const low = normalizeTemperature(
            typeof item.templow === 'number' ? item.templow : item.temperature,
            entityUnit,
            wantUnit,
        );
        return {
            date,
            dayName: date.toLocaleDateString('en-US', { weekday: 'short' }),
            tempHigh: high !== null ? Math.round(high) : null,
            tempLow: low !== null ? Math.round(low) : null,
            tempAvg: high !== null && low !== null ? Math.round((high + low) / 2) : null,
            weather: {
                icon: CONDITION_TO_OWM_ICON[item.condition] || '02d',
                description: String(item.condition || '').replace(/-/g, ' '),
                main: String(item.condition || '').replace(/-/g, ' '),
            },
            precipitation: typeof item.precipitation === 'number' ? item.precipitation : 0,
        };
    });

    return {
        source: 'homeassistant',
        entity_id: entityId,
        coordinates: { lat: null, lon: null },
        resolvedName: attrs.friendly_name || entityId,
        weatherData,
        airQualityData: null,
        forecastData,
        chartData: [],
    };
}

// ---- Alerts -------------------------------------------------------------
//
// Alert rules are evaluated server-side against current states:
//   { id, name, entity_id, condition: 'state_equals' | 'state_for_minutes',
//     value: 'on', duration_minutes: 60 }
//
// 'state_equals'      -> alert while the entity state equals `value`.
// 'state_for_minutes' -> alert while the state equals `value` and has been
//                        unchanged for at least `duration_minutes`.

function getAlertRules(db) {
    const raw = getSetting(db, HA_ALERT_RULES_KEY);
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function saveAlertRules(db, rules) {
    const normalized = (Array.isArray(rules) ? rules : [])
        .filter((rule) => rule && rule.entity_id && rule.condition)
        .map((rule, index) => ({
            id: rule.id || `rule-${index + 1}-${Date.now()}`,
            name: rule.name || rule.entity_id,
            entity_id: String(rule.entity_id).trim(),
            condition: rule.condition === 'state_for_minutes' ? 'state_for_minutes' : 'state_equals',
            value: rule.value !== undefined && rule.value !== null ? String(rule.value) : 'on',
            duration_minutes: Math.max(0, parseInt(rule.duration_minutes, 10) || 0),
        }));
    setSetting(db, HA_ALERT_RULES_KEY, JSON.stringify(normalized));
    return normalized;
}

async function evaluateAlerts(db) {
    const rules = getAlertRules(db);
    if (rules.length === 0) {
        return { alerts: [], rules_count: 0 };
    }

    const response = await haClient(db).get('/states');
    const statesById = new Map((response.data || []).map((state) => [state.entity_id, state]));

    const alerts = [];
    const now = Date.now();

    for (const rule of rules) {
        const state = statesById.get(rule.entity_id);
        if (!state) continue;

        const matchesValue = String(state.state) === rule.value;
        if (!matchesValue) continue;

        const friendlyName = state.attributes?.friendly_name || rule.entity_id;
        const sinceMs = new Date(state.last_changed).getTime();
        const minutesInState = Number.isFinite(sinceMs) ? Math.floor((now - sinceMs) / 60000) : 0;

        if (rule.condition === 'state_for_minutes') {
            if (minutesInState < rule.duration_minutes) continue;
            alerts.push({
                id: rule.id,
                name: rule.name,
                entity_id: rule.entity_id,
                friendly_name: friendlyName,
                state: state.state,
                minutes_in_state: minutesInState,
                message: `${rule.name || friendlyName}: ${friendlyName} has been ${state.state} for ${minutesInState} minute${minutesInState === 1 ? '' : 's'}`,
            });
        } else {
            alerts.push({
                id: rule.id,
                name: rule.name,
                entity_id: rule.entity_id,
                friendly_name: friendlyName,
                state: state.state,
                minutes_in_state: minutesInState,
                message: `${rule.name || friendlyName}: ${friendlyName} is ${state.state}`,
            });
        }
    }

    return { alerts, rules_count: rules.length };
}

module.exports = {
    SECRET_SETTING_KEYS,
    saveConfig,
    isConfigured,
    getStatus,
    testConnection,
    getEntities,
    callService,
    getWeatherPayload,
    getAlertRules,
    saveAlertRules,
    evaluateAlerts,
};
