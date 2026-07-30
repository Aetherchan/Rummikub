/**
 * Bot 模块 —— 统一入口。
 *
 * 三级难度：
 * - easy:   随机合法走法
 * - medium: 启发式评估
 * - hard:   MCTS + 启发式引导（Web Worker）
 */

export { easyBotDecide } from './easy-bot';
export { mediumBotDecide } from './medium-bot';
export { hardBotDecide } from './hard-bot';
export { generateMoveOptions, pickBestMove } from './move-generator';
export type { MoveOption } from './move-generator';
export type { BotDecision } from './easy-bot';
