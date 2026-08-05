# Rummikub 项目 — AI 开发参考文档

## 概述

以色列麻将（Rummikub）线上游戏。支持单人 vs AI、P2P 多人对战。完整的 Rummikub 规则实现（破冰、群组/顺子、Joker 替代、罚摸、牌池耗尽终局）。

**技术栈**: React 18, TypeScript 5.8, Vite 6, Tailwind CSS 3, @dnd-kit, Zustand 5, PeerJS (WebRTC), Vitest

**项目类型**: npm workspaces monorepo (`packages/*`)

---

## 目录结构

```
D:\study\2.5\Rummikub\
├── package.json              # Root: workspaces, build/test/lint/ghpages scripts
├── CLAUDE.md                 # 本文件
├── docs/                     # GitHub Pages 部署输出
├── packages/
│   ├── shared/               # @rummikub/shared — 纯类型定义 & 常量
│   ├── engine/               # @rummikub/engine — 纯游戏逻辑，无 UI 依赖
│   └── client/               # @rummikub/client — React 前端
```

**依赖方向**: `client → engine → shared`

---

## 游戏规则实现

### 牌组

- 106 张牌：13 个数值 (1-13) × 4 种颜色 (红/蓝/黄/黑) × 2 套 + 2 张 Joker
- 初始发牌：14 张/人
- Joker 计算为 30 分

### 合法牌组

- **群组 (Group)**: 3-4 张，同数值不同颜色，最多 2 张 Joker
- **顺子 (Run)**: 3-13 张，同颜色连续数值，Joker 填补空缺
- 每组合至少 3 张牌，Joker 可替代任意牌

### 破冰 (Initial Meld)

- 首次出牌必须从手牌打出 ≥ 30 分
- 不可借用桌面牌破冰
- `hasMelded` 标记在玩家上，破冰后可自由操作桌面牌

### 回合流程

1. `ARRANGING` — 玩家操作（出牌或摸牌）
2. `DRAW_REQUIRED` — 必须摸牌
3. `WAITING` — 等待其他玩家

### 罚摸机制

- 有时限模式：提交无效走法 → 罚摸 3 张 + 恢复回合开始状态
- 无时限模式：提交无效走法 → 恢复回合开始状态（不罚摸）

### 终局条件

- 手牌清空 → 立即获胜
- 牌池耗尽 + 所有玩家连续跳过一轮 → 手牌总分最低者获胜

---

## 引擎架构 (`packages/engine`)

### 模块结构

| 模块 | 文件 | 用途 |
|------|------|------|
| **Tile** | `tile/Tile.ts` | 牌的 ID、分数、排序、实例生成 |
| **TileDeck** | `tile/TileDeck.ts` | 创建牌堆、洗牌、摸牌 |
| **JokerLogic** | `tile/JokerLogic.ts` | Joker 判断、替代值解析 |
| **SetValidator** | `validation/SetValidator.ts` | 群组/顺子合法性验证 |
| **MeldValidator** | `validation/MeldValidator.ts` | 破冰条件验证 |
| **BoardValidator** | `validation/BoardValidator.ts` | 全桌完整性 + 提交前验证 |
| **MoveTypes** | `manipulation/MoveTypes.ts` | 6 种原子走法类型定义 |
| **MoveExecutor** | `manipulation/MoveExecutor.ts` | 原子走法的执行（修改 GameState） |
| **MoveValidator** | `manipulation/MoveValidator.ts` | 三阶段验证（语法→执行→结构） |
| **MoveDiffer** | `manipulation/MoveDiffer.ts` | Diff 算法：对比快照自动生成走法 |
| **GameState** | `game/GameState.ts` | 游戏状态机（开始、出牌、摸牌、跳过） |
| **PhaseManager** | `game/PhaseManager.ts` | 回合阶段转换 |
| **ScoreKeeper** | `game/ScoreKeeper.ts` | 计分逻辑 |
| **Snapshot** | `game/state-snapshot.ts` | 状态快照创建/恢复（试错机制） |
| **Timer** | `game/turn-timer.ts` | 回合计时器 |

### 6 种原子走法 (AtomicMove)

1. **CREATE_SET** — 从手牌创建新牌组
2. **ADD_TILES_TO_SET** — 向已有牌组添加牌（从手牌）
3. **REMOVE_TILES_FROM_SET** — 从牌组移除牌（退回手牌，<3 张删除整个牌组）
4. **SPLIT_SET** — 拆分牌组（atIndex 处分割，<3 张的部分丢弃）
5. **MERGE_SETS** — 合并两个牌组（source 并入 target）
6. **DISMISS_SET** — 解散整个牌组（所有牌退回手牌）

### 验证流程

`applyMove` → `validateMoveBatch` 三阶段：
1. **语法验证** — 检查走法引用的 ID 是否存在
2. **执行** — 在状态副本上执行走法
3. **结构验证** — `validateBoard` + 逐组 `validateSet` + 破冰检查 + 手牌数量一致性

---

## 客户端架构 (`packages/client`)

### 三状态模型

| 状态 | 用途 |
|------|------|
| `gameState` | **权威状态** — 引擎验证通过后的状态，用于引擎调用和 Bot 决策 |
| `optimisticState` | **乐观编辑** — 玩家自由拖拽操作的工作区，可直接变异 |
| `turnSnapshot` | **回合快照** — 回合开始时的状态，用于 Diff 对比和错误恢复 |

**同步规则**: 引擎操作（commit/draw/pass/timeout）成功后三个状态同步为同一值。操作阶段仅 `optimisticState` 偏离。

### Store 关键 Actions (`game-store.ts`)

**本地操作**（直接修改 optimisticState）：
- `moveTileFromHandToNewSet(instanceId)` — 手牌→空白区
- `moveTileFromHandToSet(instanceId, targetSetId)` — 手牌→已有牌组
- `moveTileBetweenSets(instanceId, sourceSetId, targetSetId)` — 桌面牌↔桌面牌
- `moveTileFromBoardToHand(instanceId, sourceSetId)` — 桌面牌→手牌
- `setJokerSubstitution(instanceId, substitution)` — 设置 Joker 替代值

**提交流程** (`commitMove()`)：
1. 检查新增的 Joker 都有替代值（快照中已有的 Joker 免检）
2. 本地验证 `validateBoardForCommit(optimisticState)` — 每个牌组合法、无重复 instanceId、scoreFromHand 计算
3. 破冰检查（未破冰时 `scoreFromHand >= 30`）
4. `diffMoves(snapshot, optimisticState)` 生成 AtomicMove[]
5. 检查 `moves.length > 0` 和 `scoreFromHand > 0`（禁止纯桌面移动）
6. `applyMove(gameState, batch)` 提交到引擎
7. 失败 → 恢复快照 + 罚摸（有时限）/ 恢复（无时限）
8. 成功 → 同步三状态 + 广播（P2P）

### Bot 系统 (`bot/`)

三个难度级别，共享 `move-generator.ts`：
- **Easy**: 随机选择合法走法
- **Medium**: 启发式评分（出牌分数 + 数量 - Joker 惩罚 + 保留高分牌）
- **Hard**: MCTS-lite（前向模拟，3 秒预算，深度 3）

Bot 使用真实 Joker tile（保留 instanceId），自动计算 Joker 替代值。

### P2P 架构

- **Host**: 运行权威引擎，广播状态给所有客户端
- **Guest**: 接收 `GameStateDiff` 更新，发送 `AtomicMove[]` 给 Host
- 断线 2 分钟内可重连；超时由 Bot 接管
- 对手手牌隐藏（仅显示 `handTileCount`）

### 组件树

```
App → GameBoard (DndContext 宿主)
  ├── Header (玩家信息 + P2P 状态)
  ├── BoardArea (empty-board droppable)
  │   └── BoardSetView (每个牌组的 droppable + draggable tiles)
  ├── PlayerHand (hand-area droppable + SortableContext)
  │   └── HandTile (useSortable)
  ├── ActionBar (出牌/摸牌/跳过/重置/提示/排序)
  ├── GameOverPanel (计分 + 排名)
  ├── DragOverlay (拖动中的幽灵牌)
  └── JokerPicker (Joker 替代值选择弹窗)
```

---

## MoveDiffer 算法 (`MoveDiffer.ts`)

`diffMoves(snapshotBoard, currentBoard) → AtomicMove[]`

### 核心流程

1. **边界情况**: 快照为空 → 全部 CREATE；当前为空 → 全部 DISMISS
2. **构建双向映射**: instanceId→setId, setId→Set<instanceId>
3. **主循环** — 对每个当前牌组找最匹配的快照祖先（最高 instanceId 重叠数）：
   - 无祖先 → 新牌组 (≥2 个祖先重叠 → MERGE；否则 → CREATE)
   - 完全相同 → 无操作
   - 超集 → ADD_TILES_TO_SET
   - 子集 → REMOVE_TILES_FROM_SET
   - 部分重叠 + 兄弟牌组存在 → SPLIT_SET
   - 部分重叠无兄弟 → 非标准回退 (REMOVE + ADD)
4. **处理消失的快照牌组**: REMOVE (部分) 或 DISMISS (全部回手)
5. **处理全新 tiles**: 不在快照中的 instanceId → ADD_TILES_TO_SET

### 安全网（按顺序检查，触发则使用 fallbackResetRecreate）

1. **ADD 到不存在的牌组** — `ADD_TILES_TO_SET.setId` 不在快照中
2. **重复破坏性引用** — 同一快照牌组被多个 MERGE(source)/SPLIT(source)/DISMISS 引用
3. **SPLIT 冲突** — SPLIT 的 source 被其他走法引用
4. **走法过多** — `moves.length > 12`

### 走法排序

执行顺序: `DISMISS(0) → REMOVE(1) → SPLIT(2) → MERGE(3) → ADD(4) → CREATE(5)`

**原因**: "归还手牌"的操作必须在"取走手牌"之前执行，否则桌面牌移动会产生幻影手牌。

### 回退策略 (`fallbackResetRecreate`)

```typescript
// 对每个快照牌组 → DISMISS_SET
// 对每个当前牌组 → CREATE_SET
```

始终正确，但不优雅。不走排序（DISMISS 生成时已排在 CREATE 前面）。

---

## Bug 修复记录

### 第 1 批 (初始 /debug 会话)
| # | 问题 | 根因 | 修复 |
|---|------|------|------|
| 1 | AI Joker 显示 "?" 并阻塞玩家出牌 | Bot 创建 Joker 副本无替代值；Store 验证所有 Joker（含快照中已有的）| 仅验证新 Joker；Bot 设置 `jokerSubstitution`；BoardSet 增加 Joker 点击编辑 |
| 2 | 摸牌不重置桌面 | `drawTileAction` 使用 `optimisticState`（含未提交编辑）| 改用 `gameState` |
| 3 | 桌面牌无法拖动 | `hasMelded` 限制 + `closestCenter` 碰撞检测不精确 | 移除限制；改用 `pointerWithin` 优先 |
| 4 | Joker 过量（5张而非2张）| Bot `{...joker, instanceId: generateInstanceId()}` 复制 Joker | 使用真实 Joker tile + 计算替代值 |

### 第 2 批 (破冰 & 显示)
| # | 问题 | 根因 | 修复 |
|---|------|------|------|
| 5 | 群组显示为顺子 | Store 硬编码 `type: 'run'`；`validateBoard` 检查 `result.type !== set.type` | `BoardValidator` 移除类型匹配检查；Store 新增 `inferSetType()` 启发式推断 |
| 6 | 破冰 39 分被拒 | `commitMove` 传 `optimisticState` 给 `applyMove`，手牌已空 | 改用 `gameState`（手牌保留回合开始状态） |

### 第 3 批 (拆分逻辑)
| # | 问题 | 根因 | 修复 |
|---|------|------|------|
| 7 | 拆分重组成两个牌组→牌消失 | REMOVE + SPLIT 同源：REMOVE 先减牌，SPLIT 再拆分剩余→不足3张丢弃 | 冲突检测 + `splitIndex` 边界检查 |
| 8 | 拆分尾部失败（拆8-10不行，拆4-6可以）| `splitIndex` 只对头部(hea部分有效，尾部 `splitIndex=0` 被跳过 | 尾部视角重算：`findIndex(t => currIds.has(t))` |

### 第 4 批 (桌面牌移动)
| # | 问题 | 根因 | 修复 |
|---|------|------|------|
| 9 | 移桌面牌→手牌多出幻影牌 | ADD 先执行（牌不在手牌），REMOVE 后执行（牌退回手牌）| **走法排序**: DISMISS/REMOVE 先于 ADD/CREATE |
| 10 | 仅重排桌面牌可提交 | 仅检查 `moves.length === 0`，但重排产生非空走法 | 新增 `scoreFromHand === 0` 检查 |

### 第 5 批 (复杂重组)
| # | 问题 | 根因 | 修复 |
|---|------|------|------|
| 11 | 多组拆卸重组成多条顺子→操作无效 | 每个新顺子独立触发 MERGE 同一对祖先→重复 MERGE→SET_NOT_FOUND | 新增**重复破坏性引用**检测（同一快照牌组被多个 MERGE/SPLIT/DISMISS 引用）|
| 12 | 引擎错误信息不具体 | Toast 仅显示"出牌无效" | 引擎错误信息现在包含在 Toast 中（如"组合 X 不存在"） |

---

## 关键技术细节

### Joker 处理

- **有效性判断**: `effectiveValue/effectiveColor` 优先使用 `jokerSubstitution`，无替代值则返回原始 null
- **顺子 Joker**: 计算非 Joker 牌的 min/max value，Joker 数量必须恰好填补空缺
- **群组 Joker**: 替代码缺失的颜色（非 Joker 集合中缺少的颜色）
- **替代值保留**: `MoveExecutor` 的 ADD/CREATE 中，仅 Joker 牌保留 `jokerSubstitution`
- **提交前检查**: 仅验证本回合新增的 Joker（不在 `snapshotBoardInstanceIds` 中的）

### 桌面牌操作规则

- 已破冰 → 可自由操作桌面牌组（拆分/合并/移动）
- 未破冰 → 不可操作桌面牌（`canManipulateBoard` 返回 false）
- 每回合必须至少从手牌打出一张牌，或选择摸牌

### 不可见状态

`GameState` 包含两个不在共享类型声明中的内部字段：
- `_deck` — 牌池数组（通过 `as any` 访问）
- `consecutivePasses` — 连续跳过计数（用于牌池耗尽终局检测）

---

## 常用命令

```bash
# 测试
cd packages/engine && npx vitest run

# 开发
cd packages/client && npx vite

# 生产构建（输出到 docs/）
npm run build:ghpages

# 清理
npm run clean
```

## 测试覆盖

`packages/engine/src/__tests__/engine.test.ts` — 71 个测试用例：
- Tile/Deck/Joker 基础
- Group/Run 验证（含 Joker 场景）
- Meld/Board 验证
- MoveExecutor/MoveValidator
- MoveDiffer（CREATE/REMOVE/SPLIT/MERGE/DISMISS + 拆分头/尾 + 多组拆卸重组）
- 计分/Phase/Snapshot/Timer
- 罚摸/牌池耗尽终局
