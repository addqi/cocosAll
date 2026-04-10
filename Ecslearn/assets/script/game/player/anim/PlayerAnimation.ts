import { _decorator, Component, Sprite, UITransform, Size } from 'cc';
import { SpriteSheetUtil, SpriteAnimator } from '../../../baseSystem/animation';
import { playerConfig } from '../config/playerConfig';
const { ccclass } = _decorator;

/** 玩家动画状态 */
export enum EPlayerAnim {
    Idle  = 'idle',
    Run   = 'run',
    Shoot = 'shoot',
}

/**
 * 玩家动画管理
 *
 * 从 playerConfig 读取动画路径与参数，异步加载纹理并自动切帧。
 * 自身 update 驱动 animator.tick，无需外部管理器。
 *
 * 使用方式：
 *   const playerAnim = this.getComponent(PlayerAnimation)!;
 *   playerAnim.play(EPlayerAnim.Run);
 *   playerAnim.playOnce(EPlayerAnim.Shoot, () => { ... });
 */
@ccclass('PlayerAnimation')
export class PlayerAnimation extends Component {
    private _animator: SpriteAnimator = null!;
    private _ready = false;
    private _pendingPlay: EPlayerAnim | null = null;

    get animator(): SpriteAnimator { return this._animator; }
    get ready(): boolean { return this._ready; }

    async onLoad() {
        const sprite = this.getComponent(Sprite)!;
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        this._animator = new SpriteAnimator(sprite);

        const { frameSize, displayWidth, displayHeight, anims } = playerConfig;

        const ut = this.getComponent(UITransform) || this.node.addComponent(UITransform);
        ut.setContentSize(new Size(displayWidth, displayHeight));

        const keys = Object.keys(anims);
        const loadTasks = keys.map(async (key) => {
            const entry = anims[key];
            const frames = await SpriteSheetUtil.loadFrames(entry.path, frameSize, frameSize);
            this._animator.addAnim(key, frames, entry.fps, entry.loop);
        });

        await Promise.all(loadTasks);

        this._ready = true;
        this._animator.play(this._pendingPlay ?? EPlayerAnim.Idle);
        this._pendingPlay = null;
    }

    update(dt: number) {
        if (!this._ready) return;
        this._animator.tick(dt);
    }

    /** 播放循环动画（idle / run） */
    play(anim: EPlayerAnim) {
        if (!this._ready) { this._pendingPlay = anim; return; }
        this._animator.play(anim);
    }

    /** 播放一次性动画（shoot），播完触发回调 */
    playOnce(anim: EPlayerAnim, onComplete?: () => void) {
        if (!this._ready) { this._pendingPlay = anim; return; }
        this._animator.play(anim, onComplete);
    }
}
