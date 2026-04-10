import { Asset, resources, Texture2D } from 'cc';

type AssetType<T extends Asset> = new (...args: any[]) => T;

/**
 * 统一资源管理器
 *
 * 职责：预加载、缓存、同步获取。所有 resources.load 调用收拢于此。
 * 游戏运行期消费方只用 get()，零异步、零等待。
 *
 * 扩展方式：
 *   将 _loadOne 内部的 resources.load 替换为 bundle.load / assetManager.loadRemote
 *   外部 API 不变，对消费方零破坏。
 */
export class ResourceMgr {
    private static _inst: ResourceMgr;
    static get inst(): ResourceMgr {
        if (!this._inst) this._inst = new ResourceMgr();
        return this._inst;
    }

    private _cache = new Map<string, Asset>();

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
     * 同步获取已缓存资源（游戏运行期专用）
     * 预加载阶段未覆盖到的路径会返回 null 并输出错误
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
     * 异步加载单个资源（兜底：有缓存直接返回，无缓存发起加载）
     */
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
    }
}
