# Petodo 像素桌宠番茄钟

这是一个课程大作业项目，目标是做一个结合番茄钟和 Clawd 桌宠的桌面应用。

当前版本只完成基础骨架：前端可以打开 Electron 窗口，后端可以启动 FastAPI 服务。

## 项目目录

```text
petodo-pet-app/
├── frontend/
│   ├── main.js
│   ├── preload.js
│   ├── index.html
│   ├── renderer.js
│   ├── style.css
│   ├── pet_window.html
│   ├── pet_window.js
│   └── package.json
├── backend/
│   ├── main.py
│   ├── models.py
│   ├── storage.py
│   ├── requirements.txt
│   └── data/
└── README.md
```

## 前端启动

进入前端目录：

```bash
cd frontend
npm install
npm start
```

运行后会打开 Electron 主窗口，并显示一个简单的 Clawd 桌宠窗口。

## 后端启动

进入后端目录：

```bash
cd backend
python -m pip install -r requirements.txt
python -m uvicorn main:app --reload
```

启动后可以访问：

- http://127.0.0.1:8000/
- http://127.0.0.1:8000/health

## 当前最小运行效果

- Electron 主窗口可以正常打开
- 桌宠窗口已有 Clawd 桌宠显示
- README、项目进度文档、主窗口和桌宠窗口的展示文字可以正常阅读
- FastAPI 后端可以返回基础运行状态
- 前后端暂时没有复杂联动

## Clawd 桌宠状态设计

本项目参考 clawd-on-desk 的桌宠状态表现方式，将番茄钟、饥饿值和喂食行为映射到不同的 Clawd 动画状态。

| 状态 | 对应表现 | 触发条件 |
| --- | --- | --- |
| idle | 默认待机 | 无特殊事件 |
| focus | typing.gif | 番茄钟专注中 |
| rest | idle-reading.gif | 专注结束后的休息阶段 |
| happy | happy.gif | 完成一次专注后 |
| sleep | sleep.gif | 长时间未操作 |
| hungry_light | thinking.gif + food? 气泡 | 轻度饥饿 |
| hungry_medium | error.gif | 中度饥饿 |
| angry | 发火并在屏幕上方跑动 | 重度饥饿 |
| eating | 进食动画 | 用户喂食 |
| finished_eating | juggling.gif | 吃完后开心反馈 |

## 暂未完成

- 番茄钟专注和休息计时
- 桌宠状态切换
- 积分系统
- 商店和喂食功能
- 专注记录保存
- 统计信息展示
