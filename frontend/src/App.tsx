import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { theme } from './theme';
import ShellLayout from './layouts/ShellLayout';
import WorkspacePage from './pages/WorkspacePage';
import LineageExplorerPage from './pages/LineageExplorerPage';
import RunsPage from './pages/RunsPage';
import RunDetailPage from './pages/RunDetailPage';
import OpenLineageAdminPage from './pages/OpenLineageAdminPage';
import SettingsPage from './pages/SettingsPage';
import { I18nProvider } from './i18n/I18nProvider';

const App: React.FC = () => {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <I18nProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<ShellLayout />}>
              <Route index element={<Navigate to="/workspace" replace />} />
              <Route path="workspace" element={<WorkspacePage />} />
              <Route path="lineage" element={<LineageExplorerPage />} />
              <Route path="runs" element={<RunsPage />} />
              <Route path="runs/:runId" element={<RunDetailPage />} />
              <Route path="admin/openlineage" element={<OpenLineageAdminPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/workspace" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </I18nProvider>
    </ThemeProvider>
  );
};

export default App;
