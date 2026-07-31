# SEMO API 部署与上线计划

- 状态：Draft for review
- 目标域名：`api.semo.one`
- 目标区域：GCP `asia-northeast1`（东京）
- 应用：New API
- 数据库：Cloud SQL for PostgreSQL
- 与 `app.semo.one` / EMO Robot 的关系：产品、用户、凭证、数据与部署相互隔离

## 1. 目标

搭建一个面向 API 客户的独立 AI 模型中转服务：

```text
浏览器 / Claude Code / API Client
                 ↓
             api.semo.one
                 ↓
      Load Balancer / Cloud Armor
                 ↓
        Cloud Run: semo-api
                 ↓
       Cloud SQL for PostgreSQL
                 ↓
 Anthropic / Vertex AI / OpenAI
```

第一阶段需要支持：

- API 用户使用独立账户体系登录和管理；MVP 账户由管理员/邀请码创建；
- 创建、查看和撤销 AI API Token；
- OpenAI/Anthropic 等兼容接口；
- Claude Code 长时间流式请求；
- 模型、渠道、额度和调用日志管理；
- 管理员查看用户、用量、余额和上游状态；
- 自动 HTTPS、自定义域名和基础攻击防护；
- 可重复部署、备份、监控和回滚。

## 2. 非目标

第一阶段明确不做：

- 不与 `app.semo.one` 共用用户系统；
- 不复用 EMO Robot 的 `emo_sk_*` API Key；
- 不读取 Robot 的 `sessions`、`uploaded_files` 或 GCS 数据；
- 不在 API 用户界面中展示或提及 Robot；
- 不实现 Robot 数据贡献换 API 额度；
- 不做跨区域 active-active；
- 不自研完整的 API 网关和计费后台；
- 不把 New API 与 `emo-web` 放进同一个容器；
- 不使用 SQLite；
- 不使用 `latest` 镜像上线。

未来如果两个产品需要关联，应通过独立、显式授权的内部映射完成，不能按邮箱自动关联。

## 3. 隔离边界

### 3.1 产品隔离

| 项目 | Robot 产品 | API 产品 |
|---|---|---|
| 域名 | `app.semo.one` | `api.semo.one` |
| Cloud Run | `emo-web` | `semo-api` |
| 用户 | Supabase Auth 用户 | New API 用户 |
| API Key | `emo_sk_*` | New API Token |
| 数据库 | 现有 Supabase | 独立 Cloud SQL |
| 数据 | Session/上传记录 | 渠道/额度/调用日志 |
| 管理后台 | Robot Admin | New API Admin |
| CI/CD | `emo-web` workflow | `emo-api` workflow |

### 3.2 GCP 隔离

MVP 默认可以继续使用现有 GCP Project，以降低开通和账单管理成本，但必须使用独立资源：

- 独立 Cloud Run service；
- 独立 runtime service account；
- 独立 deployer service account 或严格限定的 IAM；
- 独立 Cloud SQL instance/database/user；
- 独立 Secret Manager secrets；
- 独立 Artifact Registry image path；
- 独立日志、告警和预算标签。

Review checkpoint：

- [ ] MVP 是否使用现有 GCP Project；
- [ ] 正式生产前是否创建独立 GCP Project。

## 4. 关键设计决策

### 4.1 数据库

选择 Cloud SQL PostgreSQL，部署在 `asia-northeast1`，与 Cloud Run 同区。

原因：

- 同一云和同一区域，数据库往返延迟更低、更稳定；
- Cloud Run 有原生 Cloud SQL 集成；
- 可以使用 IAM、Secret Manager、私网和统一监控；
- 避免 GCP Cloud Run 到 AWS Supabase 的跨云链路；
- New API 官方推荐生产使用 PostgreSQL。

MVP 数据库基线（先写死，压测后再调整）：

- Cloud SQL Enterprise edition；
- PostgreSQL 当前受支持的稳定主版本，创建前确认 New API 兼容性；
- `db-custom-1-3840`（1 vCPU / 3.75 GiB）；
- 单区实例；
- 20 GiB SSD；
- 开启自动存储扩容，并设置预算/容量告警；如果平台支持上限则先设 100 GiB；
- 开启自动备份；
- 开启 PITR；
- 开启 deletion protection；
- 设置维护窗口；
- 使用专用数据库 `newapi`；
- 使用专用数据库用户 `newapi_app`；
- 不允许公网任意来源直接连接。

MVP 恢复目标：

```text
RPO ≤ 5 分钟
RTO ≤ 4 小时
```

单区 + PITR 只有在恢复演练能满足以上目标时才可用于 MVP。正式付费后目标收紧为 RPO 接近 0、RTO 15 分钟以内，并据此启用 Regional HA。Cloud SQL 规格、连接上限和价格必须在创建前用 GCP Pricing Calculator 复核。

升级到 Regional HA 的触发条件：

- 开始有稳定付费客户；
- 数据库不可用会造成明显收入或信誉损失；
- 已定义并验证恢复时间目标；
- 已完成一次备份恢复演练。

### 4.2 Cloud Run

MVP 初始值：

| 配置 | 初始值 |
|---|---:|
| CPU | 1 vCPU |
| 内存 | 2 GiB |
| 最小实例 | 1 |
| 最大实例 | 见“多实例约束” |
| 并发 | 50 起步；验证后在 50～80 内确定 |
| 请求超时 | 1800 秒 |
| Billing | instance-based（`--no-cpu-throttling`） |
| Region | `asia-northeast1` |
| Port | 使用 Cloud Run 注入的 `PORT=8080` |

长流式请求要求：

- Cloud Run timeout 控制整段请求的总时长；
- `STREAMING_TIMEOUT` 控制相邻 SSE 数据之间的空闲时间，不与 Cloud Run 总超时设为同一个含义；
- 客户端必须能处理断线和重试；
- 客户端断开后服务端应尽快取消上游请求；
- 不把 `RELAY_TIMEOUT` 设置得过短；
- 验证 Claude Code 15～30 分钟请求；
- 验证 30 分钟达到 Cloud Run timeout 时的错误行为和计费行为。

选择 instance-based 的原因：当前 New API 启动多个后台 goroutine，包括配置同步、渠道检查、额度/统计更新、模型元数据同步和凭证刷新。request-based billing 在无请求时会冻结或显著限制 CPU，导致这些任务不按时执行。master 节点必须使用 instance-based，并保持 `min instances=1`。

### 4.3 New API 多实例约束

这是上线前必须验证的风险项。

New API 官方集群文档区分 `master` 和 `slave`。Cloud Run 同一个 service 的所有实例使用相同配置，无法让自动扩容出来的实例分别具有不同 `NODE_TYPE`。

因此 MVP 不直接假设“把 max instances 设为 5 就安全”。分两阶段：

#### 阶段 A：名义单实例功能验证

- `min instances=1`；
- `max instances=1`；
- 同时设置 service-level 和 revision-level 上限，但不把它当成严格单例保证；
- 验证登录、渠道、额度、扣费、退款、流式响应和 migration；
- 用 concurrency 控制单实例并发；
- 测得单实例安全容量。

Cloud Run 在发布新 revision、实例替换或突发流量期间可能短暂超过 max instances；新旧 revision 也可能同时存活。因此 `max instances=1` 只能限制常态容量，不能作为 migration 单例锁。

Migration 必须从服务启动中拆出：

```text
Cloud Run Job: semo-api-migrate
        ↓
获得 PostgreSQL advisory lock
        ↓
执行 New API migration
        ↓
成功退出
        ↓
部署/切流 Cloud Run service（运行时跳过 migration）
```

当前 upstream 镜像没有已确认的 migration-only 命令，原始启动流程会执行 migration 后继续启动 HTTP server。Phase 1 必须完成以下二选一，不能用“max=1”替代：

1. 在可审计 fork 中加入 `MIGRATION_ONLY=true` 和 `RUN_MIGRATIONS=false`，并用 PostgreSQL advisory lock 保证单执行者；
2. upstream 已提供等价能力时，固定到包含该能力的版本并验证。

如果暂时不修改源码，只能在 staging 验证 GORM AutoMigrate 和项目自定义 migration 的并发幂等性；未验证前不得自动滚动 production。

#### 阶段 B：多实例验证后扩容

选择并验证以下一种方案：

方案 1：同构实例

- 确认当前固定版本允许多个 `master` 实例安全运行；
- 确认定时任务不会重复产生有害副作用；
- 确认启动 migration 并发安全；
- 确认余额更新、退款和渠道状态更新不会重复；
- 通过故障注入和并发测试后把 max instances 调到 5。

方案 2：master/relay 分离

```text
api.semo.one
      ↓
External Application Load Balancer
      ├── Web/Admin routes → semo-api-master
      │                     min=1, max=1
      └── Relay routes     → semo-api-relay
                            NODE_TYPE=slave
                            min=1, max=5
```

此方案需要确认 New API 的具体路由划分、slave 行为和 `FRONTEND_BASE_URL`，并验证流式接口经负载均衡器转发正常。

上线决策：

- [ ] 先以单实例小范围上线；
- [ ] 完成多实例兼容性验证；
- [ ] 决定采用同构实例还是 master/relay 分离。

### 4.4 Redis

名义单实例 MVP 可以不配置 Redis，但必须接受：

- 多实例时限流为实例本地状态；
- Session 状态主要依赖数据库；
- 每个实例可能分别计算速率限制。

Redis 是进入阶段 B（多实例）的硬前提，而不是事后优化项。添加 Memorystore 的触发条件：

- Cloud Run 准备扩展到多个实例；
- 要求严格的跨实例 RPM/TPM 限制；
- 要求 Token 撤销快速传播；
- 数据库 Session 查询成为热点；
- 开启数据库批量更新并验证语义。

添加时：

- 使用共享 Memorystore；
- 使用 Direct VPC egress；
- `REDIS_POOL_SIZE` 从小值开始；
- Redis 只做缓存、限流和临时聚合；
- PostgreSQL 始终是余额、用户和调用记录的权威来源。

## 5. New API 版本与许可证

### 5.1 镜像策略

- 选择一个明确版本；
- 记录 upstream release URL、tag、commit 和 image digest；
- 把固定 digest 的镜像同步到 Artifact Registry；
- Cloud Run 只从 Artifact Registry 部署；
- 不使用 `calciumion/new-api:latest`；
- 每次升级先在 staging 数据库运行。

### 5.2 品牌和许可证

在修改 Logo、页脚、版权信息或发布闭源改动前：

- review New API 当前许可证；
- 确认是否需要商业许可证；
- 保存许可确认或合同记录；
- 明确需要公开的源代码和修改；
- 未完成许可证 review 前，不以去除原品牌的版本正式收费上线。

MVP 默认保留 New API 原品牌、Logo 和版权信息，不做闭源品牌改造，因此不把商业许可证作为 MVP blocker。以下事项是 Phase 3 自定义品牌前的阻塞项：

- [ ] 开源/商业许可证选择已确认；
- [ ] 品牌修改范围已确认；
- [ ] 源代码公开义务已确认。

## 6. 建议目录结构

实施阶段将 `emo-api` 建成独立仓库，建议结构：

```text
emo-api/
  README.md
  PLAN.md
  Dockerfile
  .dockerignore
  .env.example
  docs/
    architecture.md
    operations.md
    rollback.md
    security.md
  infra/
    terraform/
      environments/
        staging/
        production/
      modules/
        cloud-run/
        cloud-sql/
        load-balancer/
        monitoring/
  scripts/
    deploy.sh
    smoke-test.sh
    database-check.sh
  tests/
    smoke/
    load/
  .github/
    workflows/
      deploy-staging.yml
      deploy-production.yml
```

如果第一阶段完全使用官方镜像而不修改源码，仓库只保存部署包装、IaC、文档和测试，不复制无关 upstream 源码。

## 7. GCP 资源命名

Production 建议：

```text
Cloud Run service       semo-api
Cloud SQL instance      semo-api-pg
Cloud SQL database      newapi
Cloud SQL user          newapi_app
Artifact Registry       emo/semo-api
Runtime service account semo-api-runtime
Deployer account        github-semo-api-deployer
Secret: DB DSN          semo-api-sql-dsn
Secret: session         semo-api-session-secret
Secret: crypto          semo-api-crypto-secret
Secret: bootstrap       semo-api-bootstrap-secret（若需要）
```

所有资源增加标签：

```text
product=semo-api
environment=production
region=asia-northeast1
managed-by=terraform
```

Staging 使用明确后缀：

```text
Cloud Run service       semo-api-staging
Cloud SQL instance      semo-api-pg-staging
Cloud SQL database      newapi_staging
Runtime service account semo-api-staging-runtime
Secrets                 semo-api-staging-*
```

MVP staging 可以与 production 位于同一 GCP Project，但不能共用数据库、数据库用户、Secret 或 runtime service account。进入 Phase 3 前将 production 迁入独立 Project；Terraform module 从第一天起不得硬编码 project ID。

### 7.1 MVP 固定成本基线

以下是按 2026-07 公布价格做的量级估算，不含上游模型调用、税、跨区/公网出网和超额日志；实施前必须用 GCP Pricing Calculator 按实际 Project 和承诺折扣复核：

| 组件 | 初始配置 | 月度量级 |
|---|---|---:|
| Cloud Run | 1 vCPU / 2 GiB、instance-based、min=1 | USD 53～58 |
| Cloud SQL | `db-custom-1-3840`、20 GiB SSD、备份 | USD 55～65 |
| Global External ALB | 1 条 forwarding rule + 少量流量 | 约 USD 18 起 |
| Cloud Armor Standard | 1 policy + 少量 rule/request | 约 USD 6 起 |
| 合计 | Redis/HA/上游费用之前 | 约 USD 130～160/月 |

预算默认：

- GCP 基础设施月预算先设 USD 200；
- 在 50%、80%、100% 设置告警；
- 上游模型费用使用独立的日上限和月上限，不能只依赖 GCP Budget；
- Phase 3 的 Regional HA、Redis 和更高 min instances 必须先更新成本基线；
- 预算告警不是硬停机开关，必须另设渠道额度、用户额度和紧急禁用 runbook。

## 8. 数据库连接

第一阶段使用 Cloud Run 原生 Cloud SQL integration：

- Cloud Run runtime service account 仅授予 `roles/cloudsql.client`；
- Cloud SQL 不向互联网开放通用 authorized network；
- `SQL_DSN` 存在 Secret Manager；
- Cloud Run 通过 `/cloudsql/<connection-name>` Unix socket 连接；
- DSN 必须以 `postgres://` 或 `postgresql://` 开头，否则 New API 会把它按 MySQL 解析；
- Phase 1 第一个数据库测试使用下面的 URL 形式，不能使用 PostgreSQL keyword DSN；
- 密码不出现在 GitHub、Terraform state 输出或构建日志。

拟定 DSN：

```text
postgres://newapi_app:<URL_ENCODED_PASSWORD>@/newapi?host=/cloudsql/<PROJECT_ID>:asia-northeast1:semo-api-pg
```

如 driver 要求显式设置本地 socket SSL 行为，再追加经 staging 验证的参数。密码必须 URL encode。验收日志必须明确显示 `using PostgreSQL as database`，并确认实际连接落到预期的 Cloud SQL instance。

New API 默认连接池上限过高，不适合小型 Cloud SQL。拟定初始值：

```text
SQL_MAX_IDLE_CONNS=5
SQL_MAX_OPEN_CONNS=10
SQL_MAX_LIFETIME=300
```

在 `max instances=5` 时，理论应用连接上限约为 50，再为 migration、管理和短暂超配实例预留安全余量。Cloud Run 可能短暂超过 max，因此 Cloud SQL 不能按恰好 50 条连接配置。

这些值必须结合以下指标调整：

- Cloud SQL `max_connections`；
- 活跃/空闲连接；
- 数据库 CPU 和内存；
- 请求等待时间；
- Cloud Run 实例数；
- migration 和管理任务额外连接。

后续如果需要进一步降低延迟或接入 Memorystore，再评估：

```text
Cloud Run Direct VPC egress
        ↓
Cloud SQL private IP
```

## 9. 环境变量

非敏感初始配置：

```text
PORT=8080
TZ=Asia/Tokyo
GIN_MODE=release
DEBUG=false
NODE_TYPE=master
SQL_MAX_IDLE_CONNS=5
SQL_MAX_OPEN_CONNS=10
SQL_MAX_LIFETIME=300
STREAMING_TIMEOUT=300
RELAY_TIMEOUT=0
GLOBAL_API_RATE_LIMIT_ENABLE=true
GLOBAL_WEB_RATE_LIMIT_ENABLE=true
CRITICAL_RATE_LIMIT_ENABLE=true
GENERATE_DEFAULT_TOKEN=false
BATCH_UPDATE_ENABLED=false
```

敏感配置：

```text
SQL_DSN
SESSION_SECRET
CRYPTO_SECRET
```

要求：

- `SESSION_SECRET` 与 `CRYPTO_SECRET` 使用独立的高熵随机值；
- 所有 Cloud Run 实例和 revision 使用一致的值；
- 不使用示例值或 `random_string`；
- Secret rotation 必须有 runbook；
- 上游渠道 API Key 优先由 New API 加密保存，`CRYPTO_SECRET` 与数据库备份分开保管；
- 不开启 `TLS_INSECURE_SKIP_VERIFY`。

Review checkpoint：

- [ ] Cloud Run 总请求时长是否固定为 1800 秒；
- [ ] `STREAMING_TIMEOUT=300` 作为 SSE 空闲超时是否能覆盖长时间 thinking；
- [ ] 是否启用 SSE ping，以及 ping 是否同时保持客户端和负载均衡链路存活；
- [ ] 是否允许用户自助注册；
- [ ] 注册是否需要邮箱验证；
- [ ] 初始是否只允许管理员创建用户；
- [ ] 默认 Token 是否自动生成。

MVP 默认答案：

- Cloud Run 总请求 timeout 为 1800 秒；
- `STREAMING_TIMEOUT` 先保持 300 秒，它是相邻 SSE 行之间的空闲 timeout，每收到一行会 reset；
- 仅邀请码/管理员创建用户；
- 不开放自助注册；
- 不做邮箱验证；
- 不接 SMTP，密码重置由管理员人工处理；
- 不自动生成默认 Token。

## 10. 域名、入口与防护

### 10.1 从第一天使用统一入口

```text
Global External Application Load Balancer
        ↓
Cloud Armor
        ↓
Serverless NEG
        ↓
Cloud Run
```

配置：

- `api.semo.one` 从第一天只指向 Global External Application Load Balancer；
- 使用 Google-managed TLS certificate 和 serverless NEG；
- Cloud Run ingress 设置为 internal and cloud load balancing；
- 禁用 Cloud Run 默认 `run.app` URL，禁止绕过负载均衡器；
- Cloud Armor 初始至少承担初始化期 allowlist、管理路径防护和速率限制；
- 登录、注册、找回密码和管理接口设置更严格的速率限制；
- API 模型请求主要使用业务 Token 限流，不能只依赖 IP；
- 不对 SSE 响应启用会破坏流式行为的缓存。

根路径显示 API 用户后台，API 路径由同一个 New API service 处理。Cookie 保持 host-only，不设置为 `.semo.one`；不与 `app.semo.one` 共享 OAuth client、cookie 或 session secret。

### 10.2 首次初始化防接管

New API 的首次 setup 是高风险窗口：固定版本如果尚未创建 root，公网 setup endpoint 可能允许第一个访问者创建管理员。源码中还保留过 `root/123456` 的兼容初始化逻辑，因此不能仅凭 UI 行为假设它不会生效。

必须按以下顺序上线：

1. 创建 LB、证书和 DNS，但 Cloud Armor 默认只允许运维 IP/IAP 等受控来源；
2. 部署 Cloud Run，确认默认 `run.app` URL 无法绕过 LB；
3. 在受控入口完成 setup，创建随机高熵管理员密码；
4. 检查数据库和固定版本源码/启动日志，确认不存在 `root/123456` 或其他默认账号；
5. 关闭公开注册、演示账号、默认 Token 和不需要的找回密码入口；
6. 创建权限更低的日常管理员，root 凭证离线保管；
7. 完成安全 smoke test 后，才把 API 和登录所需路径开放给种子用户。

任何未初始化的 revision、空数据库恢复或新环境都要重复这套流程。不能在公网开放后再“尽快改密码”。

### 10.3 后续域名拆分

未来如需拆分：

```text
console.semo.one → 用户控制台
api.semo.one     → 纯模型 API
```

MVP 暂不拆分，避免增加认证、CORS 和文档复杂度。

## 11. CI/CD

使用 GitHub Actions + Workload Identity Federation：

1. 校验配置和测试；
2. 拉取固定版本 upstream image；
3. 验证 digest；
4. 同步/构建到 Artifact Registry；
5. 对 staging 运行 `semo-api-migrate-staging` Job；
6. migration 成功后部署 staging revision；
7. 执行数据库和 HTTP smoke tests；
8. 人工批准 production；
9. 确认 production 备份/PITR 后运行 `semo-api-migrate` Job；
10. migration 成功后部署新 revision但暂不全量切流；
11. 小比例流量验证；
12. 全量切流；
13. 记录部署版本、digest、数据库 schema 版本和 migration execution ID。

禁止：

- GitHub 中保存 service account JSON；
- workflow 打印 Secret；
- 自动部署 `latest`；
- 未备份数据库直接执行未知 migration；
- migration Job 失败后继续部署 service；
- 应用 health check 未通过仍继续切流。

## 12. 数据库 Migration 策略

New API 启动时可能执行 migration，必须验证当前固定版本的行为。

目标状态是“Job 唯一负责 migration，service 永不 migration”。Job 和 service 使用同一 digest，但通过经审计的启动参数进入不同模式；Job 先获取 PostgreSQL advisory lock，失败或超时必须非零退出。

首次上线：

1. 创建 staging Cloud SQL；
2. 实现并验证 migration-only / skip-migration 两种启动模式；
3. 使用 migration Job 初始化空数据库；
4. 保存初始化后的 schema dump；
5. 记录创建的表、index、trigger 和默认数据；
6. 同时启动两个 migration Job，验证 advisory lock 和幂等性；
7. 在新旧两个 service revision 并存时验证 service 不执行 migration；
8. 验证降级到上一镜像是否仍能读取新 schema。

每次升级：

1. 阅读 release notes 和 migration；
2. 创建/确认备份；
3. 在 staging 的生产 schema 副本上运行 migration Job；
4. 跑登录、Token、渠道、扣费、退款和流式测试；
5. 判定 migration 是否 backward compatible；
6. 只有兼容时才允许 Cloud Run revision 渐进切流；
7. 不兼容时必须使用停机维护窗口，或先实施 expand/contract migration；
8. migration 失败时停止发布，不启动新 service revision。

## 13. 监控与告警

### 13.1 Cloud Run

- request count；
- active streaming requests；
- P50/P95/P99 latency；
- 4xx、429、5xx；
- instance count；
- container startup latency；
- CPU 和 memory；
- request timeout；
- 容器重启和 OOM。

### 13.2 Cloud SQL

- CPU、memory、disk；
- active/idle connections；
- connection saturation；
- query latency；
- deadlock；
- storage growth；
- backup success；
- replication/failover 状态（启用 HA 后）。

### 13.3 业务

- 每个上游的成功率；
- 首 token 时间；
- 流中断率；
- 每模型普通 input、cache creation、cache read、output/thinking token；
- 每个 request 的上游实际成本、客户收费和毛利；
- New API 日志、内部账本和上游账单之间的差异；
- 扣费失败和退款失败；
- 异常 Token/IP；
- 单用户消费突增；
- 渠道余额不足；
- 上游 401/403/429/5xx。

### 13.4 告警

至少创建：

- 5xx 比例告警；
- Cloud SQL 连接数告警；
- 数据库磁盘告警；
- Cloud Run timeout 告警；
- 上游错误率告警；
- 当日上游成本异常告警；
- GCP Budget 告警；
- Secret 或渠道密钥失效告警；
- 备份失败告警。

## 14. 收费、计费与对账

### 14.1 MVP 收款方式

MVP 采用“预付费 + 人工入账”：

1. 仅管理员/邀请码创建客户；
2. 客户通过银行转账或线下约定方式付款；
3. 财务确认到账并生成收款/发票记录；
4. 管理员通过受审计操作增加额度；
5. 客户只能消费已到账额度；
6. 退款由人工审核和执行。

MVP 不接 New API 内置的第三方支付插件，不开放后付费，不把支付网关密钥交给 New API。每次人工调额必须记录操作者、客户、币种、原币金额、汇率、额度变动、付款凭证 ID、时间和备注，并使用幂等业务编号避免重复入账。

进入自动收款前，单独评审：

- 适合日本主体的 PSP；
- 消费税、适格請求書/インボイス、币种和汇率处理；
- chargeback、退款和反欺诈；
- 支付账本与 New API 额度的边界；
- 会计/税务顾问确认的发票和收入确认流程。

### 14.2 Token 与成本口径

不能只按普通 input/output token 计费。价格表必须按“供应商 + 渠道 + 精确模型版本 + 生效时间”版本化，至少支持：

- 普通 input token；
- prompt cache creation token，并区分 5 分钟/1 小时等 TTL（供应商返回时）；
- prompt cache read token；
- output token；
- thinking/reasoning token 的供应商实际归类；
- batch、长上下文或 beta 功能的附加费；
- 上游请求级固定费用或折扣（如存在）。

Anthropic 当前常见的 prompt caching 相对系数可作为审计样例：5 分钟写入约为普通 input 的 1.25 倍、1 小时写入约为 2 倍、cache read 约为 0.1 倍；最终必须以请求发生时的上游正式价格和返回 usage 为准，不能把这些数字硬编码成所有模型的通用规则。

每次请求至少保存以下不含正文的计费证据：

```text
request_id / upstream_request_id
user_id / token_id / channel_id
provider / exact_model / price_version
input_tokens
cache_creation_tokens（含 TTL breakdown，如可得）
cache_read_tokens
output_tokens / thinking_tokens（按供应商返回结构）
upstream_actual_cost
customer_charge
currency / fx_rate_version
finish_reason / HTTP status / disconnect state
refund_amount / adjustment_reason
```

若固定 New API 版本不能完整解析、保存和计价 cache/thinking usage，该模型不得进入收费清单；不得用估算总 token 静默替代。

### 14.3 中断、失败与退款

默认规则：

- 客户端主动断开或网络中断：按上游已经产生并能取得的实际 usage 计费；
- 上游 5xx/超时且没有可用输出：客户侧全额退回；
- 已有部分可用输出：按实际 usage 计费，并明确写入服务条款；
- usage 缺失、上游状态未知或重复请求：进入异常账单队列，不能自动猜测；
- 退款和补扣使用独立、幂等账本记录，不直接改写原调用记录。

服务端必须在客户端断开后尽快取消上游请求，但不能承诺取消一定能阻止上游继续计费。

### 14.4 每日对账与止损

每日按供应商、渠道、模型和币种聚合：

```text
客户收入
- 上游实际成本
- 退款/补偿
= 毛利
```

同时比较：

1. New API usage 日志；
2. 平台不可变计费账本；
3. 上游 usage/billing statement；
4. 人工收款/退款账本；
5. New API 用户余额变动。

初始告警阈值设为“当日差异超过 5% 或 USD 10，任一先达到即告警”，运行两周后按噪声调整。出现负毛利、usage 字段缺失、价格版本过期或余额异常时，可以自动暂停相关模型/渠道。

上游转售条款不作为本计划 Phase 0 的工程阻塞项；团队已接受该业务风险。架构仍保持渠道可替换，并保留未来切换 Vertex AI、直连合同或 BYOK 模式的能力。

## 15. 日志与隐私

默认不记录：

- Authorization header；
- 完整 API Token；
- 完整 prompt；
- 完整 response；
- 上游 API Key；
- 用户密码；
- Secret Manager 内容。

结构化日志可以记录：

- request ID；
- account/user/token 的内部 ID；
- Token prefix 或不可逆 hash；
- 模型；
- 渠道 ID；
- input/output token；
- 首 token和总延迟；
- HTTP 状态；
- 上游错误类型；
- 估算成本和收费；
- 重试次数；
- Cloud Run revision。

上线前完成：

- 隐私政策；
- 服务条款；
- 可接受使用政策；
- 数据保留周期；
- 日志删除规则；
- 用户数据删除流程；
- 上游渠道和价格变更的运营检查。

## 16. 测试计划

### 16.1 功能

- 在公网关闭状态完成管理员首次初始化；
- 确认不存在 `root/123456`、默认 Token 或可重入 setup；
- 管理员创建用户、登录、退出；
- Token 创建、撤销和禁用；
- 无效 Token 返回 401；
- 余额不足拒绝调用；
- OpenAI compatible API；
- Anthropic/Claude compatible API；
- 流式与非流式；
- 多模型和渠道 fallback；
- 上游 429/5xx；
- 请求取消；
- 扣费和退款；
- Dashboard 用量一致。

### 16.2 Claude Code

- 新会话；
- 长上下文；
- `POST /v1/messages/count_tokens` 的路径、认证、返回结构和错误行为；
- 使用 Claude Code 默认的 `x-api-key` 认证，不只测试 `Authorization: Bearer`；
- `anthropic-version` 和 `anthropic-beta` header 透传；
- `cache_control` 请求透传；
- 返回 usage 中 `cache_creation`、`cache_read` 字段的解析、记录和计费；
- thinking token 的记录和计费；
- 1M context / 长上下文 beta header（仅对计划开放的模型）；
- tool use；
- thinking 模型；
- 5、15、30 分钟流式连接；
- 客户端主动中断；
- 网络断开重连；
- 上游已经计费但客户端断开的处理；
- 并发多个 Claude Code session。

`count_tokens` 是上线 Claude Code 的兼容性 blocker。所选固定版本如果未实现该端点，需要在审计 fork 中补齐或固定到已实现的 upstream 版本，不能用客户端“看起来能聊天”代替此项验收。

### 16.3 性能

压测至少覆盖：

- 10、20、50、100 个并发流；
- 单实例最大安全并发；
- Cloud Run 扩容前后的延迟；
- Cloud SQL 连接池；
- 冷启动；
- 突发请求；
- 持续 30 分钟 soak test。

输出：

- 推荐 concurrency；
- 推荐 max instances；
- 单实例内存基线；
- Cloud SQL 规格；
- 每 100 个并发流的估算成本；
- 可接受的 P95/P99。

### 16.4 故障

- Cloud Run revision 回滚；
- 部署时新旧两个 revision 并存，确认二者都不执行 migration；
- 同时运行两个 migration Job，确认只有持锁者执行；
- Cloud SQL 临时断线；
- 数据库连接池耗尽；
- 上游 timeout；
- 上游密钥失效；
- Secret rotation；
- Cloud Run 实例被终止；
- 备份恢复到新实例；
- Redis 不可用（启用后）。

## 17. 首套 Production 实施步骤（按顺序执行）

本节是接下来实际执行的主清单。当前没有正式用户和历史数据，因此不长期维护独立 staging：直接创建 production 资源，但 Cloud Run 在迁移、初始化、管理员加固和冒烟测试完成前保持私有。一次只推进一个 Step；每一步完成并验证后再进入下一步。带“收费资源”的 Step 在执行前再次确认。

### Step 0：本地仓库与镜像基线

- [x] fork 已创建：`git@github.com:xiafei571/emo-api.git`；
- [x] 本地仓库位于 `emo-api`；
- [x] `origin` 指向 fork；
- [x] `upstream` 指向 `QuantumNous/new-api`，并禁用 upstream push；
- [x] 工作分支为 `semo/cloud-run`；
- [x] fork 与 upstream `main` 同步；
- [x] 当前 smoke commit 为 `afe16c64cd73853da1eda3bf236f15d69637b4bf`；
- [x] `linux/amd64` 本地镜像构建成功；
- [x] 临时 SQLite smoke 容器已停止并删除；
- [x] 已确认当前代码缺少 `POST /v1/messages/count_tokens`；
- [x] 已确认当前 `main` 的 `VERSION` 文件为空。

Step 0 只证明源码可以构建和启动，不代表该 commit 已被选为 production 版本。

### Step 1：安装 GCP CLI 并确认账号（不创建收费资源）

目标：

- 安装 Google Cloud CLI；
- 登录正确的 Google 账号；
- 把默认 Project 设置为 `semo-ai-503410`；
- 把默认 Cloud Run/Compute region 设置为 `asia-northeast1`；
- 确认 Project 已绑定有效 Billing Account；
- 只做读取和本机配置，不创建 Cloud SQL、Redis 或 Load Balancer。

验收命令：

```bash
gcloud auth list
gcloud config get-value project
gcloud config get-value run/region
gcloud billing projects describe semo-ai-503410
```

完成条件：

- [x] `gcloud` 可执行（本机已安装 Google Cloud CLI 578.0.0；实际操作也可使用 Cloud Shell）；
- [x] Cloud Shell active account 为 `info@semo.one`；
- [x] project 输出 `semo-ai-503410`；
- [x] Cloud Run 和 Compute region 输出 `asia-northeast1`；
- [x] billing 为 enabled；
- [x] `compute.googleapis.com` 已启用。

### Step 2：固定测试版本并处理上云前代码 blocker

在产生常驻 Cloud SQL 费用前完成：

- [x] staging 固定到明确 commit：`afe16c64cd73853da1eda3bf236f15d69637b4bf` 加当前审计补丁；
- [x] 首个 production 候选版本字符串定为 `afe16c64-semo.1`，并已写入 `VERSION`，避免空版本构建；
- [x] 实现并用本地 SQLite smoke 确认 `MIGRATION_ONLY=true`；
- [x] 实现并从启动日志确认 service 的 `RUN_MIGRATIONS=false`；
- [x] migration 已实现 PostgreSQL advisory lock；真实 PostgreSQL 并发验收留在 Step 6；
- [x] 已记录第一版 staging 暂不支持 Claude Code：当前没有 `POST /v1/messages/count_tokens`；
- [x] `go test ./model` 通过；
- [x] 重新构建固定源码测试镜像 `semo-api:afe16c64-migration1`；
- [x] 记录 commit 和本地 image digest：
  `afe16c64cd73853da1eda3bf236f15d69637b4bf` /
  `sha256:c976f99d9ab8e3b66207451d30bcfa9a2f72386de7ad7071adb56dc9d1845611`。

完成条件：相同源码可以分别作为 migration Job 和不执行 migration 的 Cloud Run service 启动。

本地完成条件已满足；PostgreSQL advisory lock 仍必须在 Step 6 使用 Cloud SQL 实测后才能作为云端验收通过。

### Step 3：启用 GCP API、创建 IAM 和 Artifact Registry

启用：

```text
run.googleapis.com
sqladmin.googleapis.com
artifactregistry.googleapis.com
secretmanager.googleapis.com
iamcredentials.googleapis.com
compute.googleapis.com
cloudbuild.googleapis.com（仅在使用 Cloud Build 时）
```

创建：

```text
Artifact Registry repository: emo（已存在，可复用）
Runtime service account:       semo-api-staging-runtime
Migration service account:     semo-api-staging-migrate
GitHub deployer account:        github-semo-api-deployer
```

最初创建的两个 `staging` service account 保留但不用于 production。决定直接部署 production 后，实际运行账号改为：

```text
Runtime service account:       semo-api-prod-runtime
Migration service account:     semo-api-prod-migrate
GitHub deployer account:        github-semo-api-deployer
```

最小权限：

- runtime：`roles/cloudsql.client`、指定 secrets 的 accessor；
- migration：`roles/cloudsql.client`、数据库 DSN secret accessor；
- deployer：只授予构建、推镜像、部署指定 Cloud Run service/Job 和 impersonate 指定 service account 所需权限；
- 不给 runtime 或 GitHub Actions Project Owner/Editor。

完成条件：

- [x] 必需 API 均为 enabled（含 Cloud Run、Cloud SQL Admin、Artifact Registry、Secret Manager、IAM Credentials、Compute、Cloud Build）；
- [x] 三个 `emo-api` 专用 service accounts 已创建并启用；
- [x] Artifact Registry `emo` 已存在于 `asia-northeast1`，格式为 Docker；
- [x] runtime/migration 仅获得 Cloud SQL Client；deployer 获得 repo writer、Cloud Run Developer 和对两个 runtime account 的 Service Account User；
- [x] WIF provider `github/emo-api` 已创建且只接受 `xiafei571/emo-api`；
- [x] IAM policy 检查不存在明显过宽的 `emo-api` 角色。
- [x] production runtime/migration service account 已创建，并获得与 staging 对应的最小权限。

### Step 4：创建 Production Cloud SQL 与 Secrets（开始产生费用）

执行前再次确认预算。创建：

```text
Instance: semo-api-pg-prod
Region:   asia-northeast1
Database: newapi
User:     newapi_app
```

初始规格沿用 §4.1。数据库密码使用密码生成器创建，密码本身不写入：

- Dockerfile；
- Docker Compose；
- Git；
- GitHub Actions variables；
- Terraform output；
- shell history。

把完整 DSN 作为 Secret Manager secret `semo-api-prod-sql-dsn` 保存：

```text
postgres://newapi_app:<URL_ENCODED_PASSWORD>@/newapi?host=/cloudsql/semo-ai-503410:asia-northeast1:semo-api-pg-prod
```

同时创建：

```text
semo-api-prod-session-secret
semo-api-prod-crypto-secret
```

要求：

- 数据库密码、`SESSION_SECRET`、`CRYPTO_SECRET` 三者独立生成；
- 开启自动备份、PITR、自动存储扩容和 deletion protection；
- 不创建 `0.0.0.0/0` authorized network；
- runtime 和 migration service account 只读取各自需要的 secret；
- 用 Cloud SQL connection name 验证 DSN socket 路径。

完成条件：

- [x] `semo-api-pg-prod` 为 `RUNNABLE`，PostgreSQL 15，`db-custom-1-3840`，20 GB SSD；
- [x] database `newapi` 和非管理员用户 `newapi_app` 已创建；
- [x] SQL DSN、Session、Crypto 三个应用 secrets 均有 enabled version；管理员密码另存独立 secret；
- [x] DSN 以 `postgresql://` 开头，并使用 Cloud SQL Unix socket；
- [x] 自动备份、PITR、100 GB 自动扩容上限和 deletion protection 已开启；
- [x] Connector enforcement 为 `REQUIRED`、SSL mode 为 `ENCRYPTED_ONLY`，无 authorized networks；
- [x] runtime 只能读取应用所需三个 secrets；migration 只能读取 SQL DSN。

### Step 5：构建、推送并固定 Artifact Registry 镜像

- [ ] 为选定 commit 构建 `linux/amd64` 镜像；
- [ ] 推送 commit SHA tag，不推 `latest` 作为部署依据；
- [ ] 读取 Artifact Registry 返回的不可变 digest；
- [ ] 扫描镜像；
- [ ] Cloud Run 和 migration Job 都引用同一 digest。

拟定地址：

```text
asia-northeast1-docker.pkg.dev/semo-ai-503410/emo/semo-api@sha256:<DIGEST>
```

### Step 6：运行 Migration Job

- [ ] 创建 `semo-api-migrate-staging` Cloud Run Job；
- [ ] 连接 `semo-api-pg-staging`；
- [ ] 从 Secret Manager 注入 `SQL_DSN`；
- [ ] 设置 `MIGRATION_ONLY=true`；
- [ ] 执行一次并保存 execution ID；
- [ ] 日志确认 driver 为 PostgreSQL；
- [ ] 查询 schema 确认表/index 创建成功；
- [ ] 再并发执行两次，确认 advisory lock 阻止竞态。

Job 失败时停止，不部署 service。

### Step 7：私密部署 Production Cloud Run

初始配置：

```text
Service:       semo-api-prod
Region:        asia-northeast1
CPU/Memory:    1 vCPU / 2 GiB
Concurrency:   50
Min/Max:       1 / 1
Timeout:       1800s
CPU allocation: instance-based
Ingress:       暂不开放公网
Migration:     RUN_MIGRATIONS=false
```

- [ ] 挂载 Cloud SQL connection；
- [ ] 从 Secret Manager 注入 `SQL_DSN`、`SESSION_SECRET`、`CRYPTO_SECRET`；
- [ ] 设置连接池、stream timeout 和关闭默认 Token 等环境变量；
- [ ] 禁止未授权公网访问；
- [ ] 验证 `/api/status`；
- [ ] 验证 `/api/setup` 的 `database_type` 为 PostgreSQL；
- [ ] 确认 service 启动日志没有运行 migration。

### Step 8：受控初始化与功能验证

- [ ] 只允许运维来源访问；
- [ ] 创建随机高熵 root 密码；
- [ ] 检查不存在 `root/123456`；
- [ ] setup 不可重入；
- [ ] 关闭自助注册、邮箱验证、演示账号和默认 Token；
- [ ] 创建低权限日常管理员；
- [ ] 配置一个低额度测试渠道；
- [ ] 执行登录、Token、流式、扣费、缓存计费和断线测试；
- [ ] 未实现 `count_tokens` 时不得宣称支持 Claude Code。

### Step 9：配置正式入口

- [ ] 创建 Global External Application Load Balancer；
- [ ] 创建 serverless NEG 指向 `semo-api-staging`；
- [ ] 创建 Cloud Armor policy，先使用运维 IP allowlist；
- [ ] Cloud Run ingress 改为 internal and cloud load balancing；
- [ ] 禁用默认 `run.app` URL；
- [ ] 配置 Google-managed certificate；
- [ ] DNS 验证无误后把 `api.semo.one` 指向 LB；
- [ ] 完成安全 smoke test 后才扩大 Cloud Armor allowlist。

### Step 10：Redis 延后

Staging/Production MVP 在名义单实例阶段不创建 Redis，也不修改 Docker 中的 Redis 密码。准备把 Cloud Run 扩展到多实例时，Redis 才作为硬前提实施：

1. 创建 Memorystore；
2. 配置 Direct VPC egress；
3. 如启用 Redis AUTH，把凭证放入 Secret Manager；
4. 注入 `REDIS_CONN_STRING`；
5. 验证跨实例限流、Session、Token 撤销和 Redis 故障行为；
6. 验证完成后才把 Cloud Run `max instances` 提高到 2 以上。

## 18. 上线阶段

### Phase 0：决策

- [x] MVP 保留 New API 原品牌，不做闭源去品牌改造；
- [x] 上游转售条款作为团队接受的业务风险，不作为工程上线 blocker；
- [x] MVP 使用现有 GCP Project，Phase 3 前迁移 production 到独立 Project；
- [x] 仅管理员/邀请码创建用户，不开放自助注册；
- [x] MVP 使用预付费、线下收款、人工入账；
- [x] 单次请求最大时长先设 30 分钟；
- [x] `api.semo.one` 同时承载控制台和 API；
- [x] 从第一天使用 External ALB + Cloud Armor；
- [x] 默认不保存 prompt/response；
- [ ] 选择固定 New API 版本；
- [ ] 记录镜像 digest、commit、许可证文本和本地 patch；
- [ ] 确认初始上游供应商；
- [ ] 建立逐模型价格表和 cache/thinking 计费口径；
- [ ] 确认日志保留和隐私策略。

### Phase 1：Staging

- [ ] 初始化独立 `emo-api` repository；
- [ ] 创建指定规格的 staging Cloud SQL；
- [ ] 首先验证 URL 格式 Unix socket PostgreSQL DSN 和 driver 识别；
- [ ] 实现/确认 migration-only 与 service skip-migration 模式；
- [ ] 创建 `semo-api-migrate-staging` Job 并验证 advisory lock；
- [ ] 创建 1 vCPU / 2 GiB、instance-based 的 staging Cloud Run；
- [ ] 配置 Secret Manager；
- [ ] 创建 staging ALB、serverless NEG、Cloud Armor allowlist 和受控 setup 入口；
- [ ] 在非公网状态初始化 New API，排除默认账号和 setup 重入；
- [ ] 配置一个低额度测试渠道；
- [ ] 验证 `/v1/messages/count_tokens`、`x-api-key`、beta/version header；
- [ ] 验证 prompt cache、thinking usage 和逐请求计费；
- [ ] 完成功能、流式、双 revision 和 migration 并发测试；
- [ ] 压测 concurrency 50～80 和 2 GiB 内存基线；
- [ ] 用 Pricing Calculator 复核 USD 130～160/月的成本基线；
- [ ] 完成备份恢复演练。

### Phase 2：Production MVP

- [ ] 创建 production Cloud SQL；
- [ ] 创建 production secrets 和 service account；
- [ ] 运行 production migration Job 后部署固定镜像；
- [ ] 配置 `api.semo.one`、ALB、TLS、Cloud Armor 和受限 ingress；
- [ ] 在 allowlist 下完成初始化，再开放种子用户路径；
- [ ] 保持关闭自助注册、邮箱验证和 SMTP；
- [ ] 只邀请内部/种子用户；
- [ ] 使用预付费、线下收款和人工额度入账；
- [ ] 启用每日收入/成本/余额对账；
- [ ] 设置上游和用户双重消费上限；
- [ ] 配置 USD 200 基础设施预算及 50/80/100% 告警；
- [ ] 名义单实例运行并收集基线，不把 `max=1` 当作 migration 锁。

### Phase 3：小规模付费

- [ ] 完成条款、隐私和退款政策；
- [ ] 将 production 迁入独立 GCP Project；
- [ ] 选择日本收款/发票/税务流程，或继续受控人工收款；
- [ ] 完成支付、退款和财务账本设计后再考虑自动充值；
- [ ] 验证多实例模式；
- [ ] 在增加第二个 service 实例前先增加共享 Redis；
- [ ] 按 RPO/RTO 验证结果增加数据库 Regional HA；
- [ ] 完成 on-call/runbook；
- [ ] 继续邀请码，除非 SMTP、反滥用和支付风控均已完成。

### Phase 4：增长

- [ ] 根据指标调整 CPU、内存、并发和连接池；
- [ ] 评估日志数据库分离；
- [ ] 评估 console/API 域名拆分；
- [ ] 评估欧美区域；
- [ ] 设计租户/区域数据分片；
- [ ] 评估欧美客户的数据驻留、延迟和独立上游渠道。

## 19. 回滚

应用回滚：

- 保留上一稳定 Artifact Registry digest；
- Cloud Run 保留上一稳定 revision；
- 使用流量切换回上一 revision；
- 回滚后执行 smoke test；
- 暂停自动继续部署。

数据库回滚：

- migration backward compatible 时，仅回滚应用；
- migration 不兼容时，不允许盲目回滚镜像；
- 从备份恢复时优先恢复到新 Cloud SQL instance；
- 验证数据后再修改应用连接；
- 记录 RPO、RTO 和丢失的数据范围。

紧急止损：

- 禁用受影响渠道；
- 禁用注册和 Token 创建；
- 把 Cloud Run max instances 降低；
- 撤销泄露的上游 Key；
- 停止高风险模型；
- 保留审计日志；
- 不删除故障数据库或 revision。

## 20. MVP 验收标准

必须全部满足：

- [ ] `api.semo.one` 使用有效 HTTPS；
- [ ] 域名只通过 External ALB 访问，Cloud Run 默认 URL 无法绕过；
- [ ] Cloud Armor 初始化 allowlist 在公网开放前生效；
- [ ] setup 在受控入口完成且不可重入；
- [ ] 固定版本不存在可用的 `root/123456`、默认 Token 或其他默认凭证；
- [ ] API 用户无法访问 Robot 数据或凭证；
- [ ] Robot 用户不会自动成为 API 用户；
- [ ] New API 使用 Cloud SQL PostgreSQL，不使用 SQLite；
- [ ] 镜像固定到明确 digest；
- [ ] 所有 Secret 位于 Secret Manager；
- [ ] Cloud Run 使用 instance-based billing，后台任务在无请求时仍按期运行；
- [ ] service 不执行 migration，migration Job 有 advisory lock 且可审计；
- [ ] 双 revision 并存不会触发并发 migration；
- [ ] 上游 Key 不出现在代码、日志和 CI；
- [ ] Claude Code 的 `count_tokens`、`x-api-key` 和 Anthropic headers 测试通过；
- [ ] cache creation/read 和 thinking usage 能正确记录、计价和对账；
- [ ] Claude Code 可以完成 15 分钟以上的流式请求；
- [ ] 客户端取消后上游请求能够被合理终止；
- [ ] 扣费、失败和退款测试通过；
- [ ] Token 撤销及时生效；
- [ ] 数据库连接池不会耗尽；
- [ ] 自动备份成功；
- [ ] 备份恢复演练成功；
- [ ] 恢复演练达到 MVP `RPO ≤ 5 分钟 / RTO ≤ 4 小时`；
- [ ] 人工收款、额度入账、退款和每日对账流程跑通；
- [ ] 日成本/收入差异与负毛利告警有效；
- [ ] 5xx、数据库、上游成本和 GCP Budget 告警有效；
- [ ] 应用 revision 可以回滚；
- [ ] 许可证和隐私政策已 review；上游转售风险已由业务负责人记录接受。

## 21. 已确定事项与剩余决策

已采用的默认决策：

1. MVP 使用现有 GCP Project；Phase 3 前迁移 production 到独立 Project。
2. MVP 保留 New API 品牌和版权，不去 Logo。
3. 仅管理员/邀请码创建用户，不接 SMTP。
4. 先以 `max instances=1` 名义单实例上线，但 migration 必须先从 service 拆出。
5. 单次请求最大 30 分钟；SSE 空闲 timeout 先设 5 分钟。
6. 预付费；MVP 线下收款和人工分配额度。
7. 客户端断开按实际 usage 收费；无可用输出的上游 5xx/超时全退。
8. Redis 是扩展到多实例的硬前提。
9. `api.semo.one` 在 MVP 同时承载控制台和 API。
10. 从第一天使用 External ALB、serverless NEG、Cloud Armor 和受限 ingress。
11. 默认不保存 prompt/response；未来只能在用户显式 opt-in 和独立保留期下启用。
12. 上游转售条款不是工程 blocker，作为已接受的业务风险管理。

实施前仍需明确：

1. 固定哪个 New API tag、commit 和 image digest？
2. migration-only / skip-migration 使用 upstream 能力还是维护最小 fork？
3. 第一批渠道和精确模型清单是什么？
4. 每个模型的客户价格、上游价格版本和最低毛利率是多少？
5. Cloud SQL Regional HA 在首个付费客户前启用，还是由恢复演练结果触发？
6. 日志和不可变计费账本分别保留多久？
7. Phase 3 继续人工收款，还是选择哪个日本 PSP/开票方案？

## 22. 参考文档

- [New API environment variables](https://docs.newapi.ai/en/docs/installation/config-maintenance/environment-variables)
- [New API cluster deployment](https://docs.newapi.ai/en/docs/installation/deployment-methods/cluster-deployment)
- [Cloud Run request timeout](https://docs.cloud.google.com/run/docs/configuring/request-timeout)
- [Cloud Run concurrency](https://docs.cloud.google.com/run/docs/about-concurrency)
- [Cloud Run maximum instances behavior](https://docs.cloud.google.com/run/docs/configuring/max-instances)
- [Cloud Run instance-based billing / CPU allocation](https://docs.cloud.google.com/run/docs/configuring/billing-settings)
- [Cloud Run to Cloud SQL](https://docs.cloud.google.com/sql/docs/postgres/connect-run)
- [Cloud SQL private IP](https://docs.cloud.google.com/sql/docs/postgres/private-ip)
- [Cloud SQL high availability](https://docs.cloud.google.com/sql/docs/postgres/high-availability)
- [Cloud Run ingress](https://docs.cloud.google.com/run/docs/securing/ingress)
- [Cloud Armor integration](https://docs.cloud.google.com/armor/docs/integrating-cloud-armor)
- [Cloud Load Balancing pricing](https://cloud.google.com/load-balancing/pricing)
- [Cloud Armor pricing](https://cloud.google.com/armor/pricing)
- [Cloud SQL pricing](https://cloud.google.com/sql/pricing)
- [New API database initialization and driver selection source](https://github.com/QuantumNous/new-api/blob/main/model/main.go)
- [New API setup controller source](https://github.com/QuantumNous/new-api/blob/main/controller/setup.go)
- [New API streaming idle timeout source](https://github.com/QuantumNous/new-api/blob/main/relay/helper/stream_scanner.go)
- [New API authentication middleware source](https://github.com/QuantumNous/new-api/blob/main/middleware/auth.go)
- [Anthropic prompt caching reference](https://github.com/anthropics/skills/blob/main/skills/claude-api/shared/prompt-caching.md)
