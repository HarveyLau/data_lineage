import React from 'react';
import { Stack, Typography } from '@mui/material';
import CredentialsSettings from '../components/CredentialsSettings';
import { useI18n } from '../i18n/I18nProvider';

const SettingsPage: React.FC = () => {
  const { t } = useI18n();

  return (
    <Stack spacing={2}>
      <div>
        <Typography variant="h5" fontWeight={800}>
          {t('settings.title')}
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mt: 0.5 }}>
          {t('settings.description')}
        </Typography>
      </div>

      <Typography variant="subtitle1" fontWeight={700}>
        {t('settings.credentials')}
      </Typography>
      <CredentialsSettings />
    </Stack>
  );
};

export default SettingsPage;
