# 功能评审（当前已完成功能）

本文档基于当前仓库实现进行功能盘点，覆盖后端、前端、部署与运维能力，并给出风险与优化建议。

## 1) 总体完成度

### 已实现主链路（可用）

- 文件上传与解析：支持 Control-M XML、SAS、Python、Shell 脚本输入。
- 血缘分析：通过 Gemini 进行推断，并附带本地可解释步骤；失败时保底返回。
- 多数据源接入：支持 SSH 与 PostgreSQL 资源访问（读取文件/查询表）。
- 凭证体系：创建、验证、删除凭证；凭证以加密形式存储。
- OpenLineage 事件：`START`、`COMPLETE`、`FAIL` 事件会写入本地库并发送到 Marquez。
- ETL 运行历史：记录 job/run、状态、摘要、错误信息，可在前端查看。
- OpenLineage 读 API 安全：支持 API Key、命名空间 scope、速率/配额控制。
- OpenLineage 管理 API：支持 key 创建、轮换、吊销、审计查询。
- 前端管理页：提供 key 管理和访问审计可视化能力。

### 可用于演示/试运行

- Docker Compose 一键启动全栈。
- 内置 `sas-system`、`seed-db` 模拟环境，便于联调与演示。

## 2) 端到端业务流程（已落地）

1. 用户在前端上传脚本或 XML 文件。  
2. 后端解析出作业、远程文件、数据库连接等信息。  
3. 若缺少凭证，前端弹窗补录；若有凭证，尝试访问远程资源。  
4. AI 推断 source/target，生成分析说明。  
5. 数据集注册到 Gravitino（schema/table 占位创建）。  
6. 生成 OpenLineage 事件并本地持久化，同时发送 Marquez。  
7. 在 Runs 与 Lineage 页面查看结果，在 Admin 页面管理 key 和审计。

## 3) 后端能力清单

### 3.1 路由与接口域

- `lineage`：上传分析、数据源读写、脚本发现等。
- `credentials`：凭证新增/查询/验证/删除。
- `etl`：作业与运行历史查询。
- `openlineage`：事件查询（按 run/job/dataset 过滤）。
- `openlineage/admin`：API key 生命周期与访问审计。

### 3.2 安全与治理

- 支持 `X-API-Key` / `Authorization: Bearer` 两种读 API 鉴权。
- 支持静态 key（环境变量）与 DB 托管 key 并行。
- DB 托管 key 支持：
  - job/dataset namespace scope；
  - 每分钟限流；
  - 每日配额；
  - 过期与吊销。
- 每次 OpenLineage 读请求会审计：
  - 是否放行；
  - 状态码与拒绝原因；
  - 调用来源、指纹、客户端信息。

### 3.3 数据模型（核心）

- 凭证：`credentials`
- ETL：`etl_jobs`、`etl_runs`
- OpenLineage：`openlineage_events`、`openlineage_dataset_refs`
- 鉴权治理：`openlineage_api_keys`、`openlineage_api_key_policies`
- 访问审计：`openlineage_access_audits`

## 4) 前端能力清单

- 工作台导航：Workspace / Lineage / Runs / Admin / Settings。
- 血缘页面：上传、AI 思考提示、图谱、表格、凭证补录弹窗。
- 运行历史：筛选、分页、状态查看、跳转 run 详情。
- Run 详情：
  - 运行摘要、错误层级、解析摘要、血缘摘要；
  - 输入 OpenLineage read key 拉取 run 事件；
  - 快速跳转 Marquez。
- Admin 页面：
  - 管理 admin key（本地存储）；
  - API key 新建/轮换/吊销；
  - 审计筛选（结果、状态码、原因、端点关键字）。
- 中英文本地化基础能力（`i18n`）。

## 5) 部署与环境能力

- `docker compose` 启动完整依赖链。
- 支持内外网迁移的镜像离线包策略（见 `docs/DEPLOYMENT_WINDOWS_OFFLINE.md`）。
- 适合 Windows Docker Desktop（Linux containers）运行。

## 6) 评审发现（风险与改进建议）

### 高优先级

- 明文秘钥风险：Compose 示例中出现真实风格 API key，建议立即轮换并改为 `.env` 注入。
- 生产安全基线不足：默认 key、默认加密 key、宽松 CORS 仅适合开发环境。

### 中优先级

- 文档与接口一致性需要持续校对：历史文档中存在旧路径写法。
- AI 依赖外部服务：若内网不可达，需明确 fallback 预期与 SLA（当前仅对 SAS 有较强 fallback）。
- Gravitino 交互采用较多 best-effort/吞错处理，生产可观测性需加强（日志、告警、重试策略）。

### 低优先级

- 覆盖测试与契约测试文档仍可补齐（尤其 OpenLineage scope/rate-limit 组合场景）。

## 7) 结论

当前项目已具备“上传 -> 解析 -> 凭证补全 -> 资源访问 -> 血缘推断 -> OpenLineage 持久化/查询 -> 管理审计”的闭环能力。  
若用于企业内网长期运行，建议先完成秘钥治理、环境参数外置、观测能力与测试补强。
