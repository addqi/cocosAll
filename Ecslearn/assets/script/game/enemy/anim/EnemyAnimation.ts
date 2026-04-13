import { _decorator, Component, Sprite, UITransform, Size } from 'cc';
import { SpriteSheetUtil, SpriteAnimator } from '../../../baseSystem/animation';
import { enemyConfig } from '../config/enemyConfig';
import type { EnemyConfigData } from '../config/enemyConfig';
import { GameLoop } from '../../core/GameLoop';

const { ccclass } = _decorator;

export enum EEnemyAnim {
    Idle   = 'idle',
    Run    = 'run',
    Attack = 'attack',
    Die    = 'die',
}

@ccclass('EnemyAnimation')
export class EnemyAnimation extends Component {
    private _animator: SpriteAnimator = null!;
    private _ready = false;
    private _config: EnemyConfigData = enemyConfig;

    get animator(): SpriteAnimator { return this._animator; }

    setConfig(cfg: EnemyConfigData): void {
        this._config = cfg;
        const ut = this.getComponent(UITransform);
        if (ut) ut.setContentSize(new Size(cfg.displayWidth, cfg.displayHeight));
    }

    onLoad() {
        const sprite = this.getComponent(Sprite)!;
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        this._animator = new SpriteAnimator(sprite);

        const ut = this.getComponent(UITransform) || this.node.addComponent(UITransform);
        ut.setContentSize(new Size(this._config.displayWidth, this._config.displayHeight));

        GameLoop.onReady(() => this._initAnims());
    }

    private _initAnims() {
        const { frameSize, anims } = this._config;
        for (const key of Object.keys(anims)) {
            const entry = anims[key];
            const frames = entry.frameDir
                ? SpriteSheetUtil.getFrameDir(entry.frameDir)
                : SpriteSheetUtil.getFrames(entry.path!, frameSize, frameSize);
            this._animator.addAnim(key, frames, entry.fps, entry.loop);
        }
        this._ready = true;
        this._animator.play(EEnemyAnim.Idle);
    }

    update(dt: number) {
        if (!this._ready) return;
        this._animator.tick(dt);
    }

    play(anim: EEnemyAnim) {
        if (!this._ready) return;
        this._animator.play(anim);
    }

    playOnce(anim: EEnemyAnim, onComplete?: () => void) {
        if (!this._ready) { onComplete?.(); return; }
        this._animator.play(anim, onComplete);
    }

    hasAnim(anim: EEnemyAnim): boolean {
        return this._ready && this._animator.hasAnim(anim);
    }

    stop() {
        this._animator.stop();
    }
}
