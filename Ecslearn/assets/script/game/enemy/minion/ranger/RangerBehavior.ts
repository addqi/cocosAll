import { Node, Graphics, Color, Vec3 } from 'cc';
import { enemyBehavior } from '../../../../baseSystem/enemy';
import { enemyConfig } from '../../config/enemyConfig';
import type { EnemyConfigData } from '../../config/enemyConfig';
import type { PropertyBaseConfig } from '../../../entity/EntityPropertyMgr';
import { EPropertyId } from '../../../config/enum/propertyEnum';
import { getEnemyData } from '../../../../config/enemyConfig';
import { PlayerControl } from '../../../player/PlayerControl';
import { ProjectilePool } from '../../../projectile/ProjectilePool';
import { EnemyArrow } from '../../projectile/EnemyArrow';
import { MinionBehavior } from '../MinionBehavior';
import type { IMinionCtx } from '../MinionContext';

const THIN_W = 6;
const WIDE_W = 40;
const DEG2RAD = Math.PI / 180;

interface RangerIndicatorHandle {
    root: Node;
    outer: Node;
    inner: Node;
}

const _data = getEnemyData('ranger');

@enemyBehavior
export class RangerBehavior extends MinionBehavior {
    readonly typeId = 'ranger';
    readonly config: EnemyConfigData = { ...enemyConfig, ..._data.overrides };
    readonly propertyCfg: PropertyBaseConfig = _data.properties;

    // ─── 指示器钩子 ──────────────────────────────

    createIndicator(ctx: IMinionCtx): void {
        this.destroyIndicator(ctx);

        const root = new Node('RangerBeam');
        ctx.groundFX.addChild(root);
        root.setRotationFromEuler(0, 0, ctx.facingAngle / DEG2RAD);

        const player = PlayerControl.instance;
        const dist = player
            ? Vec3.distance(ctx.node.worldPosition, player.node.worldPosition)
            : this.config.attackRange;

        const outer = this._makeBeamNode('Outer', root,
            new Color(255, 60, 60, 80), dist, THIN_W);
        const inner = this._makeBeamNode('Inner', root,
            new Color(200, 20, 20, 160), dist, WIDE_W);

        ctx.indicatorHandle = { root, outer, inner } as RangerIndicatorHandle;
    }

    tickIndicator(ctx: IMinionCtx, t: number): void {
        const h = ctx.indicatorHandle as RangerIndicatorHandle | undefined;
        if (!h) return;

        const player = PlayerControl.instance;
        if (!player) return;

        const dx = player.node.worldPosition.x - ctx.node.worldPosition.x;
        const dy = player.node.worldPosition.y - ctx.node.worldPosition.y;
        const angle = Math.atan2(dy, dx);
        const dist = Math.sqrt(dx * dx + dy * dy);

        ctx.facingAngle = angle;
        h.root.setRotationFromEuler(0, 0, angle / DEG2RAD);

        h.outer.setScale(dist, THIN_W, 1);
        const currentW = WIDE_W + (THIN_W - WIDE_W) * t;
        h.inner.setScale(dist, currentW, 1);
    }

    destroyIndicator(ctx: IMinionCtx): void {
        const h = ctx.indicatorHandle as RangerIndicatorHandle | undefined;
        if (h) {
            h.root.destroy();
            ctx.indicatorHandle = undefined;
        }
    }

    onAttackFrame(ctx: IMinionCtx): void {
        this._fireArrow(ctx);
    }

    // ─── 内部工具 ────────────────────────────────

    private _makeBeamNode(
        name: string, parent: Node, color: Color,
        scaleX: number, scaleY: number,
    ): Node {
        const nd = new Node(name);
        parent.addChild(nd);

        const g = nd.addComponent(Graphics);
        g.fillColor = color;
        g.rect(0, -0.5, 1, 1);
        g.fill();

        nd.setScale(scaleX, scaleY, 1);
        return nd;
    }

    private _fireArrow(ctx: IMinionCtx): void {
        const arrowNode = ProjectilePool.acquire();
        let arrow = arrowNode.getComponent(EnemyArrow);
        if (!arrow) arrow = arrowNode.addComponent(EnemyArrow);

        const pos = ctx.node.worldPosition;
        const dmg = ctx.prop.getValue(EPropertyId.Attack);
        arrow.init(pos.x, pos.y, ctx.facingAngle, dmg);
    }
}
