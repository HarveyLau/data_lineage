import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  FormControlLabel,
  Paper,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import ReplayRoundedIcon from '@mui/icons-material/ReplayRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import { useNavigate, useParams } from 'react-router-dom';
import { listEtlRuns, listOpenLineageRunEvents } from '../services/api';
import { useI18n } from '../i18n/I18nProvider';

type RunRecord = {
  id: number;
  job_id: number;
  job_name: string;
  source_type: string;
  request_id: string;
  openlineage_run_id: string;
  uploaded_filename: string;
  content_hash: string;
  status: string;
  error?: string | null;
  started_at?: string | null;
  ended_at?: string | null;
  missing_credentials_count?: number;
  parsed_summary?: Record<string, any> | null;
  lineage_summary?: Record<string, any> | null;
};

type OpenLineageEvent = {
  id: number;
  request_id?: string;
  run_id?: string;
  event_type?: string;
  event_time?: string;
  job?: {
    namespace?: string;
    name?: string;
  };
  payload?: Record<string, any>;
};

const OPENLINEAGE_READ_KEY_STORAGE = 'openlineage_read_key';

const statusColor = (status: string) => {
  if (status === 'COMPLETED') return 'success';
  if (status === 'FAILED') return 'error';
  return 'warning';
};

const JsonBlock: React.FC<{ value: any }> = ({ value }) => (
  <Paper variant="outlined" sx={{ p: 2, bgcolor: '#0f172a', color: '#e2e8f0', overflowX: 'auto' }}>
    <pre style={{ margin: 0, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12 }}>
      {JSON.stringify(value || {}, null, 2)}
    </pre>
  </Paper>
);

const RunDetailPage: React.FC = () => {
  const { runId } = useParams();
  const navigate = useNavigate();
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [runs, setRuns] = useState<RunRecord[]>([]);

  const [readKeyInput, setReadKeyInput] = useState(localStorage.getItem(OPENLINEAGE_READ_KEY_STORAGE) || '');
  const [savedReadKey, setSavedReadKey] = useState(localStorage.getItem(OPENLINEAGE_READ_KEY_STORAGE) || '');
  const [events, setEvents] = useState<OpenLineageEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [includePayload, setIncludePayload] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const resp = await listEtlRuns(300);
        setRuns(resp.data?.runs || []);
      } catch (e) {
        setError(t('runs.loadFailed'));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [t]);

  const run = useMemo(() => {
    if (!runId) return null;
    return runs.find((item) => String(item.id) === runId || item.openlineage_run_id === runId) || null;
  }, [runId, runs]);

  const statusLabel = (status: string): string => {
    if (status === 'STARTED') return t('runs.status.started');
    if (status === 'COMPLETED') return t('runs.status.completed');
    if (status === 'FAILED') return t('runs.status.failed');
    return status;
  };

  const mapEventsError = (e: any) => {
    const status = e?.response?.status;
    if (status === 401) return t('runs.detail.events.error.401');
    if (status === 403) return t('runs.detail.events.error.403');
    if (status === 429) return t('runs.detail.events.error.429');
    if (status === 404) return t('runs.detail.events.empty');
    return t('runs.detail.events.error.load');
  };

  const loadRunEvents = async (targetRun: RunRecord, readKey: string) => {
    if (!readKey.trim()) {
      setEvents([]);
      setEventsError(t('runs.detail.events.error.missingKey'));
      return;
    }
    setEventsLoading(true);
    setEventsError(null);
    try {
      const resp = await listOpenLineageRunEvents(targetRun.openlineage_run_id, readKey, includePayload);
      setEvents(resp.data?.events || []);
    } catch (e: any) {
      setEvents([]);
      setEventsError(mapEventsError(e));
    } finally {
      setEventsLoading(false);
    }
  };

  useEffect(() => {
    if (!run || !savedReadKey) return;
    loadRunEvents(run, savedReadKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run?.openlineage_run_id, savedReadKey, includePayload]);

  const handleSaveReadKey = () => {
    const next = readKeyInput.trim();
    localStorage.setItem(OPENLINEAGE_READ_KEY_STORAGE, next);
    setSavedReadKey(next);
    if (run && next) {
      loadRunEvents(run, next);
    }
  };

  const errorLayers = useMemo(() => {
    if (!run?.error) return [];
    const raw = run.error.toLowerCase();
    const layers: string[] = [];
    if (/credential|auth|permission|denied|missing/.test(raw)) layers.push(t('runs.detail.layer.credential'));
    if (/timeout|network|connect|host|dns/.test(raw)) layers.push(t('runs.detail.layer.connectivity'));
    if (/parse|syntax|compile|token|xml/.test(raw)) layers.push(t('runs.detail.layer.parsing'));
    if (/sql|database|table|schema|query/.test(raw)) layers.push(t('runs.detail.layer.data'));
    if (layers.length === 0) layers.push(t('runs.detail.layer.runtime'));
    return layers;
  }, [run?.error, t]);

  const marquezUrl = process.env.REACT_APP_MARQUEZ_URL || 'http://localhost:3001';
  const namespace = 'data_lineage_app';

  if (loading) {
    return (
      <Typography variant="body1" color="text.secondary">
        {t('common.loading')}
      </Typography>
    );
  }

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  if (!run) {
    return <Alert severity="warning">{t('runs.detail.notFound')}</Alert>;
  }

  return (
    <Stack spacing={2.5}>
      <Box display="flex" alignItems="center" justifyContent="space-between" gap={1}>
        <Typography variant="h5" fontWeight={800}>
          {t('runs.detail.title')}
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" startIcon={<ArrowBackRoundedIcon />} onClick={() => navigate('/runs')}>
            {t('runs.detail.back')}
          </Button>
          <Button variant="contained" startIcon={<ReplayRoundedIcon />} onClick={() => navigate('/lineage')}>
            {t('runs.detail.retry')}
          </Button>
        </Stack>
      </Box>

      <Paper sx={{ p: 2.5 }}>
        <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.2 }}>
          {t('runs.detail.section.summary')}
        </Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
          <Chip label={`${t('runs.table.job')}: ${run.job_name}`} />
          <Chip label={`${t('runs.table.status')}: ${statusLabel(run.status)}`} color={statusColor(run.status) as any} />
          <Chip label={`${t('runs.table.file')}: ${run.uploaded_filename}`} />
          <Chip label={`${t('runs.table.missingCreds')}: ${run.missing_credentials_count ?? 0}`} />
        </Stack>
        <Typography variant="body2" color="text.secondary">
          {t('runs.table.start')}: {run.started_at || '-'}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t('runs.table.end')}: {run.ended_at || '-'}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t('runs.detail.runId')}: {run.openlineage_run_id}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t('runs.detail.requestId')}: {run.request_id}
        </Typography>
      </Paper>

      {run.error && (
        <Paper sx={{ p: 2.5 }}>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.2 }}>
            {t('runs.detail.section.error')}
          </Typography>
          <Alert severity="error">{run.error}</Alert>
          <Stack direction="row" spacing={1} sx={{ mt: 1.2 }}>
            {errorLayers.map((layer) => (
              <Chip key={layer} size="small" label={layer} color="error" variant="outlined" />
            ))}
          </Stack>
        </Paper>
      )}

      <Paper sx={{ p: 2.5 }}>
        <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.2 }}>
          {t('runs.detail.section.parsed')}
        </Typography>
        <JsonBlock value={run.parsed_summary || {}} />
      </Paper>

      <Paper sx={{ p: 2.5 }}>
        <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.2 }}>
          {t('runs.detail.section.lineage')}
        </Typography>
        <JsonBlock value={run.lineage_summary || {}} />
      </Paper>

      <Paper sx={{ p: 2.5 }}>
        <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.2 }}>
          {t('runs.detail.section.openlineage')}
        </Typography>
        <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1.5} alignItems={{ lg: 'center' }} sx={{ mb: 1.5 }}>
          <TextField
            size="small"
            type="password"
            label={t('runs.detail.events.apiKey')}
            value={readKeyInput}
            onChange={(e) => setReadKeyInput(e.target.value)}
            fullWidth
          />
          <Button variant="outlined" startIcon={<SaveRoundedIcon />} onClick={handleSaveReadKey}>
            {t('runs.detail.events.saveKey')}
          </Button>
          <Button
            variant="outlined"
            startIcon={<RefreshRoundedIcon />}
            onClick={() => loadRunEvents(run, savedReadKey)}
            disabled={eventsLoading}
          >
            {t('admin.audit.load')}
          </Button>
          <FormControlLabel
            control={<Switch checked={includePayload} onChange={(e) => setIncludePayload(e.target.checked)} />}
            label={t('runs.detail.events.includePayload')}
          />
        </Stack>

        {eventsError && <Alert severity="warning" sx={{ mb: 1.5 }}>{eventsError}</Alert>}

        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{t('common.id')}</TableCell>
              <TableCell>{t('runs.detail.events.type')}</TableCell>
              <TableCell>{t('runs.detail.events.time')}</TableCell>
              <TableCell>{t('runs.detail.events.job')}</TableCell>
              <TableCell>{t('runs.detail.events.requestId')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {events.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5}>
                  <Typography variant="body2" color="text.secondary">
                    {eventsLoading ? t('common.loading') : t('runs.detail.events.empty')}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              events.map((event) => (
                <TableRow key={event.id}>
                  <TableCell>{event.id}</TableCell>
                  <TableCell>{event.event_type || '-'}</TableCell>
                  <TableCell>{event.event_time || '-'}</TableCell>
                  <TableCell>
                    {event.job?.namespace ? `${event.job.namespace}/${event.job.name || ''}` : event.job?.name || '-'}
                  </TableCell>
                  <TableCell>{event.request_id || '-'}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {includePayload && events.length > 0 && (
          <Box sx={{ mt: 1.5 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 0.8 }}>
              {t('runs.detail.events.payloadPreview')}
            </Typography>
            <JsonBlock value={events.slice(0, 2)} />
          </Box>
        )}
      </Paper>

      <Paper sx={{ p: 2.5 }}>
        <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.2 }}>
          {t('runs.detail.section.links')}
        </Typography>
        <Button
          variant="outlined"
          endIcon={<OpenInNewRoundedIcon />}
          href={`${marquezUrl}/jobs/${encodeURIComponent(namespace)}/${encodeURIComponent(run.job_name)}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          {t('runs.detail.openMarquez')}
        </Button>
      </Paper>
    </Stack>
  );
};

export default RunDetailPage;
