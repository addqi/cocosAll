import {
    assetManager, AssetManager, ImageAsset, Material, SpriteFrame, Texture2D,
} from 'cc';
import { LevelEntry } from './Level';

const GAME_BUNDLE_NAME = 'game-bundle';
const IMAGES_DIR = 'images';

/**
 * 游戏资源包加载器。
 *
 * 设计意图：start 场景加载 → director.loadScene('game') 时所有图已就绪。
 *
 * 加图工作流：把图扔进 assets/game-bundle/images/，**完**。
 *   - 不需要 json
 *   - 不需要在代码里注册
 *   - 不需要手动改 Type（项目 .creator/default-meta.json 默认 sprite-frame；
 *     即使老图是 texture 也能正确加载，见 loadImageSF 的双路径）
 */
export class BundleManager {
    private static _game: AssetManager.Bundle | null = null;

    static get game(): AssetManager.Bundle {
        if (!this._game) throw new Error('[BundleManager] game-bundle not loaded yet');
        return this._game;
    }

    static get isLoaded(): boolean {
        return this._game !== null;
    }

    /** 加载 game-bundle 并 preload 全部资源 */
    static load(onProgress?: (finished: number, total: number) => void): Promise<void> {
        return new Promise((resolve, reject) => {
            assetManager.loadBundle(GAME_BUNDLE_NAME, (err, bundle) => {
                if (err) return reject(err);
                this._game = bundle;

                bundle.preloadDir(
                    '/',
                    (finished, total) => onProgress?.(finished, total),
                    (preloadErr) => preloadErr ? reject(preloadErr) : resolve(),
                );
            });
        });
    }

    /**
     * 扫描 images/ 下所有图片资源，自动生成关卡列表。
     *
     * getDirWithPath 会返回主资源和 sub-asset（如 images/xxx/texture）；
     * 用 segments.length === 2 过滤掉 sub-asset，只保留 images/<filename>。
     */
    static listLevels(): LevelEntry[] {
        const infos = this.game.getDirWithPath(IMAGES_DIR);
        const seen = new Set<string>();
        const result: LevelEntry[] = [];
        for (const info of infos) {
            const segments = info.path.split('/');
            if (segments.length !== 2 || segments[0] !== IMAGES_DIR) continue;
            const filename = segments[1];
            if (seen.has(filename)) continue;
            seen.add(filename);
            result.push({
                id: filename,
                name: filename,
                imagePath: info.path,
            });
        }
        return result;
    }

    /**
     * 加载某关源图，无论 type 是 sprite-frame、texture，
     * 还是只有原始 ImageAsset，都能拿到一个可用的 SpriteFrame。
     *
     * 三路径串联（前一条失败就降级）：
     *   1. SpriteFrame  —— sprite-frame type 主资源
     *   2. Texture2D    —— texture type 主资源（包成 SpriteFrame）
     *   3. ImageAsset   —— 兜底（包成 Texture2D 再包成 SpriteFrame）
     */
    static async loadImageSF(imagePath: string): Promise<SpriteFrame> {
        const sf = await this._tryLoad<SpriteFrame>(imagePath, SpriteFrame);
        if (sf) return sf;

        const tex = await this._tryLoad<Texture2D>(imagePath, Texture2D);
        if (tex) {
            const wrapped = new SpriteFrame();
            wrapped.texture = tex;
            return wrapped;
        }

        const img = await this._tryLoad<ImageAsset>(imagePath, ImageAsset);
        if (img) {
            const t = new Texture2D();
            t.image = img;
            const wrapped = new SpriteFrame();
            wrapped.texture = t;
            return wrapped;
        }

        throw new Error(`[BundleManager] all 3 load paths failed for: ${imagePath}`);
    }

    /**
     * 加载 game-bundle 里的 Material（08 节自定义 effect 生成的 .mtl）。
     *
     * 为什么返回 null 而不是抛异常：用户**没在 Cocos 编辑器里手动创建 .mtl**时，
     * 加载会失败——这是正常的渐进升级路径，不是 bug。PuzzleBoard 看到 null 就
     * fallback 到 01 节的"每块克隆 SpriteFrame"路径，游戏照玩。
     *
     * 用户做了"右键 .effect → Create Material" 之后此函数才有非 null 返回。
     */
    static loadMaterial(path: string): Promise<Material | null> {
        return this._tryLoad<Material>(path, Material);
    }

    private static _tryLoad<T>(
        path: string,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        type: new (...args: any[]) => T,
    ): Promise<T | null> {
        return new Promise(resolve => {
            this.game.load(
                path,
                type as unknown as typeof SpriteFrame,
                (err: Error | null, asset: SpriteFrame) => {
                    resolve(err || !asset ? null : (asset as unknown as T));
                },
            );
        });
    }
}
