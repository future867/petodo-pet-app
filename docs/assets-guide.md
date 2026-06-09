# Petodo 素材整理说明

## 当前原则

这次按“程序是否实际使用”整理素材。README 展示图不算程序必需；只有代码和 `theme.json` 的 `states`、`frameManifests` 会加载的素材，才留在运行主题包里。

程序不需要的动图、静态图、预览图、处理稿都放在：

```text
frontend/assets/_review-unused/
```

这个目录里的文件不参与运行，方便后续人工检查后删除。

## 运行素材目录

```text
frontend/assets/
├── pet/
│   └── luoxiaohei/
│       ├── theme.json
│       ├── gif/
│       ├── img/
│       ├── icons/
│       └── sounds/
├── ui/
│   └── rewards/
├── _review-unused/
└── _duplicates/
```

## 程序实际使用的 PNG

这些 PNG 不是多余静态图，它们是程序当前会加载的运行素材：

- `pet/luoxiaohei/img/happy/luoxiaohei-happy-01.png` 到 `luoxiaohei-happy-52.png`
- `pet/luoxiaohei/img/run/luoxiaohei-run-01.png` 到 `luoxiaohei-run-12.png`
- `pet/luoxiaohei/img/surf/luoxiaohei-surf-01.png` 到 `luoxiaohei-surf-67.png`
- `pet/luoxiaohei/img/eating/luoxiaohei-eating-hamburger.png`
- `pet/luoxiaohei/img/eating/luoxiaohei-eating-chicken-leg.png`

## 运行状态映射

罗小黑状态映射在 `frontend/assets/pet/luoxiaohei/theme.json`。主要运行素材包括：

- 待机、专注、休息、睡觉、饥饿、生气、进食、吃完、打招呼、打滚、钓鱼等 GIF/WebP 动画在 `pet/luoxiaohei/gif/`。
- `happy`、`run`、`surf` 使用 PNG 帧序列，在 `pet/luoxiaohei/img/`。
- 任务完成鱼动画在 `ui/rewards/luoxiaohei-task-complete-fish.webp`。

## 待检查素材

以下文件已移入 `_review-unused/`，当前程序不会直接加载：

- `luoxiaohei-happy.gif`
- `luoxiaohei-happy-preview.gif`
- `luoxiaohei-run-preview.gif`
- `luoxiaohei-surf-preview.gif`
- `luoxiaohei-sleep-80-original.gif`
- `licking-the-claw.gif`
- `luoxiaohei-clear-400.gif`
- `luoxiaohei-clear-400-preview.png`
- `luoxiaohei-crisp-400.gif`

## 检查命令

新增、移动或删除素材前后，运行：

```bash
node tools/check-used-assets.js
```

成功标准是 `Missing: 0`。
