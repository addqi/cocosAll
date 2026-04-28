import { _decorator, Component, Node, UITransform, view } from 'cc';
import { BundleManager } from './config/BundleManager';
import { LevelEntry } from './config/Level';
import { HomePage } from './ui/home/HomePage';
import { GamePage } from './ui/game/GamePage';

const { ccclass } = _decorator;

/**
 * game 场景唯一入口。负责 HomePage（选关）和 GamePage（拼图）的切换。
 *
 * 编辑器侧操作：
 *   1. game.scene 的 Canvas 下建空节点 'AppRoot'，Widget 撑满
 *   2. 把这个组件挂到 AppRoot 节点上
 */
@ccclass('AppRoot')
export class AppRoot extends Component {

    private _homeNode: Node = null!;
    private _gameNode: Node = null!;
    private _homePage: HomePage = null!;
    private _gamePage: GamePage = null!;

    start(): void {
        const vs = view.getVisibleSize();
        const ut = this.node.getComponent(UITransform);
        if (ut) ut.setContentSize(vs.width, vs.height);

        this._createPages(vs);
        this.showHome();
    }

    showHome(): void {
        this._gamePage.cleanup();
        this._homeNode.active = true;
        this._gameNode.active = false;
        this._homePage.refreshList();
    }

    showGame(entry: LevelEntry): void {
        this._homeNode.active = false;
        this._gameNode.active = true;
        this._gamePage.startLevel(entry);
    }

    /**
     * 求下一关 entry。最后一关返回 null（WinDialog 据此把"下一关"按钮置灰）。
     *
     * 注入给 GamePage 而非每次 showGame 算一次——
     * 玩家在游戏内连续点"下一关"通关 N 关时，GamePage 自己反复问，不需要 AppRoot 重新路由。
     */
    private _findNextEntry(current: LevelEntry): LevelEntry | null {
        if (!BundleManager.isLoaded) return null;
        const all = BundleManager.listLevels();
        const idx = all.findIndex(e => e.id === current.id);
        if (idx < 0 || idx >= all.length - 1) return null;
        return all[idx + 1];
    }

    private _createPages(vs: { width: number; height: number }): void {
        this._homeNode = this._createPageNode('HomePage', vs);
        this._homePage = this._homeNode.addComponent(HomePage);
        this._homePage.init((entry) => this.showGame(entry));

        this._gameNode = this._createPageNode('GamePage', vs);
        this._gamePage = this._gameNode.addComponent(GamePage);
        this._gamePage.init(
            () => this.showHome(),
            (current) => this._findNextEntry(current),
        );
    }

    private _createPageNode(name: string, vs: { width: number; height: number }): Node {
        const node = new Node(name);
        this.node.addChild(node);
        node.addComponent(UITransform).setContentSize(vs.width, vs.height);
        return node;
    }
}
