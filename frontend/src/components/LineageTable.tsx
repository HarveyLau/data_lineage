import React, { useMemo } from 'react';
import { 
  Paper, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow, 
  Typography, 
  Box, 
  Chip,
  Link
} from '@mui/material';
import TableChartIcon from '@mui/icons-material/TableChart';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import StorageIcon from '@mui/icons-material/Storage';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { deriveSystemKey } from '../utils/system';
import { useI18n } from '../i18n/I18nProvider';

interface LineageTableProps {
  data: any;
  highlightSystems?: string[];
}

const LineageTable: React.FC<LineageTableProps> = ({ data, highlightSystems }) => {
  const { t } = useI18n();
  const systemColorMap = useMemo(() => {
    const baseColors = ['#0ea5e9', '#22c55e', '#f97316', '#a855f7', '#e11d48'];
    const map: Record<string, string> = {};
    (highlightSystems || []).forEach((sys, idx) => {
      map[sys] = baseColors[idx % baseColors.length];
    });
    return map;
  }, [highlightSystems]);

  const { sources = [], targets = [] } = data?.lineage ?? {};

  if (!data || !data.lineage) {
    return null;
  }

  // Sanitize table name to match backend logic (gravitino_service.py:191)
  // Backend replaces: ".", "/", "-", " " with "_"
  const sanitizeTableName = (name: string): string => {
    if (!name) return '';
    return name.replace(/\./g, '_').replace(/\//g, '_').replace(/-/g, '_').replace(/ /g, '_');
  };

  const renderRows = (items: any[], type: 'source' | 'target') => {
    return items.map((item: any, index: number) => {
      const gravitinoBaseUrl = process.env.REACT_APP_GRAVITINO_URL || 'http://localhost:8090';
      const metalake = 'lineage_lake';
      const catalog = 'data_catalog';
      const schema = item.database || 'public';
      const originalTableName = item.name || '';
      const sanitizedTableName = sanitizeTableName(originalTableName);
      const catalogType = 'relational';
      
      const gravitinoUrl = `${gravitinoBaseUrl}/ui?metalake=${encodeURIComponent(metalake)}&catalog=${encodeURIComponent(catalog)}&type=${encodeURIComponent(catalogType)}&schema=${encodeURIComponent(schema)}&table=${encodeURIComponent(sanitizedTableName)}`;

      const systemKey = deriveSystemKey(item);
      const systemColor = systemKey && systemColorMap[systemKey] ? systemColorMap[systemKey] : undefined;
      const directionLabel = type === 'source' ? t('table.source') : t('table.target');
      
      return (
        <TableRow
          key={`${type}-${index}`}
          hover
          sx={
            systemColor
              ? {
                  borderLeft: `4px solid ${systemColor}`,
                  backgroundColor: `${systemColor}0f`,
                }
              : undefined
          }
        >
          <TableCell>
            <Chip 
              label={directionLabel} 
              size="small" 
              color={type === 'source' ? 'success' : 'warning'} 
              variant="outlined"
            />
          </TableCell>
          <TableCell>
            <Box display="flex" alignItems="center" gap={1}>
              {item.type === 'table' ? (
                <TableChartIcon fontSize="small" color="action" />
              ) : (
                <InsertDriveFileIcon fontSize="small" color="action" />
              )}
              <Typography variant="body2" fontWeight="500">
                {item.name}
              </Typography>
            </Box>
          </TableCell>
          <TableCell>{item.database || '-'}</TableCell>
          <TableCell>
            {systemKey ? (
              <Chip
                label={systemKey}
                size="small"
                sx={
                  systemColor
                    ? {
                        borderColor: systemColor,
                        color: systemColor,
                        backgroundColor: `${systemColor}12`,
                      }
                    : undefined
                }
                variant="outlined"
              />
            ) : (
              '-'
            )}
          </TableCell>
          <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
            {item.location || item.path}
          </TableCell>
          <TableCell>
             <Link 
               href={gravitinoUrl} 
               target="_blank" 
               rel="noopener" 
               display="flex" 
               alignItems="center" 
               gap={0.5}
             >
               {t('table.openGravitino')} <OpenInNewIcon sx={{ fontSize: 12 }} />
             </Link>
          </TableCell>
        </TableRow>
      );
    });
  };

  return (
    <Paper sx={{ p: 3, mt: 3, overflow: 'hidden' }}>
      <Box display="flex" alignItems="center" gap={1} mb={2}>
        <StorageIcon color="primary" />
        <Typography variant="h6" fontWeight="600">
          {t('table.metadataTitle')}
        </Typography>
      </Box>
      
      <TableContainer sx={{ maxHeight: 400 }}>
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              <TableCell width="100">{t('table.direction')}</TableCell>
              <TableCell width="200">{t('table.entity')}</TableCell>
              <TableCell width="150">{t('table.db')}</TableCell>
              <TableCell width="180">{t('table.system')}</TableCell>
              <TableCell>{t('table.path')}</TableCell>
              <TableCell width="120">{t('table.metadata')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {renderRows(sources, 'source')}
            {renderRows(targets, 'target')}
            {sources.length === 0 && targets.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  <Typography variant="body2" color="text.secondary" py={3}>
                    {t('table.empty')}
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
};

export default LineageTable;


