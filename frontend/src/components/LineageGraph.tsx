import React, { useEffect, useMemo, useRef, useState } from 'react';
import cytoscape from 'cytoscape';
import dagre from 'cytoscape-dagre';
import {
  Box,
  Button,
  Chip,
  FormControl,
  IconButton,
  InputLabel,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import CodeIcon from '@mui/icons-material/Code';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import TableChartIcon from '@mui/icons-material/TableChart';
import { deriveSystemKey } from '../utils/system';
import { useI18n } from '../i18n/I18nProvider';

cytoscape.use(dagre);

interface LineageGraphProps {
  data: any;
  highlightActive?: boolean;
  highlightSystems?: string[];
}

type FocusMode = 'none' | 'upstream' | 'downstream' | 'impact';
type TypeFilter = 'all' | 'dataset' | 'file' | 'process';

const LineageGraph: React.FC<LineageGraphProps> = ({ data, highlightActive, highlightSystems }) => {
  const { t } = useI18n();
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);

  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [systemFilter, setSystemFilter] = useState('all');
  const [focusMode, setFocusMode] = useState<FocusMode>('none');
  const defaultScriptName = t('lineage.defaultScriptName');

  const sources = useMemo(() => data?.lineage?.sources || [], [data]);
  const targets = useMemo(() => data?.lineage?.targets || [], [data]);

  const systemColorMap = useMemo(() => {
    const systems = highlightSystems || [];
    const baseColors = ['#0ea5e9', '#22c55e', '#f97316', '#a855f7', '#e11d48', '#14b8a6'];
    const map: Record<string, string> = {};
    systems.forEach((sys, idx) => {
      map[sys] = baseColors[idx % baseColors.length];
    });
    return map;
  }, [highlightSystems]);

  const availableSystems = useMemo(() => {
    const systems = new Set<string>();
    [...sources, ...targets].forEach((item: any) => {
      const key = deriveSystemKey(item);
      if (key) systems.add(key);
    });
    return Array.from(systems);
  }, [sources, targets]);

  useEffect(() => {
    if (!containerRef.current || !data) return;

    const elements: cytoscape.ElementDefinition[] = [];
    const scriptName = data.job?.name || data.parsed?.jobs?.[0]?.jobname || defaultScriptName;

    elements.push({
      data: {
        id: 'script',
        label: scriptName,
        type: 'process',
        fullData: { name: scriptName, type: 'Job', details: t('lineage.scriptExecution') },
        systemKey: 'process',
      },
    });

    sources.forEach((source: any, index: number) => {
      const id = `src_${index}`;
      elements.push({
        data: {
          id,
          label: source.name || t('lineage.node.sourceFallback', undefined, { index: index + 1 }),
          type: source.type === 'table' ? 'dataset' : 'file',
          fullData: source,
          systemKey: deriveSystemKey(source),
        },
      });
      elements.push({ data: { id: `edge_${id}_script`, source: id, target: 'script' } });
    });

    targets.forEach((target: any, index: number) => {
      const id = `tgt_${index}`;
      elements.push({
        data: {
          id,
          label: target.name || t('lineage.node.targetFallback', undefined, { index: index + 1 }),
          type: target.type === 'table' ? 'dataset' : 'file',
          fullData: target,
          systemKey: deriveSystemKey(target),
        },
      });
      elements.push({ data: { id: `edge_script_${id}`, source: 'script', target: id } });
    });

    const cy = cytoscape({
      container: containerRef.current,
      elements,
      style: [
        {
          selector: 'node',
          style: {
            label: 'data(label)',
            'font-family': 'Inter, sans-serif',
            'font-size': 12,
            'font-weight': 600,
            color: '#1e293b',
            'text-valign': 'bottom',
            'text-halign': 'center',
            'text-margin-y': 8,
            'overlay-opacity': 0,
            'transition-property': 'opacity, border-color, border-width, background-color',
            'transition-duration': 120,
          },
        },
        {
          selector: 'node[type="dataset"]',
          style: {
            shape: 'round-rectangle',
            width: 66,
            height: 56,
            'background-color': '#ecfdf5',
            'border-color': '#10b981',
            'border-width': 2,
          },
        },
        {
          selector: 'node[type="file"]',
          style: {
            shape: 'round-rectangle',
            width: 66,
            height: 56,
            'background-color': '#fffbeb',
            'border-color': '#f59e0b',
            'border-width': 2,
          },
        },
        {
          selector: 'node[type="process"]',
          style: {
            shape: 'ellipse',
            width: 86,
            height: 86,
            'background-color': '#eff6ff',
            'border-color': '#3b82f6',
            'border-width': 3,
          },
        },
        {
          selector: 'edge',
          style: {
            width: 2,
            'line-color': '#94a3b8',
            'target-arrow-color': '#94a3b8',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
          },
        },
        {
          selector: '.muted',
          style: {
            opacity: 0.16,
          },
        },
        {
          selector: '.focus',
          style: {
            opacity: 1,
            'border-color': '#2563eb',
            'line-color': '#2563eb',
            'target-arrow-color': '#2563eb',
            'border-width': 4,
          },
        },
        {
          selector: '.hiddenByFilter',
          style: {
            display: 'none',
          },
        },
        {
          selector: 'node.highlight',
          style: {
            'shadow-blur': 14,
            'shadow-color': '#0f172a',
            'shadow-opacity': 0.18,
            'shadow-offset-x': 0,
            'shadow-offset-y': 2,
          } as Record<string, number | string>,
        },
      ],
      layout: {
        name: 'dagre',
        rankDir: 'LR',
        nodeDimensionsIncludeLabels: true,
        padding: 50,
        spacingFactor: 1.2,
      } as any,
      minZoom: 0.2,
      maxZoom: 3,
      wheelSensitivity: 0.12,
    });

    cy.on('tap', 'node', (evt) => {
      const node = evt.target;
      setSelectedNode(node.data('fullData'));
      setSelectedNodeId(node.id());
    });

    cy.on('tap', (evt) => {
      if (evt.target === cy) {
        setSelectedNode(null);
        setSelectedNodeId(null);
      }
    });

    cy.nodes().forEach((node) => {
      const systemKey = node.data('systemKey');
      if (systemKey && systemColorMap[systemKey]) {
        node.style({
          'border-color': systemColorMap[systemKey],
        });
      }
    });

    if (highlightActive) {
      cy.nodes().addClass('highlight');
    }

    cy.fit(undefined, 50);
    cyRef.current = cy;

    return () => {
      cy.destroy();
    };
  }, [data, defaultScriptName, highlightActive, sources, systemColorMap, t, targets]);

  const applyGraphState = () => {
    const cy = cyRef.current;
    if (!cy) return;

    const term = searchTerm.trim().toLowerCase();
    cy.nodes().removeClass('hiddenByFilter');
    cy.edges().removeClass('hiddenByFilter');
    cy.nodes().removeClass('muted');
    cy.edges().removeClass('muted');
    cy.nodes().removeClass('focus');
    cy.edges().removeClass('focus');

    cy.nodes().forEach((node) => {
      const label = String(node.data('label') || '').toLowerCase();
      const nodeType = String(node.data('type') || 'dataset');
      const nodeSystem = String(node.data('systemKey') || '');

      const searchPass = !term || label.includes(term);
      const typePass = typeFilter === 'all' || nodeType === typeFilter;
      const systemPass = systemFilter === 'all' || nodeSystem === systemFilter;

      if (!(searchPass && typePass && systemPass)) {
        node.addClass('hiddenByFilter');
      }
    });

    cy.edges().forEach((edge) => {
      if (edge.source().hasClass('hiddenByFilter') || edge.target().hasClass('hiddenByFilter')) {
        edge.addClass('hiddenByFilter');
      }
    });

    if (!selectedNodeId || focusMode === 'none') {
      return;
    }

    const selected = cy.getElementById(selectedNodeId);
    if (!selected || selected.empty()) return;

    const focusNodes = new Set<string>();
    const focusEdges = new Set<string>();

    const addEdge = (sourceId: string, targetId: string) => {
      const edge = cy.edges().filter((item) => item.source().id() === sourceId && item.target().id() === targetId);
      edge.forEach((item) => {
        focusEdges.add(item.id());
      });
    };

    const sourceNodeIds = cy.nodes().filter((n) => n.id().startsWith('src_')).map((n) => n.id());
    const targetNodeIds = cy.nodes().filter((n) => n.id().startsWith('tgt_')).map((n) => n.id());

    if (selected.id() === 'script') {
      focusNodes.add('script');
      if (focusMode === 'upstream' || focusMode === 'impact') {
        sourceNodeIds.forEach((id) => {
          focusNodes.add(id);
          addEdge(id, 'script');
        });
      }
      if (focusMode === 'downstream' || focusMode === 'impact') {
        targetNodeIds.forEach((id) => {
          focusNodes.add(id);
          addEdge('script', id);
        });
      }
    } else if (selected.id().startsWith('src_')) {
      focusNodes.add(selected.id());
      if (focusMode === 'downstream' || focusMode === 'impact') {
        focusNodes.add('script');
        addEdge(selected.id(), 'script');
        targetNodeIds.forEach((id) => {
          focusNodes.add(id);
          addEdge('script', id);
        });
      }
    } else if (selected.id().startsWith('tgt_')) {
      focusNodes.add(selected.id());
      if (focusMode === 'upstream' || focusMode === 'impact') {
        focusNodes.add('script');
        addEdge('script', selected.id());
        sourceNodeIds.forEach((id) => {
          focusNodes.add(id);
          addEdge(id, 'script');
        });
      }
    }

    cy.nodes().forEach((node) => {
      if (node.hasClass('hiddenByFilter')) return;
      if (!focusNodes.has(node.id())) {
        node.addClass('muted');
      } else {
        node.addClass('focus');
      }
    });
    cy.edges().forEach((edge) => {
      if (edge.hasClass('hiddenByFilter')) return;
      if (!focusEdges.has(edge.id())) {
        edge.addClass('muted');
      } else {
        edge.addClass('focus');
      }
    });
  };

  useEffect(() => {
    applyGraphState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, typeFilter, systemFilter, focusMode, selectedNodeId]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.nodes().removeClass('highlight');
    if (highlightActive) {
      cy.nodes().addClass('highlight');
    }
  }, [highlightActive]);

  const stats = useMemo(
    () => ({
      sources: sources.length,
      targets: targets.length,
    }),
    [sources.length, targets.length]
  );

  const impactInfo = useMemo(() => {
    if (!selectedNode) return { upstream: [] as string[], downstream: [] as string[] };
    const selectedName = selectedNode.name;
    if (selectedNode.type === 'file' || selectedNode.type === 'table') {
      const isSource = sources.some((item: any) => item.name === selectedName);
      const isTarget = targets.some((item: any) => item.name === selectedName);
      if (isSource) {
        return { upstream: [selectedName], downstream: targets.map((item: any) => item.name) };
      }
      if (isTarget) {
        return { upstream: sources.map((item: any) => item.name), downstream: [selectedName] };
      }
    }
    return { upstream: sources.map((item: any) => item.name), downstream: targets.map((item: any) => item.name) };
  }, [selectedNode, sources, targets]);

  const handleReset = () => {
    setSearchTerm('');
    setTypeFilter('all');
    setSystemFilter('all');
    setFocusMode('none');
    const cy = cyRef.current;
    if (cy) {
      cy.fit(undefined, 50);
    }
  };

  if (!data?.lineage) {
    return null;
  }

  return (
    <Stack spacing={1.5}>
      <Paper sx={{ p: 2 }}>
        <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1.2} alignItems={{ lg: 'center' }}>
          <Typography variant="subtitle1" fontWeight={700} sx={{ minWidth: 160 }}>
            {t('lineage.graphTitle')}
          </Typography>

          <TextField
            size="small"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder={t('lineage.search')}
            InputProps={{
              startAdornment: <SearchRoundedIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />,
            }}
            sx={{ minWidth: 220 }}
          />

          <FormControl size="small" sx={{ minWidth: 130 }}>
            <InputLabel>{t('lineage.filterType')}</InputLabel>
            <Select value={typeFilter} label={t('lineage.filterType')} onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}>
              <MenuItem value="all">{t('lineage.typeAll')}</MenuItem>
              <MenuItem value="dataset">{t('lineage.typeTable')}</MenuItem>
              <MenuItem value="file">{t('lineage.typeFile')}</MenuItem>
              <MenuItem value="process">{t('lineage.typeProcess')}</MenuItem>
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>{t('lineage.filterSystem')}</InputLabel>
            <Select value={systemFilter} label={t('lineage.filterSystem')} onChange={(e) => setSystemFilter(e.target.value)}>
              <MenuItem value="all">{t('lineage.systemAll')}</MenuItem>
              {availableSystems.map((system) => (
                <MenuItem key={system} value={system}>
                  {system}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>{t('lineage.focusMode')}</InputLabel>
            <Select value={focusMode} label={t('lineage.focusMode')} onChange={(e) => setFocusMode(e.target.value as FocusMode)}>
              <MenuItem value="none">{t('lineage.focusNone')}</MenuItem>
              <MenuItem value="upstream">{t('lineage.focusUpstream')}</MenuItem>
              <MenuItem value="downstream">{t('lineage.focusDownstream')}</MenuItem>
              <MenuItem value="impact">{t('lineage.focusImpact')}</MenuItem>
            </Select>
          </FormControl>

          <Button variant="outlined" startIcon={<RefreshRoundedIcon />} onClick={handleReset}>
            {t('lineage.resetView')}
          </Button>
        </Stack>
      </Paper>

      <Box sx={{ display: 'flex', gap: 2, height: 620 }}>
        <Paper sx={{ flexGrow: 1, p: 2, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <Box display="flex" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
            <Stack direction="row" spacing={1}>
              <Chip label={`${stats.sources} ${t('lineage.focusUpstream')}`} size="small" />
              <Chip label={`${stats.targets} ${t('lineage.focusDownstream')}`} size="small" />
            </Stack>
            <Stack direction="row" spacing={1}>
              {availableSystems.slice(0, 5).map((system) => (
                <Chip
                  key={system}
                  size="small"
                  label={system}
                  variant="outlined"
                  sx={{
                    borderColor: systemColorMap[system] || '#cbd5e1',
                    color: systemColorMap[system] || 'text.secondary',
                  }}
                />
              ))}
            </Stack>
          </Box>

          <Box sx={{ flexGrow: 1, borderRadius: 2, border: '1px solid #e2e8f0', bgcolor: '#f8fafc', minHeight: 0 }}>
            <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
          </Box>
        </Paper>

        <Paper sx={{ width: 320, display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ p: 2, borderBottom: '1px solid #e2e8f0' }} display="flex" alignItems="center" justifyContent="space-between">
            <Typography variant="subtitle1" fontWeight={700}>
              {t('lineage.detailsTitle')}
            </Typography>
            {selectedNode && (
              <IconButton size="small" onClick={() => { setSelectedNode(null); setSelectedNodeId(null); }}>
                <CloseIcon />
              </IconButton>
            )}
          </Box>

          {!selectedNode ? (
            <Box sx={{ p: 2 }}>
              <Typography variant="body2" color="text.secondary">
                {t('lineage.noSelection')}
              </Typography>
            </Box>
          ) : (
            <Box sx={{ p: 2 }}>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
                {selectedNode.type === 'Job' ? <CodeIcon color="primary" /> : <TableChartIcon color="action" />}
                <Typography variant="subtitle2" fontWeight={700}>
                  {selectedNode.name}
                </Typography>
              </Stack>
              <List dense sx={{ mb: 1 }}>
                <ListItem disableGutters>
                  <ListItemText primary={t('lineage.detail.type')} secondary={selectedNode.type || '-'} />
                </ListItem>
                <ListItem disableGutters>
                  <ListItemText primary={t('lineage.detail.location')} secondary={selectedNode.location || selectedNode.path || '-'} />
                </ListItem>
                <ListItem disableGutters>
                  <ListItemText primary={t('lineage.detail.system')} secondary={deriveSystemKey(selectedNode) || '-'} />
                </ListItem>
              </List>

              <Paper variant="outlined" sx={{ p: 1.5, mt: 1 }}>
                <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
                  {t('lineage.impactTitle')}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                  {t('lineage.impactUpstream')}: {impactInfo.upstream.length}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                  {t('lineage.impactDownstream')}: {impactInfo.downstream.length}
                </Typography>
                <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
                  {impactInfo.downstream.slice(0, 4).join(', ') || '-'}
                </Typography>
              </Paper>
            </Box>
          )}
        </Paper>
      </Box>
    </Stack>
  );
};

export default LineageGraph;
