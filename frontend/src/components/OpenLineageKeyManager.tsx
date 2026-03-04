import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import AutorenewRoundedIcon from '@mui/icons-material/AutorenewRounded';
import BlockRoundedIcon from '@mui/icons-material/BlockRounded';
import {
  createOpenLineageApiKey,
  listOpenLineageApiKeys,
  OpenLineageApiKeyCreatePayload,
  OpenLineageApiKeyRotatePayload,
  revokeOpenLineageApiKey,
  rotateOpenLineageApiKey,
} from '../services/api';
import { useI18n } from '../i18n/I18nProvider';

type KeyManagerProps = {
  adminKey: string;
};

type KeyRow = {
  id: number;
  key_name: string;
  key_prefix: string;
  is_active: boolean;
  expires_at?: string | null;
  revoked_at?: string | null;
  last_used_at?: string | null;
  created_at?: string | null;
  policy?: {
    allowed_job_namespaces?: string[] | null;
    allowed_dataset_namespaces?: string[] | null;
    requests_per_minute?: number | null;
    requests_per_day?: number | null;
  };
};

const toStringList = (value: string): string[] => {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const parseOptionalPositive = (value: string): number | undefined => {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  return parsed;
};

const formatTimestamp = (value: string | null | undefined, locale: 'en' | 'zh'): string => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(locale === 'zh' ? 'zh-CN' : 'en-US', { hour12: false });
};

const OpenLineageKeyManager: React.FC<KeyManagerProps> = ({ adminKey }) => {
  const { locale, t } = useI18n();
  const [rows, setRows] = useState<KeyRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);

  const [keyName, setKeyName] = useState('');
  const [expiresInDays, setExpiresInDays] = useState('');
  const [allowedJobNamespaces, setAllowedJobNamespaces] = useState('');
  const [allowedDatasetNamespaces, setAllowedDatasetNamespaces] = useState('');
  const [requestsPerMinute, setRequestsPerMinute] = useState('');
  const [requestsPerDay, setRequestsPerDay] = useState('');
  const [rotateTarget, setRotateTarget] = useState<KeyRow | null>(null);
  const [rotateExpiresInDays, setRotateExpiresInDays] = useState('');
  const [rotateAllowedJobs, setRotateAllowedJobs] = useState('');
  const [rotateAllowedDatasets, setRotateAllowedDatasets] = useState('');
  const [rotateRequestsPerMinute, setRotateRequestsPerMinute] = useState('');
  const [rotateRequestsPerDay, setRotateRequestsPerDay] = useState('');

  const canOperate = adminKey.trim().length > 0;

  const load = async () => {
    if (!canOperate) return;
    setLoading(true);
    setError(null);
    try {
      const resp = await listOpenLineageApiKeys(adminKey, true);
      setRows(resp.data?.keys || []);
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : t('admin.keys.error.load'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminKey]);

  const createPayload = useMemo<OpenLineageApiKeyCreatePayload>(() => {
    const payload: OpenLineageApiKeyCreatePayload = {
      key_name: keyName.trim(),
    };

    if (expiresInDays.trim()) payload.expires_in_days = Number(expiresInDays);
    const jobs = toStringList(allowedJobNamespaces);
    if (jobs.length > 0) payload.allowed_job_namespaces = jobs;
    const datasets = toStringList(allowedDatasetNamespaces);
    if (datasets.length > 0) payload.allowed_dataset_namespaces = datasets;
    if (requestsPerMinute.trim()) payload.requests_per_minute = Number(requestsPerMinute);
    if (requestsPerDay.trim()) payload.requests_per_day = Number(requestsPerDay);
    return payload;
  }, [keyName, expiresInDays, allowedJobNamespaces, allowedDatasetNamespaces, requestsPerMinute, requestsPerDay]);

  const handleCreate = async () => {
    if (!canOperate) return;
    if (!createPayload.key_name) {
      setError(t('admin.keys.error.nameRequired'));
      return;
    }
    setError(null);
    setSuccess(null);
    setCreatedSecret(null);
    try {
      const resp = await createOpenLineageApiKey(createPayload, adminKey);
      const secret = resp.data?.api_key;
      if (secret) {
        setCreatedSecret(secret);
      }
      setSuccess(t('admin.keys.success.created'));
      setKeyName('');
      setExpiresInDays('');
      setAllowedJobNamespaces('');
      setAllowedDatasetNamespaces('');
      setRequestsPerMinute('');
      setRequestsPerDay('');
      await load();
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : t('admin.keys.error.create'));
    }
  };

  const handleRevoke = async (id: number) => {
    setError(null);
    setSuccess(null);
    try {
      await revokeOpenLineageApiKey(id, adminKey);
      setSuccess(t('admin.keys.success.revoked', undefined, { id }));
      await load();
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : t('admin.keys.error.revoke'));
    }
  };

  const openRotateDialog = (row: KeyRow) => {
    setRotateTarget(row);
    setRotateExpiresInDays('');
    setRotateAllowedJobs((row.policy?.allowed_job_namespaces || []).join(', '));
    setRotateAllowedDatasets((row.policy?.allowed_dataset_namespaces || []).join(', '));
    setRotateRequestsPerMinute(
      row.policy?.requests_per_minute !== undefined && row.policy?.requests_per_minute !== null
        ? String(row.policy.requests_per_minute)
        : ''
    );
    setRotateRequestsPerDay(
      row.policy?.requests_per_day !== undefined && row.policy?.requests_per_day !== null
        ? String(row.policy.requests_per_day)
        : ''
    );
  };

  const closeRotateDialog = () => {
    setRotateTarget(null);
  };

  const handleRotate = async () => {
    if (!rotateTarget) return;
    setError(null);
    setSuccess(null);
    setCreatedSecret(null);
    const payload: OpenLineageApiKeyRotatePayload = {};
    const expires = parseOptionalPositive(rotateExpiresInDays);
    if (expires !== undefined) payload.expires_in_days = expires;
    const jobs = toStringList(rotateAllowedJobs);
    if (jobs.length > 0) payload.allowed_job_namespaces = jobs;
    const datasets = toStringList(rotateAllowedDatasets);
    if (datasets.length > 0) payload.allowed_dataset_namespaces = datasets;
    const rpm = parseOptionalPositive(rotateRequestsPerMinute);
    if (rpm !== undefined) payload.requests_per_minute = rpm;
    const rpd = parseOptionalPositive(rotateRequestsPerDay);
    if (rpd !== undefined) payload.requests_per_day = rpd;

    try {
      const resp = await rotateOpenLineageApiKey(rotateTarget.id, payload, adminKey);
      const secret = resp.data?.new_key?.api_key;
      if (secret) {
        setCreatedSecret(secret);
      }
      setSuccess(t('admin.keys.success.rotated', undefined, { id: rotateTarget.id }));
      closeRotateDialog();
      await load();
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : t('admin.keys.error.rotate'));
    }
  };

  return (
    <Stack spacing={2}>
      <Paper sx={{ p: 2.5 }}>
        <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>
          {t('admin.keys.createTitle')}
        </Typography>

        <Stack spacing={1.5}>
          <TextField
            label={t('admin.keys.name')}
            value={keyName}
            onChange={(e) => setKeyName(e.target.value)}
            fullWidth
            size="small"
          />
          <TextField
            label={t('admin.keys.expiresInDays')}
            value={expiresInDays}
            onChange={(e) => setExpiresInDays(e.target.value)}
            type="number"
            fullWidth
            size="small"
          />
          <TextField
            label={t('admin.keys.allowedJobNamespaces')}
            value={allowedJobNamespaces}
            onChange={(e) => setAllowedJobNamespaces(e.target.value)}
            fullWidth
            size="small"
          />
          <TextField
            label={t('admin.keys.allowedDatasetNamespaces')}
            value={allowedDatasetNamespaces}
            onChange={(e) => setAllowedDatasetNamespaces(e.target.value)}
            fullWidth
            size="small"
          />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <TextField
              label={t('admin.keys.rpm')}
              value={requestsPerMinute}
              onChange={(e) => setRequestsPerMinute(e.target.value)}
              type="number"
              size="small"
              fullWidth
            />
            <TextField
              label={t('admin.keys.rpd')}
              value={requestsPerDay}
              onChange={(e) => setRequestsPerDay(e.target.value)}
              type="number"
              size="small"
              fullWidth
            />
          </Stack>
          <Box>
            <Button variant="contained" onClick={handleCreate} disabled={!canOperate}>
              {t('admin.keys.create')}
            </Button>
          </Box>
        </Stack>
      </Paper>

      {error && <Alert severity="error">{error}</Alert>}
      {success && <Alert severity="success">{success}</Alert>}
      {createdSecret && (
        <Alert severity="warning">
          <Typography variant="body2" sx={{ mb: 0.5 }}>
            {t('admin.keys.copyOnce')}
          </Typography>
          <Typography variant="body2" sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
            {createdSecret}
          </Typography>
        </Alert>
      )}

      <Paper sx={{ p: 2.5 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
          <Typography variant="subtitle1" fontWeight={700}>
            {t('admin.keys.listTitle')}
          </Typography>
          <Button startIcon={<RefreshRoundedIcon />} onClick={load} disabled={!canOperate || loading}>
            {t('admin.audit.load')}
          </Button>
        </Stack>

        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t('admin.keys.id')}</TableCell>
                <TableCell>{t('admin.keys.name')}</TableCell>
                <TableCell>{t('admin.keys.prefix')}</TableCell>
                <TableCell>{t('admin.keys.active')}</TableCell>
                <TableCell>{t('admin.keys.policy')}</TableCell>
                <TableCell>{t('admin.keys.lastUsed')}</TableCell>
                <TableCell align="right">{t('runs.table.actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7}>
                    <Typography variant="body2" color="text.secondary">
                      {t('admin.keys.none')}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.id}</TableCell>
                    <TableCell>{row.key_name}</TableCell>
                    <TableCell>{row.key_prefix}</TableCell>
                    <TableCell>{row.is_active ? t('common.true') : t('common.false')}</TableCell>
                    <TableCell sx={{ maxWidth: 280 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        {t('admin.keys.policyJobs')}: {(row.policy?.allowed_job_namespaces || []).join(', ') || '*'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        {t('admin.keys.policyDatasets')}: {(row.policy?.allowed_dataset_namespaces || []).join(', ') || '*'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        {t('admin.keys.policyRate')}: {row.policy?.requests_per_minute || '-'} / {row.policy?.requests_per_day || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>{formatTimestamp(row.last_used_at, locale)}</TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={1} justifyContent="flex-end">
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<AutorenewRoundedIcon />}
                          onClick={() => openRotateDialog(row)}
                          disabled={!canOperate}
                        >
                          {t('admin.keys.rotate')}
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          color="error"
                          startIcon={<BlockRoundedIcon />}
                          onClick={() => handleRevoke(row.id)}
                          disabled={!canOperate || !row.is_active}
                        >
                          {t('admin.keys.revoke')}
                        </Button>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Box>
      </Paper>

      <Dialog open={Boolean(rotateTarget)} onClose={closeRotateDialog} fullWidth maxWidth="sm">
        <DialogTitle>{t('admin.keys.rotate')}</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ mt: 0.5 }}>
            <TextField
              size="small"
              label={t('admin.keys.expiresInDays')}
              value={rotateExpiresInDays}
              onChange={(e) => setRotateExpiresInDays(e.target.value)}
              type="number"
              fullWidth
            />
            <TextField
              size="small"
              label={t('admin.keys.allowedJobNamespaces')}
              value={rotateAllowedJobs}
              onChange={(e) => setRotateAllowedJobs(e.target.value)}
              fullWidth
            />
            <TextField
              size="small"
              label={t('admin.keys.allowedDatasetNamespaces')}
              value={rotateAllowedDatasets}
              onChange={(e) => setRotateAllowedDatasets(e.target.value)}
              fullWidth
            />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
              <TextField
                size="small"
                label={t('admin.keys.rpm')}
                value={rotateRequestsPerMinute}
                onChange={(e) => setRotateRequestsPerMinute(e.target.value)}
                type="number"
                fullWidth
              />
              <TextField
                size="small"
                label={t('admin.keys.rpd')}
                value={rotateRequestsPerDay}
                onChange={(e) => setRotateRequestsPerDay(e.target.value)}
                type="number"
                fullWidth
              />
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeRotateDialog}>{t('lineage.close')}</Button>
          <Button variant="contained" onClick={handleRotate}>
            {t('admin.keys.rotate')}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
};

export default OpenLineageKeyManager;
