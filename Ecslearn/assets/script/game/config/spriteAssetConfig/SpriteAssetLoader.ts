/**
 * 图片资源配置加载器
 *
 * 职责：
 *   - 读取 spriteAssets.json，把"id → {texturePath / 尺寸 / 池策略}"映射到 Map
 *   - 启动时全量校验，非法字段立即抛错并定位到 id
 *
 * 加一张新图片资源的完整流程（零代码改动）：
 *   1. 图片放入 assets/resources/xxx.png（Cocos Creator 自动生成 /texture 子资源）
 *   2. 在 spriteAssets.json 追加一条 "xxx": { ... }
 *   3. 运行时 SpriteNodeFactory.acquire('xxx', pos) 即可拿到节点
 *
 * 业务行为脚本（CoinEntity / GemEntity 等）属于 Layer 2，不在本 loader 范畴。
 */
import rawDefs from './spriteAssets.json';

export type SpriteOverflowStrategy = 'drop' | 'compact';

export interface SpriteAssetDef {
    /** JSON 的 key 注入，作为唯一 id */
    readonly id: string;
    /** 调试/日志友好名（如 "金币"），不参与业务 */
    readonly name: string;
    /** resources 下的 Texture2D 路径，必须带 /texture 后缀 */
    readonly texturePath: string;
    /** 世界空间显示宽度（px）*/
    readonly displayWidth: number;
    /** 世界空间显示高度（px）*/
    readonly displayHeight: number;
    /** 对象池并发上限；不填 = 无限 */
    readonly maxActive?: number;
    /** 超限策略；不填 = 'drop'（新请求被拒）*/
    readonly onOverflow?: SpriteOverflowStrategy;
}

const VALID_OVERFLOW: ReadonlySet<SpriteOverflowStrategy> = new Set<SpriteOverflowStrategy>([
    'drop',
    'compact',
]);

const _defs: Map<string, SpriteAssetDef> = (() => {
    const m = new Map<string, SpriteAssetDef>();
    const raw = rawDefs as Record<string, unknown>;
    for (const id of Object.keys(raw)) {
        m.set(id, _validate(id, raw[id]));
    }
    return m;
})();

function _validate(id: string, raw: unknown): SpriteAssetDef {
    if (!raw || typeof raw !== 'object') {
        throw new Error(`[SpriteAssetLoader] "${id}" 必须是对象`);
    }
    const r = raw as Record<string, unknown>;

    if (typeof r.name !== 'string' || r.name.length === 0) {
        throw new Error(`[SpriteAssetLoader] "${id}" 缺少 name (string)`);
    }
    if (typeof r.texturePath !== 'string' || r.texturePath.length === 0) {
        throw new Error(`[SpriteAssetLoader] "${id}" 缺少 texturePath (string)`);
    }
    if (typeof r.displayWidth !== 'number' || r.displayWidth <= 0) {
        throw new Error(`[SpriteAssetLoader] "${id}" displayWidth 必须 > 0`);
    }
    if (typeof r.displayHeight !== 'number' || r.displayHeight <= 0) {
        throw new Error(`[SpriteAssetLoader] "${id}" displayHeight 必须 > 0`);
    }
    if (r.maxActive !== undefined
        && (typeof r.maxActive !== 'number' || r.maxActive < 0 || !Number.isFinite(r.maxActive))) {
        throw new Error(`[SpriteAssetLoader] "${id}" maxActive 必须是非负数`);
    }
    if (r.onOverflow !== undefined && !VALID_OVERFLOW.has(r.onOverflow as SpriteOverflowStrategy)) {
        throw new Error(
            `[SpriteAssetLoader] "${id}" onOverflow "${r.onOverflow}" 非法。合法值: [${[...VALID_OVERFLOW].join(', ')}]`,
        );
    }

    return {
        id,
        name: r.name,
        texturePath: r.texturePath,
        displayWidth: r.displayWidth,
        displayHeight: r.displayHeight,
        maxActive: r.maxActive as number | undefined,
        onOverflow: r.onOverflow as SpriteOverflowStrategy | undefined,
    };
}

export function getSpriteAssetDef(id: string): SpriteAssetDef | null {
    return _defs.get(id) ?? null;
}

export function allSpriteAssetDefs(): readonly SpriteAssetDef[] {
    return Array.from(_defs.values());
}

export function allSpriteAssetIds(): string[] {
    return Array.from(_defs.keys());
}

/** @internal 测试用：对任意对象做校验，不改真实 Map */
export function _validateSpriteAssetRawForTest(id: string, raw: unknown): SpriteAssetDef {
    return _validate(id, raw);
}
