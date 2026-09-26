# study-tool

给外甥学英语用。npm workspaces monorepo：

```
├── packages/
│   └── core/          # @study/core：纯 TS 核心包（单词数据 / 出题逻辑 / 进度存储 / 平台接口）
├── apps/
│   ├── h5/            # H5 端：Vite + Vue3 + TS + vue-router + Pinia + Tailwind
│   ├── server/        # @study/server：Fastify + better-sqlite3 账号/进度同步服务
│   └── uni/           # App 壳：HBuilderX 管理的 uni-app 项目（web-view 加载线上 H5），
│                      # 不在 npm workspaces 内，用 HBuilderX 打开并云打包
└── scripts/
    └── generate_audio.py   # 从 core 的 words.ts 生成 edge-tts 音频到 apps/h5/public/audio
```

## 常用命令

```bash
npm install            # 根目录安装所有 workspace 依赖

npm run dev            # 启动 H5 开发服务器（= npm run dev --workspace apps/h5）
npm run build          # 构建 H5（vue-tsc + vite），产物在 apps/h5/dist
npm run preview        # 预览 H5 构建产物
npm run dev:server     # 启动服务端（tsx watch，默认 127.0.0.1:3000）
npm run build:server   # 服务端类型检查（tsc --noEmit）
npm run gen:audio      # 重新生成单词/例句音频（需要 python + edge-tts）
```

## App 打包（apps/uni）

apps/uni 是 **HBuilderX 可视化项目**（不是 CLI 项目），只有一页 web-view 指向线上 H5：

1. 用 HBuilderX 打开 `apps/uni` 目录
2. 发行 → 原生 App-云打包 → Android → 得到 apk

> 注意：不要给 apps/uni 装 node_modules / 走 npm 编译，HBuilderX 云打包会使用项目里的依赖副本，
> 与 monorepo 的 vue 版本冲突会导致 "xxx is not exported" 报错。

## 首次克隆后的初始化

音频文件不进仓库（可通过脚本再生），克隆后需要：

```bash
npm install
pip install edge-tts
npm run gen:audio       # 生成全部单词/例句音频到 apps/h5/public/audio/（约几分钟）
```

不生成音频也能跑：发音会自动走"有道在线接口 → 浏览器 TTS"兜底，只是音质和稳定性差一些。

词表解析脚本的使用见 `docs/词表解析脚本使用指南.md`，音标校对参考 `docs/音标字符表.md`。

## 服务端（apps/server）

Fastify + better-sqlite3 的账号与进度同步服务，接口全部挂在 `/api` 前缀下。
因为 @study/core 是 TS 源码包（exports 直接指向 src），**服务端开发/生产都用 tsx 运行**
（tsx 在 dependencies 里），`npm run build:server` 只做 tsc 类型检查不产出 dist。

```bash
npm run dev:server        # 启动服务端，默认监听 127.0.0.1:3000（HOST/PORT 环境变量可覆盖）
                          # SQLite 文件默认 ./data/app.db，可用 DB_PATH 覆盖（自动建目录）

# 创建/更新账号（重复执行同用户名 = 改密码）
npm run seed --workspace apps/server -- --user waisheng --pass xxx --role user
# seed 会幂等保证存在 admin 账号：密码取 ADMIN_PASS 环境变量，
# 未设置则随机生成并在控制台打印一次

# 本地联调：另开一个终端起 H5，vite 已把 /api 代理到 127.0.0.1:3000
npm run dev
```

接口摘要：

| 接口 | 说明 |
| --- | --- |
| `POST /api/login` | `{username, password}` → `{token, role}`（scrypt 校验，Bearer token 认证） |
| `GET /api/progress` | 返回本人进度（无记录返回 `null`） |
| `POST /api/progress` | `{progress}` → 用 core 的 `mergeProgress` 与服务器数据合并后写库，返回合并结果 |
| `GET /api/admin/summary` | 仅 admin：所有用户的星星/等级/已学单词/完成单元/最近活跃 |

### 部署到服务器

打 tag（`git tag v0.x.x && git push origin v0.x.x`）后 GitHub Actions 会在部署 H5 之后，
把 `apps/server` + `packages/core` 打包上传到 `/var/www/english-study-server/`，
执行 `npm install --omit=dev` 并用 pm2 重启（`pm2 start npm --name english-study-server -- run start --workspace apps/server`）。
首次部署需要在服务器上手动准备：

```bash
# 1. 安装 pm2 并设置开机自启
npm i -g pm2
pm2 save && pm2 startup

# 2. 首次创建管理员账号
cd /var/www/english-study-server
ADMIN_PASS=你的密码 npm run seed --workspace apps/server

# 3. nginx 反代（H5 已部署在 /english-study/）
location /english-study/api/ {
    proxy_pass http://127.0.0.1:3000/api/;
    proxy_set_header Host $host;
}
```

数据库文件在 `/var/www/english-study-server/data/app.db`（相对 pm2 的工作目录），部署不会覆盖。

## packages/core（@study/core）

- `data/words`：`grades` / `Grade` / `Unit` / `Word` / `getGrade` / `getUnit` / `getAllWords`
- `utils/quiz`：`shuffle` / `generateQuiz` / `Question` / `QuestionType`
- `stores/progress`：Pinia store，**必须先 `initStorage(adapter)` 注入存储适配器**再使用 `useProgressStore`
- `platform`：`Platform` / `StorageAdapter` / `SpeakAdapter` / `RecordAdapter` 接口

H5 端在 `apps/h5/src/stores/progress.ts` 注入 localStorage 适配器后转发导出，页面仍用 `@/stores/progress`。
