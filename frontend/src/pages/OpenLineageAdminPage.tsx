import React, { useMemo, useState } from 'react';
import {
  Box,
  Button,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import OpenLineageKeyManager from '../components/OpenLineageKeyManager';
import OpenLineageAccessAuditTable from '../components/OpenLineageAccessAuditTable';
import { useI18n } from '../i18n/I18nProvider';

const ADMIN_KEY_STORAGE_KEY = 'openlineage_admin_key';

const OpenLineageAdminPage: React.FC = () => {
  const { t } = useI18n();
  const [adminKeyInput, setAdminKeyInput] = useState(localStorage.getItem(ADMIN_KEY_STORAGE_KEY) || '');
  const [savedAdminKey, setSavedAdminKey] = useState(localStorage.getItem(ADMIN_KEY_STORAGE_KEY) || '');
  const [tab, setTab] = useState(0);
  const [savedMessage, setSavedMessage] = useState('');

  const hasAdminKey = useMemo(() => savedAdminKey.trim().length > 0, [savedAdminKey]);

  const handleSave = () => {
    localStorage.setItem(ADMIN_KEY_STORAGE_KEY, adminKeyInput.trim());
    setSavedAdminKey(adminKeyInput.trim());
    setSavedMessage(t('admin.saved'));
    setTimeout(() => setSavedMessage(''), 1600);
  };

  return (
    <Stack spacing={2.5}>
      <Box>
        <Typography variant="h5" fontWeight={800}>
          {t('admin.title')}
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mt: 0.5 }}>
          {t('admin.description')}
        </Typography>
      </Box>

      <Paper sx={{ p: 2.5 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ md: 'center' }}>
          <TextField
            fullWidth
            size="small"
            label={t('admin.adminKey')}
            placeholder={t('admin.adminKeyPlaceholder')}
            value={adminKeyInput}
            onChange={(e) => setAdminKeyInput(e.target.value)}
            type="password"
          />
          <Button variant="contained" onClick={handleSave}>
            {t('admin.saveAdminKey')}
          </Button>
        </Stack>
        {savedMessage && (
          <Typography variant="caption" color="success.main" sx={{ display: 'block', mt: 1 }}>
            {savedMessage}
          </Typography>
        )}
      </Paper>

      {!hasAdminKey && (
        <Paper sx={{ p: 2.5 }}>
          <Typography variant="body2" color="text.secondary">
            {t('admin.missingAdminKey')}
          </Typography>
        </Paper>
      )}

      {hasAdminKey && (
        <>
          <Paper sx={{ px: 1.5, py: 0.5 }}>
            <Tabs value={tab} onChange={(_, next) => setTab(next)}>
              <Tab label={t('admin.keyManager')} />
              <Tab label={t('admin.audit')} />
            </Tabs>
          </Paper>

          {tab === 0 && <OpenLineageKeyManager adminKey={savedAdminKey} />}
          {tab === 1 && <OpenLineageAccessAuditTable adminKey={savedAdminKey} />}
        </>
      )}
    </Stack>
  );
};

export default OpenLineageAdminPage;
