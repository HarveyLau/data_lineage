# 多数据源模拟环境使用指南

## 概述

系统现在支持从多个数据源（SSH服务器、PostgreSQL数据库等）自动提取数据血缘信息。

## 模拟VM环境

### 1. sas-system VM
- **用途**: 模拟SAS系统，包含CSV数据文件
- **SSH访问**: `sas-system:2222` (从宿主机) 或 `sas-system:22` (从Docker网络)
- **默认凭证**: 
  - Username: `sasuser`
  - Password: `sasuser123`
- **示例文件**: `/var/data/incoming/transactions_20240101.csv`

### 2. seed-db VM
- **用途**: PostgreSQL数据库，包含源数据表
- **连接信息**: 
- Host: `seed-db` (Docker网络) 或 `localhost:5434` (从宿主机)
  - Database: `seed_db`
  - Username: `seeduser`
  - Password: `seedpass123`
- **示例表**: `customers` (包含5条测试数据)

## 使用流程

### Step 1: 启动服务

```bash
cd docker
docker-compose up -d
```

这将启动所有服务，包括两个模拟VM。

### Step 2: 配置凭证

1. 打开前端: `http://localhost:3000`
2. 点击右上角设置图标
3. 添加以下凭证:

**SSH凭证 (用于sas-system)**:
- Type: SSH
- Host: `sas-system` (或容器IP)
- Username: `sasuser`
- Password: `sasuser123`
- Port: `22` (可选，默认22)

**PostgreSQL凭证 (用于seed-db)**:
- Type: PostgreSQL
- Host: `seed-db` (或容器IP)
- Username: `seeduser`
- Password: `seedpass123`
- Port: `5432`
- Database: `seed_db`
- Schema: `public` (可选)

### Step 3: 上传Control-M XML文件

上传 `example_scripts/etl_process_controlm.xml` 文件。

系统将：
1. 解析XML，识别远程资源和数据库连接
2. 检查凭证是否存在
3. 如果缺少凭证，自动提示用户输入
4. 使用凭证访问远程文件（从sas-system读取CSV）
5. 使用凭证查询数据库表（从seed-db查询customers表）
6. AI分析完整的数据流
7. 生成OpenLineage事件并发送到Marquez

## Control-M XML格式说明

XML文件应包含：
- `<NODEID>`: 指定执行作业的VM hostname
- `<VARIABLE>`: 定义文件路径和数据库连接参数
  - `INPUT_FILE`: 输入文件路径
  - `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_SCHEMA`, `DB_TABLE`: 数据库连接信息

## API端点

### 凭证管理
- `POST /api/v1/credentials` - 创建/更新凭证
- `GET /api/v1/credentials?type=SSH` - 按类型查询凭证
- `POST /api/v1/credentials/verify` - 验证凭证

### 数据源访问
- `POST /api/v1/data-sources/read-file` - 从远程VM读取文件
- `POST /api/v1/data-sources/query` - 查询数据库表
- `GET /api/v1/data-sources/types` - 获取支持的数据源类型

## 扩展性

系统设计支持未来添加更多数据源类型：
- Oracle Database
- MySQL
- Snowflake
- S3/对象存储
- 等等

只需：
1. 实现对应的 `DataSource` 子类
2. 在 `DataSourceFactory` 中注册
3. 更新前端凭证表单（如果需要特殊字段）
