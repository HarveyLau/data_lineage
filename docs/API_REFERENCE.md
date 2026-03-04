# API 参考

Base URL：`http://localhost:8000/api/v1`

## 1) 连通性

- `GET /lineage/ping`

## 2) 血缘主流程

### 上传并分析

- `POST /lineage/upload`
- Content-Type：`multipart/form-data`
- 字段：`file`
- 支持扩展名：`.xml`、`.sas`、`.py`、`.sh`、`.txt`

响应关键字段：

- `parsed`：解析结果（作业、远程资源、数据库连接等）。
- `lineage`：推断出的 `sources` 与 `targets`。
- `openlineage`：生成的 `COMPLETE` 事件体。
- `missing_credentials`：缺失凭证列表。
- `accessed_resources`：远程访问结果（成功/失败）。
- `analysis_explanation`：可读分析说明。

### 数据源辅助接口（都在 `lineage` 路由下）

- `POST /lineage/data-sources/read-file`
- `POST /lineage/data-sources/query`
- `GET /lineage/data-sources/types`
- `POST /lineage/discover`

## 3) 凭证管理

### 创建或更新凭证

- `POST /credentials`
- 请求体示例：

```json
{
  "credential_type": "POSTGRES",
  "host": "seed-db",
  "username": "seeduser",
  "password": "seedpass123",
  "connection_params": {
    "port": 5432,
    "database": "seed_db",
    "schema": "public"
  },
  "description": "seed db access"
}
```

说明：

- 创建前会进行连通性验证（SSH/Postgres/MySQL/Oracle）。
- 密码以加密形式存储于数据库。

### 其他凭证接口

- `GET /credentials`（可选：`credential_type`）
- `POST /credentials/verify`（查询参数：`credential_type`、`host`、`username`）
- `DELETE /credentials/{credential_id}`

## 4) ETL 作业与运行

- `GET /etl/jobs?limit=50`
- `GET /etl/runs?limit=100&job_name=...`

`/etl/runs` 典型返回包括：

- 作业与运行标识
- OpenLineage Run ID
- 状态与错误
- 解析摘要与血缘摘要
- 缺失凭证计数

## 5) OpenLineage 读取接口

`/openlineage/*` 可启用 API Key 鉴权。

鉴权头：

- `X-API-Key: <key>`
- 或 `Authorization: Bearer <key>`

### 事件查询

- `GET /openlineage/events`
- 查询参数：
  - `run_id`
  - `job_namespace`、`job_name`
  - `event_type`
  - `dataset_namespace`、`dataset_name`
  - `since`、`until`
  - `limit`、`offset`
  - `include_payload`

### 运行 / 作业 / 数据集视图

- `GET /openlineage/runs/{run_id}`
- `GET /openlineage/jobs/{job_namespace}/{job_name}`
- `GET /openlineage/jobs/events?job_namespace=...&job_name=...`
- `GET /openlineage/datasets/{dataset_namespace}/{dataset_name}/events`
- `GET /openlineage/datasets/events?dataset_namespace=...&dataset_name=...`

## 6) OpenLineage 管理接口

管理员鉴权头：

- `X-Admin-Key: <admin-key>`
- 或 `Authorization: Bearer <admin-key>`

### API Key 管理

- `POST /openlineage/admin/keys`
- `GET /openlineage/admin/keys`
- `POST /openlineage/admin/keys/{key_id}/revoke`
- `POST /openlineage/admin/keys/{key_id}/rotate`

策略字段：

- `allowed_job_namespaces`
- `allowed_dataset_namespaces`
- `requests_per_minute`
- `requests_per_day`
- `expires_in_days`

### 访问审计

- `GET /openlineage/admin/access-audits`
- 查询参数：
  - `limit`、`offset`
  - `status_code`
  - `allowed`
  - `endpoint`

## 7) 常见错误码语义

- `400`：参数错误或凭证校验失败
- `401`：缺少 key
- `403`：key 无效或 scope 不允许
- `404`：资源不存在
- `429`：触发限流或配额
- `500`：服务端处理异常
- `503`：鉴权已开启但 key 配置缺失
