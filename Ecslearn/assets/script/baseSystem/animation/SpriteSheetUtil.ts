import { SpriteFrame, Texture2D, Rect, resources } from 'cc';

/**
 * Sprite Sheet 切帧工具
 * 职责单一：Texture2D → SpriteFrame[]，带缓存，不管播放
 */
export class SpriteSheetUtil {
    private static _cache = new Map<string, SpriteFrame[]>();

    /**
     * 从已加载的 Texture2D 创建帧数组（同步，带缓存）
     * 支持单行和多行 sprite sheet
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
     * 从 resources 路径加载纹理并创建帧数组（异步）
     * @param path resources 目录下的路径，不带后缀
     */
    static loadFrames(
        path: string,
        frameW: number,
        frameH: number,
        totalFrames?: number
    ): Promise<SpriteFrame[]> {
        return new Promise((resolve, reject) => {
            resources.load(`${path}/texture`, Texture2D, (err, texture) => {
                if (err) { reject(err); return; }
                resolve(this.createFrames(texture, frameW, frameH, totalFrames));
            });
        });
    }

    static clearCache() {
        this._cache.clear();
    }
}
