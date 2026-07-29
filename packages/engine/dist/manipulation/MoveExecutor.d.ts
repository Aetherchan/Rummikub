import type { GameState } from '@rummikub/shared';
import type { AtomicMove } from './MoveTypes.js';
/** 执行单个原子操作 */
export declare function executeAtomicMove(state: GameState, move: AtomicMove): GameState;
/** 执行完整的走法批次 */
export declare function executeMoveBatch(state: GameState, moves: AtomicMove[]): GameState;
//# sourceMappingURL=MoveExecutor.d.ts.map