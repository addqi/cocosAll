import { _decorator, Component, Node, Vec2, Vec3, tween, Color, Sprite } from 'cc';
import { emit } from '../../baseSystem/util';
import { GameEvt, type GoldPickupBeginEvent } from '../events/GameEvents';

const { ccclass } = _decorator;

export enum CoinTier {
    Bronze = 'bronze',
    Silver = 'silver',
    Gold   = 'gold',
    Ruby   = 'ruby',
}

export type CoinState = 'idle' | 'attracting' | 'pickedUp';

const _dir = new Vec2();

/**
 * 金币物件（单枚面值 = N 金）
 *
 * 三状态机：
 *   idle       出生跳跃后静置，等待玩家进入 PickupRange
 *   attracting 飞向玩家节点
 *   pickedUp   到手（入账 + 回池）
 */
@ccclass('CoinEntity')
export class CoinEntity extends Component {

    denomination = 1;
    state: CoinState = 'idle';

    private _target: Node | null = null;
    private _vel = new Vec2();
    private _sprite: Sprite | null = null;

    reset(worldPos: Readonly<Vec3>, amount: number): void {
        this.denomination = amount;
        this.state = 'idle';
        this._target = null;
        this._vel.set(0, 0);
        this.node.setWorldPosition(worldPos.x, worldPos.y, worldPos.z);
        this.node.setScale(1, 1, 1);
        this._applyTierVisual();
        this._playSpawnTween();
    }

    startAttracting(target: Node): void {
        if (this.state !== 'idle') return;
        this.state = 'attracting';
        this._target = target;
        const payload: GoldPickupBeginEvent = { amount: this.denomination };
        emit(GameEvt.GoldPickupBegin, payload);
    }

    /**
     * 吸附步进。返回 true 表示已抵达玩家。
     * accel/maxSpeed 由 CoinPickupSystem 传入。
     *
     * 速度模型：
     *   1. 老速度按 VELOCITY_DAMPING 衰减 —— 消除惯性导致的"绕玩家飞"轨道现象
     *   2. 朝当前目标方向加速
     *   3. 限 maxSpeed
     * damping 每秒 8：一帧 dt=0.016 保留 ~87%，50ms 内老方向衰减 ~33%
     * 玩家移动时金币能快速重新瞄准，不会错过入账。
     */
    tickAttracting(dt: number, accel: number, maxSpeed: number, arriveRadius: number): boolean {
        if (!this._target || !this._target.isValid) return true;

        const from = this.node.worldPosition;
        const to = this._target.worldPosition;
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const distSq = dx * dx + dy * dy;
        if (distSq <= arriveRadius * arriveRadius) return true;

        const dist = Math.sqrt(distSq);
        const inv = 1 / dist;
        _dir.set(dx * inv, dy * inv);

        // 衰减旧速度（消除绕圈惯性）
        const damping = Math.max(0, 1 - 8 * dt);
        this._vel.x *= damping;
        this._vel.y *= damping;

        // 朝目标方向加速
        this._vel.x += _dir.x * accel * dt;
        this._vel.y += _dir.y * accel * dt;

        const spd = this._vel.length();
        if (spd > maxSpeed) {
            const k = maxSpeed / spd;
            this._vel.x *= k;
            this._vel.y *= k;
        }

        this.node.setWorldPosition(
            from.x + this._vel.x * dt,
            from.y + this._vel.y * dt,
            from.z,
        );
        return false;
    }

    markPickedUp(): void { this.state = 'pickedUp'; }

    private _applyTierVisual(): void {
        const tier = CoinEntity.pickTier(this.denomination);
        this._ensureSprite();
        if (!this._sprite) return;
        switch (tier) {
            case CoinTier.Bronze: this._sprite.color = new Color(210, 140, 80, 255); break;
            case CoinTier.Silver: this._sprite.color = new Color(220, 225, 230, 255); break;
            case CoinTier.Gold:   this._sprite.color = new Color(255, 210, 80, 255); break;
            case CoinTier.Ruby:   this._sprite.color = new Color(230, 70, 110, 255); break;
        }
        const scale = tier === CoinTier.Ruby ? 1.3 : tier === CoinTier.Gold ? 1.15 : tier === CoinTier.Silver ? 1.0 : 0.85;
        this.node.setScale(scale, scale, 1);
    }

    static pickTier(amount: number): CoinTier {
        if (amount >= 250) return CoinTier.Ruby;
        if (amount >= 50)  return CoinTier.Gold;
        if (amount >= 10)  return CoinTier.Silver;
        return CoinTier.Bronze;
    }

    private _ensureSprite(): void {
        if (!this._sprite) {
            this._sprite = this.getComponent(Sprite) ?? this.getComponentInChildren(Sprite);
        }
    }

    private _playSpawnTween(): void {
        const angle = Math.random() * Math.PI * 2;
        const dist = 60 + Math.random() * 40;
        const from = this.node.worldPosition;
        const tx = from.x + Math.cos(angle) * dist;
        const ty = from.y + Math.sin(angle) * dist;

        const target = new Vec3(tx, ty, from.z);
        tween(this.node)
            .to(0.25, { worldPosition: target }, { easing: 'quadOut' })
            .start();
    }
}
