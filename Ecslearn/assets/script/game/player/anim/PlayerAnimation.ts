import { _decorator, Component, Sprite, UITransform, Size } from 'cc';
import { SpriteSheetUtil, SpriteAnimator } from '../../../baseSystem/animation';
import { playerConfig } from '../config/playerConfig';
import { GameLoop } from '../../core/GameLoop';
const { ccclass } = _decorator;

/** 玩家动画状态 */
export enum EPlayerAnim {
    Idle  = 'idle',
    Run   = 'run',
    Shoot = 'shoot',
}

@ccclass('PlayerAnimation')
export class PlayerAnimation extends Component {
    private _animator: SpriteAnimator = null!;
    private _ready = false;
    private _pendingPlay: EPlayerAnim | null = null;

    get animator(): SpriteAnimator { return this._animator; }

    onLoad() {
        const sprite = this.getComponent(Sprite)!;
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        this._animator = new SpriteAnimator(sprite);

        const ut = this.getComponent(UITransform) || this.node.addComponent(UITransform);
        ut.setContentSize(new Size(playerConfig.displayWidth, playerConfig.displayHeight));

        GameLoop.onReady(() => this._initAnims());
    }

    private _initAnims() {
        const { frameSize, anims } = playerConfig;
        let registered = 0;
        for (const key of Object.keys(anims)) {
            const entry = anims[key];
            const frames = entry.frameDir
                ? SpriteSheetUtil.getFrameDir(entry.frameDir)
                : SpriteSheetUtil.getFrames(entry.path!, frameSize, frameSize);
            if (frames.length === 0) {
                console.error(
                    `[PlayerAnimation] 动画 "${key}" 加载帧失败 — 源: ${entry.frameDir ?? entry.path}. 跳过注册。`,
                );
                continue;
            }
            this._animator.addAnim(key, frames, entry.fps, entry.loop);
            registered++;
        }
        if (registered === 0) {
            console.error('[PlayerAnimation] 没有任何动画注册成功，角色将看不见。请检查 resources 目录与 playerConfig.anims 是否匹配。');
            return;
        }
        this._ready = true;
        this._animator.play(this._pendingPlay ?? EPlayerAnim.Idle);
        this._pendingPlay = null;
    }

    update(dt: number) {
        if (!this._ready) return;
        this._animator.tick(dt);
    }

    play(anim: EPlayerAnim) {
        if (!this._ready) { this._pendingPlay = anim; return; }
        this._animator.play(anim);
    }

    playOnce(anim: EPlayerAnim, onComplete?: () => void) {
        if (!this._ready) { this._pendingPlay = anim; return; }
        this._animator.play(anim, onComplete);
    }
}
