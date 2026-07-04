// Sample data for the public demo build (VITE_DEMO_MODE=1).
// All dates are generated relative to "now" so the showcase never looks stale.

const pad = (n) => String(n).padStart(2, '0');

export const toDateString = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const at = (dayOffset, hours, minutes = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hours, minutes, 0, 0);
  return d;
};

const todayWeekday = new Date().getDay();

export const timezone =
  Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Edmonton';

export const users = [
  { id: 1, username: 'Alice', profile_picture: null },
  { id: 2, username: 'Ben', profile_picture: null },
  { id: 3, username: 'Maya', profile_picture: null },
];

export const chores = [
  { id: 1, title: 'Do the dishes', description: 'Load and run the dishwasher', is_bonus: 0 },
  { id: 2, title: 'Take out the trash', description: 'Bins go out tonight', is_bonus: 0 },
  { id: 3, title: 'Feed the dog', description: 'One scoop, fresh water', is_bonus: 0 },
  { id: 4, title: 'Vacuum living room', description: '', is_bonus: 0 },
  { id: 5, title: 'Water the plants', description: 'Kitchen + balcony', is_bonus: 1 },
  { id: 6, title: 'Clean the garage', description: 'Sticky until someone does it', is_bonus: 0 },
  { id: 7, title: 'Homework', description: 'Before screen time', is_bonus: 0 },
];

// Shape matches GET /api/chore-schedules (chore_schedules.* joined with
// chores.title/description/is_bonus).
const schedule = (id, choreId, userId, crontab, extra = {}) => {
  const chore = chores.find((c) => c.id === choreId);
  return {
    id,
    chore_id: choreId,
    user_id: userId,
    crontab,
    visible: 1,
    created_at: at(-30, 12).toISOString(),
    duration: 'day-of',
    interval: null,
    parent_schedule_id: null,
    title: chore.title,
    description: chore.description,
    is_bonus: chore.is_bonus,
    ...extra,
  };
};

export const choreSchedules = [
  schedule(1, 1, 1, '0 0 * * *'), // Alice: dishes, daily
  schedule(2, 3, 1, '0 0 * * *'), // Alice: feed the dog, daily
  schedule(3, 2, 2, `0 0 * * ${todayWeekday}`), // Ben: trash, weekly (today)
  schedule(4, 7, 3, '0 0 * * *'), // Maya: homework, daily
  schedule(5, 4, 2, `0 0 * * ${todayWeekday}`), // Ben: vacuum, weekly (today)
  schedule(6, 5, null, '0 0 * * *'), // bonus: water the plants, unassigned
  schedule(7, 6, 1, null, { duration: 'until-completed' }), // sticky: garage
];

// A few completions from earlier this week for the history views.
let historyId = 1;
const historyEntry = (userId, scheduleId, dayOffset) => {
  const sched = choreSchedules.find((s) => s.id === scheduleId);
  return {
    id: historyId++,
    user_id: userId,
    chore_schedule_id: scheduleId,
    date: toDateString(at(dayOffset, 0)),
    created_at: at(dayOffset, 19).toISOString(),
    title: sched ? sched.title : 'Chore',
  };
};

export const choreHistory = [
  historyEntry(1, 1, -1),
  historyEntry(1, 2, -1),
  historyEntry(3, 4, -1),
  historyEntry(2, 3, -2),
  historyEntry(1, 1, -2),
  historyEntry(3, 4, -3),
];

export const calendarSources = [
  { id: 1, name: 'Family', type: 'ICS', url: '', username: null, color: '#38bdf8', enabled: 1, sort_order: 0, created_at: at(-60, 9).toISOString() },
  { id: 2, name: 'School', type: 'ICS', url: '', username: null, color: '#f472b6', enabled: 1, sort_order: 1, created_at: at(-60, 9).toISOString() },
];

// Shape matches calendarSync.getCachedEvents(): dates serialize to ISO strings.
let eventId = 1;
const event = (sourceId, title, start, end, opts = {}) => {
  const source = calendarSources.find((s) => s.id === sourceId);
  return {
    id: `demo-event-${eventId++}`,
    title,
    start: start.toISOString(),
    end: end.toISOString(),
    description: opts.description || null,
    location: opts.location || null,
    all_day: Boolean(opts.allDay),
    source_id: sourceId,
    source_name: source.name,
    source_color: source.color,
  };
};

const allDay = (sourceId, title, dayOffset, days = 1, opts = {}) =>
  event(sourceId, title, at(dayOffset, 0), at(dayOffset + days, 0), { ...opts, allDay: true });

export const calendarEvents = [
  // This week
  event(1, 'Soccer practice', at(0, 17, 30), at(0, 18, 30), { location: 'Community field' }),
  event(1, 'Dentist — Ben', at(1, 15, 0), at(1, 16, 0)),
  event(2, 'Science fair setup', at(2, 9, 0), at(2, 11, 0), { location: 'School gym' }),
  event(1, 'Movie night', at((5 - todayWeekday + 7) % 7 || 7, 19, 0), at((5 - todayWeekday + 7) % 7 || 7, 21, 30)),
  allDay(1, "Grandma's birthday", 3),
  // Next week
  event(1, 'Soccer practice', at(7, 17, 30), at(7, 18, 30), { location: 'Community field' }),
  allDay(1, 'Family camping trip', 9, 3, { location: 'Lakeside campground' }),
  event(2, 'Parent–teacher meetings', at(8, 16, 0), at(8, 18, 0)),
  // Earlier this week / filler across the month
  event(1, 'Soccer practice', at(-2, 17, 30), at(-2, 18, 30)),
  allDay(2, 'No school — PD day', 12),
  event(1, 'Vet appointment', at(15, 10, 0), at(15, 10, 45)),
  event(2, 'Book fair', at(17, 8, 30), at(17, 15, 0), { location: 'School library' }),
  event(1, 'Date night', at(18, 19, 0), at(18, 22, 0)),
  allDay(1, 'Recycling pickup', 6),
  event(2, 'Swim lessons — Maya', at(4, 16, 0), at(4, 16, 45), { location: 'Rec centre pool' }),
  event(2, 'Swim lessons — Maya', at(11, 16, 0), at(11, 16, 45), { location: 'Rec centre pool' }),
];

export const calendarSyncStatus = calendarSources.map((s) => ({
  source_id: s.id,
  last_sync_at: at(0, new Date().getHours()).toISOString(),
  last_sync_status: 'success',
  last_sync_message: 'Demo data',
  event_count: calendarEvents.filter((e) => e.source_id === s.id).length,
  sync_interval_minutes: 15,
  source_name: s.name,
}));

// Shape matches homeAssistant.getWeatherPayload().
export const weatherPayload = (unit = 'C') => {
  const conv = (c) => (unit === 'F' ? Math.round((c * 9) / 5 + 32) : c);
  const day = (dayOffset, icon, description, high, low, precipitation) => {
    const date = at(dayOffset, 12);
    return {
      date: date.toISOString(),
      dayName: date.toLocaleDateString('en-US', { weekday: 'short' }),
      tempHigh: conv(high),
      tempLow: conv(low),
      tempAvg: conv(Math.round((high + low) / 2)),
      weather: { icon, description, main: description },
      precipitation,
    };
  };
  return {
    source: 'homeassistant',
    entity_id: 'weather.home',
    coordinates: { lat: null, lon: null },
    resolvedName: 'Home',
    weatherData: {
      name: 'Home',
      weather: [{ icon: '02d', description: 'partly cloudy', main: 'partly cloudy' }],
      main: { temp: conv(22), feels_like: conv(21), humidity: 48 },
      wind: { speed: 11 },
    },
    airQualityData: null,
    forecastData: [
      day(1, '01d', 'sunny', 26, 14, 0),
      day(2, '10d', 'rainy', 19, 12, 60),
      day(3, '02d', 'partly cloudy', 23, 13, 10),
    ],
    chartData: [],
  };
};

export const settings = {
  WEATHER_SOURCE: 'homeassistant',
  CHORE_SOUND_ENABLED: 'false',
  PROXY_WHITELIST: '',
};

export const deviceSettings = {
  widgetSettings: {
    chores: { enabled: true, transparent: false, refreshInterval: 0 },
    calendar: { enabled: true, transparent: false, refreshInterval: 0 },
    weather: { enabled: true, transparent: false, refreshInterval: 0 },
    photos: { enabled: false, transparent: false, refreshInterval: 0 },
    homeassistant: { enabled: false, transparent: false, refreshInterval: 0 },
  },
  weatherTempUnit: 'C',
};

export const buildTabs = (deviceName) => [
  { id: 1, device_name: deviceName, number: 1, label: 'Home', icon: 'home', show_label: 1, created_at: at(-60, 9).toISOString(), config_json: '{}' },
  { id: 2, device_name: deviceName, number: 2, label: 'Calendar', icon: 'calendar_month', show_label: 1, created_at: at(-60, 9).toISOString(), config_json: '{}' },
];

// Null layout values let the app place widgets with its default sizes.
const assignment = (tabNumber, widgetName, deviceName) => ({
  id: `${tabNumber}::${widgetName}`,
  device_name: deviceName,
  tab_number: tabNumber,
  widget_name: widgetName,
  layout_x: null,
  layout_y: null,
  layout_w: null,
  layout_h: null,
});

export const buildAssignments = (deviceName) => [
  assignment(1, 'chores', deviceName),
  assignment(1, 'calendar', deviceName),
  assignment(1, 'weather', deviceName),
  assignment(2, 'calendar', deviceName),
];
