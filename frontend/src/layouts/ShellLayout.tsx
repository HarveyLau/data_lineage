import React, { useMemo, useState } from 'react';
import {
  AppBar,
  Box,
  Divider,
  Drawer,
  IconButton,
  InputAdornment,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  MenuItem,
  Select,
  SelectChangeEvent,
  TextField,
  Toolbar,
  Tooltip,
  Typography,
} from '@mui/material';
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded';
import HubRoundedIcon from '@mui/icons-material/HubRounded';
import PlayCircleOutlineRoundedIcon from '@mui/icons-material/PlayCircleOutlineRounded';
import AdminPanelSettingsRoundedIcon from '@mui/icons-material/AdminPanelSettingsRounded';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import MenuRoundedIcon from '@mui/icons-material/MenuRounded';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useI18n } from '../i18n/I18nProvider';

const drawerWidthExpanded = 256;
const drawerWidthCollapsed = 76;

type NavItem = {
  to: string;
  labelKey: string;
  icon: React.ReactElement;
};

const navItems: NavItem[] = [
  { to: '/workspace', labelKey: 'nav.workspace', icon: <DashboardRoundedIcon /> },
  { to: '/lineage', labelKey: 'nav.lineage', icon: <HubRoundedIcon /> },
  { to: '/runs', labelKey: 'nav.runs', icon: <PlayCircleOutlineRoundedIcon /> },
  { to: '/admin/openlineage', labelKey: 'nav.admin', icon: <AdminPanelSettingsRoundedIcon /> },
  { to: '/settings', labelKey: 'nav.settings', icon: <SettingsRoundedIcon /> },
];

const pageTitleMap: Record<string, string> = {
  '/workspace': 'nav.workspace',
  '/lineage': 'nav.lineage',
  '/runs': 'nav.runs',
  '/admin/openlineage': 'nav.admin',
  '/settings': 'nav.settings',
};

const ShellLayout: React.FC = () => {
  const { locale, setLocale, t } = useI18n();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const drawerWidth = collapsed ? drawerWidthCollapsed : drawerWidthExpanded;

  const pageTitleKey = useMemo(() => {
    const matched = Object.keys(pageTitleMap).find((prefix) => location.pathname.startsWith(prefix));
    return matched ? pageTitleMap[matched] : 'app.title';
  }, [location.pathname]);

  const handleLanguageChange = (event: SelectChangeEvent) => {
    const next = event.target.value as 'en' | 'zh';
    setLocale(next);
  };

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
            borderRight: '1px solid #e2e8f0',
            backgroundColor: '#ffffff',
            transition: 'width .2s ease',
          },
        }}
      >
        <Toolbar
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'space-between',
            px: 1.5,
          }}
        >
          {!collapsed && (
            <Box>
              <Typography variant="subtitle1" fontWeight={800} lineHeight={1.2}>
                {t('app.title')}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {t('app.subtitle')}
              </Typography>
            </Box>
          )}
          <Tooltip title={collapsed ? t('layout.expandNav') : t('layout.collapseNav')}>
            <IconButton size="small" onClick={() => setCollapsed((prev) => !prev)}>
              <MenuRoundedIcon />
            </IconButton>
          </Tooltip>
        </Toolbar>

        <Divider />

        <List sx={{ px: 1, py: 1.5 }}>
          {navItems.map((item) => (
            <ListItemButton
              key={item.to}
              component={NavLink}
              to={item.to}
              sx={{
                mb: 0.5,
                borderRadius: 2,
                '&.active': {
                  bgcolor: 'rgba(37,99,235,0.12)',
                  color: 'primary.main',
                  '& .MuiListItemIcon-root': {
                    color: 'primary.main',
                  },
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 40 }}>{item.icon}</ListItemIcon>
              {!collapsed && <ListItemText primary={t(item.labelKey)} />}
            </ListItemButton>
          ))}
        </List>
      </Drawer>

      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <AppBar
          position="sticky"
          color="inherit"
          elevation={0}
          sx={{
            borderBottom: '1px solid #e2e8f0',
            backgroundColor: 'rgba(255,255,255,0.9)',
            backdropFilter: 'blur(6px)',
          }}
        >
          <Toolbar sx={{ gap: 2 }}>
            <Typography variant="h6" fontWeight={700} sx={{ minWidth: 180 }}>
              {t(pageTitleKey)}
            </Typography>

            <TextField
              size="small"
              placeholder={t('layout.searchPlaceholder')}
              fullWidth
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchRoundedIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />

            <Select
              size="small"
              value={locale}
              onChange={handleLanguageChange}
              inputProps={{ 'aria-label': t('layout.language') }}
              sx={{ minWidth: 120 }}
            >
              <MenuItem value="zh">{t('layout.zh')}</MenuItem>
              <MenuItem value="en">{t('layout.en')}</MenuItem>
            </Select>
          </Toolbar>
        </AppBar>

        <Box sx={{ p: { xs: 2, md: 3 } }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
};

export default ShellLayout;
