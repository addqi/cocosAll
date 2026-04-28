import { _decorator, Component, Sprite, SpriteFrame, Node, Vec3, Label, Color, UITransform, UIOpacity, Texture2D,
    RigidBody2D, CircleCollider2D, ERigidBody2DType, EffectAsset } from 'cc';
import { ResourceMgr } from '../../baseSystem/resource';
import { on, off } from '../../baseSystem/util';
import { GameEvt, type EnemyDeathEvent } from '../events/GameEvents';
import { PHY_GROUP } from '../physics/PhysicsGroups';
import { attachColliderDebug } from '../physics/ColliderDebugDraw';
import { Entity } from '../../baseSystem/ecs';
import { StateMachine } from '../../baseSystem/fsm';
import { RawInputComp, ActionComp, EAction, VelocityComp, NodeRefComp } from '../component';
import { EPropertyId } from '../config/enum/propertyEnum';
import { World } from '../core/World';
import { ResourceState } from '../core/ResourceState';
import { getMainCamera } from '../core/CameraRef';
import { CameraController } from '../core/CameraController';
import { GameSession } from '../core/GameSession';
import { findNearestEnemy } from '../enemy/EnemyQuery';
import { PlayerAnimation } from './anim/PlayerAnimation';
import { PlayerProperty } from './property/playerProperty';
import { PlayerCombat } from './combat/PlayerCombat';
import { PlayerExperience } from './experience/PlayerExperience';
import { playerConfig } from './config/playerConfig';
import { PlayerBehaviorFactory } from '../../baseSystem/player';
import type { PlayerBehavior } from './base';
import './behaviors';
import { PlayerRuntime } from './runtime';
import { DamagePopupMgr, EDamageStyle } from '../vfx/DamagePopupMgr';
import '../hitEffects';
import '../skill';
import { installAttackHandlers } from '../combat/attack';
import { SkillFactory } from '../skill/SkillFactory';
import { getSkillDef } from '../config/skillConfig/SkillConfigLoader';
import { getBuffDef } from '../config/buffConfig/BuffConfigLoader';
import { getPlayerClassDef } from '../config/classConfig/ClassConfigLoader';
import { createTakenDamageContext } from '../hitEffects/types';
import type { IActiveSkill, SkillContext } from '../skill/SkillTypes';
import { getWhiteSF } from '../ui/UiAtlas';
import type { ArcherBehavior } from './archer/ArcherBehavior';
import {
    EPlayerState,
    type PlayerCtx,
    PlayerIdleState,
    PlayerRunState,
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
 *     └── HpLabel
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
    private _hpLabel!: Label;
    // 蓄力条 —— 仅蓄力流启用，其他流派 _chargeBarRoot 保持 null
    private _chargeBarRoot: Node | null = null;
    private _chargeBarFill: Node | null = null;
    private _chargeBarFillSprite: Sprite | null = null;
    private _chargeBarWidth = 60;
    private _chargeBarBlinkT = 0;
    private _behaviorId = 'archer';
    private _behavior!: PlayerBehavior;
    private _runtime!: PlayerRuntime;
    private _mouseScreenPos = new Vec3();
    private _mouseWorldPos = new Vec3();
    private _currentClassId: string | null = null;

    get combat(): PlayerCombat { return this._playerCombat; }
    get playerProp(): PlayerProperty { return this._playerProp; }
    get experience(): PlayerExperience { return this._playerExp; }
    get buffOwner() { return this._runtime.buffOwner; }
    get buffMgr() { return this._runtime.buffMgr; }
    get body(): Node { return this._body; }
    get hitEffectMgr() { return this._runtime.hitEffectMgr; }
    get upgradeMgr() { return this._runtime.upgradeMgr; }
    get skillSystem() { return this._runtime.skillSystem; }
    get mouseWorldPos(): Readonly<Vec3> { return this._mouseWorldPos; }
    get isDead(): boolean { return this._playerCombat?.isDead ?? false; }
    get behavior(): PlayerBehavior { return this._behavior; }
    get runtime(): PlayerRuntime { return this._runtime; }
    get currentClassId(): string | null { return this._currentClassId; }
    /** 暴露 RawInputComp 给虚拟输入（VirtualInputPanel）写入；只读 reference */
    get rawInput(): RawInputComp | null {
        return this._entity?.getComponent(RawInputComp) ?? null;
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

        on(GameEvt.EnemyDeath, this._onEnemyDeath);
    }

    private _onEnemyDeath = (e: EnemyDeathEvent) => {
        this._playerExp?.addXp(e.xpReward);
    };

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
        // 资源预加载完成（GameLoop 在 preload 完后调 markReady）才真正建 runtime。
        // 此前整套依赖 World 的初始化都推迟——这样 Player 节点和 GameLoop 节点的
        // onLoad 执行顺序就不再重要，单脚本启动的场景也能工作。
        ResourceState.onReady(() => this._initAfterReady());
    }

    private _initAfterReady(): void {
        if (!World.inst) {
            console.error(
                '[PlayerControl] ResourceState.ready 后 World 仍为空 —— 请检查场景中是否挂了 GameLoop（或等效的启动器）。',
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

        this._behavior = PlayerBehaviorFactory.create<PlayerBehavior>(this._behaviorId);

        this._runtime = new PlayerRuntime({
            prop: this._playerProp,
            combat: this._playerCombat,
            behavior: this._behavior,
            bodySprite: this._body.getComponent(Sprite)!,
            parentNode: this.node.parent!,
        });

        this._createHpLabel();
        this._initProxy();
        this._initFsm();

        CameraController.inst.setFollowTarget(this.node);

        this._createRangeCircle();
        ResourceMgr.inst.preload(['shader/flash-white'], EffectAsset);
        this._installAttackRuntime();
        // 默认技能不在这里装；由 GameManager 在玩家选流派后调 setPlayerClass(id)
    }

    private _installAttackRuntime(): void {
        const parent = this.node.parent;
        if (!parent) {
            console.warn('[PlayerControl] parent 丢失，跳过 attack handler 安装');
            return;
        }
        installAttackHandlers(parent);
    }

    /**
     * 应用玩家流派：切换射击模式 + 装备起手技能 + 施加被动 Buff。
     * 由 GameManager 在玩家选流派后调用一次；在此之前 LevelManager 不应启动。
     */
    setPlayerClass(classId: string): boolean {
        if (!this._runtime) {
            console.error(`[PlayerControl] setPlayerClass 调用过早，_runtime 尚未创建 (id=${classId})`);
            return false;
        }
        const def = getPlayerClassDef(classId);
        if (!def) {
            console.error(`[PlayerControl] 未知流派 id: ${classId}`);
            return false;
        }

        this._currentClassId = classId;

        this._behavior.onBehaviorCommand('set_shoot_mode', def.shoot);

        const sys = this._runtime.skillSystem;
        let slotAuto = 0;
        for (const s of def.startSkills) {
            const skillDef = getSkillDef(s.skillId);
            if (!skillDef) {
                console.warn(`[PlayerControl] 未找到 skill def: ${s.skillId}`);
                continue;
            }
            const skill = SkillFactory.create(skillDef) as IActiveSkill;
            const slot = typeof s.slot === 'number' ? s.slot : slotAuto++;
            sys.equip(skill, slot);
        }

        for (const p of def.passiveBuffs) {
            const buffDef = getBuffDef(p.buffKey);
            if (!buffDef) {
                console.warn(`[PlayerControl] 未找到 buff def: ${p.buffKey}`);
                continue;
            }
            this._runtime.buffMgr.addBuff(buffDef, this._runtime.buffOwner);
        }

        this._syncChargeBarForMode();

        console.log(`[PlayerControl] 流派 "${def.name}" 就绪`);
        return true;
    }

    // ─── Damage interface (called by enemies) ──────

    /**
     * 敌人调用入口。
     * @param rawDmg       原始伤害
     * @param attackerNode 可选，攻击来源节点（用于反弹 / 位置相关 effect；不传 = 无法定位源头）
     */
    applyDamage(rawDmg: number, attackerNode: Node | null = null): number {
        if (this._playerCombat.isDead) return 0;
        if (this._ctx && this._ctx.invincibleTimer > 0) return 0;

        // ── onTakenDamage 钩子 ──
        // effect 可修改 ctx.rawDamage（减伤/免死/反弹）
        let effectiveDmg = rawDmg;
        if (this._runtime?.hitEffectMgr) {
            const tCtx = createTakenDamageContext(
                this._playerProp, this._playerCombat, rawDmg,
                attackerNode, attackerNode?.worldPosition?.clone() ?? null,
            );
            this._runtime.hitEffectMgr.executeOnTakenDamage(tCtx);
            effectiveDmg = Math.max(0, tCtx.rawDamage);
        }

        if (effectiveDmg <= 0) return 0;

        const actual = this._playerCombat.takeDamage(effectiveDmg);
        if (actual > 0) {
            this._runtime.flashWhite.flash();
            CameraController.inst.shake(3, 0.1);
            DamagePopupMgr.inst.show(this.node.worldPosition, actual, EDamageStyle.PlayerHurt);

            if (this._ctx) this._ctx.invincibleTimer = INVINCIBLE_DURATION;

            if (this._playerCombat.isDead) {
                this._onDeath();
            } else if (this._fsm) {
                this._fsm.changeState(EPlayerState.Hurt);
            }
        }
        return actual;
    }

    grantXp(amount: number): void {
        this._playerExp.addXp(amount);
    }

    /**
     * 复活：重置 HP + 清掉 dissolve material + 切回 Idle。
     * 默认满血。
     */
    revive(hpRatio = 1.0): void {
        this._playerCombat.setHpRatio(hpRatio);
        // 清 dissolve 材质，恢复原始外观
        const sprite = this._body?.getComponent(Sprite);
        if (sprite) sprite.customMaterial = null;
        GameSession.inst.confirmRevive();
        this._fsm.changeState(EPlayerState.Idle);
    }

    /**
     * HP→0 触发：进入 PlayerDeadState 播 dissolve 动画。
     * GameSession.onPlayerDeath 不在这里调，而是由 PlayerDeadState 在 dissolve 完成后调，
     * 这样"死亡动画 → 失败弹窗"有自然时序。
     */
    private _onDeath(): void {
        this._fsm.changeState(EPlayerState.Dead);
    }

    update(dt: number) {
        this._runtime?.tick(dt);
        CameraController.inst.tick(dt);
        this._updateMouseWorldPos();
        this._syncMoveSpeed();
    }

    buildSkillContext(): SkillContext {
        return this._behavior.buildSkillContext({
            playerProp:    this._playerProp,
            playerCombat:  this._playerCombat,
            playerNode:    this.node,
            hitEffectMgr:  this._runtime.hitEffectMgr,
            buffMgr:       this._runtime.buffMgr,
            buffOwner:     this._runtime.buffOwner,
            mouseWorldPos: this._mouseWorldPos.clone(),
        });
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
        if (!vel) return;
        const base = this._playerProp.getValue(EPropertyId.MoveSpeed);
        const ratio = this._behavior?.getMoveSpeedRatio(this._ctx) ?? 1;
        vel.speed = base * ratio;
    }

    private _tickSkillKeys(act: ActionComp): void {
        if (act.justPressed.has(EAction.Skill1)) {
            this._runtime.skillSystem.tryUseBySlot(0, this.buildSkillContext());
        }
        if (act.justPressed.has(EAction.Skill2)) {
            this._runtime.skillSystem.tryUseBySlot(1, this.buildSkillContext());
        }
        if (act.justPressed.has(EAction.Skill3)) {
            this._runtime.skillSystem.tryUseBySlot(2, this.buildSkillContext());
        }
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

    // ─── 蓄力条（仅蓄力流启用）─────────────────────────

    /** 根据当前流派 shootMode 创建 / 销毁蓄力条节点 */
    private _syncChargeBarForMode(): void {
        const mode = (this._behavior as ArcherBehavior).shootMode;
        const needBar = mode?.type === 'charge';
        if (needBar && !this._chargeBarRoot) {
            this._createChargeBar();
        } else if (!needBar && this._chargeBarRoot) {
            this._chargeBarRoot.destroy();
            this._chargeBarRoot = null;
            this._chargeBarFill = null;
            this._chargeBarFillSprite = null;
        }
    }

    private _createChargeBar(): void {
        const root = new Node('ChargeBar');
        this._uiAnchor.addChild(root);
        // HP 标签在 +15，蓄力条放到 -10（玩家头顶与 HP 之间留点距离）
        root.setPosition(0, playerConfig.displayHeight / 2 - 10, 0);
        const rootUt = root.addComponent(UITransform);
        rootUt.setContentSize(this._chargeBarWidth, 8);

        const bg = new Node('Bg');
        root.addChild(bg);
        const bgUt = bg.addComponent(UITransform);
        bgUt.setContentSize(this._chargeBarWidth, 8);
        const bgSp = bg.addComponent(Sprite);
        bgSp.sizeMode = Sprite.SizeMode.CUSTOM;
        bgSp.spriteFrame = getWhiteSF();
        bgSp.color = new Color(20, 20, 28, 220);

        const fill = new Node('Fill');
        root.addChild(fill);
        // Fill 从左边缘向右生长 —— 锚点左侧对齐
        const fillUt = fill.addComponent(UITransform);
        fillUt.anchorX = 0;
        fillUt.anchorY = 0.5;
        fillUt.setContentSize(0, 6);
        fill.setPosition(-this._chargeBarWidth / 2, 0, 0);
        const fillSp = fill.addComponent(Sprite);
        fillSp.sizeMode = Sprite.SizeMode.CUSTOM;
        fillSp.spriteFrame = getWhiteSF();
        fillSp.color = new Color(120, 200, 255, 255);

        this._chargeBarRoot = root;
        this._chargeBarFill = fill;
        this._chargeBarFillSprite = fillSp;
        root.active = false;
    }

    /**
     * 每帧刷新蓄力条 —— 显示规则：
     *   - 未蓄力（chargeSec <= 0）：隐藏
     *   - 蓄力进行中（0 < t < 1）：填充宽度随 t 增长，颜色 蓝→白 渐变
     *   - 蓄满（t >= 1）：填充宽度 = 最大，颜色 橙红 + 闪烁（sin 亮度调制）
     */
    private _tickChargeBar(dt: number): void {
        if (!this._chargeBarRoot || !this._chargeBarFill || !this._chargeBarFillSprite) return;

        const mode = (this._behavior as ArcherBehavior).shootMode;
        if (mode?.type !== 'charge') {
            this._chargeBarRoot.active = false;
            return;
        }

        const chargeSec = this._ctx?.chargeSec ?? 0;
        if (chargeSec <= 0) {
            this._chargeBarRoot.active = false;
            this._chargeBarBlinkT = 0;
            return;
        }

        this._chargeBarRoot.active = true;
        const t = Math.min(chargeSec / mode.maxChargeSec, 1);
        const w = this._chargeBarWidth * t;
        const fillUt = this._chargeBarFill.getComponent(UITransform)!;
        fillUt.setContentSize(w, 6);

        if (t >= 1) {
            // 蓄满：橙红 + sin 闪烁
            this._chargeBarBlinkT += dt;
            const s = 0.6 + 0.4 * Math.abs(Math.sin(this._chargeBarBlinkT * 10));
            this._chargeBarFillSprite.color = new Color(
                Math.round(255 * s),
                Math.round(120 * s),
                Math.round(60 * s),
                255,
            );
        } else {
            // 蓄力中：蓝 → 白 线性插值
            this._chargeBarBlinkT = 0;
            const b = 120 + (255 - 120) * t;
            const g = 200 + (255 - 200) * t;
            this._chargeBarFillSprite.color = new Color(
                Math.round(b),
                Math.round(g),
                255,
                255,
            );
        }
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
            behavior: this._behavior,
            combat: this._playerCombat,
            prop: this._playerProp,
            targetEnemy: null,
            findNearestEnemy: () => findNearestEnemy(
                this.node.worldPosition,
                this._playerProp.getValue(EPropertyId.AttackRange),
            ),
            attackCooldown: 0,
            hitEffectMgr: this._runtime.hitEffectMgr,
            invincibleTimer: 0,
            chargeSec: 0,
            pendingChargeSec: 0,
        };
        this._fsm = new StateMachine<EPlayerState, PlayerCtx>(this._ctx);
        this._ctx.fsm = this._fsm;

        this._fsm.addState(EPlayerState.Idle,   new PlayerIdleState());
        this._fsm.addState(EPlayerState.Run,    new PlayerRunState());
        this._fsm.addState(EPlayerState.Attack, this._behavior.createAttackState());
        this._fsm.addState(EPlayerState.Hurt,   new PlayerHurtState());
        this._fsm.addState(EPlayerState.Dead,   new PlayerDeadState());
        this._fsm.changeState(EPlayerState.Idle);
    }

    lateUpdate(dt: number) {
        if (!this._entity) return;

        this._ctx.attackCooldown = Math.max(0, this._ctx.attackCooldown - dt);
        this._ctx.invincibleTimer = Math.max(0, this._ctx.invincibleTimer - dt);

        if (this._hpLabel) {
            this._hpLabel.string = `${this._playerCombat.currentHp} / ${this._playerCombat.maxHp}`;
        }

        if (this._playerCombat.isDead) {
            this._fsm.tick(dt);
            return;
        }

        if (this._fsm.current === EPlayerState.Hurt) {
            this._fsm.tick(dt);
            return;
        }

        const vel = this._entity.getComponent(VelocityComp)!;
        const act = this._entity.getComponent(ActionComp)!;

        this._tickSkillKeys(act);

        // 职业自定义每帧输入 tick（蓄力流在此累加 chargeSec；其他职业空实现）
        this._behavior.tickInput(this._ctx, act, dt);

        const isMoving = vel.vx !== 0 || vel.vy !== 0;
        const hasTarget = findNearestEnemy(
            this.node.worldPosition,
            this._playerProp.getValue(EPropertyId.AttackRange),
        ) !== null;

        const wantAttack = this._behavior.wantAttack({ input: act, hasTarget, isMoving });

        if (wantAttack) {
            this._fsm.changeState(EPlayerState.Attack);
        } else {
            this._fsm.changeState(isMoving ? EPlayerState.Run : EPlayerState.Idle);
        }

        if (this._fsm.current !== EPlayerState.Attack && vel.vx !== 0) {
            this._body.setScale(vel.vx < 0 ? -1 : 1, 1, 1);
        }

        this._fsm.tick(dt);
        this._tickChargeBar(dt);
    }

    onDestroy() {
        off(GameEvt.EnemyDeath, this._onEnemyDeath);
        if (PlayerControl._inst === this) PlayerControl._inst = null;
        if (this._entity && World.inst) {
            World.inst.remove(this._entity);
        }
    }
}
