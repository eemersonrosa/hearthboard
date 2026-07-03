import React, { useState, useCallback, useEffect } from 'react';
import { Box, Alert, Collapse, IconButton } from '@mui/material';
import { Close } from '@mui/icons-material';
import axios from 'axios';
import { API_BASE_URL } from '../utils/apiConfig.js';
import useScheduledRefresh from '../utils/useScheduledRefresh.js';

const ALERT_POLL_INTERVAL_MS = 60 * 1000;

// Floating strip of active Home Assistant alerts (open door, light left on,
// …) evaluated server-side against the configured alert rules. Dismissing an
// alert hides it until its underlying state changes.
const HAAlertsBar = () => {
  const [alerts, setAlerts] = useState([]);
  const [dismissed, setDismissed] = useState({});

  const fetchAlerts = useCallback(async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/homeassistant/alerts`);
      setAlerts(Array.isArray(response.data?.alerts) ? response.data.alerts : []);
    } catch {
      // Alerts are best-effort; never disturb the dashboard over them.
      setAlerts([]);
    }
  }, []);

  useEffect(() => {
    void fetchAlerts();
  }, [fetchAlerts]);

  useScheduledRefresh(ALERT_POLL_INTERVAL_MS, fetchAlerts);

  const dismissKey = (alert) => `${alert.id}:${alert.state}`;

  const visibleAlerts = alerts.filter((alert) => !dismissed[dismissKey(alert)]);

  if (visibleAlerts.length === 0) {
    return null;
  }

  return (
    <Box
      sx={{
        position: 'fixed',
        top: 12,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9998,
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
        width: 'min(560px, calc(100vw - 32px))',
      }}
    >
      {visibleAlerts.map((alert) => (
        <Collapse in key={dismissKey(alert)}>
          <Alert
            severity="warning"
            variant="filled"
            sx={{ boxShadow: 'var(--shadow)' }}
            action={(
              <IconButton
                size="small"
                color="inherit"
                onClick={() => setDismissed((prev) => ({ ...prev, [dismissKey(alert)]: true }))}
              >
                <Close fontSize="small" />
              </IconButton>
            )}
          >
            {alert.message}
          </Alert>
        </Collapse>
      ))}
    </Box>
  );
};

export default HAAlertsBar;
