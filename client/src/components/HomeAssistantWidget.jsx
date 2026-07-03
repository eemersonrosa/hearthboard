import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  Switch,
  IconButton,
  TextField,
  Chip,
  CircularProgress,
  Alert,
  Tooltip,
} from '@mui/material';
import { Star, StarBorder, Refresh, PowerSettingsNew } from '@mui/icons-material';
import axios from 'axios';
import { API_BASE_URL } from '../utils/apiConfig.js';
import { getDeviceApiBase } from '../utils/deviceName.js';
import useScheduledRefresh from '../utils/useScheduledRefresh.js';

// Domains the panel can control with a simple on/off toggle.
const TOGGLE_DOMAINS = new Set(['light', 'switch', 'fan', 'input_boolean']);
// Domains shown in the panel by default.
const PANEL_DOMAINS = 'light,switch,fan,cover,lock,climate,sensor,binary_sensor,input_boolean,scene,script';

const domainOf = (entityId) => entityId.split('.')[0];

const HomeAssistantWidget = ({ transparentBackground, refreshInterval = 0 }) => {
  const API_DEVICE_URL = getDeviceApiBase(API_BASE_URL);
  const [entities, setEntities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('');
  const [favorites, setFavorites] = useState([]);
  const [favoritesLoaded, setFavoritesLoaded] = useState(false);
  const [busyEntity, setBusyEntity] = useState(null);

  const fetchEntities = useCallback(async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/homeassistant/entities`, {
        params: { domains: PANEL_DOMAINS },
      });
      setEntities(Array.isArray(response.data) ? response.data : []);
      setError('');
    } catch (fetchError) {
      const message = fetchError.response?.data?.error || 'Could not reach Home Assistant';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchEntities();
  }, [fetchEntities]);

  useScheduledRefresh(refreshInterval > 0 ? refreshInterval : 60 * 1000, fetchEntities);

  // Favorites persist per device profile so the family panel shows the same
  // pinned entities on every shared display.
  useEffect(() => {
    const loadFavorites = async () => {
      try {
        const response = await axios.get(`${API_DEVICE_URL}/settings`);
        const saved = response.data?.homeAssistantWidgetSettings?.favorites;
        if (Array.isArray(saved)) {
          setFavorites(saved);
        }
      } catch (loadError) {
        console.error('Error loading Home Assistant widget settings:', loadError);
      } finally {
        setFavoritesLoaded(true);
      }
    };

    void loadFavorites();
  }, [API_DEVICE_URL]);

  useEffect(() => {
    if (!favoritesLoaded) return undefined;

    const timeoutId = setTimeout(async () => {
      try {
        await axios.patch(`${API_DEVICE_URL}/settings`, {
          homeAssistantWidgetSettings: { favorites },
        });
      } catch (saveError) {
        console.error('Error saving Home Assistant widget settings:', saveError);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [API_DEVICE_URL, favorites, favoritesLoaded]);

  const toggleFavorite = (entityId) => {
    setFavorites((prev) => (
      prev.includes(entityId) ? prev.filter((id) => id !== entityId) : [...prev, entityId]
    ));
  };

  const callService = async (domain, service, entityId, data) => {
    try {
      setBusyEntity(entityId);
      await axios.post(`${API_BASE_URL}/api/homeassistant/service`, {
        domain,
        service,
        entity_id: entityId,
        data,
      });
      await fetchEntities();
    } catch (serviceError) {
      const message = serviceError.response?.data?.error || 'Service call failed';
      setError(message);
    } finally {
      setBusyEntity(null);
    }
  };

  const handleToggle = (entity) => {
    const domain = domainOf(entity.entity_id);
    if (TOGGLE_DOMAINS.has(domain)) {
      void callService('homeassistant', 'toggle', entity.entity_id);
    } else if (domain === 'cover') {
      void callService('cover', entity.state === 'open' ? 'close_cover' : 'open_cover', entity.entity_id);
    } else if (domain === 'lock') {
      void callService('lock', entity.state === 'locked' ? 'unlock' : 'lock', entity.entity_id);
    } else if (domain === 'scene') {
      void callService('scene', 'turn_on', entity.entity_id);
    } else if (domain === 'script') {
      void callService('script', 'turn_on', entity.entity_id);
    }
  };

  const isActionable = (entity) => {
    const domain = domainOf(entity.entity_id);
    return TOGGLE_DOMAINS.has(domain) || ['cover', 'lock', 'scene', 'script'].includes(domain);
  };

  const filteredEntities = useMemo(() => {
    const query = filter.trim().toLowerCase();
    const matching = query
      ? entities.filter((entity) => (
        entity.entity_id.toLowerCase().includes(query)
        || (entity.friendly_name || '').toLowerCase().includes(query)
      ))
      : entities;

    const favoriteSet = new Set(favorites);
    return [...matching].sort((a, b) => {
      const aFav = favoriteSet.has(a.entity_id) ? 0 : 1;
      const bFav = favoriteSet.has(b.entity_id) ? 0 : 1;
      if (aFav !== bFav) return aFav - bFav;
      return (a.friendly_name || a.entity_id).localeCompare(b.friendly_name || b.entity_id);
    });
  }, [entities, filter, favorites]);

  // Without a search, an unfiltered HA install can have hundreds of
  // entities; show favorites plus a capped list.
  const visibleEntities = useMemo(() => {
    if (filter.trim()) return filteredEntities.slice(0, 50);
    if (favorites.length > 0) {
      return filteredEntities.filter((entity) => favorites.includes(entity.entity_id));
    }
    return filteredEntities.slice(0, 20);
  }, [filteredEntities, filter, favorites]);

  const renderEntityState = (entity) => {
    const domain = domainOf(entity.entity_id);

    if (TOGGLE_DOMAINS.has(domain)) {
      return (
        <Switch
          size="small"
          checked={entity.state === 'on'}
          onChange={() => handleToggle(entity)}
          disabled={busyEntity === entity.entity_id}
        />
      );
    }

    if (['cover', 'lock', 'scene', 'script'].includes(domain)) {
      return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Typography variant="caption" sx={{ color: 'var(--text-secondary)' }}>
            {entity.state}
          </Typography>
          <Tooltip title={domain === 'scene' || domain === 'script' ? 'Run' : 'Toggle'}>
            <span>
              <IconButton
                size="small"
                onClick={() => handleToggle(entity)}
                disabled={busyEntity === entity.entity_id}
                sx={{ color: 'var(--accent)' }}
              >
                <PowerSettingsNew fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </Box>
      );
    }

    return (
      <Typography variant="body2" sx={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
        {entity.state}
        {entity.unit_of_measurement ? ` ${entity.unit_of_measurement}` : ''}
      </Typography>
    );
  };

  return (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        p: 2,
        bgcolor: transparentBackground ? 'transparent' : undefined,
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5, gap: 1 }}>
        <Typography variant="h6" sx={{ whiteSpace: 'nowrap' }}>Home Assistant</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1, justifyContent: 'flex-end' }}>
          <TextField
            size="small"
            placeholder="Search entities…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            sx={{ maxWidth: 220, flex: 1 }}
          />
          <IconButton size="small" onClick={fetchEntities} title="Refresh">
            <Refresh fontSize="small" />
          </IconButton>
        </Box>
      </Box>

      {error && <Alert severity="warning" sx={{ mb: 1 }}>{error}</Alert>}

      {loading ? (
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CircularProgress size={32} />
        </Box>
      ) : (
        <Box sx={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          {visibleEntities.length === 0 ? (
            <Typography variant="body2" sx={{ color: 'var(--text-secondary)', textAlign: 'center', py: 2 }}>
              {filter.trim()
                ? 'No entities match the search.'
                : 'Search for entities and star the ones this panel should show.'}
            </Typography>
          ) : (
            visibleEntities.map((entity) => (
              <Box
                key={entity.entity_id}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  px: 1,
                  py: 0.75,
                  mb: 0.5,
                  borderRadius: 1.5,
                  border: '1px solid var(--card-border)',
                  bgcolor: entity.state === 'on' ? 'rgba(var(--accent-rgb), 0.08)' : 'transparent',
                }}
              >
                <IconButton size="small" onClick={() => toggleFavorite(entity.entity_id)}>
                  {favorites.includes(entity.entity_id)
                    ? <Star fontSize="small" sx={{ color: 'var(--warning)' }} />
                    : <StarBorder fontSize="small" sx={{ color: 'var(--text-secondary)' }} />}
                </IconButton>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" sx={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {entity.friendly_name}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'var(--text-secondary)' }}>
                    <Chip
                      label={domainOf(entity.entity_id)}
                      size="small"
                      variant="outlined"
                      sx={{ height: 16, fontSize: '0.65rem', mr: 0.5 }}
                    />
                    {entity.entity_id}
                  </Typography>
                </Box>
                {renderEntityState(entity)}
              </Box>
            ))
          )}
        </Box>
      )}
    </Box>
  );
};

export default HomeAssistantWidget;
