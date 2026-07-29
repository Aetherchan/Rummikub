// ---- 游戏错误 ----
export class GameError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = 'GameError';
    }
}
//# sourceMappingURL=types.js.map