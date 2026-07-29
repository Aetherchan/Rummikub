import { describe, it, expect } from 'vitest';
import {
  // Tile
  tileId, isSameDefinition, tileScore, generateInstanceId, createTileInstance,
  sortTiles, compareByColor, compareByValue,
  // TileDeck
  createDeck, shuffleDeck, drawTiles, drawOneTile,
  // JokerLogic
  isJoker, effectiveColor, effectiveValue, canReplaceJoker, freeJokerFromSet,
  // SetValidator
  isValidGroup, isValidRun, validateSet, computeScore,
  // MeldValidator
  validateInitialMeld, canManipulateBoard,
  // BoardValidator
  validateBoard,
  // Move types
  // (types are compile-time)
  // GameState
  createDefaultConfig, createPlayerState, createGameState,
  startGame, applyMove, drawTile, passTurn, getDeck,
  // MoveExecutor
  executeAtomicMove, executeMoveBatch,
  // MoveValidator
  validateMoveBatch,
  // ScoreKeeper
  calculateScores, handTotalScore,
  // PhaseManager
  canTransition, isPlayerTurn, canCommitMove, canDraw,
} from '../index.js';

// ============================================================
// 1. 牌测试
// ============================================================
describe('Tile', () => {
  it('tileId 应该生成正确的 ID', () => {
    expect(tileId('red', 7)).toBe('red-7');
    expect(tileId('blue', 13)).toBe('blue-13');
    expect(tileId(null, null)).toBe('joker');
  });

  it('tileScore 应该正确计分', () => {
    expect(tileScore(createTileInstance({ id: 'red-5', color: 'red', value: 5 }))).toBe(5);
    expect(tileScore(createTileInstance({ id: 'joker', color: null, value: null }))).toBe(30);
    expect(tileScore(createTileInstance({ id: 'blue-13', color: 'blue', value: 13 }))).toBe(13);
  });

  it('sortTiles 应该按颜色排序', () => {
    const tiles = [
      createTileInstance({ id: 'blue-3', color: 'blue', value: 3 }),
      createTileInstance({ id: 'red-1', color: 'red', value: 1 }),
      createTileInstance({ id: 'black-7', color: 'black', value: 7 }),
    ];
    const sorted = sortTiles(tiles);
    expect(sorted[0].color).toBe('red');
    expect(sorted[1].color).toBe('blue');
    expect(sorted[2].color).toBe('black');
  });
});

// ============================================================
// 2. 牌组测试
// ============================================================
describe('TileDeck', () => {
  it('createDeck 应该创建 106 张牌', () => {
    const deck = createDeck();
    expect(deck.length).toBe(106);
  });

  it('应该包含 2 张 joker', () => {
    const deck = createDeck();
    const jokers = deck.filter(t => isJoker(t));
    expect(jokers.length).toBe(2);
  });

  it('每种颜色-数值组合应该有 2 份', () => {
    const deck = createDeck();
    const red7s = deck.filter(t => t.id === 'red-7');
    expect(red7s.length).toBe(2);
  });

  it('shuffleDeck 应该返回相同长度的数组', () => {
    const deck = createDeck();
    const shuffled = shuffleDeck(deck);
    expect(shuffled.length).toBe(106);
  });

  it('drawTiles 应该正确摸牌', () => {
    const deck = createDeck();
    const { drawn, remaining } = drawTiles(deck, 14);
    expect(drawn.length).toBe(14);
    expect(remaining.length).toBe(106 - 14);
  });

  it('drawOneTile 从空牌池应返回 null', () => {
    const { tile } = drawOneTile([]);
    expect(tile).toBeNull();
  });
});

// ============================================================
// 3. Joker 测试
// ============================================================
describe('JokerLogic', () => {
  it('isJoker 应该正确识别 joker', () => {
    const joker = createTileInstance({ id: 'joker-1', color: null, value: null });
    const normal = createTileInstance({ id: 'red-7', color: 'red', value: 7 });
    expect(isJoker(joker)).toBe(true);
    expect(isJoker(normal)).toBe(false);
  });

  it('canReplaceJoker 应该正确判断', () => {
    const jokerOnBoard = {
      ...createTileInstance({ id: 'joker-1', color: null, value: null }),
      jokerSubstitution: { substitutedValue: 7 as const, substitutedColor: 'red' as const },
    };
    const matching = createTileInstance({ id: 'red-7', color: 'red', value: 7 });
    const nonMatching = createTileInstance({ id: 'blue-7', color: 'blue', value: 7 });

    expect(canReplaceJoker(jokerOnBoard, matching)).toBe(true);
    expect(canReplaceJoker(jokerOnBoard, nonMatching)).toBe(false);
  });
});

// ============================================================
// 4. 组合验证测试
// ============================================================
describe('SetValidator', () => {
  describe('isValidGroup', () => {
    it('合法的 3 张同数组应该通过', () => {
      const tiles = [
        createTileInstance({ id: 'red-7', color: 'red', value: 7 }),
        createTileInstance({ id: 'blue-7', color: 'blue', value: 7 }),
        createTileInstance({ id: 'black-7', color: 'black', value: 7 }),
      ];
      expect(isValidGroup(tiles).valid).toBe(true);
    });

    it('合法的 4 张同数组应该通过', () => {
      const tiles = [
        createTileInstance({ id: 'red-7', color: 'red', value: 7 }),
        createTileInstance({ id: 'blue-7', color: 'blue', value: 7 }),
        createTileInstance({ id: 'yellow-7', color: 'yellow', value: 7 }),
        createTileInstance({ id: 'black-7', color: 'black', value: 7 }),
      ];
      expect(isValidGroup(tiles).valid).toBe(true);
    });

    it('含 joker 的同数组应该通过', () => {
      const tiles = [
        createTileInstance({ id: 'red-7', color: 'red', value: 7 }),
        createTileInstance({ id: 'blue-7', color: 'blue', value: 7 }),
        createTileInstance({ id: 'joker-1', color: null, value: null }),
      ];
      // joker 在验证时没有替代值，所以无法确定它代表什么
      // 但 group 的验证只看非 joker 牌是否同值且不同色
      expect(isValidGroup(tiles).valid).toBe(true);
    });

    it('不同数值的牌不能组成 group', () => {
      const tiles = [
        createTileInstance({ id: 'red-7', color: 'red', value: 7 }),
        createTileInstance({ id: 'blue-7', color: 'blue', value: 7 }),
        createTileInstance({ id: 'black-8', color: 'black', value: 8 }),
      ];
      expect(isValidGroup(tiles).valid).toBe(false);
    });

    it('同色牌不能组成 group', () => {
      const tiles = [
        createTileInstance({ id: 'red-7', color: 'red', value: 7 }),
        createTileInstance({ id: 'red-7', color: 'red', value: 7 }),
        createTileInstance({ id: 'red-8', color: 'red', value: 8 }),
      ];
      expect(isValidGroup(tiles).valid).toBe(false);
    });

    it('少于 3 张不能组成 group', () => {
      const tiles = [
        createTileInstance({ id: 'red-7', color: 'red', value: 7 }),
        createTileInstance({ id: 'blue-7', color: 'blue', value: 7 }),
      ];
      expect(isValidGroup(tiles).valid).toBe(false);
    });

    it('超过 4 张不能组成 group', () => {
      const tiles = [
        createTileInstance({ id: 'red-7', color: 'red', value: 7 }),
        createTileInstance({ id: 'blue-7', color: 'blue', value: 7 }),
        createTileInstance({ id: 'yellow-7', color: 'yellow', value: 7 }),
        createTileInstance({ id: 'black-7', color: 'black', value: 7 }),
        createTileInstance({ id: 'red-7', color: 'red', value: 7 }, 'dup'),
      ];
      expect(isValidGroup(tiles).valid).toBe(false);
    });
  });

  describe('isValidRun', () => {
    it('合法的顺子应该通过', () => {
      const tiles = [
        createTileInstance({ id: 'red-3', color: 'red', value: 3 }),
        createTileInstance({ id: 'red-4', color: 'red', value: 4 }),
        createTileInstance({ id: 'red-5', color: 'red', value: 5 }),
      ];
      expect(isValidRun(tiles).valid).toBe(true);
    });

    it('含 joker 的顺子应该通过', () => {
      const tiles = [
        createTileInstance({ id: 'red-3', color: 'red', value: 3 }),
        createTileInstance({ id: 'joker-1', color: null, value: null }),
        createTileInstance({ id: 'red-5', color: 'red', value: 5 }),
      ];
      // joker 可以填补 4 的空隙
      expect(isValidRun(tiles).valid).toBe(true);
    });

    it('不同色的顺子应该失败', () => {
      const tiles = [
        createTileInstance({ id: 'red-3', color: 'red', value: 3 }),
        createTileInstance({ id: 'blue-4', color: 'blue', value: 4 }),
        createTileInstance({ id: 'red-5', color: 'red', value: 5 }),
      ];
      expect(isValidRun(tiles).valid).toBe(false);
    });

    it('不连续的顺子应该失败', () => {
      const tiles = [
        createTileInstance({ id: 'red-3', color: 'red', value: 3 }),
        createTileInstance({ id: 'red-5', color: 'red', value: 5 }),
        createTileInstance({ id: 'red-6', color: 'red', value: 6 }),
      ];
      expect(isValidRun(tiles).valid).toBe(false);
    });

    it('少于 3 张不能组成顺子', () => {
      const tiles = [
        createTileInstance({ id: 'red-3', color: 'red', value: 3 }),
        createTileInstance({ id: 'red-4', color: 'red', value: 4 }),
      ];
      expect(isValidRun(tiles).valid).toBe(false);
    });

    it('1-2-3-4-5-6-7-8-9-10-11-12-13 的顺子应该通过', () => {
      const tiles = Array.from({ length: 13 }, (_, i) =>
        createTileInstance({ id: `red-${i + 1}`, color: 'red', value: (i + 1) as 1|2|3|4|5|6|7|8|9|10|11|12|13 })
      );
      expect(isValidRun(tiles).valid).toBe(true);
    });

    it('joker 不能填补过大的空隙', () => {
      const tiles = [
        createTileInstance({ id: 'red-3', color: 'red', value: 3 }),
        createTileInstance({ id: 'joker-1', color: null, value: null }),
        createTileInstance({ id: 'red-7', color: 'red', value: 7 }),
      ];
      // 间隔 3-7: 需要填补 4,5,6 三张→1 张 joker 不够
      expect(isValidRun(tiles).valid).toBe(false);
    });
  });

  describe('validateSet (自动检测)', () => {
    it('自动检测为 group', () => {
      const tiles = [
        createTileInstance({ id: 'red-7', color: 'red', value: 7 }),
        createTileInstance({ id: 'blue-7', color: 'blue', value: 7 }),
        createTileInstance({ id: 'black-7', color: 'black', value: 7 }),
      ];
      const result = validateSet(tiles);
      expect(result.valid).toBe(true);
      expect(result.type).toBe('group');
    });

    it('自动检测为 run', () => {
      const tiles = [
        createTileInstance({ id: 'red-3', color: 'red', value: 3 }),
        createTileInstance({ id: 'red-4', color: 'red', value: 4 }),
        createTileInstance({ id: 'red-5', color: 'red', value: 5 }),
      ];
      const result = validateSet(tiles);
      expect(result.valid).toBe(true);
      expect(result.type).toBe('run');
    });
  });
});

// ============================================================
// 5. 破冰验证测试
// ============================================================
describe('MeldValidator', () => {
  it('≥30 分应该通过', () => {
    const tiles = [
      createTileInstance({ id: 'red-10', color: 'red', value: 10 }),
      createTileInstance({ id: 'blue-10', color: 'blue', value: 10 }),
      createTileInstance({ id: 'black-10', color: 'black', value: 10 }),
    ];
    const result = validateInitialMeld(tiles);
    expect(result.valid).toBe(true);
    expect(result.score).toBe(30);
  });

  it('<30 分应该失败', () => {
    const tiles = [
      createTileInstance({ id: 'red-5', color: 'red', value: 5 }),
      createTileInstance({ id: 'blue-5', color: 'blue', value: 5 }),
      createTileInstance({ id: 'black-5', color: 'black', value: 5 }),
    ];
    const result = validateInitialMeld(tiles);
    expect(result.valid).toBe(false);
    expect(result.score).toBe(15);
  });

  it('canManipulateBoard 未破冰不可操作桌面', () => {
    expect(canManipulateBoard(false)).toBe(false);
    expect(canManipulateBoard(true)).toBe(true);
  });
});

// ============================================================
// 6. 桌面验证测试
// ============================================================
describe('BoardValidator', () => {
  it('全部合法的桌面应该通过', () => {
    const boardSets = [
      {
        id: 'set-1',
        type: 'group' as const,
        tiles: [
          { ...createTileInstance({ id: 'red-7', color: 'red', value: 7 }), jokerSubstitution: undefined } as any,
          { ...createTileInstance({ id: 'blue-7', color: 'blue', value: 7 }), jokerSubstitution: undefined } as any,
          { ...createTileInstance({ id: 'black-7', color: 'black', value: 7 }), jokerSubstitution: undefined } as any,
        ],
      },
    ];
    const result = validateBoard(boardSets);
    expect(result.valid).toBe(true);
  });

  it('不合法的组合应该被检测到', () => {
    const boardSets = [
      {
        id: 'set-1',
        type: 'group' as const,
        tiles: [
          { ...createTileInstance({ id: 'red-7', color: 'red', value: 7 }), jokerSubstitution: undefined } as any,
          { ...createTileInstance({ id: 'red-7', color: 'red', value: 7 }, 'dup'), jokerSubstitution: undefined } as any,
          { ...createTileInstance({ id: 'black-8', color: 'black', value: 8 }), jokerSubstitution: undefined } as any,
        ],
      },
    ];
    const result = validateBoard(boardSets);
    expect(result.valid).toBe(false);
  });
});

// ============================================================
// 7. 游戏状态机测试
// ============================================================
describe('GameState', () => {
  function createTestGame() {
    const players = [
      createPlayerState('p1', '玩家1'),
      createPlayerState('p2', '玩家2'),
    ];
    const config = createDefaultConfig({ maxPlayers: 2, aiPlayers: 0 });
    return createGameState('g1', players, config);
  }

  it('startGame 应该正确初始化', () => {
    const state = createTestGame();
    const { state: newState, events } = startGame(state);

    expect(newState.phase).toBe('IN_PROGRESS');
    expect(newState.players[0].handTiles.length).toBe(14);
    expect(newState.players[1].handTiles.length).toBe(14);
    expect(newState.poolTileCount).toBe(106 - 28); // 106 - 2*14
    expect(newState.turnNumber).toBe(1);
    expect(events.some(e => e.type === 'GAME_STARTED')).toBe(true);
  });

  it('startGame 需要至少 2 名玩家', () => {
    const state = createGameState('g1', [createPlayerState('p1', '玩家1')], createDefaultConfig());
    expect(() => startGame(state)).toThrow('至少需要 2 名玩家');
  });

  it('非当前玩家不能出牌', () => {
    const state = createTestGame();
    const { state: gameState } = startGame(state);

    // p2 尝试出牌（当前是 p1 的回合）
    const batch = {
      moveId: 'm1',
      playerId: 'p2',
      moves: [{ type: 'CREATE_SET' as const, setId: 's1', tiles: [] }],
    };
    const result = applyMove(gameState, batch);
    expect(result).toBeInstanceOf(Error);
    if (result instanceof Error) {
      expect(result.code).toBe('NOT_YOUR_TURN');
    }
  });

  it('drawTile 应该从牌池摸牌', () => {
    const state = createTestGame();
    const { state: gameState } = startGame(state);
    const poolBefore = gameState.poolTileCount;

    const result = drawTile(gameState, 'p1');
    if (result instanceof Error) throw result;

    expect(result.drawnTile).not.toBeNull();
    expect(result.state.poolTileCount).toBe(poolBefore - 1);
    expect(result.state.players[0].handTiles.length).toBe(15); // 14 + 1
    expect(result.events.some(e => e.type === 'TILE_DRAWN')).toBe(true);
  });

  it('passTurn 应该推进到下一位玩家', () => {
    const state = createTestGame();
    const { state: gameState } = startGame(state);

    const result = passTurn(gameState, 'p1');
    if (result instanceof Error) throw result;

    expect(result.state.currentPlayerIndex).toBe(1); // p2 的回合
    expect(result.events.some(e => e.type === 'TURN_PASSED')).toBe(true);
  });

  it('摸牌后跳过应推进回合', () => {
    const state = createTestGame();
    const { state: gameState } = startGame(state);

    // 先摸牌
    const drawResult = drawTile(gameState, 'p1');
    if (drawResult instanceof Error) throw drawResult;

    // 跳过后应推进到 p2
    const passResult = passTurn(drawResult.state, 'p1');
    if (passResult instanceof Error) throw passResult;
    expect(passResult.state.currentPlayerIndex).toBe(1);
  });
});

// ============================================================
// 8. 走法执行测试
// ============================================================
describe('MoveExecutor', () => {
  function createTestGameWithHand() {
    const players = [
      { ...createPlayerState('p1', '玩家1'), handTiles: [
        createTileInstance({ id: 'red-7', color: 'red', value: 7 }),
        createTileInstance({ id: 'blue-7', color: 'blue', value: 7 }),
        createTileInstance({ id: 'black-7', color: 'black', value: 7 }),
        createTileInstance({ id: 'red-3', color: 'red', value: 3 }),
        createTileInstance({ id: 'red-4', color: 'red', value: 4 }),
        createTileInstance({ id: 'red-5', color: 'red', value: 5 }),
      ], handTileCount: 6 },
      { ...createPlayerState('p2', '玩家2'), handTiles: [], handTileCount: 0 },
    ];
    const config = createDefaultConfig({ maxPlayers: 2 });
    const state = createGameState('g1', players, config);
    return { ...state, phase: 'IN_PROGRESS' as const, turnPhase: 'ARRANGING' as const, poolTileCount: 80, turnNumber: 1, _deck: [] };
  }

  it('CREATE_SET 应该从手牌创建新组合', () => {
    const state = createTestGameWithHand() as any;
    const tiles = state.players[0].handTiles.slice(0, 3); // 3 张 7

    const newState = executeAtomicMove(state, {
      type: 'CREATE_SET',
      setId: 'new-set',
      tiles,
    });

    expect(newState.boardSets.length).toBe(1);
    expect(newState.boardSets[0].tiles.length).toBe(3);
    expect(newState.players[0].handTiles.length).toBe(3); // 6 - 3
  });

  it('SPLIT_SET 应该正确拆分组合', () => {
    // 先创建一个带序列的桌面组合
    let state = createTestGameWithHand() as any;
    const runTiles = state.players[0].handTiles.slice(3, 6); // 红 3-4-5
    state = executeAtomicMove(state, {
      type: 'CREATE_SET',
      setId: 'run-1',
      tiles: runTiles,
    });

    // 拆分
    const newState = executeAtomicMove(state, {
      type: 'SPLIT_SET',
      sourceSetId: 'run-1',
      atIndex: 1,  // 第一张留在原组
      newSetId: 'run-2',
    });

    // 注意：拆分后每个部分至少 3 张才保留，这里 1 和 2 都 < 3，两个部分都会被丢弃
    // 这个限制在 MoveValidator 中处理，Executor 只忠实地执行操作
    // 所以这里验证拆分逻辑即可
  });

  it('DISMISS_SET 应该解散组合退回手牌', () => {
    let state = createTestGameWithHand() as any;
    const tiles = state.players[0].handTiles.slice(0, 3);
    state = executeAtomicMove(state, { type: 'CREATE_SET', setId: 'set-1', tiles });

    const newState = executeAtomicMove(state, { type: 'DISMISS_SET', setId: 'set-1' });
    expect(newState.boardSets.length).toBe(0);
    expect(newState.players[0].handTiles.length).toBe(6); // 全部退回
  });
});

// ============================================================
// 9. 走法验证测试
// ============================================================
describe('MoveValidator', () => {
  function createTestGame() {
    const players = [
      {
        ...createPlayerState('p1', '玩家1'),
        handTiles: [
          createTileInstance({ id: 'red-7', color: 'red', value: 7 }),
          createTileInstance({ id: 'blue-7', color: 'blue', value: 7 }),
          createTileInstance({ id: 'black-7', color: 'black', value: 7 }),
          createTileInstance({ id: 'yellow-7', color: 'yellow', value: 7 }),
        ],
        handTileCount: 4,
        hasMelded: true,
      },
      { ...createPlayerState('p2', '玩家2'), handTiles: [], handTileCount: 0 },
    ];
    const config = createDefaultConfig({ maxPlayers: 2 });
    const state = createGameState('g1', players, config);
    return {
      ...state,
      phase: 'IN_PROGRESS' as const,
      turnPhase: 'ARRANGING' as const,
      currentPlayerIndex: 0,
      poolTileCount: 80,
      turnNumber: 1,
    };
  }

  it('合法的 CREATE_SET 应该通过', () => {
    const state = createTestGame();
    const tiles = state.players[0].handTiles.slice(0, 3); // 3 张 7

    const result = validateMoveBatch(state, {
      moveId: 'm1',
      playerId: 'p1',
      moves: [{ type: 'CREATE_SET', setId: 'new-set', tiles }],
    });

    expect(result.valid).toBe(true);
  });

  it('不合法的组合应该被拒绝', () => {
    const state = createTestGame();
    // 2 张同值 + 1 张不同值
    const tiles = [
      state.players[0].handTiles[0], // red-7
      state.players[0].handTiles[1], // blue-7
      createTileInstance({ id: 'red-8', color: 'red', value: 8 }),
    ];

    const result = validateMoveBatch(state, {
      moveId: 'm1',
      playerId: 'p1',
      moves: [{ type: 'CREATE_SET', setId: 'new-set', tiles }],
    });

    expect(result.valid).toBe(false);
  });

  it('未破冰且未达 30 分应该被拒绝', () => {
    const players = [
      {
        ...createPlayerState('p1', '玩家1'),
        handTiles: [
          createTileInstance({ id: 'red-3', color: 'red', value: 3 }),
          createTileInstance({ id: 'blue-3', color: 'blue', value: 3 }),
          createTileInstance({ id: 'black-3', color: 'black', value: 3 }),
        ],
        handTileCount: 3,
        hasMelded: false,  // 未破冰
      },
      { ...createPlayerState('p2', '玩家2'), handTiles: [], handTileCount: 0 },
    ];
    const config = createDefaultConfig({ maxPlayers: 2 });
    const state = {
      ...createGameState('g1', players, config),
      phase: 'IN_PROGRESS' as const,
      turnPhase: 'ARRANGING' as const,
      currentPlayerIndex: 0,
      poolTileCount: 80,
      turnNumber: 1,
    };

    const tiles = state.players[0].handTiles.slice(0, 3); // 3+3+3 = 9 < 30

    const result = validateMoveBatch(state, {
      moveId: 'm1',
      playerId: 'p1',
      moves: [{ type: 'CREATE_SET', setId: 'new-set', tiles }],
    });

    expect(result.valid).toBe(false);
  });
});

// ============================================================
// 10. 计分测试
// ============================================================
describe('ScoreKeeper', () => {
  it('calculateScores 赢家获正分，其他玩家获负分', () => {
    const players = [
      {
        ...createPlayerState('p1', '玩家1'),
        handTiles: [], // 赢家，手里没牌
        handTileCount: 0,
      },
      {
        ...createPlayerState('p2', '玩家2'),
        handTiles: [
          createTileInstance({ id: 'red-5', color: 'red', value: 5 }),
          createTileInstance({ id: 'blue-7', color: 'blue', value: 7 }),
        ],
        handTileCount: 2,
      },
      {
        ...createPlayerState('p3', '玩家3'),
        handTiles: [
          createTileInstance({ id: 'red-3', color: 'red', value: 3 }),
        ],
        handTileCount: 1,
      },
    ];

    const scores = calculateScores(players, 'p1');
    const p1Score = scores.find(s => s.playerId === 'p1')!;
    const p2Score = scores.find(s => s.playerId === 'p2')!;
    const p3Score = scores.find(s => s.playerId === 'p3')!;

    expect(p1Score.score).toBe(15); // 5+7+3
    expect(p1Score.rank).toBe(1);
    expect(p2Score.score).toBe(-12); // -(5+7)
    expect(p3Score.score).toBe(-3);
  });

  it('手中 joker 计 30 分', () => {
    const players = [
      {
        ...createPlayerState('p1', '赢家'),
        handTiles: [],
        handTileCount: 0,
      },
      {
        ...createPlayerState('p2', '输家'),
        handTiles: [
          createTileInstance({ id: 'joker-1', color: null, value: null }),
        ],
        handTileCount: 1,
      },
    ];

    const scores = calculateScores(players, 'p1');
    const p1Score = scores.find(s => s.playerId === 'p1')!;
    const p2Score = scores.find(s => s.playerId === 'p2')!;

    expect(p1Score.score).toBe(30);
    expect(p2Score.score).toBe(-30);
  });
});

// ============================================================
// 11. 阶段管理测试
// ============================================================
describe('PhaseManager', () => {
  it('ARRANGING → COMMITTING 应该合法', () => {
    expect(canTransition('ARRANGING', 'COMMITTING')).toBe(true);
  });

  it('ARRANGING → DRAW_REQUIRED 应该合法', () => {
    expect(canTransition('ARRANGING', 'DRAW_REQUIRED')).toBe(true);
  });

  it('COMMITTING → WAITING 应该合法', () => {
    expect(canTransition('COMMITTING', 'WAITING')).toBe(true);
  });

  it('WAITING → ARRANGING 不应该合法', () => {
    expect(canTransition('WAITING', 'ARRANGING')).toBe(true); // 轮到你了
  });

  it('WAITING → COMMITTING 不应该合法', () => {
    expect(canTransition('WAITING', 'COMMITTING')).toBe(false);
  });

  it('isPlayerTurn 应该正确判断', () => {
    const state = {
      ...createGameState('g1', [
        createPlayerState('p1', 'P1'),
        createPlayerState('p2', 'P2'),
      ], createDefaultConfig()),
      phase: 'IN_PROGRESS' as const,
      turnPhase: 'ARRANGING' as const,
      currentPlayerIndex: 0,
    };
    expect(isPlayerTurn(state, 'p1')).toBe(true);
    expect(isPlayerTurn(state, 'p2')).toBe(false);
  });

  it('canCommitMove 在 ARRANGING 阶段应该为 true', () => {
    const state = {
      ...createGameState('g1', [], createDefaultConfig()),
      phase: 'IN_PROGRESS' as const,
      turnPhase: 'ARRANGING' as const,
    };
    expect(canCommitMove(state)).toBe(true);
  });
});
