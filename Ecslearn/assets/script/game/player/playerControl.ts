import { _decorator, Component, Sprite, SpriteFrame, Node, Vec3, Label, Color, UITransform, UIOpacity, Texture2D,
    RigidBody2D, CircleCollider2D, ERigidBody2DType, EffectAsset } from 'cc';
import { ResourceMgr } from '../../baseSystem/resource';
import type { IBuffOwner } from '../../baseSystem/buff';
import { PHY_GROUP } from '../physics/PhysicsGroups';
import { attachColliderDebug } from '../physics/ColliderDebugDraw';
import { Entity } from '../../baseSystem/ecs';
import { StateMachine } from '../../baseSystem/fsm';
import { RawInputComp, ActionComp, EAction, VelocityComp, NodeRefComp } from '../component';
import { EntityBuffMgr } from '../entity/EntityBuffMgr';
import { EPropertyId } from '../config/enum/propertyEnum';
import { World } from '../core/World';
import { GameLoop } from '../core/GameLoop';
import { getMainCamera } from '../core/CameraRef';
import { CameraController } from '../core/CameraController';
import { GameSession, ESessionPhase } from '../core/GameSession';
import { findNearestEnemy } from '../enemy/EnemyQuery';
import { PlayerAnimation } from './anim/PlayerAnimation';
import { PlayerProperty } from './property/playerProperty';
import { PlayerCombat } from './combat/PlayerCombat';
import { PlayerExperience } from './experience/PlayerExperience';
import { playerConfig } from './config/playerConfig';
import type { IShootPolicy } from '../shoot/types';
import { HoldToShoot } from '../shoot/ShootPolicies';
import { HitEffectMgr } from '../entity/HitEffectMgr';
import { UpgradeManager } from '../upgrade/UpgradeManager';
import { SkillSystem } from '../skill/SkillSystem';
import type { SkillContext } from '../skill/SkillTypes';
import { FlashWhite } from '../vfx/FlashWhite';
import { DamagePopupMgr, EDamageStyle } from '../vfx/DamagePopupMgr';
import '../hitEffects';
import {
    EPlayerState,
    type PlayerCtx,
    PlayerIdleState,
    PlayerRunState,
    PlayerShootState,
    PlayerHurtState,
    PlayerDeadState,
} from './states';

const { ccclass } = _decorator;

const INVINCIBLE_DURATION = 0.5;

/**
 * 节点结构：
 * Player (PlayerControl)
 * ├── Body (Sprite + PlayerAnimation) ← 翻转只在这里
 * ├── GroundFX
 * │   └── RangeCircle
 * └── UIAnchor
 *     └── HpLabel（保留简易显示，主 HUD 在屏幕左上角）
 */
@ccclass('PlayerControl')
export class PlayerControl extends Component {
    private static _inst: PlayerControl | null = null;
    static get instance(): PlayerControl | null { return this._inst; }

    private _body: Node = null!;
    private _uiAnchor: Node = null!;
    private _groundFX: Node = null!;

    private _entity: Entity = null!;
    private _anim: PlayerAnimation = null!;
    private _fsm!: StateMachine<EPlayerState, PlayerCtx>;
    private _ctx!: PlayerCtx;
    private _playerProp!: PlayerProperty;
    private _playerCombat!: PlayerCombat;
    private _playerExp!: PlayerExperience;
    private _buffOwner!: IBuffOwner;
    private _buffMgr!: EntityBuffMgr;
    private _hpLabel!: Label;
    private _shootPolicy: IShootPolicy = new HoldToShoot();
    private _hitEffectMgr!: HitEffectMgr;
    private _upgradeMgr!: UpgradeManager;
    private _skillSystem!: SkillSystem;
    private _flashWhite!: FlashWhite;
    private _mouseScreenPos = new Vec3();
    private _mouseWorldPos = new Vec3();

    get combat(): PlayerCombat { return this._playerCombat; }
    get playerProp(): PlayerProperty { return this._playerProp; }
    get experience(): PlayerExperience { return this._playerExp; }
    get buffOwner(): IBuffOwner { return this._buffOwner; }
    get buffMgr(): EntityBuffMgr { return this._buffMgr; }
    get body(): Node { return this._body; }
    get hitEffectMgr(): HitEffectMgr { return this._hitEffectMgr; }
    get upgradeMgr(): UpgradeManager { return this._upgradeMgr; }
    get skillSystem(): SkillSystem { return this._skillSystem; }
    get mouseWorldPos(): Readonly<Vec3> { return this._mouseWorldPos; }
    get isDead(): boolean { return this._playerCombat?.isDead ?? false; }

    setShootPolicy(policy: IShootPolicy): void {
        this._shootPolicy = policy;
    }

    onLoad() {
        PlayerControl._inst = this;

        this._body = new Node('Body');
        this.node.addChild(this._body);
        this._body.addComponent(Sprite);
        this._anim = this._body.addComponent(PlayerAnimation);

        this._groundFX = new Node('GroundFX');
        this.node.addChild(this._groundFX);

        this._uiAnchor = new Node('UIAnchor');
        this.node.addChild(this._uiAnchor);

        this._setupPhysics();
    }

    private _setupPhysics() {
        const rb = this.node.addComponent(RigidBody2D);
        rb.type = ERigidBody2DType.Kinematic;
        rb.allowSleep = false;
        rb.fixedRotation = true;
        rb.group = PHY_GROUP.Player;

        const col = this.node.addComponent(CircleCollider2D);
        col.radius = playerConfig.displayHeight * 0.18;
        col.sensor = true;
        col.group = PHY_GROUP.Player;

        attachColliderDebug(this.node);
    }

    start() {
        if (!World.inst) {
            console.error(
                '[PlayerControl] World 尚未初始化，请确保场景中有一个节点挂了 GameLoop，' +
                '且该节点在 Player 节点之前（父节点或靠前的兄弟节点）。',
            );
            return;
        }

        this._playerProp = new PlayerProperty();
        this._playerCombat = new PlayerCombat(this._playerProp);
        this._playerCombat.setHpRatio(0.5);

        this._playerExp = new PlayerExperience();
        this._playerExp.onLevelUp = (lv) => {
            console.log(`[PlayerControl] Level Up! → Lv.${lv}`);
        };

        this._buffOwner = {
            uid: 'player',
            getPropertyManager: () => this._playerProp,
            heal: (amount: number) => { this._playerCombat.heal(amount); },
        };
        this._buffMgr = new EntityBuffMgr(this._playerProp);

        this._hitEffectMgr = new HitEffectMgr();
        this._hitEffectMgr.add({ id: 'base-damage', effectClass: 'DamageHitEffect', priority: 0 });

        this._upgradeMgr = new UpgradeManager({
            buffMgr: this._buffMgr,
            buffOwner: this._buffOwner,
            hitEffectMgr: this._hitEffectMgr,
            setShootPolicy: (p) => { this._shootPolicy = p; },
        });

        this._skillSystem = new SkillSystem();

        this._flashWhite = new FlashWhite(this._body.getComponent(Sprite)!);

        DamagePopupMgr.inst.init(this.node.parent!);

        this._createHpLabel();
        this._initProxy();
        this._initFsm();

        CameraController.inst.setFollowTarget(this.node);

        GameLoop.onReady(() => {
            this._createRangeCircle();
            ResourceMgr.inst.preload(['shader/flash-white'], EffectAsset);
        });
    }

    // ─── Damage interface (called by enemies) ──────

    applyDamage(rawDmg: number): number {
        if (this._playerCombat.isDead) return 0;
        if (this._ctx && this._ctx.invincibleTimer > 0) return 0;

        const actual = this._playerCombat.takeDamage(rawDmg);
        if (actual > 0) {
            this._flashWhite.flash();
            CameraController.inst.shake(3, 0.1);
            DamagePopupMgr.inst.show(this.node.worldPosition, actual, EDamageStyle.PlayerHurt);

            if (this._ctx) this._ctx.invincibleTimer = INVINCIBLE_DURATION;

            if (this._playerCombat.isDead) {
                this._onDeath();
            }
        }
        return actual;
    }

    /** 经验获取入口 */
    grantXp(amount: number): void {
        this._playerExp.addXp(amount);
    }

    /** 复活：恢复到指定血量比例 */
    revive(hpRatio = 0.5): void {
        this._playerCombat.setHpRatio(hpRatio);
        GameSession.inst.confirmRevive();
        this._fsm.changeState(EPlayerState.Idle);
    }

    private _onDeath(): void {
        this._fsm.changeState(EPlayerState.Dead);
        GameSession.inst.onPlayerDeath();
    }

    update(dt: number) {
        this._buffMgr?.update(dt);
        this._skillSystem?.tick(dt);
        this._flashWhite?.tick(dt);
        DamagePopupMgr.inst.tick(dt);
        CameraController.inst.tick(dt);
        this._updateMouseWorldPos();
        this._syncMoveSpeed();
    }

    buildSkillContext(): SkillContext {
        return {
            playerProp:          this._playerProp,
            playerCombat:        this._playerCombat,
            playerNode:          this.node,
            hitEffectMgr:        this._hitEffectMgr,
            buffMgr:             this._buffMgr,
            buffOwner:           this._buffOwner,
            mouseWorldPos:       this._mouseWorldPos.clone(),
            currentShootPolicy:  this._shootPolicy,
            setShootPolicy:      (p) => { this._shootPolicy = p; },
        };
    }

    private _updateMouseWorldPos(): void {
        if (!this._entity) return;
        const raw = this._entity.getComponent(RawInputComp);
        if (!raw) return;
        this._mouseScreenPos.set(raw.mouseScreenX, raw.mouseScreenY, 0);
        const cam = getMainCamera();
        if (cam) {
            cam.screenToWorld(this._mouseScreenPos, this._mouseWorldPos);
        }
    }

    private _syncMoveSpeed(): void {
        if (!this._entity) return;
        const vel = this._entity.getComponent(VelocityComp);
        if (vel) vel.speed = this._playerProp.getValue(EPropertyId.MoveSpeed);
    }

    private _createHpLabel() {
        const labelNode = new Node('HpLabel');
        this._uiAnchor.addChild(labelNode);
        labelNode.setPosition(0, playerConfig.displayHeight / 2 + 15, 0);

        const ut = labelNode.addComponent(UITransform);
        ut.setContentSize(200, 30);

        this._hpLabel = labelNode.addComponent(Label);
        this._hpLabel.fontSize = 22;
        this._hpLabel.lineHeight = 26;
        this._hpLabel.color = new Color(80, 220, 80, 255);
        this._hpLabel.enableOutline = true;
        this._hpLabel.outlineColor = new Color(0, 0, 0, 200);
        this._hpLabel.outlineWidth = 2;
    }

    private _createRangeCircle() {
        const circleNode = new Node('RangeCircle');
        this._groundFX.addChild(circleNode);

        const range = this._playerProp.getValue(EPropertyId.AttackRange);
        const diameter = range * 2;
        const ut = circleNode.addComponent(UITransform);
        ut.setContentSize(diameter, diameter);

        const sprite = circleNode.addComponent(Sprite);
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        const tex = ResourceMgr.inst.get<Texture2D>(`${playerConfig.rangeTexture}/texture`);
        if (tex) {
            const sf = new SpriteFrame();
            sf.texture = tex;
            sprite.spriteFrame = sf;
        }

        const opacity = circleNode.addComponent(UIOpacity);
        opacity.opacity = 76;
    }

    private _initProxy() {
        this._entity = new Entity();
        this._entity.addComponent(new RawInputComp());
        this._entity.addComponent(new ActionComp());
        this._entity.addComponent(new VelocityComp());
        this._entity.addComponent(new NodeRefComp(this.node));
        World.inst.add(this._entity);
    }

    private _initFsm() {
        this._ctx = {
            anim: this._anim,
            node: this.node,
            body: this._body,
            fsm: null!,
            combat: this._playerCombat,
            prop: this._playerProp,
            targetEnemy: null,
            findNearestEnemy: () => findNearestEnemy(
                this.node.worldPosition,
                this._playerProp.getValue(EPropertyId.AttackRange),
            ),
            shootCooldown: 0,
            hitEffectMgr: this._hitEffectMgr,
            invincibleTimer: 0,
        };
        this._fsm = new StateMachine<EPlayerState, PlayerCtx>(this._ctx);
        this._ctx.fsm = this._fsm;

        this._fsm.addState(EPlayerState.Idle,  new PlayerIdleState());
        this._fsm.addState(EPlayerState.Run,   new PlayerRunState());
        this._fsm.addState(EPlayerState.Shoot, new PlayerShootState());
        this._fsm.addState(EPlayerState.Hurt,  new PlayerHurtState());
        this._fsm.addState(EPlayerState.Dead,  new PlayerDeadState());
        this._fsm.changeState(EPlayerState.Idle);
    }

    lateUpdate(dt: number) {
        if (!this._entity) return;

        this._ctx.shootCooldown = Math.max(0, this._ctx.shootCooldown - dt);
        this._ctx.invincibleTimer = Math.max(0, this._ctx.invincibleTimer - dt);

        if (this._hpLabel) {
            this._hpLabel.string = `${this._playerCombat.currentHp} / ${this._playerCombat.maxHp}`;
        }

        if (this._playerCombat.isDead) {
            this._fsm.tick(dt);
            return;
        }

        const vel = this._entity.getComponent(VelocityComp)!;
        const act = this._entity.getComponent(ActionComp)!;
        const isMoving = vel.vx !== 0 || vel.vy !== 0;
        const hasTarget = findNearestEnemy(
            this.node.worldPosition,
            this._playerProp.getValue(EPropertyId.AttackRange),
        ) !== null;

        const wantShoot = this._shootPolicy.wantShoot(act, hasTarget, isMoving);

        if (wantShoot) {
            this._fsm.changeState(EPlayerState.Shoot);
        } else {
            this._fsm.changeState(isMoving ? EPlayerState.Run : EPlayerState.Idle);
        }

        if (this._fsm.current !== EPlayerState.Shoot && vel.vx !== 0) {
            this._body.setScale(vel.vx < 0 ? -1 : 1, 1, 1);
        }

        this._fsm.tick(dt);
    }

    onDestroy() {
        if (PlayerControl._inst === this) PlayerControl._inst = null;
        if (this._entity && World.inst) {
            World.inst.remove(this._entity);
        }
    }
}