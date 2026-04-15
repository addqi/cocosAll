/**
 * 资源就绪状态 — 从 GameLoop 抽出的静态通知机制。
 *
 * 任何需要等资源加载完毕的代码统一调 ResourceState.onReady()，
 * 不再依赖 GameLoop 组件的静态方法。
 */
export class ResourceState {
    private static _readyFns: (() => void)[] = [];
    private static _isReady = false;

    static get ready(): boolean { return this._isReady; }

    static onReady(fn: () => void): void {
        if (this._isReady) { fn(); return; }
        this._readyFns.push(fn);
    }

    static markReady(): void {
        this._isReady = true;
        for (const fn of this._readyFns) fn();
        this._readyFns.length = 0;
    }

    static reset(): void {
        this._isReady = false;
        this._readyFns.length = 0;
    }
}
