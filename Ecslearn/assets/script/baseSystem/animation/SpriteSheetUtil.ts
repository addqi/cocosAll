import { SpriteFrame, Texture2D, Rect } from 'cc';
import { ResourceMgr } from '../resource';

/**
 * Sprite 帧工具
 *
 * 两种帧获取模式：
 *   1. getFrames    — 从一张 Sprite Sheet 按网格切帧（旧模式，保留向后兼容）
 *   2. getFrameDir  — 从独立帧图片目录加载（新模式，每帧一张 PNG）
 */
export class SpriteSheetUtil {
    private static _cache = new Map<string, SpriteFrame[]>();

    /**
     * 从已加载的 Texture2D 按网格切帧（同步，带缓存）
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
     * 从 Sprite Sheet 纹理同步获取帧数组（旧模式）
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

    /**
     * 从独立帧图片目录获取帧数组（新模式）
     * 需先通过 ResourceMgr.preloadDir 预加载目录
     * 帧文件命名须可按字典序排出正确播放顺序（如 frame_00、frame_01 …）
     */
    static getFrameDir(dir: string): SpriteFrame[] {
        const cached = this._cache.get(`dir:${dir}`);
        if (cached) return cached;

        const raw = ResourceMgr.inst.getDir<SpriteFrame>(dir);
        if (!raw || raw.length === 0) {
            console.error(`[SpriteSheetUtil] no frames in dir: "${dir}"`);
            return [];
        }

        const frames = raw.slice().sort(
            (a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }),
        );
        this._cache.set(`dir:${dir}`, frames);
        return frames;
    }

    static clearCache() {
        this._cache.clear();
    }
}
