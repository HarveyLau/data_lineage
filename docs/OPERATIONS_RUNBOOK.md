# 运维手册（Runbook）

## 1) 启停服务

在仓库根目录执行：

```bash
cd docker
docker compose up -d --build
```

停止：

```bash
cd docker
docker compose down
```

## 2) 核心运行检查

```bash
cd docker
docker compose ps
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f gravitino
docker compose logs -f marquez-api
```

后端连通检查：

```bash
curl -s http://localhost:8000/api/v1/lineage/ping
```

## 3) 功能冒烟测试

1. 打开 UI：`http://localhost:3000`
2. 上传 `example_scripts/etl_process_controlm.xml`
3. 若出现缺失凭证提示，填写：
   - SSH: `sas-system` / `sasuser` / `sasuser123`
   - PostgreSQL: `seed-db` / `seeduser` / `seedpass123`
4. 验证：
   - 图谱与表格正常渲染
   - `Runs` 页面出现新运行记录
   - Run 详情可使用 read key 拉取 OpenLineage 事件

## 4) OpenLineage 读取接口验证

示例：

```bash
curl -s "http://localhost:8000/api/v1/openlineage/events?limit=20" \
  -H "X-API-Key: dev-openlineage-read-key"
```

预期：

- key 正确时返回 `200` 与事件列表。
- key 缺失/无效/被限流时返回 `401/403/429`。

## 5) 管理接口验证

```bash
curl -s "http://localhost:8000/api/v1/openlineage/admin/keys" \
  -H "X-Admin-Key: dev-openlineage-admin-key"
```

## 6) 常见问题与处理

### Gravitino 注册失败

- 先检查 `postgres` 与 `gravitino` 容器状态。
- 查看 backend 日志中的 catalog/schema 创建与 dataset 注册报错。

### 未出现缺失凭证提示

- 确认 XML 含有 `NODEID` 与 `VARIABLE` 字段（`INPUT_FILE`、`DB_*`）。
- 检查 `/lineage/upload` 响应中的 `missing_credentials`。

### OpenLineage 读取接口被拒绝

- 核对 read key 请求头和值。
- 若使用 scoped key，确保传入 namespace 过滤参数且在授权范围内。
- 若返回 `429`，检查策略限流/配额与请求频率。

### Marquez UI 可访问但看不到血缘

- 确认 backend 可访问 `MARQUEZ_URL`。
- 检查上传流程是否达到 `COMPLETE` 阶段。
- 使用 `/openlineage/events` 对照本地落库事件。

## 7) 生产加固清单

- 替换默认 key 与加密密钥。
- 所有敏感配置改用环境变量注入，不在 compose 明文。
- 收紧 CORS 与网络暴露范围。
- 补充监控告警，至少覆盖：
  - backend 5xx 激增
  - key 拒绝与限流异常
  - Gravitino/Marquez 不可达
