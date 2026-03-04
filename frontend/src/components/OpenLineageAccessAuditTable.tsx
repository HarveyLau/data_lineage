import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import { listOpenLineageAccessAudits } from '../services/api';
import { useI18n } from '../i18n/I18nProvider';

type AccessAuditTableProps = {
  adminKey: string;
};

type AuditRow = {
  id: number;
  request_id: string;
  endpoint: string;
  http_method: string;
  query_params?: Record<string, string | number | boolean | null | undefined> | null;
  status_code: number;
  allowed: boolean;
  denial_reason?: string | null;
  auth_source?: string | null;
  api_key_fingerprint?: string | null;
  created_at?: string | null;
};

type OutcomeFilter = 'all' | 'allowed' | 'denied';
type StatusFilter = 'all' | '200' | '401' | '403' | '404' | '429' | '503';
type ReasonFilter =
  | 'all'
  | 'denied_only'
  | 'missing_key'
  | 'invalid_key'
  | 'scope_denied'
  | 'rate_limit'
  | 'quota'
  | 'misconfigured'
  | 'other';
type ReasonKind =
  | 'none'
  | 'missing_key'
  | 'invalid_key'
  | 'scope_required'
  | 'scope_denied'
  | 'run_scope_denied'
  | 'rate_limit'
  | 'quota'
  | 'misconfigured'
  | 'not_found'
  | 'other';

const resolveReasonKind = (row: AuditRow): ReasonKind => {
  const text = String(row.denial_reason || '').toLowerCase();

  if (!text) return 'none';
  if (text.includes('missing api key')) return 'missing_key';
  if (text.includes('invalid api key')) return 'invalid_key';
  if (text.includes('namespace filters')) return 'scope_required';
  if (text.includes('job_namespace not allowed') || text.includes('dataset_namespace not allowed')) {
    return 'scope_denied';
  }
  if (text.includes('run contains disallowed')) return 'run_scope_denied';
  if (text.includes('rate limit')) return 'rate_limit';
  if (text.includes('daily quota')) return 'quota';
  if (text.includes('misconfigured')) return 'misconfigured';
  if (text.includes('not found')) return 'not_found';
  return 'other';
};

const reasonLabelKey = (reasonKind: ReasonKind): string => {
  if (reasonKind === 'missing_key') return 'admin.audit.reason.missingKey';
  if (reasonKind === 'invalid_key') return 'admin.audit.reason.invalidKey';
  if (reasonKind === 'scope_required') return 'admin.audit.reason.scopeRequired';
  if (reasonKind === 'scope_denied') return 'admin.audit.reason.scopeDenied';
  if (reasonKind === 'run_scope_denied') return 'admin.audit.reason.runScopeDenied';
  if (reasonKind === 'rate_limit') return 'admin.audit.reason.rateLimit';
  if (reasonKind === 'quota') return 'admin.audit.reason.quota';
  if (reasonKind === 'misconfigured') return 'admin.audit.reason.misconfigured';
  if (reasonKind === 'not_found') return 'admin.audit.reason.notFound';
  if (reasonKind === 'none') return 'admin.audit.reason.none';
  return 'admin.audit.reason.other';
};

const statusChipColor = (statusCode: number) => {
  if (statusCode >= 200 && statusCode < 300) return 'success';
  if (statusCode === 401 || statusCode === 403 || statusCode >= 500) return 'error';
  if (statusCode === 429 || statusCode >= 400) return 'warning';
  return 'default';
};

const reasonChipColor = (kind: ReasonKind) => {
  if (kind === 'missing_key' || kind === 'scope_required' || kind === 'scope_denied' || kind === 'run_scope_denied') {
    return 'warning';
  }
  if (kind === 'invalid_key' || kind === 'misconfigured') return 'error';
  if (kind === 'rate_limit' || kind === 'quota') return 'info';
  if (kind === 'not_found') return 'default';
  if (kind === 'none') return 'success';
  return 'default';
};

const formatTimestamp = (value: string | null | undefined, locale: 'en' | 'zh'): string => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(locale === 'zh' ? 'zh-CN' : 'en-US', {
    hour12: false,
  });
};

const OpenLineageAccessAuditTable: React.FC<AccessAuditTableProps> = ({ adminKey }) => {
  const { locale, t } = useI18n();
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [outcomeFilter, setOutcomeFilter] = useState<OutcomeFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [reasonFilter, setReasonFilter] = useState<ReasonFilter>('all');
  const [endpointKeyword, setEndpointKeyword] = useState('');

  const canOperate = adminKey.trim().length > 0;

  const load = async () => {
    if (!canOperate) return;
    setLoading(true);
    setError(null);
    try {
      const resp = await listOpenLineageAccessAudits(adminKey, { limit: 500 });
      setRows(resp.data?.audits || []);
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : t('admin.audit.errorLoad'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminKey]);

  const filteredRows = useMemo(() => {
    const endpointTerm = endpointKeyword.trim().toLowerCase();
    return rows.filter((row) => {
      if (outcomeFilter === 'allowed' && !row.allowed) return false;
      if (outcomeFilter === 'denied' && row.allowed) return false;

      if (statusFilter !== 'all' && row.status_code !== Number(statusFilter)) return false;

      if (endpointTerm && !String(row.endpoint || '').toLowerCase().includes(endpointTerm)) return false;

      const reasonKind = resolveReasonKind(row);
      if (reasonFilter === 'all') return true;
      if (reasonFilter === 'denied_only') return !row.allowed;
      if (reasonFilter === 'scope_denied') return reasonKind === 'scope_required' || reasonKind === 'scope_denied' || reasonKind === 'run_scope_denied';
      if (reasonFilter === 'other') return reasonKind === 'other' || reasonKind === 'not_found';
      return reasonKind === reasonFilter;
    });
  }, [rows, outcomeFilter, statusFilter, reasonFilter, endpointKeyword]);

  const stats = useMemo(() => {
    const total = filteredRows.length;
    const allowedCount = filteredRows.filter((row) => row.allowed).length;
    const deniedCount = total - allowedCount;
    const throttledCount = filteredRows.filter((row) => row.status_code === 429).length;

    const deniedReasonCounts: Record<string, number> = {};
    filteredRows
      .filter((row) => !row.allowed)
      .forEach((row) => {
        const key = resolveReasonKind(row);
        deniedReasonCounts[key] = (deniedReasonCounts[key] || 0) + 1;
      });

    const topReason = Object.entries(deniedReasonCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'none';
    return {
      total,
      allowedCount,
      deniedCount,
      throttledCount,
      topReason: topReason as ReasonKind,
    };
  }, [filteredRows]);

  const topReasonLabel = t(reasonLabelKey(stats.topReason));

  return (
    <Paper sx={{ p: 2.5 }}>
      <Box display="flex" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
        <Typography variant="subtitle1" fontWeight={700}>
          {t('admin.audit.title')}
        </Typography>
        <Button startIcon={<RefreshRoundedIcon />} onClick={load} disabled={!canOperate || loading}>
          {t('admin.audit.load')}
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert>}

      <Grid container spacing={1.2} sx={{ mb: 1.5 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Paper variant="outlined" sx={{ p: 1.25 }}>
            <Typography variant="caption" color="text.secondary">
              {t('admin.audit.total')}
            </Typography>
            <Typography variant="h6" fontWeight={700}>
              {stats.total}
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper variant="outlined" sx={{ p: 1.25 }}>
            <Typography variant="caption" color="text.secondary">
              {t('admin.audit.allowedCount')}
            </Typography>
            <Typography variant="h6" fontWeight={700} color="success.main">
              {stats.allowedCount}
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper variant="outlined" sx={{ p: 1.25 }}>
            <Typography variant="caption" color="text.secondary">
              {t('admin.audit.deniedCount')}
            </Typography>
            <Typography variant="h6" fontWeight={700} color="error.main">
              {stats.deniedCount}
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper variant="outlined" sx={{ p: 1.25 }}>
            <Typography variant="caption" color="text.secondary">
              {t('admin.audit.topReason')}
            </Typography>
            <Typography variant="body2" fontWeight={700} sx={{ mt: 0.3 }}>
              {topReasonLabel}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t('admin.audit.throttledCount')}: {stats.throttledCount}
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1.2} sx={{ mb: 1.5 }}>
        <TextField
          size="small"
          label={t('admin.audit.filterEndpoint')}
          placeholder={t('admin.audit.filterEndpointPlaceholder')}
          value={endpointKeyword}
          onChange={(event) => setEndpointKeyword(event.target.value)}
          sx={{ minWidth: 260 }}
        />
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>{t('admin.audit.filterOutcome')}</InputLabel>
          <Select
            value={outcomeFilter}
            label={t('admin.audit.filterOutcome')}
            onChange={(event) => setOutcomeFilter(event.target.value as OutcomeFilter)}
          >
            <MenuItem value="all">{t('admin.audit.filterOutcomeAll')}</MenuItem>
            <MenuItem value="allowed">{t('admin.audit.filterOutcomeAllowed')}</MenuItem>
            <MenuItem value="denied">{t('admin.audit.filterOutcomeDenied')}</MenuItem>
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>{t('admin.audit.filterStatus')}</InputLabel>
          <Select
            value={statusFilter}
            label={t('admin.audit.filterStatus')}
            onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
          >
            <MenuItem value="all">{t('admin.audit.filterStatusAll')}</MenuItem>
            <MenuItem value="200">200</MenuItem>
            <MenuItem value="401">401</MenuItem>
            <MenuItem value="403">403</MenuItem>
            <MenuItem value="404">404</MenuItem>
            <MenuItem value="429">429</MenuItem>
            <MenuItem value="503">503</MenuItem>
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>{t('admin.audit.filterReason')}</InputLabel>
          <Select
            value={reasonFilter}
            label={t('admin.audit.filterReason')}
            onChange={(event) => setReasonFilter(event.target.value as ReasonFilter)}
          >
            <MenuItem value="all">{t('admin.audit.filterReasonAll')}</MenuItem>
            <MenuItem value="denied_only">{t('admin.audit.filterReasonDeniedOnly')}</MenuItem>
            <MenuItem value="missing_key">{t('admin.audit.filterReasonMissingKey')}</MenuItem>
            <MenuItem value="invalid_key">{t('admin.audit.filterReasonInvalidKey')}</MenuItem>
            <MenuItem value="scope_denied">{t('admin.audit.filterReasonScope')}</MenuItem>
            <MenuItem value="rate_limit">{t('admin.audit.filterReasonRateLimit')}</MenuItem>
            <MenuItem value="quota">{t('admin.audit.filterReasonQuota')}</MenuItem>
            <MenuItem value="misconfigured">{t('admin.audit.filterReasonMisconfigured')}</MenuItem>
            <MenuItem value="other">{t('admin.audit.filterReasonOther')}</MenuItem>
          </Select>
        </FormControl>
      </Stack>

      <Box sx={{ overflowX: 'auto' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{t('common.id')}</TableCell>
              <TableCell>{t('admin.audit.endpoint')}</TableCell>
              <TableCell>{t('admin.audit.method')}</TableCell>
              <TableCell>{t('admin.audit.statusCode')}</TableCell>
              <TableCell>{t('admin.audit.allowed')}</TableCell>
              <TableCell>{t('admin.audit.reason')}</TableCell>
              <TableCell>{t('admin.audit.source')}</TableCell>
              <TableCell>{t('admin.audit.fingerprint')}</TableCell>
              <TableCell>{t('admin.audit.createdAt')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9}>
                  <Typography variant="body2" color="text.secondary">
                    {t('admin.audit.none')}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              filteredRows.map((row) => {
                const reasonKind = resolveReasonKind(row);
                const outcomeColor = row.allowed ? 'success' : 'error';
                return (
                <TableRow
                  key={row.id}
                  sx={
                    row.allowed
                      ? undefined
                      : {
                          bgcolor: 'rgba(248,113,113,0.08)',
                        }
                  }
                >
                  <TableCell>{row.id}</TableCell>
                  <TableCell sx={{ maxWidth: 280 }}>
                    <Tooltip title={row.endpoint} placement="top-start">
                      <Typography variant="body2" sx={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {row.endpoint}
                      </Typography>
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    <Chip size="small" variant="outlined" label={row.http_method || t('common.httpGet')} />
                  </TableCell>
                  <TableCell>
                    <Chip size="small" color={statusChipColor(row.status_code) as any} label={String(row.status_code)} />
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      color={outcomeColor as any}
                      label={row.allowed ? t('admin.audit.outcomeAllowed') : t('admin.audit.outcomeDenied')}
                    />
                  </TableCell>
                  <TableCell sx={{ maxWidth: 360 }}>
                    <Stack spacing={0.35}>
                      <Chip
                        size="small"
                        variant="outlined"
                        color={reasonChipColor(reasonKind) as any}
                        label={t(reasonLabelKey(reasonKind))}
                        sx={{ width: 'fit-content' }}
                      />
                      {row.denial_reason ? (
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                          title={row.denial_reason}
                        >
                          {row.denial_reason}
                        </Typography>
                      ) : (
                        <Typography variant="caption" color="text.secondary">
                          -
                        </Typography>
                      )}
                    </Stack>
                  </TableCell>
                  <TableCell>{row.auth_source || '-'}</TableCell>
                  <TableCell>
                    <Typography variant="caption" sx={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
                      {row.api_key_fingerprint || '-'}
                    </Typography>
                  </TableCell>
                  <TableCell>{formatTimestamp(row.created_at, locale)}</TableCell>
                </TableRow>
              )})
            )}
          </TableBody>
        </Table>
      </Box>
    </Paper>
  );
};

export default OpenLineageAccessAuditTable;
