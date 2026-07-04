// MSW request handlers for demo mode. State is held in memory: visitors can
// complete chores, move widgets, and edit tabs; a reload resets everything.
// URL patterns start with '*' so they match both relative (production build)
// and absolute (dev server) request URLs.
import { http, HttpResponse } from 'msw';
import * as fixtures from './fixtures.js';

const json = (data) => HttpResponse.json(data);

// ---- Mutable in-memory state -------------------------------------------
const state = {
  deviceSettings: { ...fixtures.deviceSettings },
  tabs: null, // built lazily once we know the device name
  assignments: null,
  history: [...fixtures.choreHistory],
  nextHistoryId: fixtures.choreHistory.length + 1,
  nextTabId: 100,
};

const ensureDevice = (deviceName) => {
  if (!state.tabs) {
    state.tabs = fixtures.buildTabs(deviceName);
    state.assignments = fixtures.buildAssignments(deviceName);
  }
  return deviceName;
};

export const handlers = [
  // ---- Boot ----
  http.get('*/api/timezone', () => json({ timezone: fixtures.timezone })),
  http.get('*/api/test', () => json({ message: 'Demo mode', timestamp: new Date().toISOString() })),
  http.get('*/api/stats', () =>
    json({ version: 'demo', commit: null, repository: 'eemersonrosa/hearthboard', commitUrl: null })),
  http.get('*/api/admin-pin/exists', () => json({ exists: false })),

  // ---- Settings ----
  http.get('*/api/settings', () => json({ ...fixtures.settings })),
  http.post('*/api/settings/search', async ({ request }) => {
    const keys = await request.json().catch(() => []);
    const wanted = (Array.isArray(keys) ? keys : [keys]).map((k) =>
      new RegExp(`^${String(k).replaceAll('*', '.*')}$`));
    const out = {};
    for (const [key, value] of Object.entries(fixtures.settings)) {
      if (wanted.some((re) => re.test(key))) out[key] = value;
    }
    return json(out);
  }),
  http.post('*/api/settings', () => json({ success: true, message: 'Saved (demo — resets on reload).' })),

  // ---- Devices, tabs & layout ----
  http.get('*/api/devices', () => json([{ id: 1, name: 'demo-display', updateTime: new Date().toISOString(), widget_count: 4 }])),
  http.get('*/api/devices/:deviceName/settings', ({ params }) => {
    ensureDevice(params.deviceName);
    return json(state.deviceSettings);
  }),
  http.put('*/api/devices/:deviceName/settings', async ({ request }) => {
    const incoming = await request.json().catch(() => ({}));
    state.deviceSettings = { ...state.deviceSettings, ...incoming };
    return json(state.deviceSettings);
  }),
  http.patch('*/api/devices/:deviceName/settings', async ({ request }) => {
    const incoming = await request.json().catch(() => ({}));
    state.deviceSettings = { ...state.deviceSettings, ...incoming };
    return json(state.deviceSettings);
  }),
  http.get('*/api/devices/:deviceName/tabs', ({ params }) => {
    ensureDevice(params.deviceName);
    return json(state.tabs);
  }),
  http.post('*/api/devices/:deviceName/tabs', async ({ params, request }) => {
    ensureDevice(params.deviceName);
    const body = await request.json().catch(() => ({}));
    const tab = {
      id: state.nextTabId++,
      device_name: params.deviceName,
      number: state.tabs.length + 1,
      label: body.label || 'New tab',
      icon: body.icon || 'star',
      show_label: body.show_label === false ? 0 : 1,
      created_at: new Date().toISOString(),
      config_json: '{}',
    };
    state.tabs.push(tab);
    return json(tab);
  }),
  http.get('*/api/devices/:deviceName/widget-assignments', ({ params }) => {
    ensureDevice(params.deviceName);
    return json(state.assignments);
  }),
  http.post('*/api/devices/:deviceName/widget-assignments', async ({ params, request }) => {
    ensureDevice(params.deviceName);
    const { widget_name, tabNumber } = await request.json().catch(() => ({}));
    const created = {
      id: `${tabNumber}::${widget_name}`,
      device_name: params.deviceName,
      tab_number: Number(tabNumber),
      widget_name,
      layout_x: null, layout_y: null, layout_w: null, layout_h: null,
    };
    state.assignments = state.assignments.filter((a) => a.id !== created.id).concat(created);
    return json(created);
  }),
  http.delete('*/api/devices/:deviceName/widget-assignments/widget/:widgetName', ({ params }) => {
    state.assignments = (state.assignments || []).filter((a) => a.widget_name !== params.widgetName);
    return json({ success: true });
  }),
  http.delete('*/api/devices/:deviceName/widget-assignments/:id', ({ params }) => {
    state.assignments = (state.assignments || []).filter((a) => a.id !== decodeURIComponent(params.id));
    return json({ success: true });
  }),
  http.patch('*/api/devices/:deviceName/widget-assignments/layout/bulk', async ({ request }) => {
    const { layouts } = await request.json().catch(() => ({}));
    for (const layout of layouts || []) {
      const id = `${layout.tabNumber ?? layout.tab_number}::${layout.widget_name}`;
      const found = (state.assignments || []).find((a) => a.id === id);
      if (found) {
        found.layout_x = layout.layout_x;
        found.layout_y = layout.layout_y;
        found.layout_w = layout.layout_w;
        found.layout_h = layout.layout_h;
      }
    }
    return json({ success: true });
  }),
  http.patch('*/api/devices/:deviceName/widget-assignments/layout', async ({ request }) => {
    const layout = await request.json().catch(() => ({}));
    const id = `${layout.tabNumber ?? layout.tab_number}::${layout.widget_name}`;
    const found = (state.assignments || []).find((a) => a.id === id);
    if (found) {
      found.layout_x = layout.layout_x;
      found.layout_y = layout.layout_y;
      found.layout_w = layout.layout_w;
      found.layout_h = layout.layout_h;
    }
    return json(found || { success: true });
  }),

  // ---- Users & chores ----
  http.get('*/api/users', () => json(fixtures.users)),
  http.get('*/api/chores', () => json(fixtures.chores)),
  http.get('*/api/chore-schedules', ({ request }) => {
    const url = new URL(request.url);
    let rows = fixtures.choreSchedules;
    if (url.searchParams.get('usage') === 'chart') {
      rows = rows.filter((s) => s.visible && !['until-completed', 'once-completed'].includes(s.duration));
    }
    const userId = url.searchParams.get('user_id');
    if (userId !== null) rows = rows.filter((s) => String(s.user_id) === userId);
    return json(rows);
  }),
  http.get('*/api/chore-history/recent', () => {
    const rows = state.history
      .map((h) => ({
        id: h.id,
        date: h.date,
        title: h.title,
        created_at: h.created_at,
        username: fixtures.users.find((u) => u.id === h.user_id)?.username || 'Someone',
      }))
      .sort((a, b) => (a.date < b.date ? 1 : -1));
    return json(rows);
  }),
  http.get('*/api/chore-history', ({ request }) => {
    const url = new URL(request.url);
    const date = url.searchParams.get('date');
    const userId = url.searchParams.get('user_id');
    let rows = state.history;
    if (date) rows = rows.filter((h) => h.date === date);
    if (userId !== null && userId !== undefined && userId !== '') {
      rows = rows.filter((h) => String(h.user_id) === userId);
    }
    return json(rows);
  }),
  http.post('*/api/chores/complete', async ({ request }) => {
    const { chore_schedule_id, user_id, date } = await request.json().catch(() => ({}));
    const schedule = fixtures.choreSchedules.find((s) => s.id === Number(chore_schedule_id));
    if (!schedule) return HttpResponse.json({ error: 'Schedule not found' }, { status: 404 });
    const dup = state.history.find(
      (h) => h.chore_schedule_id === Number(chore_schedule_id) && h.user_id === Number(user_id) && h.date === date,
    );
    if (dup) return HttpResponse.json({ error: 'Chore already completed for this date' }, { status: 409 });
    state.history.push({
      id: state.nextHistoryId++,
      user_id: Number(user_id),
      chore_schedule_id: Number(chore_schedule_id),
      date,
      created_at: new Date().toISOString(),
      title: schedule.title,
    });
    return json({ success: true });
  }),
  http.post('*/api/chores/uncomplete', async ({ request }) => {
    const { chore_schedule_id, user_id, date } = await request.json().catch(() => ({}));
    state.history = state.history.filter(
      (h) => !(h.chore_schedule_id === Number(chore_schedule_id) && h.user_id === Number(user_id) && h.date === date),
    );
    return json({ success: true });
  }),

  // ---- Calendar ----
  http.get('*/api/calendar-sources', () => json(fixtures.calendarSources)),
  http.get('*/api/calendar-sync/status', () => json(fixtures.calendarSyncStatus)),
  http.get('*/api/calendar-events', ({ request }) => {
    const url = new URL(request.url);
    const start = url.searchParams.get('start');
    const end = url.searchParams.get('end');
    let rows = fixtures.calendarEvents;
    if (start) rows = rows.filter((e) => new Date(e.end) >= new Date(start));
    if (end) rows = rows.filter((e) => new Date(e.start) <= new Date(end));
    return json(rows);
  }),

  // ---- Weather (served through the Home Assistant source) ----
  http.get('*/api/homeassistant/weather', ({ request }) => {
    const unit = new URL(request.url).searchParams.get('unit') === 'F' ? 'F' : 'C';
    return json(fixtures.weatherPayload(unit));
  }),
  http.get('*/api/homeassistant/status', () =>
    json({ configured: false, base_url: '', has_token: false, token_encrypted: false, weather_entity: 'weather.home' })),
  http.get('*/api/homeassistant/alert-rules', () => json([])),
  http.get('*/api/homeassistant/alerts', () => json([])),

  // ---- Quiet, empty responses for the rest of the surface ----
  http.get('*/api/photo-sources', () => json([])),
  http.get('*/api/photo-items', () => json([])),
  http.get('*/api/sounds', () => json([])),
  http.get('*/api/widgets', () => json([])),
  http.get('*/api/widgets/github', () => json([])),
  http.get('*/api/connections/google/status', () =>
    json({ connected: false, account: null, oauth: { configured: false }, encryption: { configured: false, status: 'missing' } })),

  // Backup showcase: export works from fixture state, import is disabled.
  http.post('*/api/config/export', () =>
    json({
      type: 'hearthboard-config-export',
      version: 1,
      exported_at: new Date().toISOString(),
      encrypted: false,
      data: {
        settings: Object.entries(fixtures.settings).map(([key, value]) => ({ key, value })),
        users: fixtures.users,
        chores: fixtures.chores,
        chore_schedules: fixtures.choreSchedules,
        chore_history: state.history,
        events: [],
        devices: [],
        tabs: state.tabs || [],
        calendar_sources: fixtures.calendarSources,
        calendar_sync_status: [],
        photo_sources: [],
        admin_pin: [],
      },
    })),
  http.post('*/api/config/import', () =>
    HttpResponse.json({ error: 'Import is disabled in the demo.' }, { status: 400 })),

  // Catch-all: anything unmocked fails visibly instead of hanging.
  http.all('*/api/*', ({ request }) => {
    console.warn(`[demo] Unmocked API call: ${request.method} ${request.url}`);
    return HttpResponse.json({ error: 'Not available in the demo.' }, { status: 501 });
  }),
];
