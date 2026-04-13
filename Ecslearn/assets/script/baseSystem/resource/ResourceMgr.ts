import { Asset, resources, Texture2D } from 'cc';

type AssetType<T extends Asset> = new (...args: any[]) => T;

/**
 * 统一资源管理器
 *
 * 职责：预加载、缓存、同步获取。所有 resources.load 调用收拢于此。
 * 游戏运行期消费方只用 get() / getDir()，零异步、零等待。
 */
export class ResourceMgr {
    private static _inst: ResourceMgr;
    static get inst(): ResourceMgr {
        if (!this._inst) this._inst = new ResourceMgr();
        return this._inst;
    }

    private _cache = new Map<string, Asset>();
    private _dirCache = new Map<string, Asset[]>();

    /**
     * 批量预加载（启动阶段调用，await 完再进入游戏）
     * @param paths  resources 路径列表（含 /texture 后缀，如 'Archer/Arrow/texture'）
     * @param type   资源类型（默认 Texture2D）
     */
    async preload<T extends Asset>(paths: string[], type: AssetType<T> = Texture2D as any): Promise<void> {
        const tasks = paths.map((p) => this._loadOne(p, type));
        await Promise.all(tasks);
    }

    /**
     * 预加载整个目录（启动阶段调用）
     * @param dir  resources 下的目录路径，如 'Archer/idle'
     * @param type 资源类型
     */
    async preloadDir<T extends Asset>(dir: string, type: AssetType<T>): Promise<void> {
        if (this._dirCache.has(dir)) return;
        return new Promise((resolve, reject) => {
            resources.loadDir(dir, type, (err, assets) => {
                if (err) {
                    console.error(`[ResourceMgr] loadDir failed: "${dir}"`, err);
                    reject(err);
                    return;
                }
                this._dirCache.set(dir, assets as Asset[]);
                resolve();
            });
        });
    }

    /**
     * 同步获取已缓存资源（游戏运行期专用）
     */
    get<T extends Asset>(path: string): T | null {
        const asset = this._cache.get(path);
        if (!asset) {
            console.error(`[ResourceMgr] cache miss: "${path}" — 请确认已在 preload 中声明`);
            return null;
        }
        return asset as T;
    }

    /**
     * 同步获取已缓存的目录资源数组
     */
    getDir<T extends Asset>(dir: string): T[] | null {
        const assets = this._dirCache.get(dir);
        if (!assets) {
            console.error(`[ResourceMgr] dir cache miss: "${dir}" — 请确认已在 preloadDir 中声明`);
            return null;
        }
        return assets as T[];
    }

    async load<T extends Asset>(path: string, type: AssetType<T> = Texture2D as any): Promise<T> {
        const cached = this._cache.get(path) as T | undefined;
        if (cached) return cached;
        return this._loadOne(path, type);
    }

    private _loadOne<T extends Asset>(path: string, type: AssetType<T>): Promise<T> {
        return new Promise((resolve, reject) => {
            resources.load(path, type, (err, asset) => {
                if (err) {
                    console.error(`[ResourceMgr] load failed: "${path}"`, err);
                    reject(err);
                    return;
                }
                this._cache.set(path, asset);
                resolve(asset);
            });
        });
    }

    clearCache() {
        this._cache.clear();
        this._dirCache.clear();
    }
}
