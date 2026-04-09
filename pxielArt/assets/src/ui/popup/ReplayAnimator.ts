import { _decorator, Component, Sprite, SpriteFrame, Texture2D } from 'cc';
import { CellBrushEntry, PuzzleData } from '../../types/types';

const { ccclass } = _decorator;

const TARGET_FPS = 60;

/**
 * 涂色回放动画 — 按玩家真实涂色顺序逐帧重现。
 *
 * 对标 G15 SettlementReplayLogic：
 * buffer 初始全白 fill(255)，逐帧写入真实颜色，推送到 Texture2D。
 */
@ccclass('ReplayAnimator')
export class ReplayAnimator extends Component {

    private _rgba: Uint8Array = null!;
    private _tex: Texture2D = null!;
    private _gridSize = 0;
    private _palette: string[] = [];
    private _history: CellBrushEntry[] = [];
    private _cellsPerFrame = 1;
    private _cursor = 0;
    private _playing = false;
    private _onComplete: (() => void) | null = null;

    /**
     * 初始化回放：buffer 先写入完整彩色图（fade-in 期间可见），
     * 待 play() 调用时清白并逐帧重建。对标 G15 SettlementCreateFunction。
     */
    setup(
        puzzle: PuzzleData,
        history: CellBrushEntry[],
        sprite: Sprite,
        onComplete: () => void,
        replayDurationSec: number,
    ): void {
        this._gridSize = puzzle.gridSize;
        this._palette = puzzle.palette;
        this._history = history;
        this._onComplete = onComplete;

        const size = this._gridSize;
        this._rgba = new Uint8Array(size * size * 4).fill(255);

        for (const entry of history) {
            this._writeCell(entry);
        }

        this._tex = new Texture2D();
        this._tex.reset({ width: size, height: size, format: Texture2D.PixelFormat.RGBA8888 });
        this._tex.setFilters(Texture2D.Filter.NEAREST, Texture2D.Filter.NEAREST);
        this._tex.uploadData(this._rgba);

        const sf = new SpriteFrame();
        sf.texture = this._tex;
        sprite.spriteFrame = sf;

        const totalFrames = replayDurationSec * TARGET_FPS;
        this._cellsPerFrame = Math.max(1, Math.ceil(history.length / totalFrames));
    }

    play(): void {
        this._cursor = 0;
        this._rgba.fill(255);
        this._uploadFull();
        this._playing = true;
    }

    get playing(): boolean { return this._playing; }

    update(_dt: number): void {
        if (!this._playing) return;

        const end = Math.min(this._cursor + this._cellsPerFrame, this._history.length);
        for (let i = this._cursor; i < end; i++) {
            this._writeCell(this._history[i]);
        }
        this._cursor = end;
        this._uploadFull();

        if (this._cursor >= this._history.length) {
            this._playing = false;
            this._onComplete?.();
        }
    }

    /* ── 内部 ── */

    private _writeCell(entry: CellBrushEntry): void {
        const size = this._gridSize;
        const flippedRow = size - 1 - entry.row;
        const off = (flippedRow * size + entry.col) * 4;
        const hex = this._palette[entry.brushIndex];
        if (!hex) return;
        const v = parseInt(hex.slice(1), 16);
        this._rgba[off]     = (v >> 16) & 0xff;
        this._rgba[off + 1] = (v >> 8) & 0xff;
        this._rgba[off + 2] = v & 0xff;
        this._rgba[off + 3] = 255;
    }

    private _uploadFull(): void {
        this._tex.uploadData(this._rgba);
    }
}
