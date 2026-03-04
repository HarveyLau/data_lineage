# Windows 离线部署指南（Docker 镜像包）

适用场景：公司内网无法直接 `pip install` / `npm install` / `docker pull`。

目标：在外网机器构建并打包镜像，在 Windows 公司机离线导入并启动。

## 1) 关键原则

- 公司 Windows 端通常运行 Linux 容器，建议统一镜像平台为 `linux/amd64`。
- 内网机启动时使用 `--no-build`，避免再次触发依赖安装。
- 离线包与代码目录要一起迁移。

## 2) 外网机器打包步骤

在项目根目录执行：

```bash
cd docker

# 1) 预拉取远端镜像
docker compose -p data_lineage pull

# 2) 构建本地服务镜像（建议固定平台）
DOCKER_DEFAULT_PLATFORM=linux/amd64 docker compose -p data_lineage build backend frontend sas-system

# 3) 导出镜像清单
docker compose -p data_lineage config --images | sort -u > images.txt

# 4) 打包离线镜像（建议指定平台）
docker save --platform linux/amd64 $(cat images.txt) | gzip > data_lineage_images_linux_amd64.tar.gz

# 5) 校验
shasum -a 256 data_lineage_images_linux_amd64.tar.gz
gzip -t data_lineage_images_linux_amd64.tar.gz
```

建议一并保存：

- `images.txt`
- `docker-compose.yml`
- 校验和（sha256）

## 3) Windows 公司机导入与启动

PowerShell:

```powershell
# 1) 确保 Docker Desktop 为 Linux containers 模式

# 2) 导入镜像
docker load -i .\data_lineage_images_linux_amd64.tar.gz

# 3) 启动
cd .\data_lineage\docker
docker compose -p data_lineage up -d --no-build
```

## 4) 启动后验证

```powershell
docker ps
docker compose -p data_lineage ps
```

访问：

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:8000/api/v1`
- Gravitino: `http://localhost:8090`
- Marquez: `http://localhost:3001`

## 5) 常见问题

### Q1: 镜像能导入但启动报架构错误

原因：打包平台与目标机器不一致。  
处理：在外网重打 `linux/amd64` 包。

### Q2: 启动时又开始构建

原因：命令未带 `--no-build`，或镜像名不匹配。  
处理：使用固定 project 名（`-p data_lineage`）并加 `--no-build`。

### Q3: 公司机端口冲突

处理：修改 `docker/docker-compose.yml` 端口映射后重启。

### Q4: Gemini 不可达

处理：该能力依赖外部服务。可先使用 fallback 行为验证主流程（尤其 SAS 场景）。

## 6) 安全建议

- 不要在 compose 文件中硬编码生产 API key。
- 使用 `.env` 注入 `GEMINI_API_KEY` / `OPENLINEAGE_*` / `ENCRYPTION_KEY`。
- 迁移前后轮换所有临时 key。
