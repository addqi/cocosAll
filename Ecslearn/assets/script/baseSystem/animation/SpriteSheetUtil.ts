import { SpriteFrame, Texture2D, Rect } from 'cc';
import { ResourceMgr } from '../resource';

/**
 * Sprite Sheet 切帧工具
 * 职责单一：Texture2D → SpriteFrame[]，带缓存，不管播放
 */
export class SpriteSheetUtil {
    private static _cache = new Map<string, SpriteFrame[]>();

    /**
     * 从已加载的 Texture2D 创建帧数组（同步，带缓存）
     * @param totalFrames 不传则自动按满格计算
     */
    static createFrames(
        texture: Texture2D,
        frameW: number,
        frameH: number,
        totalFrames?: number
    ): SpriteFrame[] {
        const key = `${texture._uuid}_${frameW}_${frameH}`;
        const cached = this._cache.get(key);
        if (cached) return cached;

        const cols = Math.floor(texture.width / frameW);
        const rows = Math.floor(texture.height / frameH);
        const max = totalFrames ?? cols * rows;

        const frames: SpriteFrame[] = [];
        for (let i = 0; i < max; i++) {
            const c = i % cols;
            const r = Math.floor(i / cols);
            if (r >= rows) break;

            const sf = new SpriteFrame();
            sf.texture = texture;
            sf.rect = new Rect(c * frameW, r * frameH, frameW, frameH);
            frames.push(sf);
        }

        this._cache.set(key, frames);
        return frames;
    }

    /**
     * 同步获取帧数组（需先通过 ResourceMgr 预加载纹理）
     * @param path resources 路径（不带 /texture 后缀）
     */
    static getFrames(
        path: string,
        frameW: number,
        frameH: number,
        totalFrames?: number
    ): SpriteFrame[] {
        const tex = ResourceMgr.inst.get<Texture2D>(`${path}/texture`);
        if (!tex) {
            console.error(`[SpriteSheetUtil] texture not preloaded: "${path}/texture"`);
            return [];
        }
        return this.createFrames(tex, frameW, frameH, totalFrames);
    }

    static clearCache() {
        this._cache.clear();
    }
}
