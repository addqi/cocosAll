import { _decorator, Component, Sprite, UITransform, Size } from 'cc';
import { SpriteSheetUtil, SpriteAnimator } from '../../../baseSystem/animation';
import { enemyConfig } from '../config/enemyConfig';
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

    get animator(): SpriteAnimator { return this._animator; }

    onLoad() {
        const sprite = this.getComponent(Sprite)!;
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        this._animator = new SpriteAnimator(sprite);

        const ut = this.getComponent(UITransform) || this.node.addComponent(UITransform);
        ut.setContentSize(new Size(enemyConfig.displayWidth, enemyConfig.displayHeight));

        GameLoop.onReady(() => this._initAnims());
    }

    private _initAnims() {
        const { frameSize, anims } = enemyConfig;
        for (const key of Object.keys(anims)) {
            const entry = anims[key];
            const frames = SpriteSheetUtil.getFrames(entry.path, frameSize, frameSize);
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
        if (!this._ready) return;
        this._animator.play(anim, onComplete);
    }
}
