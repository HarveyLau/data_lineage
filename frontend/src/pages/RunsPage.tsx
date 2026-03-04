import React from 'react';
import { Stack, Typography } from '@mui/material';
import RunHistory from '../components/RunHistory';
import { useI18n } from '../i18n/I18nProvider';

const RunsPage: React.FC = () => {
  const { t } = useI18n();

  return (
    <Stack spacing={2}>
      <div>
        <Typography variant="h5" fontWeight={800}>
          {t('runs.title')}
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mt: 0.5 }}>
          {t('runs.description')}
        </Typography>
      </div>

      <RunHistory />
    </Stack>
  );
};

export default RunsPage;
