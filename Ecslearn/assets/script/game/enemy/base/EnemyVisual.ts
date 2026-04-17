import { Node, Color, Sprite, SpriteFrame, UITransform, UIOpacity,
    Texture2D, ImageAsset, Graphics, Material, EffectAsset } from 'cc';
import type { EnemyCombat } from '../EnemyCombat';
import { enemyResConfig } from '../config/enemyResConfig';
import { ResourceMgr } from '../../../baseSystem/resource';
import { GameLoop } from '../../core/GameLoop';

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

export class EnemyVisual {
    private _indicatorRoot: Node | null = null;
    private _innerIndicator: Node | null = null;

    private _hpBarWhiteUt!: UITransform;
    private _hpBarRedUt!: UITransform;
    private _hpDisplayRatio = 1;

    private _dissolving = false;
    private _dissolveProgress = 0;
    private _dissolveDelay = 2;
    private _dissolveMat: Material | null = null;

    get indicatorInner(): Node | null { return this._innerIndicator; }
    get dissolving(): boolean { return this._dissolving; }
    get dissolveDelay(): number { return this._dissolveDelay; }
    set dissolveDelay(v: number) { this._dissolveDelay = v; }

    // ─── HP Bar ──────────────────────────────────────────

    createHpBar(uiAnchor: Node, displayHeight: number): void {
        const barNode = new Node('HpBar');
        uiAnchor.addChild(barNode);
        barNode.setPosition(0, displayHeight / 2 + 10, 0);

        const { hpBarWidth: W, hpBarHeight: H } = enemyResConfig;
        const sf = getWhiteSF();

        this._makeBarSprite('HpBg', barNode, sf, W, H, new Color(30, 30, 30, 200));

        const whiteNode = this._makeBarSprite('HpWhite', barNode, sf, W, H, new Color(255, 255, 255, 220));
        this._hpBarWhiteUt = whiteNode.getComponent(UITransform)!;

        const redNode = this._makeBarSprite('HpRed', barNode, sf, W, H, new Color(220, 40, 40, 255));
        this._hpBarRedUt = redNode.getComponent(UITransform)!;
    }

    updateHpBar(combat: EnemyCombat, dt: number): void {
        const ratio = Math.max(0, combat.currentHp / combat.maxHp);
        const { hpBarWidth: W, hpBarHeight: H } = enemyResConfig;

        this._hpBarRedUt.setContentSize(W * ratio, H);

        if (this._hpDisplayRatio > ratio) {
            this._hpDisplayRatio = Math.max(ratio, this._hpDisplayRatio - 0.8 * dt);
        } else {
            this._hpDisplayRatio = ratio;
        }
        this._hpBarWhiteUt.setContentSize(W * this._hpDisplayRatio, H);
    }

    private _makeBarSprite(name: string, parent: Node, sf: SpriteFrame,
        w: number, h: number, color: Color): Node {
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

    // ─── Detection Circle ────────────────────────────────

    tryCreateDetectionCircle(
        groundFX: Node, detectionRange: number,
        scheduleRetry: (cb: () => void, delay: number) => void,
    ): void {
        if (!GameLoop.resourcesReady) {
            scheduleRetry(() => this.tryCreateDetectionCircle(groundFX, detectionRange, scheduleRetry), 0.1);
            return;
        }
        const tex = ResourceMgr.inst.get<Texture2D>(`${enemyResConfig.rangeTexture}/texture`);
        if (!tex) return;

        const nd = new Node('DetectionCircle');
        groundFX.addChild(nd);

        const diameter = detectionRange * 2;
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

    // ─── Attack Indicator ────────────────────────────────

    showIndicator(
        groundFX: Node,
        radius: number,
        facingAngle: number,
        needsRotation: boolean,
        drawFn: (g: Graphics, r: number) => void,
    ): void {
        this.hideIndicator();

        const DEG2RAD = Math.PI / 180;
        const root = new Node('AttackIndicator');
        groundFX.addChild(root);

        if (needsRotation) {
            root.setRotationFromEuler(0, 0, facingAngle / DEG2RAD);
        }

        const outer = new Node('OuterFan');
        root.addChild(outer);
        const og = outer.addComponent(Graphics);
        og.fillColor = new Color(255, 60, 60, 80);
        drawFn(og, radius);
        og.fill();

        const inner = new Node('InnerFan');
        root.addChild(inner);
        const ig = inner.addComponent(Graphics);
        ig.fillColor = new Color(200, 20, 20, 160);
        drawFn(ig, radius);
        ig.fill();
        inner.setScale(0.05, 0.05, 1);

        this._indicatorRoot = root;
        this._innerIndicator = inner;
    }

    hideIndicator(): void {
        if (!this._indicatorRoot) return;
        this._indicatorRoot.destroy();
        this._indicatorRoot = null;
        this._innerIndicator = null;
    }

    scaleInner(sx: number, sy = sx): void {
        this._innerIndicator?.setScale(sx, sy, 1);
    }

    // ─── Dissolve ────────────────────────────────────────

    startDissolve(body: Node): boolean {
        if (this._dissolving) return true;

        const effect = ResourceMgr.inst.get<EffectAsset>('shader/dissolve');
        const noiseTex = ResourceMgr.inst.get<Texture2D>(`${enemyResConfig.noiseTexture}/texture`);
        if (!effect || !noiseTex) return false;

        const mat = new Material();
        mat.initialize({ effectAsset: effect, technique: 0 });
        mat.setProperty('noiseTexture', noiseTex);
        mat.setProperty('dissolveThreshold', 0);

        const sprite = body.getComponent(Sprite)!;
        sprite.customMaterial = mat;

        this._dissolveMat = mat;
        this._dissolving = true;
        this._dissolveProgress = 0;
        return true;
    }

    tickDissolve(dt: number): boolean {
        this._dissolveProgress += dt / enemyResConfig.dissolveTime;
        if (this._dissolveProgress >= 1) return true;
        this._dissolveMat!.setProperty('dissolveThreshold', this._dissolveProgress);
        return false;
    }
}
