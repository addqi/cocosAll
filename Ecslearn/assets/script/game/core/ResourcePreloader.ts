import { Texture2D, SpriteFrame, EffectAsset } from 'cc';
import { ResourceMgr } from '../../baseSystem/resource';
import { playerConfig, type AnimEntry } from '../player/config/playerConfig';
import { archerConfig } from '../player/archer/archerConfig';
import { enemyConfig } from '../enemy/config/enemyConfig';
import { enemyResConfig } from '../enemy/config/enemyResConfig';

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

    const dirTasks = frameDirs.map(d => ResourceMgr.inst.preloadDir(d, SpriteFrame));

    const wrap = (p: Promise<void>, label: string) =>
        p.catch(err => { console.warn(`[ResourcePreloader] ${label} failed:`, err); });

    await Promise.all([
        wrap(ResourceMgr.inst.preload(texturePaths, Texture2D), 'textures'),
        wrap(ResourceMgr.inst.preload(['shader/dissolve', 'shader/flash-white'], EffectAsset), 'effects'),
        ...dirTasks.map((t, i) => wrap(t, `frameDir[${frameDirs[i]}]`)),
    ]);
}
