// ============================================================
// 回合计时器 —— 可配置的每回合倒计时
// ============================================================

/** 计时器状态 */
export type TimerState = 'IDLE' | 'RUNNING' | 'EXPIRED' | 'PAUSED';

/** 计时器配置 */
export interface TimerConfig {
  /** 回合时间限制（秒），0 = 无限制 */
  limitSeconds: number;
}

/** 回合计时器（纯数据，由 React useEffect/setInterval 驱动） */
export interface TurnTimer {
  /** 剩余秒数 */
  secondsRemaining: number;
  /** 总秒数 */
  totalSeconds: number;
  /** 当前状态 */
  state: TimerState;
  /** 是否无时间限制 */
  isUnlimited: boolean;
}

/** 创建计时器 */
export function createTimer(limitSeconds: number): TurnTimer {
  if (limitSeconds === 0) {
    return {
      secondsRemaining: 0,
      totalSeconds: 0,
      state: 'IDLE',
      isUnlimited: true,
    };
  }
  return {
    secondsRemaining: limitSeconds,
    totalSeconds: limitSeconds,
    state: 'IDLE',
    isUnlimited: false,
  };
}

/** 启动计时器 */
export function startTimer(timer: TurnTimer): TurnTimer {
  if (timer.isUnlimited) return timer;
  return { ...timer, state: 'RUNNING' };
}

/** tick 秒数减少 */
export function tickTimer(timer: TurnTimer, deltaSeconds: number = 1): TurnTimer {
  if (timer.isUnlimited || timer.state !== 'RUNNING') return timer;
  const newRemaining = Math.max(0, timer.secondsRemaining - deltaSeconds);
  return {
    ...timer,
    secondsRemaining: newRemaining,
    state: newRemaining <= 0 ? 'EXPIRED' : 'RUNNING',
  };
}

/** 暂停计时器 */
export function pauseTimer(timer: TurnTimer): TurnTimer {
  if (timer.isUnlimited) return timer;
  return { ...timer, state: 'PAUSED' };
}

/** 重置计时器 */
export function resetTimer(timer: TurnTimer): TurnTimer {
  if (timer.isUnlimited) return timer;
  return {
    ...timer,
    secondsRemaining: timer.totalSeconds,
    state: 'IDLE',
  };
}

/** 计时器是否已过期 */
export function isExpired(timer: TurnTimer): boolean {
  return timer.state === 'EXPIRED';
}

/** 格式化剩余时间 mm:ss */
export function formatTime(timer: TurnTimer): string {
  if (timer.isUnlimited) return '∞';
  const m = Math.floor(timer.secondsRemaining / 60);
  const s = timer.secondsRemaining % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** 支持的回合时间选项 */
export const TIME_LIMIT_OPTIONS = [
  { label: '30 秒', value: 30 },
  { label: '60 秒', value: 60 },
  { label: '120 秒', value: 120 },
  { label: '无限制', value: 0 },
] as const;
