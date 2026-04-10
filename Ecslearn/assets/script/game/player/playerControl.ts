import { _decorator, Component, Sprite, SpriteFrame, Node, Vec3, Label, Color, UITransform, UIOpacity, Texture2D } from 'cc';
import { ResourceMgr } from '../../baseSystem/resource';
import type { IBuffOwner } from '../../baseSystem/buff';
import { Entity } from '../../baseSystem/ecs';
import { StateMachine } from '../../baseSystem/fsm';
import { RawInputComp, ActionComp, EAction, VelocityComp, NodeRefComp } from '../component';
import { EntityBuffMgr } from '../entity/EntityBuffMgr';
import { EPropertyId } from '../config/enum/propertyEnum';
import { World } from '../core/World';
import { GameLoop } from '../core/GameLoop';
import { PlayerAnimation } from './anim/PlayerAnimation';
import { PlayerProperty } from './property/playerProperty';
import { PlayerCombat } from './combat/PlayerCombat';
import { EnemyControl } from '../enemy/EnemyControl';
import { playerConfig } from './config/playerConfig';
import type { IShootPolicy } from '../shoot/types';
import { HoldToShoot } from '../shoot/ShootPolicies';
import { HitEffectMgr } from '../entity/HitEffectMgr';
import '../hitEffects';
import {
    EPlayerState,
    type PlayerCtx,
    PlayerIdleState,
    PlayerRunState,
    PlayerShootState,
} from './states';

const { ccclass } = _decorator;

const _tmpVec = new Vec3();

/**
 * 节点结构：
 * Player (PlayerControl)
 * ├── Body (Sprite + PlayerAnimation) ← 翻转只在这里
 * ├── GroundFX
 * │   └── RangeCircle
 * └── UIAnchor ← 永不翻转
 *     └── HpLabel
 */
@ccclass('PlayerControl')
export class PlayerControl extends Component {
    private _body: Node = null!;
    private _uiAnchor: Node = null!;
    private _groundFX: Node = null!;

    private _entity: Entity = null!;
    private _anim: PlayerAnimation = null!;
    private _fsm!: StateMachine<EPlayerState, PlayerCtx>;
    private _ctx!: PlayerCtx;
    private _playerProp!: PlayerProperty;
    private _playerCombat!: PlayerCombat;
    private _buffOwner!: IBuffOwner;
    private _buffMgr!: EntityBuffMgr;
    private _hpLabel!: Label;
    private _shootPolicy: IShootPolicy = new HoldToShoot();
    private _hitEffectMgr!: HitEffectMgr;

    get combat(): PlayerCombat { return this._playerCombat; }
    get playerProp(): PlayerProperty { return this._playerProp; }
    get buffOwner(): IBuffOwner { return this._buffOwner; }
    get buffMgr(): EntityBuffMgr { return this._buffMgr; }
    get body(): Node { return this._body; }
    get hitEffectMgr(): HitEffectMgr { return this._hitEffectMgr; }

    setShootPolicy(policy: IShootPolicy): void {
        this._shootPolicy = policy;
    }

    onLoad() {
        this._body = new Node('Body');
        this.node.addChild(this._body);
        this._body.addComponent(Sprite);
        this._anim = this._body.addComponent(PlayerAnimation);

        this._groundFX = new Node('GroundFX');
        this.node.addChild(this._groundFX);

        this._uiAnchor = new Node('UIAnchor');
        this.node.addChild(this._uiAnchor);
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

        this._buffOwner = {
            uid: 'player',
            getPropertyManager: () => this._playerProp,
            heal: (amount: number) => { this._playerCombat.heal(amount); },
        };
        this._buffMgr = new EntityBuffMgr(this._playerProp);

        this._hitEffectMgr = new HitEffectMgr();
        this._hitEffectMgr.add({ id: 'base-damage', effectClass: 'DamageHitEffect', priority: 0 });

        this._createHpLabel();
        this._initProxy();
        this._initFsm();

        GameLoop.onReady(() => this._createRangeCircle());
    }

    update(dt: number) {
        this._buffMgr?.update(dt);
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
            findNearestEnemy: () => this._findNearestEnemy(),
            shootCooldown: 0,
            hitEffectMgr: this._hitEffectMgr,
        };
        this._fsm = new StateMachine<EPlayerState, PlayerCtx>(this._ctx);
        this._ctx.fsm = this._fsm;

        this._fsm.addState(EPlayerState.Idle,  new PlayerIdleState());
        this._fsm.addState(EPlayerState.Run,   new PlayerRunState());
        this._fsm.addState(EPlayerState.Shoot, new PlayerShootState());
        this._fsm.changeState(EPlayerState.Idle);
    }

    lateUpdate(dt: number) {
        if (!this._entity) return;

        this._ctx.shootCooldown = Math.max(0, this._ctx.shootCooldown - dt);

        if (this._hpLabel) {
            this._hpLabel.string = `${this._playerCombat.currentHp} / ${this._playerCombat.maxHp}`;
        }

        const vel = this._entity.getComponent(VelocityComp)!;
        const act = this._entity.getComponent(ActionComp)!;
        const isMoving = vel.vx !== 0 || vel.vy !== 0;
        const hasTarget = this._findNearestEnemy() !== null;

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

    private _findNearestEnemy(): EnemyControl | null {
        const myPos = this.node.worldPosition;
        const range = this._playerProp.getValue(EPropertyId.AttackRange);
        let best: EnemyControl | null = null;
        let bestDist = Infinity;

        for (const enemy of EnemyControl.allEnemies) {
            if (!enemy.node.isValid || enemy.combat.isDead) continue;
            Vec3.subtract(_tmpVec, enemy.node.worldPosition, myPos);
            const dist = _tmpVec.length();
            if (dist <= range && dist < bestDist) {
                bestDist = dist;
                best = enemy;
            }
        }
        return best;
    }

    onDestroy() {
        if (this._entity && World.inst) {
            World.inst.remove(this._entity);
        }
    }
}
