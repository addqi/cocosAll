import { Sprite, SpriteFrame } from 'cc';

export interface AnimClip {
    frames: SpriteFrame[];
    fps: number;
    loop: boolean;
}

/**
 * Sprite Sheet 动画播放器（纯类，非 Component）
 * 职责单一：SpriteFrame[] → 定时切帧播放，不管加载/切帧
 * 由持有者的 update 调用 tick 驱动
 *
 * 使用方式：
 *   const anim = new SpriteAnimator(sprite);
 *   anim.addAnim('idle', frames, 10, true);
 *   anim.play('idle');
 *   // 持有者 update 中：anim.tick(dt);
 */
export class SpriteAnimator {
    /** 全局倍速，影响所有实例（慢动作等） */
    static globalSpeed = 1;
    /** 全局暂停，影响所有实例（菜单等） */
    static globalPaused = false;

    private _clips   = new Map<string, AnimClip>();
    private _sprite: Sprite;

    private _current  = '';
    private _index    = 0;
    private _elapsed  = 0;
    private _playing  = false;
    private _paused   = false;
    private _speed    = 1;
    private _onComplete: (() => void) | null = null;

    constructor(sprite: Sprite) {
        this._sprite = sprite;
    }

    // ─── 只读状态 ───

    get currentClip(): string { return this._current; }
    get isPlaying(): boolean  { return this._playing && !this._paused; }
    get isPaused(): boolean   { return this._paused; }
    get frameIndex(): number  { return this._index; }
    get frameCount(): number  {
        const clip = this._clips.get(this._current);
        return clip ? clip.frames.length : 0;
    }

    get speed(): number  { return this._speed; }
    set speed(v: number) { this._speed = Math.max(0, v); }

    // ─── 注册 / 移除动画 ───

    addAnim(key: string, frames: SpriteFrame[], fps = 10, loop = true) {
        this._clips.set(key, { frames, fps, loop });
    }

    removeAnim(key: string) {
        this._clips.delete(key);
        if (this._current === key) this.stop();
    }

    hasAnim(key: string): boolean {
        return this._clips.has(key);
    }

    // ─── 播放控制 ───

    /**
     * 播放指定动画
     * - 循环动画重复调用同一个 key 不会重启（防止状态机每帧调用导致卡第0帧）
     * - 非循环动画重复调用同一个 key 会重启（连续射击等场景）
     */
    play(key: string, onComplete?: () => void) {
        const clip = this._clips.get(key);
        if (!clip || clip.frames.length === 0) return;

        if (this._current === key && this._playing && !this._paused && clip.loop) return;

        this._current    = key;
        this._index      = 0;
        this._elapsed    = 0;
        this._playing    = true;
        this._paused     = false;
        this._onComplete = onComplete ?? null;
        this._sprite.spriteFrame = clip.frames[0];
    }

    pause() {
        if (this._playing) this._paused = true;
    }

    resume() {
        if (this._playing) this._paused = false;
    }

    stop() {
        this._playing    = false;
        this._paused     = false;
        this._onComplete = null;
    }

    // ─── 帧驱动（由持有者 update 调用） ───

    tick(dt: number) {
        if (SpriteAnimator.globalPaused) return;
        if (!this._playing || this._paused) return;

        const clip = this._clips.get(this._current);
        if (!clip) return;

        this._elapsed += dt * this._speed * SpriteAnimator.globalSpeed;
        const interval = 1 / clip.fps;

        while (this._elapsed >= interval) {
            this._elapsed -= interval;
            this._index++;

            if (this._index >= clip.frames.length) {
                if (clip.loop) {
                    this._index = 0;
                } else {
                    this._index = clip.frames.length - 1;
                    this._playing = false;
                    this._sprite.spriteFrame = clip.frames[this._index];
                    const cb = this._onComplete;
                    this._onComplete = null;
                    cb?.();
                    return;
                }
            }
        }

        this._sprite.spriteFrame = clip.frames[this._index];
    }
}
