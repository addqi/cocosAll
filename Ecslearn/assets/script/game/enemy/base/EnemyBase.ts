import { Component, Sprite, Node,
    RigidBody2D, CircleCollider2D, ERigidBody2DType } from 'cc';
import { EnemyProperty } from '../EnemyProperty';
import { EnemyCombat } from '../EnemyCombat';
import { EnemyBuffOwner } from '../EnemyBuffOwner';
import { EntityBuffMgr } from '../../entity/EntityBuffMgr';
import { EnemyAnimation } from '../anim/EnemyAnimation';
import type { EnemyConfigData } from '../config/enemyConfig';
import type { PropertyBaseConfig } from '../../entity/EntityPropertyMgr';
import { PHY_GROUP } from '../../physics/PhysicsGroups';
import { attachColliderDebug } from '../../physics/ColliderDebugDraw';
import { FlashWhite } from '../../vfx/FlashWhite';
import { DamagePopupMgr, EDamageStyle } from '../../vfx/DamagePopupMgr';
import { EnemyVisual } from './EnemyVisual';
import { EnemyMovement } from './EnemyMovement';
import { EMobState } from './types';

/**
 * 所有敌人的共有基类（非 @ccclass，不直接挂节点）
 *
 * 节点结构：
 * EnemyNode (MinionControl / EliteControl / ...)
 * ├── Body (Sprite + EnemyAnimation)
 * ├── GroundFX  (检测圈 + 攻击指示器)
 * └── UIAnchor  (HP条)
 */
export abstract class EnemyBase extends Component {
    private static _all: EnemyBase[] = [];
    static get allEnemies(): readonly EnemyBase[] { return this._all; }

    protected _cfg!: EnemyConfigData;
    protected _body: Node = null!;
    protected _groundFX: Node = null!;
    protected _uiAnchor: Node = null!;

    protected _prop!: EnemyProperty;
    protected _combat!: EnemyCombat;
    protected _buffOwner!: EnemyBuffOwner;
    protected _buffMgr!: EntityBuffMgr;
    protected _anim!: EnemyAnimation;

    protected _visual!: EnemyVisual;
    protected _movement!: EnemyMovement;
    protected _flashWhite!: FlashWhite;

    protected _state = EMobState.Idle;
    protected _xpGranted = false;

    get combat(): EnemyCombat { return this._combat; }
    get prop(): EnemyProperty { return this._prop; }
    get buffOwner(): EnemyBuffOwner { return this._buffOwner; }
    get buffMgr(): EntityBuffMgr { return this._buffMgr; }
    get anim(): EnemyAnimation { return this._anim; }
    get body(): Node { return this._body; }
    get state(): EMobState { return this._state; }
    get visual(): EnemyVisual { return this._visual; }
    get movement(): EnemyMovement { return this._movement; }
    get cfg(): EnemyConfigData { return this._cfg; }

    /** 子类必须在 super.onLoad() 之前设置 */
    protected abstract getConfig(): EnemyConfigData;
    protected abstract getPropertyCfg(): PropertyBaseConfig;

    onLoad() {
        this._cfg = this.getConfig();

        this._body = new Node('Body');
        this.node.addChild(this._body);
        this._body.addComponent(Sprite);
        this._anim = this._body.addComponent(EnemyAnimation);
        this._anim.setConfig(this._cfg);

        this._groundFX = new Node('GroundFX');
        this.node.addChild(this._groundFX);

        this._uiAnchor = new Node('UIAnchor');
        this.node.addChild(this._uiAnchor);

        this._prop = new EnemyProperty(this.getPropertyCfg());
        this._combat = new EnemyCombat(this._prop);
        this._buffOwner = new EnemyBuffOwner(this._prop, this._combat, `enemy-${this.node.name}`);
        this._buffMgr = new EntityBuffMgr(this._prop);

        this._flashWhite = new FlashWhite(this._body.getComponent(Sprite)!);
        this._visual = new EnemyVisual();
        this._movement = new EnemyMovement(this.node, this._body, this._prop);

        this._setupPhysics();
        this._visual.createHpBar(this._uiAnchor, this._cfg.displayHeight);

        EnemyBase._all.push(this);
    }

    start() {
        this._visual.tryCreateDetectionCircle(
            this._groundFX, this._cfg.detectionRange,
            (cb, delay) => this.scheduleOnce(cb, delay),
        );
    }

    onHitVisual(damage: number, isCrit: boolean): void {
        this._flashWhite?.flash();
        DamagePopupMgr.inst.show(
            this.node.worldPosition,
            damage,
            isCrit ? EDamageStyle.Crit : EDamageStyle.Normal,
        );
    }

    onDestroy() {
        const i = EnemyBase._all.indexOf(this);
        if (i >= 0) EnemyBase._all.splice(i, 1);
    }

    private _setupPhysics() {
        const rb = this.node.addComponent(RigidBody2D);
        rb.type = ERigidBody2DType.Kinematic;
        rb.allowSleep = false;
        rb.fixedRotation = true;
        rb.group = PHY_GROUP.Enemy;

        const col = this.node.addComponent(CircleCollider2D);
        col.radius = this._cfg.displayHeight * 0.2;
        col.sensor = true;
        col.group = PHY_GROUP.Enemy;

        attachColliderDebug(this.node);
    }
}
