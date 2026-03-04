import React, { useMemo, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import UploadForm from '../components/UploadForm';
import type { AnalyzeStartContext } from '../components/UploadForm';
import LineageGraph from '../components/LineageGraph';
import LineageTable from '../components/LineageTable';
import CredentialsSettings from '../components/CredentialsSettings';
import CredentialForm from '../components/CredentialForm';
import AiThinkingDialog from '../components/AiThinkingDialog';
import { deriveSystemKey } from '../utils/system';
import { useI18n } from '../i18n/I18nProvider';

const LineageExplorerPage: React.FC = () => {
  const { t } = useI18n();
  const [lineageData, setLineageData] = useState<any>(null);
  const [showCredentials, setShowCredentials] = useState(false);
  const [missingCreds, setMissingCreds] = useState<any[]>([]);
  const [showCredentialPrompt, setShowCredentialPrompt] = useState(false);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [thinkingMessages, setThinkingMessages] = useState<string[]>([]);
  const [analysisCompleted, setAnalysisCompleted] = useState(false);
  const [highlightActive, setHighlightActive] = useState(false);

  const defaultThinkingMessages = useMemo(
    () => [
      t('thinking.step.parse'),
      t('thinking.step.detectResources'),
      t('thinking.step.inferLineage'),
      t('thinking.step.register'),
    ],
    [t]
  );

  const handleAnalyzeStart = (context: AnalyzeStartContext) => {
    const previewText = context.previewLines.length
      ? context.previewLines.map((line) => `- ${line}`).join('\n')
      : `- ${t('thinking.context.previewUnavailable')}`;

    const initialThinkingMessages = [
      `${t('thinking.context.receivedFile')}: ${context.fileName} (${t('thinking.context.fileType')}: ${context.fileType}, ${t('thinking.context.lineCount')}: ${context.lineCount})`,
      `${t('thinking.context.previewTitle')}:\n${previewText}`,
      ...defaultThinkingMessages,
    ];

    setAnalysisCompleted(false);
    setHighlightActive(false);
    setIsAiThinking(true);
    setThinkingMessages(initialThinkingMessages);
  };

  const handleUploadSuccess = (data: any) => {
    setLineageData(data);
    setAnalysisCompleted(true);

    if (data.missing_credentials && data.missing_credentials.length > 0) {
      const mergedCreds = data.missing_credentials.reduce((acc: any[], cred: any) => {
        const key = `${String(cred.type || '').toUpperCase()}::${String(cred.host || '').toLowerCase()}::${String(cred.username || '')}`;
        const existing = acc.find((item) => {
          const itemKey = `${String(item.type || '').toUpperCase()}::${String(item.host || '').toLowerCase()}::${String(item.username || '')}`;
          return itemKey === key;
        });

        const incomingResources = Array.isArray(cred.resources)
          ? cred.resources.filter(Boolean).map((value: any) => String(value))
          : [];
        if (cred.resource) {
          incomingResources.push(String(cred.resource));
        } else if (cred.database || cred.table) {
          const dbResource = `${cred.database || ''}${cred.database && cred.table ? '.' : ''}${cred.table || ''}`.trim();
          if (dbResource) incomingResources.push(dbResource);
        }

        if (!existing) {
          acc.push({
            ...cred,
            resources: Array.from(new Set(incomingResources)),
          });
          return acc;
        }

        const mergedResources = Array.from(
          new Set([...(Array.isArray(existing.resources) ? existing.resources : []), ...incomingResources])
        );
        existing.resources = mergedResources;

        if (!existing.database && cred.database) existing.database = cred.database;
        if (!existing.table && cred.table) existing.table = cred.table;
        if (!existing.reason && cred.reason) existing.reason = cred.reason;
        if (!existing.error && cred.error) existing.error = cred.error;
        return acc;
      }, []);

      setMissingCreds(mergedCreds);
      setShowCredentialPrompt(true);
    }
  };

  const handleAnalyzeError = () => {
    setIsAiThinking(false);
    setAnalysisCompleted(true);
  };

  const handleThinkingComplete = () => {
    setIsAiThinking(false);
    setHighlightActive(true);
  };

  const highlightSystems = useMemo(() => {
    if (!lineageData) return [];
    const systems = new Set<string>();

    const lineage = lineageData.lineage || {};
    (lineage.sources || []).forEach((s: any) => {
      const systemKey = deriveSystemKey(s);
      if (systemKey) systems.add(systemKey);
    });
    (lineage.targets || []).forEach((t: any) => {
      const systemKey = deriveSystemKey(t);
      if (systemKey) systems.add(systemKey);
    });

    const parsed = lineageData.parsed || {};
    (parsed.remote_resources || []).forEach((r: any) => {
      if (r.host) systems.add(r.host);
    });
    (parsed.database_connections || []).forEach((db: any) => {
      if (db.database) systems.add(db.database);
      else if (db.host) systems.add(db.host);
    });

    return Array.from(systems).filter(Boolean);
  }, [lineageData]);

  const handleMissingCredentialSaved = (index: number) => {
    setMissingCreds((prev) => {
      const next = prev.filter((_, i) => i !== index);
      if (next.length === 0) {
        setShowCredentialPrompt(false);
      }
      return next;
    });
  };

  return (
    <Stack spacing={3}>
      <Box display="flex" alignItems="flex-start" justifyContent="space-between" gap={2}>
        <Box>
          <Typography variant="h5" fontWeight={800}>
            {t('lineage.title')}
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mt: 0.5 }}>
            {t('lineage.description')}
          </Typography>
        </Box>

        <Button variant="outlined" onClick={() => setShowCredentials(true)}>
          {t('lineage.settings')}
        </Button>
      </Box>

      <UploadForm
        onUploadSuccess={handleUploadSuccess}
        onAnalyzeStart={handleAnalyzeStart}
        onAnalyzeError={handleAnalyzeError}
      />

      {lineageData && (
        <>
          <LineageGraph data={lineageData} highlightActive={highlightActive} highlightSystems={highlightSystems} />
          <LineageTable data={lineageData} highlightSystems={highlightSystems} />
        </>
      )}

      <Paper sx={{ p: 2.5 }}>
        <Typography variant="subtitle1" fontWeight={700}>
          {t('lineage.marquezTitle')}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.8, mb: 1.5 }}>
          {t('lineage.marquezDesc')}
        </Typography>
        <Button
          variant="outlined"
          endIcon={<OpenInNewRoundedIcon />}
          href={process.env.REACT_APP_MARQUEZ_URL || 'http://localhost:3001'}
          target="_blank"
          rel="noopener noreferrer"
        >
          {t('lineage.openMarquez')}
        </Button>
      </Paper>

      <AiThinkingDialog
        open={isAiThinking}
        messages={thinkingMessages}
        analysisCompleted={analysisCompleted}
        onClose={() => setIsAiThinking(false)}
        onThinkingComplete={handleThinkingComplete}
      />

      <Dialog open={showCredentials} onClose={() => setShowCredentials(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ borderBottom: '1px solid #e2e8f0' }}>
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Typography variant="h6" fontWeight={700}>
              {t('lineage.settings')}
            </Typography>
            <IconButton onClick={() => setShowCredentials(false)} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ p: 3 }}>
          <CredentialsSettings />
        </DialogContent>
      </Dialog>

      <Dialog open={showCredentialPrompt} onClose={() => setShowCredentialPrompt(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ borderBottom: '1px solid #e2e8f0' }}>
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Typography variant="h6" fontWeight={700}>
              {t('lineage.credentialsRequired')}
            </Typography>
            <IconButton onClick={() => setShowCredentialPrompt(false)} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ p: 3 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t('lineage.credentialsPrompt')}
          </Typography>
          {missingCreds.map((cred, idx) => {
            const initialValues = {
              credential_type: cred.type || 'SSH',
              host: cred.host || '',
              username: cred.username || '',
              connection_params: {
                port: cred.port,
                database: cred.database || cred.db_name,
                schema: cred.schema,
              },
              description:
                Array.isArray(cred.resources) && cred.resources.length > 0
                  ? `${t('lineage.credential.resources')}: ${cred.resources.join('; ')}`
                  : cred.resource
                    ? `${t('lineage.credential.resource')}: ${cred.resource}`
                    : cred.database || cred.table
                      ? `${t('lineage.credential.resource')}: ${cred.database || ''}${cred.database && cred.table ? '.' : ''}${cred.table || ''}`
                      : undefined,
            };

            return (
              <Box key={idx} sx={{ p: 2, mb: 2, bgcolor: '#f8fafc', borderRadius: 2, border: '1px solid #e2e8f0' }}>
                <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
                  {cred.type || t('lineage.credential.defaultType')} - {cred.host || t('lineage.credential.unknownHost')}
                </Typography>
                <CredentialForm initialValues={initialValues} compact onSaved={() => handleMissingCredentialSaved(idx)} />
              </Box>
            );
          })}
          <Box display="flex" justifyContent="flex-end">
            <Button onClick={() => setShowCredentialPrompt(false)}>{t('lineage.close')}</Button>
          </Box>
        </DialogContent>
      </Dialog>
    </Stack>
  );
};

export default LineageExplorerPage;
