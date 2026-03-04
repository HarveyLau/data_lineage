import React, { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Pagination,
  Select,
  Stack,
  TextField,
  Link,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { listEtlRuns } from '../services/api';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n/I18nProvider';

type RunRow = {
  id: number;
  job_name: string;
  source_type: string;
  openlineage_run_id: string;
  uploaded_filename: string;
  status: string;
  started_at?: string | null;
  ended_at?: string | null;
  missing_credentials_count?: number;
};

const statusColor = (status: string) => {
  if (status === 'COMPLETED') return 'success';
  if (status === 'FAILED') return 'error';
  return 'warning';
};

const timestampOf = (value?: string | null): number => {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const RunHistory: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [rows, setRows] = useState<RunRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [jobKeyword, setJobKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [timeFrom, setTimeFrom] = useState('');
  const [timeTo, setTimeTo] = useState('');
  const [sortBy, setSortBy] = useState('start_desc');
  const [page, setPage] = useState(1);
  const pageSize = 12;

  const marquezUrl = process.env.REACT_APP_MARQUEZ_URL || 'http://localhost:3001';
  const namespace = 'data_lineage_app';

  const statusLabel = (status: string): string => {
    if (status === 'STARTED') return t('runs.status.started');
    if (status === 'COMPLETED') return t('runs.status.completed');
    if (status === 'FAILED') return t('runs.status.failed');
    return status;
  };

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await listEtlRuns(300);
      setRows(resp.data?.runs || []);
    } catch (e) {
      setError(t('runs.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredRows = useMemo(() => {
    const keyword = jobKeyword.trim().toLowerCase();
    const fromTs = timeFrom ? Date.parse(timeFrom) : Number.NaN;
    const toTs = timeTo ? Date.parse(timeTo) : Number.NaN;
    return rows.filter((row) => {
      const statusMatch = statusFilter === 'ALL' || row.status === statusFilter;
      const keywordMatch = !keyword || row.job_name.toLowerCase().includes(keyword);
      const rowTs = timestampOf(row.started_at || row.ended_at);
      const fromMatch = Number.isNaN(fromTs) || rowTs >= fromTs;
      const toMatch = Number.isNaN(toTs) || rowTs <= toTs;
      return statusMatch && keywordMatch && fromMatch && toMatch;
    });
  }, [rows, statusFilter, jobKeyword, timeFrom, timeTo]);

  const sortedRows = useMemo(() => {
    const next = [...filteredRows];
    if (sortBy === 'job_asc') {
      next.sort((a, b) => a.job_name.localeCompare(b.job_name));
      return next;
    }
    if (sortBy === 'status_asc') {
      next.sort((a, b) => a.status.localeCompare(b.status));
      return next;
    }
    if (sortBy === 'start_asc') {
      next.sort((a, b) => timestampOf(a.started_at || a.ended_at) - timestampOf(b.started_at || b.ended_at));
      return next;
    }
    next.sort((a, b) => timestampOf(b.started_at || b.ended_at) - timestampOf(a.started_at || a.ended_at));
    return next;
  }, [filteredRows, sortBy]);

  const pagedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sortedRows.slice(start, start + pageSize);
  }, [sortedRows, page]);

  React.useEffect(() => {
    setPage(1);
  }, [statusFilter, jobKeyword, timeFrom, timeTo, sortBy]);

  const pageCount = Math.max(1, Math.ceil(sortedRows.length / pageSize));

  return (
    <Paper sx={{ p: 2 }}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1.5} sx={{ mb: 2 }}>
        <Typography variant="h6" fontWeight={700}>
          {t('runs.title')}
        </Typography>
        <Button onClick={load} disabled={loading}>
          {t('admin.audit.load')}
        </Button>
      </Stack>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
        <TextField
          size="small"
          label={t('runs.filterJob')}
          placeholder={t('runs.filterSearch')}
          value={jobKeyword}
          onChange={(e) => setJobKeyword(e.target.value)}
          sx={{ minWidth: 220 }}
        />
        <Select
          size="small"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          sx={{ minWidth: 180 }}
        >
          <MenuItem value="ALL">{t('runs.filterAllStatus')}</MenuItem>
          <MenuItem value="STARTED">{t('runs.status.started')}</MenuItem>
          <MenuItem value="COMPLETED">{t('runs.status.completed')}</MenuItem>
          <MenuItem value="FAILED">{t('runs.status.failed')}</MenuItem>
        </Select>
        <TextField
          size="small"
          type="datetime-local"
          label={t('runs.filterTimeFrom')}
          value={timeFrom}
          onChange={(e) => setTimeFrom(e.target.value)}
          InputLabelProps={{ shrink: true }}
        />
        <TextField
          size="small"
          type="datetime-local"
          label={t('runs.filterTimeTo')}
          value={timeTo}
          onChange={(e) => setTimeTo(e.target.value)}
          InputLabelProps={{ shrink: true }}
        />
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>{t('runs.sortBy')}</InputLabel>
          <Select value={sortBy} label={t('runs.sortBy')} onChange={(e) => setSortBy(e.target.value)}>
            <MenuItem value="start_desc">{t('runs.sort.startDesc')}</MenuItem>
            <MenuItem value="start_asc">{t('runs.sort.startAsc')}</MenuItem>
            <MenuItem value="status_asc">{t('runs.sort.statusAsc')}</MenuItem>
            <MenuItem value="job_asc">{t('runs.sort.jobAsc')}</MenuItem>
          </Select>
        </FormControl>
      </Stack>

      {error && <Alert severity="error">{error}</Alert>}
      <Box sx={{ overflowX: 'auto' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell><b>{t('runs.table.job')}</b></TableCell>
              <TableCell><b>{t('runs.table.file')}</b></TableCell>
              <TableCell><b>{t('runs.table.status')}</b></TableCell>
              <TableCell><b>{t('runs.table.start')}</b></TableCell>
              <TableCell><b>{t('runs.table.end')}</b></TableCell>
              <TableCell><b>{t('runs.table.missingCreds')}</b></TableCell>
              <TableCell><b>{t('runs.table.actions')}</b></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {pagedRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7}>
                  <Typography variant="body2" color="text.secondary">
                    {t('runs.empty')}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              pagedRows.map((r) => (
                <TableRow key={r.id} hover>
                  <TableCell>
                    <Link
                      component="button"
                      underline="hover"
                      onClick={() => navigate(`/runs/${r.id}`)}
                    >
                      {r.job_name}
                    </Link>
                  </TableCell>
                  <TableCell>{r.uploaded_filename}</TableCell>
                  <TableCell>
                    <Chip size="small" label={statusLabel(r.status)} color={statusColor(r.status) as any} />
                  </TableCell>
                  <TableCell>{r.started_at || '-'}</TableCell>
                  <TableCell>{r.ended_at || '-'}</TableCell>
                  <TableCell>{r.missing_credentials_count ?? 0}</TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={1}>
                      <Button size="small" variant="outlined" onClick={() => navigate(`/runs/${r.id}`)}>
                        {t('runs.table.view')}
                      </Button>
                      <Link
                        href={`${marquezUrl}/jobs/${encodeURIComponent(namespace)}/${encodeURIComponent(r.job_name)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {t('runs.table.marquez')}
                      </Link>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Box>

      <Stack direction="row" justifyContent="flex-end" sx={{ mt: 2 }}>
        <Pagination count={pageCount} page={page} onChange={(_, value) => setPage(value)} />
      </Stack>
    </Paper>
  );
};

export default RunHistory;
