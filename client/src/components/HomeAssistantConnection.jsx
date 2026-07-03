import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Alert,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  IconButton,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';
import { Save, Delete, Add, Cable } from '@mui/icons-material';
import axios from 'axios';
import { API_BASE_URL } from '../utils/apiConfig.js';

const EMPTY_RULE = {
  name: '',
  entity_id: '',
  condition: 'state_equals',
  value: 'on',
  duration_minutes: 60,
};

// Admin > Connections card: Home Assistant base URL + token, optional weather
// entity override, connection test, and the alert rules the server evaluates.
const HomeAssistantConnection = ({ onMessage }) => {
  const [status, setStatus] = useState(null);
  const [baseUrl, setBaseUrl] = useState('');
  const [token, setToken] = useState('');
  const [weatherEntity, setWeatherEntity] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [saving, setSaving] = useState(false);
  const [rules, setRules] = useState([]);
  const [newRule, setNewRule] = useState({ ...EMPTY_RULE });

  const notify = useCallback((type, text) => {
    if (onMessage) onMessage({ type, text });
  }, [onMessage]);

  const fetchStatus = useCallback(async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/homeassistant/status`);
      setStatus(response.data);
      setBaseUrl(response.data?.base_url || '');
      setWeatherEntity(response.data?.weather_entity || '');
    } catch (error) {
      console.error('Error fetching Home Assistant status:', error);
    }
  }, []);

  const fetchRules = useCallback(async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/homeassistant/alert-rules`);
      setRules(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Error fetching Home Assistant alert rules:', error);
    }
  }, []);

  useEffect(() => {
    void fetchStatus();
    void fetchRules();
  }, [fetchStatus, fetchRules]);

  const saveConfig = async () => {
    try {
      setSaving(true);
      const payload = { base_url: baseUrl.trim(), weather_entity: weatherEntity.trim() };
      if (token.trim()) {
        payload.token = token.trim();
      }
      const response = await axios.post(`${API_BASE_URL}/api/homeassistant/config`, payload);
      setStatus(response.data?.status || null);
      setToken('');
      notify('success', 'Home Assistant settings saved.');
    } catch (error) {
      notify('error', error.response?.data?.error || 'Failed to save Home Assistant settings.');
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async () => {
    try {
      setTesting(true);
      const response = await axios.get(`${API_BASE_URL}/api/homeassistant/status?test=1`);
      setStatus(response.data);
      setTestResult(response.data?.connection || { ok: false, message: 'Not configured yet.' });
    } catch (error) {
      setTestResult({ ok: false, message: error.response?.data?.error || 'Test failed.' });
    } finally {
      setTesting(false);
    }
  };

  const persistRules = async (nextRules) => {
    try {
      const response = await axios.put(`${API_BASE_URL}/api/homeassistant/alert-rules`, nextRules);
      setRules(Array.isArray(response.data) ? response.data : nextRules);
      notify('success', 'Alert rules saved.');
    } catch (error) {
      notify('error', error.response?.data?.error || 'Failed to save alert rules.');
    }
  };

  const addRule = () => {
    if (!newRule.entity_id.trim()) return;
    const nextRules = [...rules, { ...newRule, entity_id: newRule.entity_id.trim() }];
    setNewRule({ ...EMPTY_RULE });
    void persistRules(nextRules);
  };

  const removeRule = (ruleId) => {
    void persistRules(rules.filter((rule) => rule.id !== ruleId));
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Cable />
        <Typography variant="h6">Home Assistant</Typography>
        {status?.configured && (
          <Chip label="Configured" color="success" size="small" />
        )}
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Connect a Home Assistant instance to control devices from the dashboard panel, use it
        as the weather source (no OpenWeatherMap key needed), and raise alerts from entity
        states. Create a long-lived access token in Home Assistant under your profile.
      </Typography>

      <TextField
        fullWidth
        label="Home Assistant URL"
        placeholder="http://homeassistant.local:8123"
        value={baseUrl}
        onChange={(e) => setBaseUrl(e.target.value)}
        sx={{ mb: 2 }}
      />
      <TextField
        fullWidth
        label="Long-Lived Access Token"
        type="password"
        placeholder={status?.has_token ? '•••••••• (saved — enter to replace)' : ''}
        value={token}
        onChange={(e) => setToken(e.target.value)}
        sx={{ mb: 2 }}
        helperText={status?.has_token && !status?.token_encrypted
          ? 'Stored unencrypted; set ENCRYPTION_KEY on the server to encrypt it at rest.'
          : ' '}
      />
      <TextField
        fullWidth
        label="Weather entity (optional)"
        placeholder="weather.home — leave blank to auto-detect"
        value={weatherEntity}
        onChange={(e) => setWeatherEntity(e.target.value)}
        sx={{ mb: 2 }}
      />

      <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
        <Button variant="contained" onClick={saveConfig} startIcon={<Save />} disabled={saving}>
          {saving ? 'Saving…' : 'Save Home Assistant Settings'}
        </Button>
        <Button variant="outlined" onClick={testConnection} disabled={testing || !status?.configured}>
          {testing ? 'Testing…' : 'Test Connection'}
        </Button>
      </Box>

      {testResult && (
        <Alert severity={testResult.ok ? 'success' : 'error'} sx={{ mb: 2 }}>
          {testResult.message}{testResult.version ? ` (v${testResult.version})` : ''}
        </Alert>
      )}

      <Typography variant="subtitle1" sx={{ fontWeight: 600, mt: 3, mb: 1 }}>
        Alerts
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Alerts show as a banner on every display while the rule matches — for example a door
        left open, or a light that has been on for hours.
      </Typography>

      {rules.length > 0 && (
        <Table size="small" sx={{ mb: 2 }}>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Entity</TableCell>
              <TableCell>Condition</TableCell>
              <TableCell align="right" />
            </TableRow>
          </TableHead>
          <TableBody>
            {rules.map((rule) => (
              <TableRow key={rule.id}>
                <TableCell>{rule.name}</TableCell>
                <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{rule.entity_id}</TableCell>
                <TableCell>
                  {rule.condition === 'state_for_minutes'
                    ? `"${rule.value}" for ${rule.duration_minutes}+ min`
                    : `state is "${rule.value}"`}
                </TableCell>
                <TableCell align="right">
                  <IconButton size="small" color="error" onClick={() => removeRule(rule.id)}>
                    <Delete fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField
          size="small"
          label="Alert name"
          value={newRule.name}
          onChange={(e) => setNewRule((prev) => ({ ...prev, name: e.target.value }))}
          sx={{ width: 160 }}
        />
        <TextField
          size="small"
          label="Entity ID"
          placeholder="binary_sensor.front_door"
          value={newRule.entity_id}
          onChange={(e) => setNewRule((prev) => ({ ...prev, entity_id: e.target.value }))}
          sx={{ width: 220 }}
        />
        <FormControl size="small" sx={{ width: 170 }}>
          <InputLabel>Condition</InputLabel>
          <Select
            label="Condition"
            value={newRule.condition}
            onChange={(e) => setNewRule((prev) => ({ ...prev, condition: e.target.value }))}
          >
            <MenuItem value="state_equals">State equals</MenuItem>
            <MenuItem value="state_for_minutes">State held for minutes</MenuItem>
          </Select>
        </FormControl>
        <TextField
          size="small"
          label="State"
          value={newRule.value}
          onChange={(e) => setNewRule((prev) => ({ ...prev, value: e.target.value }))}
          sx={{ width: 90 }}
        />
        {newRule.condition === 'state_for_minutes' && (
          <TextField
            size="small"
            label="Minutes"
            type="number"
            value={newRule.duration_minutes}
            onChange={(e) => setNewRule((prev) => ({ ...prev, duration_minutes: parseInt(e.target.value, 10) || 0 }))}
            sx={{ width: 100 }}
          />
        )}
        <Button
          variant="outlined"
          startIcon={<Add />}
          onClick={addRule}
          disabled={!newRule.entity_id.trim()}
        >
          Add Alert
        </Button>
      </Box>
    </Box>
  );
};

export default HomeAssistantConnection;
