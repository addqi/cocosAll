import { Node, Sprite, SpriteFrame, Texture2D, UITransform, Vec3 } from 'cc';
import { ResourceMgr } from '../../baseSystem/resource';
import {
    allSpriteAssetDefs,
    getSpriteAssetDef,
    type SpriteAssetDef,
} from '../config/spriteAssetConfig/SpriteAssetLoader';

/**
 * 通用图片节点工厂 + 对象池
 *
 * Layer 1（纯视觉）：
 *   - 输入：id（如 'coin' / 'gem'），世界坐标
 *   - 输出：一个挂好 Sprite + UITransform 的节点
 *   - 不知道也不关心这个节点"是什么业务"
 *
 * Layer 2 业务脚本（CoinEntity / GemEntity 等）由调用方自己 addComponent，
 * 本工厂只负责"图片 → 节点"这一层抽象。
 *
 * 对象池按 id 分组：不同资源共享同一个工厂，但各自的节点池互不混用
 * —— 金币池里的节点永远是金币节点，不会被宝石复用导致 Sprite 错乱。
 *
 * 超限策略（来自配置表）：
 *   'drop'     —— 超限时 acquire 返回 null，丢弃本次请求
 *   'compact'  —— 把最早的若干个物件合并回收一轮（交给上层业务语义，工厂不合并）
 *                 当前默认等同于 drop；需要真正的合并语义请在业务层（如 CoinFactory）自己实现
 */
export class SpriteNodeFactory {

    private static _rootLayer: Node | null = null;
    private static _pools = new Map<string, SpritePool>();

    /** GameBootstrap 调一次 */
    static init(parentRoot: Node): void {
        if (this._rootLayer) return;

        const root = new Node('SpriteNodeFactoryRoot');
        parentRoot.addChild(root);
        this._rootLayer = root;

        // 为每个已登记的资源建"SpriteFrame + layer 节点 + 空池"
        for (const def of allSpriteAssetDefs()) {
            const pool = this._createPool(def);
            if (pool) this._pools.set(def.id, pool);
        }
    }

    static isReady(id?: string): boolean {
        if (!this._rootLayer) return false;
        if (id === undefined) return true;
        return this._pools.has(id);
    }

    /**
     * 取一个节点（已挂 Sprite + UITransform，位置已设置）
     * 节点尚未挂任何业务 Component —— 调用方按需 addComponent 自己的行为脚本
     */
    static acquire(id: string, worldPos: Readonly<Vec3>): Node | null {
        const pool = this._pools.get(id);
        if (!pool) {
            console.error(`[SpriteNodeFactory] 未知资源 id: "${id}"。请确认 spriteAssets.json 有对应条目。`);
            return null;
        }

        const def = pool.def;
        if (def.maxActive !== undefined && pool.active.length >= def.maxActive) {
            // 默认 drop 策略：不吐新节点
            // compact 策略的"合并"逻辑与业务语义强耦合（如金币合并面值），
            // 工厂层无法做通用处理，交给业务层在 acquire 失败时自行降级。
            return null;
        }

        const node = pool.free.pop() ?? this._createNode(pool);
        node.active = true;
        pool.layer.addChild(node);
        node.setWorldPosition(worldPos.x, worldPos.y, worldPos.z);
        pool.active.push(node);
        return node;
    }

    static release(id: string, node: Node): void {
        const pool = this._pools.get(id);
        if (!pool) return;

        const i = pool.active.indexOf(node);
        if (i >= 0) pool.active.splice(i, 1);
        if (!node || !node.isValid) return;
        node.active = false;
        node.removeFromParent();
        pool.free.push(node);
    }

    static activeCount(id: string): number {
        return this._pools.get(id)?.active.length ?? 0;
    }

    static activeNodes(id: string): readonly Node[] {
        return this._pools.get(id)?.active ?? [];
    }

    /** 指定 id 的池整个清空（在场／闲置节点全销毁） */
    static clear(id: string): void {
        const pool = this._pools.get(id);
        if (!pool) return;
        for (const n of pool.active) if (n.isValid) n.destroy();
        pool.active.length = 0;
        for (const n of pool.free) if (n.isValid) n.destroy();
        pool.free.length = 0;
    }

    /** 所有 id 的池一起清 */
    static clearAll(): void {
        for (const id of this._pools.keys()) this.clear(id);
    }

    // ─── 内部 ────────────────────────────────────────────

    private static _createPool(def: SpriteAssetDef): SpritePool | null {
        const tex = ResourceMgr.inst.get<Texture2D>(def.texturePath);
        if (!tex) {
            console.error(
                `[SpriteNodeFactory] "${def.id}" texture 未预加载，path=${def.texturePath}`,
            );
            return null;
        }
        const frame = new SpriteFrame();
        frame.texture = tex;

        const layer = new Node(`Layer_${def.id}`);
        this._rootLayer!.addChild(layer);

        return { def, frame, layer, free: [], active: [] };
    }

    private static _createNode(pool: SpritePool): Node {
        const def = pool.def;
        const node = new Node(def.id);

        const ut = node.addComponent(UITransform);
        ut.setContentSize(def.displayWidth, def.displayHeight);

        const sp = node.addComponent(Sprite);
        sp.sizeMode = Sprite.SizeMode.CUSTOM;
        sp.spriteFrame = pool.frame;

        return node;
    }
}

interface SpritePool {
    readonly def: SpriteAssetDef;
    readonly frame: SpriteFrame;
    readonly layer: Node;
    readonly free: Node[];
    readonly active: Node[];
}

// 重新 export 给业务层一个便捷 getter，避免绕 loader
export { getSpriteAssetDef };
