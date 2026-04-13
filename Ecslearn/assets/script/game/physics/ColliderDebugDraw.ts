import { Node, UITransform, Graphics, Color, CircleCollider2D, BoxCollider2D } from 'cc';

const DBG_NAME = '__dbg_col__';

let _enabled = true;

/** 全局开关：关闭后新创建的实体不再附加调试形状 */
export function setColliderDebugEnabled(v: boolean) { _enabled = v; }
export function isColliderDebugEnabled(): boolean { return _enabled; }

/**
 * 在 target 节点下创建一个半透明子节点，形状匹配 CircleCollider2D 或 BoxCollider2D。
 * 幂等：多次调用只创建一次。
 */
export function attachColliderDebug(
    target: Node,
    debugColor: Color = new Color(0, 255, 0, 128),
): Node | null {
    if (!_enabled) return null;

    const circleCol = target.getComponent(CircleCollider2D);
    const boxCol = target.getComponent(BoxCollider2D);
    if (!circleCol && !boxCol) return null;

    let dn = target.getChildByName(DBG_NAME);
    if (dn) return dn;

    dn = new Node(DBG_NAME);
    target.addChild(dn);
    dn.addComponent(UITransform);

    const g = dn.addComponent(Graphics);
    const stroke = new Color(debugColor.r, debugColor.g, debugColor.b, 255);

    if (circleCol) {
        const ox = circleCol.offset.x;
        const oy = circleCol.offset.y;
        const r  = circleCol.radius;

        g.fillColor = debugColor;
        g.circle(ox, oy, r);
        g.fill();

        g.strokeColor = stroke;
        g.lineWidth = 1.5;
        g.circle(ox, oy, r);
        g.stroke();
    } else if (boxCol) {
        const ox = boxCol.offset.x;
        const oy = boxCol.offset.y;
        const w  = boxCol.size.width;
        const h  = boxCol.size.height;

        g.fillColor = debugColor;
        g.rect(ox - w / 2, oy - h / 2, w, h);
        g.fill();

        g.strokeColor = stroke;
        g.lineWidth = 1.5;
        g.rect(ox - w / 2, oy - h / 2, w, h);
        g.stroke();
    }

    return dn;
}

/** 移除调试可视化 */
export function removeColliderDebug(target: Node): void {
    const dn = target.getChildByName(DBG_NAME);
    if (dn?.isValid) dn.destroy();
}
