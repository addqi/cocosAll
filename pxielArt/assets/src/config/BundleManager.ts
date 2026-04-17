import { assetManager, AssetManager, JsonAsset } from 'cc';

const GAME_BUNDLE_NAME = 'game-bundle';
/**
 * 游戏资源管理器
 */
export class BundleManager {
    /**
     * 游戏资源包
     */
    private static _game: AssetManager.Bundle | null = null;

    /**
     * 获取游戏资源包
     */
    static get game(): AssetManager.Bundle {
        if (!this._game) throw new Error('game-bundle not loaded yet');
        return this._game;
    }

    /**
     * 游戏资源包是否已加载
     */
    static get isLoaded(): boolean {
        return this._game !== null;
    }

    /**
     * 加载游戏资源包
     */
    static load(
        onProgress?: (finished: number, total: number) => void,
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            const url = this._resolveBundlePath();
            assetManager.loadBundle(url, (err, bundle) => {
                if (err) return reject(err);
                this._game = bundle;

                if (onProgress) {
                    // TODO: 上线前删除 _loadDirSlowly，换回 preloadDir
                    this._loadDirSlowly(bundle, onProgress).then(resolve).catch(reject);
                } else {
                    resolve();
                }
            });
        });
    }

    // TODO: 调试用，模拟慢速加载，上线前删除此方法
    private static _loadDirSlowly(
        bundle: AssetManager.Bundle,
        onProgress: (finished: number, total: number) => void,
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            const infos = bundle.getDirWithPath('/');
            const total = infos.length;
            let idx = 0;

            const next = (): void => {
                if (idx >= total) { resolve(); return; }
                const info = infos[idx];
                bundle.load(info.path, (err) => {
                    if (err) { reject(err); return; }
                    idx++;
                    onProgress(idx, total);
                    next();
                });
            };
            next();
        });
    }

    static loadPuzzle(jsonPath: string): Promise<JsonAsset> {
        return new Promise((resolve, reject) => {
            this.game.load(jsonPath, JsonAsset, (err, asset) => {
                if (err || !asset) return reject(err ?? new Error('load failed'));
                resolve(asset);
            });
        });
    }
    /**
     * 解析游戏资源包路径
     */
    private static _resolveBundlePath(): string {
        return GAME_BUNDLE_NAME;
    }
}