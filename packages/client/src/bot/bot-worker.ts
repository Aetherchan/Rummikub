/**
 * Bot Web Worker —— 在后台线程运行硬 Bot 的计算。
 *
 * 用法：
 *   const worker = new Worker(new URL('./bot-worker.ts', import.meta.url));
 *   worker.postMessage({ type: 'HARD_BOT_DECIDE', state, playerIndex });
 *   worker.onmessage = (e) => { const { moves, playerId } = e.data; };
 */

import { hardBotDecide } from './hard-bot';
import type { BotWorkerRequest, BotWorkerResponse } from './hard-bot';

self.onmessage = (event: MessageEvent<BotWorkerRequest>) => {
  const { state, playerIndex } = event.data;
  const result: BotWorkerResponse = hardBotDecide(state, playerIndex);
  self.postMessage(result);
};
