import axios from 'axios';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:8000/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

export default api;

export const uploadFile = async (formData: FormData) => {
  return api.post('/lineage/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
};

export const getLineage = async () => {
  return api.get('/lineage/graph');
};

export const saveCredential = async (data: any) => {
  return api.post('/credentials', data);
};

export const listCredentials = async () => {
  return api.get('/credentials');
};

export const deleteCredential = async (credentialId: number) => {
  return api.delete(`/credentials/${credentialId}`);
};

export const listEtlRuns = async (limit = 100) => {
  return api.get(`/etl/runs?limit=${limit}`);
};

export const listEtlJobs = async (limit = 50) => {
  return api.get(`/etl/jobs?limit=${limit}`);
};

const buildHeaders = (headers?: Record<string, string>) => ({
  headers: headers || {},
});

export const listOpenLineageEvents = async (
  params?: Record<string, string | number | boolean | undefined>,
  apiKey?: string
) => {
  const headers = apiKey ? { 'X-API-Key': apiKey } : undefined;
  return api.get('/openlineage/events', {
    params,
    ...(headers ? buildHeaders(headers) : {}),
  });
};

export const listOpenLineageRunEvents = async (runId: string, apiKey?: string, includePayload = true) => {
  const headers = apiKey ? { 'X-API-Key': apiKey } : undefined;
  return api.get(`/openlineage/runs/${encodeURIComponent(runId)}`, {
    params: { include_payload: includePayload },
    ...(headers ? buildHeaders(headers) : {}),
  });
};

export const listOpenLineageJobEvents = async (
  jobNamespace: string,
  jobName: string,
  apiKey?: string,
  includePayload = false
) => {
  const headers = apiKey ? { 'X-API-Key': apiKey } : undefined;
  return api.get('/openlineage/jobs/events', {
    params: {
      job_namespace: jobNamespace,
      job_name: jobName,
      include_payload: includePayload,
    },
    ...(headers ? buildHeaders(headers) : {}),
  });
};

export type OpenLineageApiKeyCreatePayload = {
  key_name: string;
  expires_in_days?: number;
  allowed_job_namespaces?: string[];
  allowed_dataset_namespaces?: string[];
  requests_per_minute?: number;
  requests_per_day?: number;
};

export type OpenLineageApiKeyRotatePayload = {
  expires_in_days?: number;
  allowed_job_namespaces?: string[];
  allowed_dataset_namespaces?: string[];
  requests_per_minute?: number;
  requests_per_day?: number;
};

const adminHeaders = (adminKey: string) => ({ 'X-Admin-Key': adminKey });

export const createOpenLineageApiKey = async (payload: OpenLineageApiKeyCreatePayload, adminKey: string) => {
  return api.post('/openlineage/admin/keys', payload, buildHeaders(adminHeaders(adminKey)));
};

export const listOpenLineageApiKeys = async (adminKey: string, includeInactive = true) => {
  return api.get('/openlineage/admin/keys', {
    params: { include_inactive: includeInactive },
    ...buildHeaders(adminHeaders(adminKey)),
  });
};

export const revokeOpenLineageApiKey = async (keyId: number, adminKey: string) => {
  return api.post(`/openlineage/admin/keys/${keyId}/revoke`, {}, buildHeaders(adminHeaders(adminKey)));
};

export const rotateOpenLineageApiKey = async (
  keyId: number,
  payload: OpenLineageApiKeyRotatePayload,
  adminKey: string
) => {
  return api.post(`/openlineage/admin/keys/${keyId}/rotate`, payload, buildHeaders(adminHeaders(adminKey)));
};

export const listOpenLineageAccessAudits = async (
  adminKey: string,
  params?: Record<string, string | number | boolean | undefined>
) => {
  return api.get('/openlineage/admin/access-audits', {
    params,
    ...buildHeaders(adminHeaders(adminKey)),
  });
};
