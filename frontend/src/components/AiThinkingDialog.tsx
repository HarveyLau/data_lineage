import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Box,
  Typography,
  IconButton,
  Stack,
  Paper,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { useI18n } from '../i18n/I18nProvider';

interface AiThinkingDialogProps {
  open: boolean;
  messages: string[];
  analysisCompleted: boolean;
  onClose: () => void;
  onThinkingComplete?: () => void;
}

const TYPING_INTERVAL_MS = 30;
const MESSAGE_PAUSE_MS = 600;

const AiThinkingDialog: React.FC<AiThinkingDialogProps> = ({
  open,
  messages,
  analysisCompleted,
  onClose,
  onThinkingComplete,
}) => {
  const { t } = useI18n();
  const [visibleMessages, setVisibleMessages] = useState<string[]>([]);
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [currentCharIndex, setCurrentCharIndex] = useState(0);
  const [hasFinishedAll, setHasFinishedAll] = useState(false);
  const [hasSignaledCompletion, setHasSignaledCompletion] = useState(false);

  useEffect(() => {
    if (!open) {
      setVisibleMessages([]);
      setCurrentMessageIndex(0);
      setCurrentCharIndex(0);
      setHasFinishedAll(false);
      setHasSignaledCompletion(false);
      return;
    }

    // Reset when dialog opens
    setVisibleMessages(['']);
    setCurrentMessageIndex(0);
    setCurrentCharIndex(0);
    setHasFinishedAll(false);
    setHasSignaledCompletion(false);
  }, [open]);

  useEffect(() => {
    if (!open || messages.length === 0 || hasFinishedAll) {
      return;
    }

    const fullMessage = messages[currentMessageIndex] || '';

    // When current message finished typing
    if (currentCharIndex >= fullMessage.length) {
      if (currentMessageIndex >= messages.length - 1) {
        // All messages finished
        if (!hasFinishedAll) {
          setHasFinishedAll(true);
        }
        return;
      }

      const pauseTimer = setTimeout(() => {
        setVisibleMessages((prev) => {
          const updated = [...prev];
          updated[currentMessageIndex] = fullMessage;
          return [...updated, ''];
        });
        setCurrentMessageIndex((index) => index + 1);
        setCurrentCharIndex(0);
      }, MESSAGE_PAUSE_MS);

      return () => clearTimeout(pauseTimer);
    }

    const typingTimer = setTimeout(() => {
      setVisibleMessages((prev) => {
        const updated = [...prev];
        const nextText = fullMessage.slice(0, currentCharIndex + 1);
        updated[currentMessageIndex] = nextText;
        return updated;
      });
      setCurrentCharIndex((index) => index + 1);
    }, TYPING_INTERVAL_MS);

    return () => clearTimeout(typingTimer);
  }, [open, messages, currentMessageIndex, currentCharIndex, hasFinishedAll]);

  useEffect(() => {
    if (open && analysisCompleted && onThinkingComplete && !hasSignaledCompletion) {
      setHasSignaledCompletion(true);
      onThinkingComplete();
    }
  }, [open, analysisCompleted, onThinkingComplete, hasSignaledCompletion]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: { borderRadius: 3 },
      }}
    >
      <DialogTitle sx={{ borderBottom: '1px solid #e2e8f0', px: 3, py: 2 }}>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box display="flex" alignItems="center" gap={1}>
            <AutoAwesomeIcon color="primary" />
            <Typography variant="subtitle1" fontWeight={600}>
              {t('thinking.title')}
            </Typography>
          </Box>
          <IconButton size="small" onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent sx={{ pt: 2, pb: 3 }}>
        <Stack spacing={1.5}>
          {visibleMessages.map((msg, index) => (
            <Box
              key={index}
              display="flex"
              justifyContent="flex-start"
              sx={{ opacity: msg ? 1 : 0.6 }}
            >
              <Paper
                elevation={0}
                sx={{
                  px: 2,
                  py: 1.5,
                  borderRadius: 2,
                  bgcolor: '#f1f5f9',
                  border: '1px solid #e2e8f0',
                  maxWidth: '100%',
                }}
              >
                <Typography
                  variant="body2"
                  sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                >
                  {msg || '…'}
                </Typography>
              </Paper>
            </Box>
          ))}
        </Stack>

        <Box mt={3}>
          <Typography variant="caption" color="text.secondary">
            {t('thinking.footer')}
          </Typography>
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default AiThinkingDialog;

