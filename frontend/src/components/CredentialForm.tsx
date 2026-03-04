import React, { useEffect, useState } from 'react';
import { 
  Button, 
  TextField, 
  Box, 
  Typography, 
  Alert, 
  Select, 
  MenuItem, 
  FormControl, 
  InputLabel,
  Grid
} from '@mui/material';
import { saveCredential } from '../services/api';
import { useI18n } from '../i18n/I18nProvider';

const CREDENTIAL_TYPES = ['SSH', 'POSTGRES', 'ORACLE', 'MYSQL'] as const;
type CredentialType = (typeof CREDENTIAL_TYPES)[number];

const normalizeCredentialType = (value?: string): CredentialType => {
  const normalized = String(value || '').toUpperCase();
  return CREDENTIAL_TYPES.includes(normalized as CredentialType) ? (normalized as CredentialType) : 'SSH';
};

type CredentialFormProps = {
  onSaved?: () => void;
  initialValues?: {
    credential_type?: string;
    host?: string;
    username?: string;
    password?: string;
    description?: string;
    connection_params?: {
      port?: number | string;
      database?: string;
      schema?: string;
      service_name?: string;
      sid?: string;
    };
  };
  compact?: boolean;
};

const CredentialForm: React.FC<CredentialFormProps> = ({ onSaved, initialValues, compact = false }) => {
  const { t } = useI18n();
  const [credentialType, setCredentialType] = useState<CredentialType>('SSH');
  const [host, setHost] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [port, setPort] = useState('');
  const [database, setDatabase] = useState('');
  const [schema, setSchema] = useState('');
  const [serviceName, setServiceName] = useState('');
  const [sid, setSid] = useState('');
  const [description, setDescription] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!initialValues) return;
    setCredentialType(normalizeCredentialType(initialValues.credential_type));
    setHost(initialValues.host || '');
    setUsername(initialValues.username || '');
    setPassword(initialValues.password || '');
    setPort(
      initialValues.connection_params?.port !== undefined
        ? String(initialValues.connection_params.port)
        : ''
    );
    setDatabase(initialValues.connection_params?.database || '');
    setSchema(initialValues.connection_params?.schema || '');
    setServiceName(initialValues.connection_params?.service_name || '');
    setSid(initialValues.connection_params?.sid || '');
    setDescription(initialValues.description || '');
  }, [initialValues]);

  const handleSave = async () => {
    try {
      const connectionParams: any = {};
      
      if (credentialType === 'SSH') {
        if (port) connectionParams.port = parseInt(port);
      } else if (['POSTGRES', 'ORACLE', 'MYSQL'].includes(credentialType)) {
        if (port) connectionParams.port = parseInt(port);
        if (database) connectionParams.database = database;
        if (schema) connectionParams.schema = schema;
        if (credentialType === 'ORACLE') {
          if (serviceName) connectionParams.service_name = serviceName;
          if (sid) connectionParams.sid = sid;
        }
      }
      
      await saveCredential({ 
        credential_type: credentialType,
        host, 
        username, 
        password,
        connection_params: connectionParams,
        description
      });
      setMessage(t('credentialForm.saveSuccess'));
      setError(false);
      onSaved?.();
      // Reset form
      setHost('');
      setUsername('');
      setPassword('');
      setPort('');
      setDatabase('');
      setSchema('');
      setServiceName('');
      setSid('');
      setDescription('');
    } catch (e) {
      const apiError = e as any;
      const detail = apiError?.response?.data?.detail;
      setMessage(typeof detail === 'string' ? detail : t('credentialForm.saveError'));
      setError(true);
    }
  };

  const isDatabaseType = ['POSTGRES', 'ORACLE', 'MYSQL'].includes(credentialType);
  const isOracleType = credentialType === 'ORACLE';
  const isMySqlType = credentialType === 'MYSQL';

  return (
    <Box>
      {!compact && (
        <Typography variant="body2" color="textSecondary" paragraph>
          {t('credentialForm.helper')}
        </Typography>
      )}
      
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: compact ? 0 : 2 }}>
        <FormControl fullWidth>
          <InputLabel>{t('credentialForm.credentialType')}</InputLabel>
          <Select
            value={credentialType}
            label={t('credentialForm.credentialType')}
            onChange={(e) => setCredentialType(normalizeCredentialType(String(e.target.value)))}
          >
            {CREDENTIAL_TYPES.map((type) => (
              <MenuItem key={type} value={type}>
                {type === 'SSH' && t('credentialType.ssh')}
                {type === 'POSTGRES' && t('credentialType.postgres')}
                {type === 'ORACLE' && t('credentialType.oracle')}
                {type === 'MYSQL' && t('credentialType.mysql')}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <TextField 
              label={t('credentialForm.host')}
              value={host} 
              onChange={e => setHost(e.target.value)} 
              fullWidth 
              required
              placeholder={credentialType === 'SSH' ? t('credentialForm.placeholder.hostSsh') : t('credentialForm.placeholder.hostDb')}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField 
              label={t('credentialForm.username')}
              value={username} 
              onChange={e => setUsername(e.target.value)} 
              fullWidth 
              required
            />
          </Grid>
          <Grid item xs={12}>
            <TextField 
              label={t('credentialForm.password')}
              type="password" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              fullWidth 
              required
            />
          </Grid>
          
          {isDatabaseType && (
            <>
              <Grid item xs={12} md={6}>
                <TextField 
                  label={t('credentialForm.port')}
                  value={port} 
                  onChange={e => setPort(e.target.value)} 
                  fullWidth 
                  placeholder={credentialType === 'POSTGRES' ? t('credentialForm.placeholder.portPostgres') : t('credentialForm.placeholder.portOracle')}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField 
                  label={t('credentialForm.database')}
                  value={database} 
                  onChange={e => setDatabase(e.target.value)} 
                  fullWidth 
                  placeholder={isOracleType ? t('credentialForm.placeholder.databaseOracle') : t('credentialForm.placeholder.databaseDefault')}
                  required={isMySqlType}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField 
                  label={t('credentialForm.schemaOptional')}
                  value={schema} 
                  onChange={e => setSchema(e.target.value)} 
                  fullWidth 
                  placeholder={t('credentialForm.placeholder.schema')}
                />
              </Grid>
              {isOracleType && (
                <>
                  <Grid item xs={12} md={6}>
                    <TextField 
                      label={t('credentialForm.serviceNameRecommended')}
                      value={serviceName} 
                      onChange={e => setServiceName(e.target.value)} 
                      fullWidth 
                      placeholder={t('credentialForm.placeholder.serviceName')}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField 
                      label={t('credentialForm.sidOptional')}
                      value={sid} 
                      onChange={e => setSid(e.target.value)} 
                      fullWidth 
                      placeholder={t('credentialForm.placeholder.sid')}
                    />
                  </Grid>
                </>
              )}
            </>
          )}
          
          {credentialType === 'SSH' && (
            <Grid item xs={12} md={6}>
              <TextField 
                label={t('credentialForm.portOptional')}
                value={port} 
                onChange={e => setPort(e.target.value)} 
                fullWidth 
                placeholder={t('credentialForm.placeholder.portSsh')}
              />
            </Grid>
          )}
          
          <Grid item xs={12}>
            <TextField 
              label={t('credentialForm.descriptionOptional')}
              value={description} 
              onChange={e => setDescription(e.target.value)} 
              fullWidth 
              multiline
              rows={2}
            />
          </Grid>
        </Grid>

        <Button variant="contained" onClick={handleSave} size={compact ? 'medium' : 'large'} sx={{ mt: compact ? 1 : 2 }}>
          {compact ? t('credentialForm.save') : t('credentialForm.saveCredential')}
        </Button>
      </Box>
      
      {message && (
        <Alert severity={error ? "error" : "success"} sx={{ mt: 2 }}>
          {message}
        </Alert>
      )}
    </Box>
  );
};

export default CredentialForm;
