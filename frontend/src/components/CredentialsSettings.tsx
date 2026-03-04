import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Divider,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import RefreshIcon from '@mui/icons-material/Refresh';
import CredentialForm from './CredentialForm';
import { deleteCredential, listCredentials } from '../services/api';
import { useI18n } from '../i18n/I18nProvider';

type CredentialRow = {
  id: number;
  credential_type: string;
  host: string;
  username: string;
  connection_params?: Record<string, any>;
  description?: string | null;
  created_at?: string | null;
};

const CredentialsSettings: React.FC = () => {
  const { t } = useI18n();
  const [rows, setRows] = useState<CredentialRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await listCredentials();
      setRows(resp.data?.credentials || []);
    } catch (e: any) {
      setError(t('credentials.error.load'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => (b.id ?? 0) - (a.id ?? 0));
  }, [rows]);

  const handleDelete = async (id: number) => {
    setError(null);
    setMessage(null);
    try {
      await deleteCredential(id);
      setMessage(t('credentials.success.deleted'));
      await load();
    } catch (e: any) {
      setError(t('credentials.error.delete'));
    }
  };

  return (
    <Stack spacing={3}>
      <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
          <Typography variant="subtitle1" fontWeight={700}>
            {t('credentials.stored')}
          </Typography>
          <Button size="small" startIcon={<RefreshIcon />} onClick={load} disabled={loading}>
            {t('credentials.refresh')}
          </Button>
        </Stack>

        {error && <Alert severity="error">{error}</Alert>}
        {message && <Alert severity="success">{message}</Alert>}

        <Box sx={{ mt: 2, overflowX: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell><b>{t('credentials.column.type')}</b></TableCell>
                <TableCell><b>{t('credentials.column.host')}</b></TableCell>
                <TableCell><b>{t('credentials.column.username')}</b></TableCell>
                <TableCell><b>{t('credentials.column.connectionParams')}</b></TableCell>
                <TableCell><b>{t('credentials.column.description')}</b></TableCell>
                <TableCell align="right"><b>{t('credentials.column.actions')}</b></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6}>
                    <Typography variant="body2" color="text.secondary">
                      {t('credentials.none')}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                sortedRows.map((r) => (
                  <TableRow key={r.id} hover>
                    <TableCell>{r.credential_type}</TableCell>
                    <TableCell>{r.host}</TableCell>
                    <TableCell>{r.username}</TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary">
                        {r.connection_params ? JSON.stringify(r.connection_params) : ''}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary">
                        {r.description || ''}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleDelete(r.id)}
                        title={t('credentials.delete')}
                      >
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Box>

        <Divider sx={{ my: 2 }} />

        <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
          {t('credentials.addOrUpdate')}
        </Typography>
        <CredentialForm onSaved={load} />
      </Paper>
    </Stack>
  );
};

export default CredentialsSettings;

