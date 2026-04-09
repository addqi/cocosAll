import { Color, Label, Node, Sprite, SpriteFrame, UITransform, view } from 'cc';
import { ToolType, ToolDefs } from '../../config/ToolConfig';
import { ToolState } from '../../core/tool/ToolState';

const TOOL_SIZE = 120;
const TOOL_GAP = 40;
const BADGE_SIZE = 36;
const TOOL_COLORS: Record<number, Color> = {
    [ToolType.MagicWand]: new Color(156, 39, 176, 255),
    [ToolType.Bomb]:      new Color(244, 67, 54, 255),
    [ToolType.Magnifier]: new Color(33, 150, 243, 255),
};

export interface ToolPanelHandle {
    node: Node;
    hitTest(localX: number, localY: number): ToolType;
}

/**
 * 道具面板：纯视觉 + hitTest，不含 Button / 触摸监听。
 * 点击判定由 PaletteInstaller 统一处理。
 */
export class ToolPanel {

    static create(
        toolState: ToolState,
        itemSprite: SpriteFrame,
        barH: number,
    ): ToolPanelHandle {
        const root = new Node('ToolPanel');
        const viewW = view.getVisibleSize().width;
        root.addComponent(UITransform).setContentSize(viewW, barH);

        const totalW = ToolDefs.length * TOOL_SIZE + (ToolDefs.length - 1) * TOOL_GAP;
        const startX = -totalW / 2 + TOOL_SIZE / 2;

        const items: { node: Node; badgeLabel: Label; ringNode: Node; type: ToolType }[] = [];

        for (let i = 0; i < ToolDefs.length; i++) {
            const def = ToolDefs[i];
            const x = startX + i * (TOOL_SIZE + TOOL_GAP);

            const item = new Node(`Tool_${def.name}`);
            root.addChild(item);
            item.setPosition(x, 0, 0);
            item.addComponent(UITransform).setContentSize(TOOL_SIZE + 16, TOOL_SIZE + 16);

            const ring = new Node('Ring');
            item.addChild(ring);
            ring.addComponent(UITransform).setContentSize(TOOL_SIZE + 12, TOOL_SIZE + 12);
            const ringSp = ring.addComponent(Sprite);
            ringSp.sizeMode = Sprite.SizeMode.CUSTOM;
            ringSp.spriteFrame = itemSprite;
            ringSp.color = new Color(255, 193, 7, 255);
            ring.active = false;

            const bg = new Node('Bg');
            item.addChild(bg);
            bg.addComponent(UITransform).setContentSize(TOOL_SIZE, TOOL_SIZE);
            const bgSp = bg.addComponent(Sprite);
            bgSp.sizeMode = Sprite.SizeMode.CUSTOM;
            bgSp.spriteFrame = itemSprite;
            bgSp.color = (TOOL_COLORS[def.type] ?? new Color(100, 100, 100, 255)).clone();

            const labNode = new Node('Label');
            item.addChild(labNode);
            labNode.addComponent(UITransform).setContentSize(TOOL_SIZE, TOOL_SIZE);
            const lab = labNode.addComponent(Label);
            lab.string = def.name;
            lab.fontSize = 22;
            lab.horizontalAlign = Label.HorizontalAlign.CENTER;
            lab.verticalAlign = Label.VerticalAlign.CENTER;
            lab.color = Color.WHITE;

            const badge = this._createBadge(item, toolState.getCount(def.type));

            items.push({ node: item, badgeLabel: badge, ringNode: ring, type: def.type });
        }

        toolState.onChanged = () => {
            for (let i = 0; i < ToolDefs.length; i++) {
                const def = ToolDefs[i];
                const it = items[i];
                const count = toolState.getCount(def.type);
                it.badgeLabel.string = String(count);
                const bg = it.node.getChildByName('Bg')!.getComponent(Sprite)!;
                bg.color = count <= 0
                    ? new Color(180, 180, 180, 255)
                    : (TOOL_COLORS[def.type] ?? new Color(100, 100, 100, 255)).clone();
                it.ringNode.active = toolState.activeType === def.type;
            }
        };

        const hitTest = (localX: number, localY: number): ToolType => {
            for (const it of items) {
                const p = it.node.position;
                const ut = it.node.getComponent(UITransform)!;
                const hw = ut.width * 0.5;
                const hh = ut.height * 0.5;
                if (localX >= p.x - hw && localX <= p.x + hw &&
                    localY >= p.y - hh && localY <= p.y + hh) {
                    return it.type;
                }
            }
            return ToolType.None;
        };

        return { node: root, hitTest };
    }

    private static _createBadge(parent: Node, count: number): Label {
        const badge = new Node('Badge');
        parent.addChild(badge);
        badge.setPosition(TOOL_SIZE / 2 - 4, TOOL_SIZE / 2 - 4, 0);
        badge.addComponent(UITransform).setContentSize(BADGE_SIZE, BADGE_SIZE);
        const sp = badge.addComponent(Sprite);
        sp.sizeMode = Sprite.SizeMode.CUSTOM;
        sp.color = new Color(244, 67, 54, 255);

        const labNode = new Node('Num');
        badge.addChild(labNode);
        labNode.addComponent(UITransform).setContentSize(BADGE_SIZE, BADGE_SIZE);
        const lab = labNode.addComponent(Label);
        lab.string = String(count);
        lab.fontSize = 20;
        lab.horizontalAlign = Label.HorizontalAlign.CENTER;
        lab.verticalAlign = Label.VerticalAlign.CENTER;
        lab.color = Color.WHITE;
        return lab;
    }
}
