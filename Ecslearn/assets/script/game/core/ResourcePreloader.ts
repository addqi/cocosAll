import { Texture2D, SpriteFrame, EffectAsset, Prefab } from 'cc';
import { ResourceMgr } from '../../baseSystem/resource';
import { playerConfig, type AnimEntry } from '../player/config/playerConfig';
import { archerConfig } from '../player/archer/archerConfig';
import { enemyConfig } from '../enemy/config/enemyConfig';
import { enemyResConfig } from '../enemy/config/enemyResConfig';
import { allSpriteAssetDefs } from '../config/spriteAssetConfig/SpriteAssetLoader';
import { TILE_DIR, tileName } from '../map/terrainTileConfig';

// 瓦片集尺寸：和 TileMapRenderer 里的 TILESET_ROWS/COLS 保持一致
const TILESET_ROWS = 6;
const TILESET_COLS = 9;

function collectTerrainTiles(out: string[]): void {
    for (let r = 0; r < TILESET_ROWS; r++) {
        for (let c = 0; c < TILESET_COLS; c++) {
            out.push(`${TILE_DIR}/${tileName(r, c)}/texture`);
        }
    }
}

/**
 * 统一的 Prefab 资源路径（resources 下的相对路径，不带扩展名）。
 *
 * 新增 prefab 的标准姿势：
 *   1. 放入 assets/resources/prefab/...
 *   2. 在本常量里加一条
 *   3. 游戏代码用 ResourceMgr.inst.get<Prefab>(PREFAB_PATHS.xxx) 同步拿
 */
export const PREFAB_PATHS = {
    arrow: 'prefab/fly/Arrow-001',
} as const;

const REQUIRED_PREFABS: readonly string[] = [
    PREFAB_PATHS.arrow,
];

function collectAnim(entry: AnimEntry, texPaths: string[], frameDirs: string[]) {
    if (entry.frameDir) {
        frameDirs.push(entry.frameDir);
    } else if (entry.path) {
        texPaths.push(`${entry.path}/texture`);
    }
}

export async function preloadAllResources(): Promise<void> {
    const texturePaths: string[] = [];
    const frameDirs: string[] = [];

    for (const key of Object.keys(playerConfig.anims)) collectAnim(playerConfig.anims[key], texturePaths, frameDirs);
    texturePaths.push(`${archerConfig.arrowTexture}/texture`);
    texturePaths.push(`${playerConfig.rangeTexture}/texture`);

    for (const key of Object.keys(enemyConfig.anims)) collectAnim(enemyConfig.anims[key], texturePaths, frameDirs);
    texturePaths.push(`${enemyResConfig.rangeTexture}/texture`);

    texturePaths.push('shader/noise/texture');

    // UI 共享 texture（虚拟摇杆 / 攻击按钮的白底圆图）
    texturePaths.push('gameplay_pic_colordi/texture');

    // 业务 Texture 统一从 spriteAssets.json 读，单一事实来源
    for (const def of allSpriteAssetDefs()) texturePaths.push(def.texturePath);

    // 地形瓦片：54 张独立 PNG，全部以 Texture2D 进 ResourceMgr._cache，
    // 运行期 TileMapRenderer 同步 get 后自建 SpriteFrame
    collectTerrainTiles(texturePaths);

    const dirTasks = frameDirs.map(d => ResourceMgr.inst.preloadDir(d, SpriteFrame));

    // 每一项都跑完再汇总失败：某个 frameDir 挂掉不应阻塞其他资源加载；
    // 但只要有任意一项失败，整体就 reject，GameLoop 的 .catch 能收到完整清单。
    const labeledTasks: Array<[string, Promise<void>]> = [
        ['textures', ResourceMgr.inst.preload(texturePaths, Texture2D)],
        ['effects', ResourceMgr.inst.preload(['shader/dissolve', 'shader/flash-white'], EffectAsset)],
        ['requiredPrefabs', ResourceMgr.inst.preload(REQUIRED_PREFABS as string[], Prefab)],
        ...dirTasks.map((t, i) => [`frameDir[${frameDirs[i]}]`, t] as [string, Promise<void>]),
    ];

    // 不用 Promise.allSettled（TS lib < es2020 没这个 API）。
    // 把每个任务 catch 成 { label, err | null }，再统一汇总失败。
    const settled = await Promise.all(
        labeledTasks.map(([label, p]) =>
            p.then(() => ({ label, err: null as unknown })).catch(err => ({ label, err })),
        ),
    );

    const failures: string[] = [];
    for (const s of settled) {
        if (s.err !== null) {
            console.error(`[ResourcePreloader] ${s.label} failed:`, s.err);
            failures.push(s.label);
        }
    }

    if (failures.length > 0) {
        throw new Error(`[ResourcePreloader] ${failures.length} task(s) failed: ${failures.join(', ')}`);
    }
}
