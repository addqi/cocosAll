import { EffectAsset, Material, Sprite, Texture2D, type Node } from 'cc';
import { ResourceMgr } from '../../baseSystem/resource';

const DISSOLVE_EFFECT_PATH = 'shader/dissolve';
const NOISE_TEXTURE_PATH   = 'shader/noise/texture';

/**
 * 通用溶解动画播放器 —— 把传入的 Sprite 节点逐步溶解。
 *
 * 资源依赖（ResourcePreloader 已预加载，运行时同步 get）：
 *   - shader/dissolve.effect
 *   - shader/noise/texture
 *
 * 使用：
 *   const anim = new DissolveAnimator(0.8);
 *   anim.start(bodyNode);
 *   // 每帧：
 *   if (anim.tick(dt)) onDone();
 */
export class DissolveAnimator {
    private _mat: Material | null = null;
    private _progress = 0;
    private _duration: number;

    constructor(duration = 0.8) {
        this._duration = Math.max(0.01, duration);
    }

    get progress(): number { return this._progress; }
    get done(): boolean    { return this._progress >= 1; }

    /**
     * 给 body 节点贴上 dissolve material；后续 tick 推进溶解阈值。
     * @returns 是否启动成功（资源缺失返 false）
     */
    start(body: Node): boolean {
        const effect = ResourceMgr.inst.get<EffectAsset>(DISSOLVE_EFFECT_PATH);
        const noiseTex = ResourceMgr.inst.get<Texture2D>(NOISE_TEXTURE_PATH);
        if (!effect || !noiseTex) {
            console.error(
                `[DissolveAnimator] 资源未预加载: effect=${!!effect}, noise=${!!noiseTex}`,
            );
            return false;
        }

        const sprite = body.getComponent(Sprite);
        if (!sprite) {
            console.error('[DissolveAnimator] body 节点没有 Sprite 组件');
            return false;
        }

        const mat = new Material();
        mat.initialize({ effectAsset: effect, technique: 0 });
        mat.setProperty('noiseTexture', noiseTex);
        mat.setProperty('dissolveThreshold', 0);

        sprite.customMaterial = mat;
        this._mat = mat;
        this._progress = 0;
        return true;
    }

    /** 推进一帧，返回是否完成 */
    tick(dt: number): boolean {
        if (!this._mat) return true;
        this._progress = Math.min(1, this._progress + dt / this._duration);
        this._mat.setProperty('dissolveThreshold', this._progress);
        return this._progress >= 1;
    }
}
