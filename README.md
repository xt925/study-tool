# study-tool

给外甥学英语用。npm workspaces monorepo：

```
├── packages/
│   └── core/          # @study/core：纯 TS 核心包（单词数据 / 出题逻辑 / 进度存储 / 平台接口）
├── apps/
│   ├── h5/            # H5 端：Vite + Vue3 + TS + vue-router + Pinia + Tailwind
│   └── uni/           # uni-app 端（Vue3 + TS + Vite），目前只有演示页
└── scripts/
    └── generate_audio.py   # 从 core 的 words.ts 生成 edge-tts 音频到 apps/h5/public/audio
```

## 常用命令

```bash
npm install            # 根目录安装所有 workspace 依赖

npm run dev            # 启动 H5 开发服务器（= npm run dev --workspace apps/h5）
npm run build          # 构建 H5（vue-tsc + vite）
npm run preview        # 预览 H5 构建产物
npm run gen:audio      # 重新生成单词/例句音频（需要 python + edge-tts）

# uni-app 端
npm run dev:h5 --workspace apps/uni        # uni-app H5 开发
npm run build:h5 --workspace apps/uni      # uni-app H5 构建
npm run build:mp-weixin --workspace apps/uni
```

## 首次克隆后的初始化

音频文件不进仓库（可通过脚本再生），克隆后需要：

```bash
npm install
pip install edge-tts
npm run gen:audio       # 生成全部单词/例句音频到 apps/h5/public/audio/（约几分钟）
```

不生成音频也能跑：发音会自动走"有道在线接口 → 浏览器 TTS"兜底，只是音质和稳定性差一些。

词表解析脚本的使用见 `docs/词表解析脚本使用指南.md`，音标校对参考 `docs/音标字符表.md`。

## packages/core（@study/core）

- `data/words`：`grades` / `Grade` / `Unit` / `Word` / `getGrade` / `getUnit` / `getAllWords`
- `utils/quiz`：`shuffle` / `generateQuiz` / `Question` / `QuestionType`
- `stores/progress`：Pinia store，**必须先 `initStorage(adapter)` 注入存储适配器**再使用 `useProgressStore`
- `platform`：`Platform` / `StorageAdapter` / `SpeakAdapter` / `RecordAdapter` 接口

H5 端在 `apps/h5/src/stores/progress.ts` 注入 localStorage 适配器后转发导出，页面仍用 `@/stores/progress`。
