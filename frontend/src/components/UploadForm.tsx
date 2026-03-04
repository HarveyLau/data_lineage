import React, { useState, useRef } from 'react';
import { Button, Box, Typography, Paper, Alert, LinearProgress, Stack } from '@mui/material';
import { uploadFile } from '../services/api';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { useI18n } from '../i18n/I18nProvider';

export interface AnalyzeStartContext {
  fileName: string;
  fileType: string;
  lineCount: number;
  previewLines: string[];
}

interface UploadFormProps {
  onUploadSuccess: (data: any) => void;
  onAnalyzeStart?: (context: AnalyzeStartContext) => void;
  onAnalyzeError?: (error: string) => void;
}

const UploadForm: React.FC<UploadFormProps> = ({ onUploadSuccess, onAnalyzeStart, onAnalyzeError }) => {
  const { t } = useI18n();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
      setError(null);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const buildAnalyzeContext = async (selectedFile: File): Promise<AnalyzeStartContext> => {
    let previewLines: string[] = [];
    let lineCount = 0;

    try {
      const textContent = await selectedFile.text();
      const allLines = textContent.split(/\r?\n/);
      lineCount = allLines.length;
      previewLines = allLines
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .slice(0, 6);
    } catch {
      previewLines = [];
      lineCount = 0;
    }

    const fileType = selectedFile.name.includes('.')
      ? selectedFile.name.split('.').pop()?.toLowerCase() || 'unknown'
      : 'unknown';

    return {
      fileName: selectedFile.name,
      fileType,
      lineCount,
      previewLines,
    };
  };

  const handleUpload = async () => {
    if (!file) return;
    if (onAnalyzeStart) {
      const context = await buildAnalyzeContext(file);
      onAnalyzeStart(context);
    }
    setLoading(true);
    setError(null);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await uploadFile(formData);
      onUploadSuccess(response.data);
    } catch (err: any) {
      console.error("Upload Error:", err);
      let msg = t('upload.error.failed');
      if (err.response) {
        msg = `${t('upload.error.server')} (${err.response.status}): ${err.response.data?.detail || err.response.statusText}`;
      } else if (err.request) {
        msg = t('upload.error.noResponse');
      } else {
        msg = err.message;
      }
      setError(msg);
      if (onAnalyzeError) {
        onAnalyzeError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Paper sx={{ p: 4, mb: 4, textAlign: 'center' }}>
      <Typography variant="h5" gutterBottom sx={{ fontWeight: 600, color: 'text.primary' }}>
        {t('upload.title')}
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        {t('upload.description')}
      </Typography>

      <Box
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        sx={{
          border: '2px dashed',
          borderColor: file ? 'primary.main' : 'divider',
          borderRadius: 2,
          p: 4,
          mb: 3,
          bgcolor: file ? 'action.hover' : 'background.paper',
          cursor: 'pointer',
          transition: 'all 0.2s',
          '&:hover': {
            borderColor: 'primary.main',
            bgcolor: 'action.hover',
          },
        }}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          type="file"
          hidden
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".xml,.sh,.py,.sas,.txt"
        />
        
        {file ? (
          <Stack direction="row" spacing={2} alignItems="center" justifyContent="center">
            <InsertDriveFileIcon color="primary" sx={{ fontSize: 40 }} />
            <Box textAlign="left">
              <Typography variant="subtitle1" fontWeight="600">{file.name}</Typography>
              <Typography variant="body2" color="text.secondary">{(file.size / 1024).toFixed(1)} KB</Typography>
            </Box>
          </Stack>
        ) : (
          <>
            <CloudUploadIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.primary" gutterBottom>
              {t('upload.dropTitle')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t('upload.support')}
            </Typography>
          </>
        )}
      </Box>

      {loading && (
        <Box sx={{ mb: 3 }}>
          <LinearProgress sx={{ borderRadius: 1 }} />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            {t('upload.processing')}
          </Typography>
        </Box>
      )}

      {error && <Alert severity="error" sx={{ mb: 3, textAlign: 'left' }}>{error}</Alert>}

      <Button 
        variant="contained" 
        size="large"
        onClick={(e) => {
          e.stopPropagation();
          handleUpload();
        }}
        disabled={!file || loading}
        startIcon={loading ? null : <AutoAwesomeIcon />}
        sx={{ px: 4, py: 1.5, fontSize: '1rem' }}
      >
        {loading ? t('upload.processingAction') : t('upload.action')}
      </Button>
    </Paper>
  );
};

export default UploadForm;
