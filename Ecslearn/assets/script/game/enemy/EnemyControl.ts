import { _decorator, Component, Sprite, SpriteFrame, Node, Vec3, Color,
    UITransform, UIOpacity, Texture2D, ImageAsset, Graphics, Material, EffectAsset,
    RigidBody2D, CircleCollider2D, ERigidBody2DType } from 'cc';
import { EnemyProperty } from './EnemyProperty';
import { EnemyCombat } from './EnemyCombat';
import { EnemyBuffOwner } from './EnemyBuffOwner';
import { EntityBuffMgr } from '../entity/EntityBuffMgr';
import { EnemyAnimation, EEnemyAnim } from './anim/EnemyAnimation';
import { enemyConfig } from './config/enemyConfig';
import { PHY_GROUP } from '../physics/PhysicsGroups';
import { attachColliderDebug } from '../physics/ColliderDebugDraw';
import { EPropertyId } from '../config/enum/propertyEnum';
import { ResourceMgr } from '../../baseSystem/resource';
import { PlayerControl } from '../player/PlayerControl';
import { GameLoop } from '../core/GameLoop';
import { FlashWhite } from '../vfx/FlashWhite';
import { DamagePopupMgr, EDamageStyle } from '../vfx/DamagePopupMgr';

const { ccclass } = _decorator;

const DEG2RAD = Math.PI / 180;

function randRange(min: number, max: number): number {
    return min + Math.random() * (max - min);
}

export enum EMobState {
    Idle,
    Wander,
    Chase,
    WindUp,
    Attack,
    Recovery,
    Dead,
}

let _whiteFrame: SpriteFrame | null = null;
function getWhiteSF(): SpriteFrame {
    if (!_whiteFrame) {
        const size = 4;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, size, size);

        const tex = new Texture2D();
        tex.image = new ImageAsset(canvas as any);
        _whiteFrame = new SpriteFrame();
        _whiteFrame.texture = tex;
        _whiteFrame.packable = false;
    }
    return _whiteFrame;
}

/**
 * Enemy (EnemyControl)
 * ├── Body (Sprite + EnemyAnimation)
 * ├── GroundFX
 * │   ├── DetectionCircle (round.png, teal, opacity 40)
 * │   └── AttackIndicator (rotated toward player)
 * │       ├── OuterFan  Graphics 100° fan, light red
 * │       └── InnerFan  Graphics 100° fan, deep red, scale 0→1
 * └── UIAnchor
 *     └── HpBar
 */
@ccclass('EnemyControl')
export class EnemyControl extends Component {
    private static _all: EnemyControl[] = [];
    static get allEnemies(): readonly EnemyControl[] { return this._all; }

    private _body: Node = null!;
    private _groundFX: Node = null!;
    private _uiAnchor: Node = null!;

    private _prop!: EnemyProperty;
    private _combat!: EnemyCombat;
    private _buffOwner!: EnemyBuffOwner;
    private _buffMgr!: EntityBuffMgr;
    private _anim!: EnemyAnimation;

    private _state = EMobState.Idle;
    private _stateTimer = 0;
    private _hitApplied = false;

    private _indicatorRoot: Node | null = null;
    private _innerFan: Node | null = null;
    private _facingAngle = 0;

    private _idleDuration = 2;
    private _wanderDuration = 1.5;
    private _wanderDx = 0;
    private _wanderDy = 0;

    private _dissolving = false;
    private _dissolveProgress = 0;
    private _dissolveMat: Material | null = null;
    private _flashWhite: FlashWhite | null = null;
    private _xpGranted = false;

    private _hpBarWhiteUt!: UITransform;
    private _hpBarRedUt!: UITransform;
    private _hpDisplayRatio = 1;

    get combat(): EnemyCombat { return this._combat; }
    get prop(): EnemyProperty { return this._prop; }
    get buffOwner(): EnemyBuffOwner { return this._buffOwner; }
    get buffMgr(): EntityBuffMgr { return this._buffMgr; }
    get anim(): EnemyAnimation { return this._anim; }
    get body(): Node { return this._body; }
    get state(): EMobState { return this._state; }

    // ─── Lifecycle ────────────────────────────────────────────

    onLoad() {
        this._body = new Node('Body');
        this.node.addChild(this._body);
        this._body.addComponent(Sprite);
        this._anim = this._body.addComponent(EnemyAnimation);

        this._groundFX = new Node('GroundFX');
        this.node.addChild(this._groundFX);

        this._uiAnchor = new Node('UIAnchor');
        this.node.addChild(this._uiAnchor);

        this._prop = new EnemyProperty();
        this._combat = new EnemyCombat(this._prop);
        this._buffOwner = new EnemyBuffOwner(this._prop, this._combat, `enemy-${this.node.name}`);
        this._buffMgr = new EntityBuffMgr(this._prop);

        this._flashWhite = new FlashWhite(this._body.getComponent(Sprite)!);

        this._setupPhysics();
        this._createHpBar();

        this._idleDuration = randRange(enemyConfig.idleTimeMin, enemyConfig.idleTimeMax);

        EnemyControl._all.push(this);
    }

    start() {
        this._tryCreateDetectionCircle();
    }

    update(dt: number) {
        this._flashWhite?.tick(dt);
        if (this._state === EMobState.Dead) {
            this._tickDead(dt);
            return;
        }
        this._buffMgr.update(dt);
        this._updateState(dt);
        this._updateHpBar(dt);
    }

    /** 受击视觉反馈：闪白 + 飘字 */
    onHitVisual(damage: number, isCrit: boolean): void {
        this._flashWhite?.flash();
        DamagePopupMgr.inst.show(
            this.node.worldPosition,
            damage,
            isCrit ? EDamageStyle.Crit : EDamageStyle.Normal,
        );
    }

    onDestroy() {
        const i = EnemyControl._all.indexOf(this);
        if (i >= 0) EnemyControl._all.splice(i, 1);
    }

    // ─── Physics ──────────────────────────────────────────────

    private _setupPhysics() {
        const rb = this.node.addComponent(RigidBody2D);
        rb.type = ERigidBody2DType.Kinematic;
        rb.allowSleep = false;
        rb.fixedRotation = true;
        rb.group = PHY_GROUP.Enemy;

        const col = this.node.addComponent(CircleCollider2D);
        col.radius = enemyConfig.displayHeight * 0.2;
        col.sensor = true;
        col.group = PHY_GROUP.Enemy;

        attachColliderDebug(this.node);
    }

    // ─── Health Bar ───────────────────────────────────────────

    private _createHpBar() {
        const barNode = new Node('HpBar');
        this._uiAnchor.addChild(barNode);
        barNode.setPosition(0, enemyConfig.displayHeight / 2 + 10, 0);

        const { hpBarWidth: W, hpBarHeight: H } = enemyConfig;
        const sf = getWhiteSF();

        this._makeBarSprite('HpBg', barNode, sf, W, H, new Color(30, 30, 30, 200));

        const whiteNode = this._makeBarSprite('HpWhite', barNode, sf, W, H, new Color(255, 255, 255, 220));
        this._hpBarWhiteUt = whiteNode.getComponent(UITransform)!;

        const redNode = this._makeBarSprite('HpRed', barNode, sf, W, H, new Color(220, 40, 40, 255));
        this._hpBarRedUt = redNode.getComponent(UITransform)!;
    }

    private _makeBarSprite(name: string, parent: Node, sf: SpriteFrame, w: number, h: number, color: Color): Node {
        const nd = new Node(name);
        parent.addChild(nd);
        nd.setPosition(-w / 2, 0, 0);

        const ut = nd.addComponent(UITransform);
        ut.setContentSize(w, h);
        ut.setAnchorPoint(0, 0.5);

        const sp = nd.addComponent(Sprite);
        sp.sizeMode = Sprite.SizeMode.CUSTOM;
        sp.spriteFrame = sf;
        sp.color = color;

        return nd;
    }

    private _updateHpBar(dt: number) {
        const ratio = Math.max(0, this._combat.currentHp / this._combat.maxHp);
        const { hpBarWidth: W, hpBarHeight: H } = enemyConfig;

        this._hpBarRedUt.setContentSize(W * ratio, H);

        if (this._hpDisplayRatio > ratio) {
            this._hpDisplayRatio = Math.max(ratio, this._hpDisplayRatio - 0.8 * dt);
        } else {
            this._hpDisplayRatio = ratio;
        }
        this._hpBarWhiteUt.setContentSize(W * this._hpDisplayRatio, H);
    }

    // ─── Detection Circle ─────────────────────────────────────

    private _tryCreateDetectionCircle() {
        if (!GameLoop.resourcesReady) {
            this.scheduleOnce(() => this._tryCreateDetectionCircle(), 0.1);
            return;
        }
        const tex = ResourceMgr.inst.get<Texture2D>(`${enemyConfig.rangeTexture}/texture`);
        if (!tex) return;

        const nd = new Node('DetectionCircle');
        this._groundFX.addChild(nd);

        const diameter = enemyConfig.detectionRange * 2;
        const ut = nd.addComponent(UITransform);
        ut.setContentSize(diameter, diameter);

        const sp = nd.addComponent(Sprite);
        sp.sizeMode = Sprite.SizeMode.CUSTOM;
        sp.color = new Color(60, 200, 200, 255);

        const sf = new SpriteFrame();
        sf.texture = tex;
        sp.spriteFrame = sf;

        nd.addComponent(UIOpacity).opacity = 40;
    }

    // ─── Attack Fan Indicator (Graphics) ──────────────────────

    private _showAttackFan() {
        if (this._indicatorRoot) return;

        const player = PlayerControl.instance;
        if (!player) return;

        const root = new Node('AttackIndicator');
        this._groundFX.addChild(root);

        const dx = player.node.worldPosition.x - this.node.worldPosition.x;
        const dy = player.node.worldPosition.y - this.node.worldPosition.y;
        this._facingAngle = Math.atan2(dy, dx);
        root.setRotationFromEuler(0, 0, this._facingAngle / DEG2RAD);

        const radius = enemyConfig.attackRange;
        const halfAngle = enemyConfig.attackAngle * 0.5 * DEG2RAD;

        const outer = new Node('OuterFan');
        root.addChild(outer);
        const og = outer.addComponent(Graphics);
        og.fillColor = new Color(255, 60, 60, 80);
        this._drawFanPath(og, radius, halfAngle);
        og.fill();

        const inner = new Node('InnerFan');
        root.addChild(inner);
        const ig = inner.addComponent(Graphics);
        ig.fillColor = new Color(200, 20, 20, 160);
        this._drawFanPath(ig, radius, halfAngle);
        ig.fill();
        inner.setScale(0.05, 0.05, 1);

        this._indicatorRoot = root;
        this._innerFan = inner;
    }

    private _drawFanPath(g: Graphics, radius: number, halfAngleRad: number) {
        g.moveTo(0, 0);
        g.arc(0, 0, radius, -halfAngleRad, halfAngleRad, true);
        g.lineTo(0, 0);
        g.close();
    }

    private _hideAttackFan() {
        if (!this._indicatorRoot) return;
        this._indicatorRoot.destroy();
        this._indicatorRoot = null;
        this._innerFan = null;
    }

    // ─── Fan Hit Detection ────────────────────────────────────

    private _isInFan(target: Node, angleDeg: number): boolean {
        const dx = target.worldPosition.x - this.node.worldPosition.x;
        const dy = target.worldPosition.y - this.node.worldPosition.y;
        const toTarget = Math.atan2(dy, dx);

        let diff = toTarget - this._facingAngle;
        if (diff > Math.PI) diff -= Math.PI * 2;
        if (diff < -Math.PI) diff += Math.PI * 2;

        return Math.abs(diff) <= angleDeg * 0.5 * DEG2RAD;
    }

    // ─── State Machine ────────────────────────────────────────

    private _enterState(next: EMobState) {
        const prev = this._state;
        if (prev === EMobState.WindUp || prev === EMobState.Attack) {
            if (next !== EMobState.Attack) this._hideAttackFan();
        }

        this._state = next;
        this._stateTimer = 0;

        switch (next) {
            case EMobState.Idle:
                this._idleDuration = randRange(enemyConfig.idleTimeMin, enemyConfig.idleTimeMax);
                this._anim.play(EEnemyAnim.Idle);
                break;

            case EMobState.Wander: {
                this._wanderDuration = randRange(enemyConfig.wanderTimeMin, enemyConfig.wanderTimeMax);
                const angle = Math.random() * Math.PI * 2;
                this._wanderDx = Math.cos(angle);
                this._wanderDy = Math.sin(angle);
                this._anim.play(EEnemyAnim.Run);
                if (this._wanderDx !== 0) {
                    this._body.setScale(this._wanderDx < 0 ? -1 : 1, 1, 1);
                }
                break;
            }

            case EMobState.Chase:
                this._anim.play(EEnemyAnim.Run);
                break;

            case EMobState.WindUp: {
                this._anim.play(EEnemyAnim.Idle);
                this._showAttackFan();
                const player = PlayerControl.instance;
                if (player) this._faceTarget(player.node);
                break;
            }

            case EMobState.Attack:
                this._hitApplied = false;
                this._anim.playOnce(EEnemyAnim.Attack, () => {
                    if (this._state === EMobState.Attack) {
                        this._enterState(EMobState.Recovery);
                    }
                });
                break;

            case EMobState.Recovery:
                this._anim.play(EEnemyAnim.Idle);
                break;

            case EMobState.Dead: {
                this._hideAttackFan();
                this._uiAnchor.active = false;
                this._groundFX.active = false;
                this._anim.playOnce(EEnemyAnim.Die, () => this._startDissolve());
                if (!this._xpGranted) {
                    this._xpGranted = true;
                    PlayerControl.instance?.grantXp(enemyConfig.xpReward);
                }
                break;
            }
        }
    }

    private _updateState(dt: number) {
        const player = PlayerControl.instance;
        if (!player || player.combat.isDead) return;

        if (this._combat.isDead && this._state !== EMobState.Dead) {
            this._enterState(EMobState.Dead);
            return;
        }

        this._stateTimer += dt;

        switch (this._state) {
            case EMobState.Idle:     this._tickIdle(player);        break;
            case EMobState.Wander:   this._tickWander(player, dt);  break;
            case EMobState.Chase:    this._tickChase(player, dt);   break;
            case EMobState.WindUp:   this._tickWindUp();            break;
            case EMobState.Attack:   this._tickAttack(player);      break;
            case EMobState.Recovery: this._tickRecovery();          break;
        }
    }

    private _tickIdle(player: PlayerControl) {
        if (this._distTo(player.node) < enemyConfig.detectionRange) {
            this._enterState(EMobState.Chase);
            return;
        }
        if (this._stateTimer >= this._idleDuration) {
            this._enterState(EMobState.Wander);
        }
    }

    private _tickWander(player: PlayerControl, dt: number) {
        if (this._distTo(player.node) < enemyConfig.detectionRange) {
            this._enterState(EMobState.Chase);
            return;
        }
        if (this._stateTimer >= this._wanderDuration) {
            this._enterState(EMobState.Idle);
            return;
        }
        const speed = this._prop.getValue(EPropertyId.MoveSpeed) * enemyConfig.wanderSpeedRatio;
        const lPos = this.node.position;
        this.node.setPosition(
            lPos.x + this._wanderDx * speed * dt,
            lPos.y + this._wanderDy * speed * dt,
            lPos.z,
        );
    }

    private _tickChase(player: PlayerControl, dt: number) {
        const dist = this._distTo(player.node);

        if (dist <= enemyConfig.attackRange) {
            this._enterState(EMobState.WindUp);
            return;
        }
        if (dist > enemyConfig.detectionRange * 1.5) {
            this._enterState(EMobState.Idle);
            return;
        }

        this._moveToward(player.node.worldPosition, dt);
    }

    private _tickWindUp() {
        if (this._innerFan) {
            const t = Math.min(this._stateTimer / enemyConfig.attackWindUp, 1);
            this._innerFan.setScale(t, t, 1);
        }

        if (this._stateTimer >= enemyConfig.attackWindUp) {
            this._enterState(EMobState.Attack);
        }
    }

    private _tickAttack(player: PlayerControl) {
        if (this._hitApplied) return;

        if (this._anim.animator.frameIndex >= enemyConfig.attackHitFrame) {
            this._hitApplied = true;
            const inRange = this._distTo(player.node) <= enemyConfig.attackRange * 1.3;
            const inFan = this._isInFan(player.node, enemyConfig.attackAngle);
            if (inRange && inFan) {
                const dmg = this._prop.getValue(EPropertyId.Attack);
                player.applyDamage(dmg);
            }
        }
    }

    private _tickRecovery() {
        if (this._stateTimer >= enemyConfig.attackCooldown) {
            this._enterState(EMobState.Idle);
        }
    }

    // ─── Death / Dissolve ──────────────────────────────────────

    private _startDissolve() {
        if (this._dissolving) return;

        const effect = ResourceMgr.inst.get<EffectAsset>('shader/dissolve');
        const noiseTex = ResourceMgr.inst.get<Texture2D>(`${enemyConfig.noiseTexture}/texture`);
        if (!effect || !noiseTex) {
            this.node.destroy();
            return;
        }

        const mat = new Material();
        mat.initialize({ effectAsset: effect, technique: 0 });
        mat.setProperty('noiseTexture', noiseTex);
        mat.setProperty('dissolveThreshold', 0);

        const sprite = this._body.getComponent(Sprite)!;
        sprite.customMaterial = mat;

        this._dissolveMat = mat;
        this._dissolving = true;
        this._dissolveProgress = 0;
    }

    private _tickDead(dt: number) {
        this._stateTimer += dt;

        if (!this._dissolving) {
            if (this._stateTimer > 2) this._startDissolve();
            return;
        }

        this._dissolveProgress += dt / enemyConfig.dissolveTime;
        if (this._dissolveProgress >= 1) {
            this.node.destroy();
            return;
        }
        this._dissolveMat!.setProperty('dissolveThreshold', this._dissolveProgress);
    }

    // ─── Movement ─────────────────────────────────────────────

    private _moveToward(target: Readonly<Vec3>, dt: number) {
        const wPos = this.node.worldPosition;
        const dx = target.x - wPos.x;
        const dy = target.y - wPos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 1) return;

        const speed = this._prop.getValue(EPropertyId.MoveSpeed);
        const step = Math.min(speed * dt, dist);
        const nx = dx / dist;
        const ny = dy / dist;

        const lPos = this.node.position;
        this.node.setPosition(lPos.x + nx * step, lPos.y + ny * step, lPos.z);

        if (dx !== 0) {
            this._body.setScale(dx < 0 ? -1 : 1, 1, 1);
        }
    }

    private _faceTarget(target: Node) {
        const dx = target.worldPosition.x - this.node.worldPosition.x;
        if (dx !== 0) this._body.setScale(dx < 0 ? -1 : 1, 1, 1);
    }

    private _distTo(node: Node): number {
        return Vec3.distance(this.node.worldPosition, node.worldPosition);
    }
}
