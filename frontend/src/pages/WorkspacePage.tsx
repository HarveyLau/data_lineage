import React from 'react';
import { Box, Button, Grid, Paper, Stack, Typography } from '@mui/material';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n/I18nProvider';

const WorkspacePage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useI18n();

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h5" fontWeight={800}>
          {t('workspace.title')}
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mt: 0.5 }}>
          {t('workspace.description')}
        </Typography>
      </Box>

      <Paper sx={{ p: 2.5 }}>
        <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>
          {t('workspace.quickActions')}
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
          <Button variant="contained" onClick={() => navigate('/lineage')}>
            {t('workspace.actionLineage')}
          </Button>
          <Button variant="outlined" onClick={() => navigate('/runs')}>
            {t('workspace.actionRuns')}
          </Button>
          <Button variant="outlined" onClick={() => navigate('/admin/openlineage')}>
            {t('workspace.actionAdmin')}
          </Button>
        </Stack>
      </Paper>

      <Grid container spacing={2}>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2.5, height: '100%' }}>
            <Typography variant="subtitle1" fontWeight={700}>
              {t('workspace.cardLineageTitle')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 2 }}>
              {t('workspace.cardLineageDesc')}
            </Typography>
            <Button size="small" endIcon={<ArrowForwardRoundedIcon />} onClick={() => navigate('/lineage')}>
              {t('workspace.actionLineage')}
            </Button>
          </Paper>
        </Grid>

        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2.5, height: '100%' }}>
            <Typography variant="subtitle1" fontWeight={700}>
              {t('workspace.cardRunsTitle')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 2 }}>
              {t('workspace.cardRunsDesc')}
            </Typography>
            <Button size="small" endIcon={<ArrowForwardRoundedIcon />} onClick={() => navigate('/runs')}>
              {t('workspace.actionRuns')}
            </Button>
          </Paper>
        </Grid>

        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2.5, height: '100%' }}>
            <Typography variant="subtitle1" fontWeight={700}>
              {t('workspace.cardAdminTitle')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 2 }}>
              {t('workspace.cardAdminDesc')}
            </Typography>
            <Button size="small" endIcon={<ArrowForwardRoundedIcon />} onClick={() => navigate('/admin/openlineage')}>
              {t('workspace.actionAdmin')}
            </Button>
          </Paper>
        </Grid>
      </Grid>
    </Stack>
  );
};

export default WorkspacePage;
