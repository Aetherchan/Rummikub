# 🎴 Rummikub 拉密 —— 以色列麻将线上版

[![Deploy](https://github.com/username/Rummikub/actions/workflows/deploy.yml/badge.svg)](https://github.com/username/Rummikub/actions/workflows/deploy.yml)

一款基于 **React + WebRTC** 的 Rummikub（拉密/以色列麻将）在线游戏。支持单人 vs AI、P2P 多人联机、三级难度机器人，**零服务器成本**，部署在 GitHub Pages 上。

---

## ✨ 功能

- 🎮 **完整规则实现** —— 破冰、Group/Run 组合、Joker 替换、试错机制、牌池耗尽终局
- 🤖 **三级 AI** —— 简单（随机合法走法）、中等（启发式评估）、困难（MCTS 搜索）
- 🌐 **P2P 联机** —— PeerJS + WebRTC 直连，主机创建房间、客户端输入码加入
- 💡 **AI 提示** —— 可选的智能出牌建议（高亮推荐手牌）
- ⏱️ **时间限制** —— 30s / 60s / 120s / 无限制，试错失败罚摸
- 📱 **响应式** —— 桌面浏览器均可游玩

---

## 🚀 快速开始

### 本地开发

```bash
# 安装依赖
npm install

# 启动开发服务器
cd packages/client
npx vite
# 访问 http://localhost:5173
```

### 运行测试

```bash
# 引擎单元测试（66 个）
cd packages/engine
npx vitest run
```

### 构建

```bash
# 构建到 packages/client/dist/
npm run build

# 构建到 docs/（用于 GitHub Pages 部署）
npm run build:ghpages
```

---

## 🏗️ 技术栈

| 层级 | 技术 |
|------|------|
| **前端框架** | React 18 + TypeScript |
| **构建工具** | Vite 6 |
| **样式** | Tailwind CSS 3 |
| **拖拽** | @dnd-kit |
| **状态管理** | Zustand |
| **P2P 联机** | PeerJS + WebRTC DataChannel |
| **测试** | Vitest |
| **部署** | GitHub Pages (免费) |
| **包管理** | npm workspaces (monorepo) |

---

## 📁 项目结构

```
Rummikub/
├── packages/
│   ├── shared/src/          # 共享类型（tile-types, game-types, protocol）
│   ├── engine/               # 游戏引擎（纯逻辑，无 UI 依赖）
│   │   └── src/
│   │       ├── tile/         # 牌面、Joker 逻辑
│   │       ├── validation/   # 组合验证、走法验证
│   │       ├── manipulation/ # 桌面操作（拆分、合并、替换 Joker）
│   │       └── game/         # GameState、计分、快照/回滚、计时器
│   └── client/               # React 前端
│       └── src/
│           ├── components/   # UI 组件
│           │   ├── lobby/    # 大厅：主菜单、单人/多人配置
│           │   ├── game/     # 游戏：桌面、手牌、操作栏、结束面板
│           │   ├── controls/ # ActionBar（出牌/摸牌/提示等）
│           │   ├── hand/     # 手牌（dnd-kit 拖拽排序）
│           │   ├── tiles/    # 牌面渲染（TileFace、JokerTile）
│           │   └── ui/       # 通用 UI（Toast 通知）
│           ├── stores/       # Zustand 状态管理（game-store, toast-store）
│           ├── p2p/          # P2P 联机（PeerJS 管理、主机/客户端房间）
│           ├── bot/          # AI 机器人（easy/medium/hard + 走法生成）
│           └── hooks/        # React Hooks
├── docs/                     # GitHub Pages 部署输出（构建后生成）
└── .github/workflows/        # CI/CD（自动部署）
```

---

## 🎯 游戏规则

### 基础规则

- **牌组**：106 张（1-13 × 4 色 × 2 组 + 2 张 Joker）
- **起手**：14 张
- **破冰**：首次出牌需 ≥ 30 分（仅用手牌，不能使用桌面牌）
- **合法组合**：
  - **Group**：同数字、不同颜色、3-4 张
  - **Run**：同颜色、连续数字、3+ 张
- **Joker**：可替代任意牌；可用真牌替换后移走 Joker 立即使用；手中持有 Joker 计 30 分罚分

### 回合流程

1. **出牌**：构建 Group/Run，操作桌面组合，点击「确认出牌」
2. **摸牌**：无法出牌时摸 1 张
3. **试错**：回合内可自由尝试、拆分桌面组合
   - 确认合法 → 提交成功
   - 确认不合法 → 恢复原状，有时限时罚摸 3 张
4. **结束**：手牌出完即获胜 → 计分

### 计分

- 赢家获得其他所有玩家剩余手牌分数之和（正分）
- 其他玩家各得自身剩余手牌分数的负值
- Joker = 30 分，数字牌 = 面值

---

## 🌐 P2P 联机说明

```
主机: 创建房间 → PeerJS 生成房间码 → 等待加入 → 开始游戏
客户端: 输入主机 ID → WebRTC 直连 → 加入房间 → 等待开始
```

- **架构**：主机运行引擎（Authoritative），广播状态给客户端；客户端为 Replica
- **断线重连**：2 分钟内重连可恢复；超时由 Bot 接管
- **信令服务器**：PeerJS 免费云服务（仅用于建立连接，不传输游戏数据）

---

## 🚢 部署

### GitHub Pages (推荐)

1. Fork 本仓库
2. 在仓库 Settings → Pages 中启用 GitHub Pages，Source 选 **GitHub Actions**
3. Push 到 `main` 分支，GitHub Actions 自动构建部署

### 手动部署

```bash
npm install
npm run build:ghpages
# 将 docs/ 目录部署到任意静态托管服务
```

---

## 📝 许可

MIT License

---

## 🙏 致谢

- [PeerJS](https://peerjs.com/) — 免费 WebRTC 信令服务
- [@dnd-kit](https://dndkit.com/) — React 拖拽库
- [Zustand](https://zustand-demo.pmnd.rs/) — 轻量状态管理
- [Tailwind CSS](https://tailwindcss.com/) — 实用优先的 CSS 框架
