import { _decorator, Component, Enum, Node, UITransform } from 'cc';
import { IRed } from './IRed';

import { getRed } from './RedRegister';
import { RedDisplay, RedDisplayMode } from './RedDisplay';
import { Signal } from './Signal';
const { ccclass, property } = _decorator;

/** 防抖间隔（秒） */
const RED_REFRESH_DEBOUNCE = 0.01;

@ccclass('RedCom')
export class RedCom extends Component {

    @property
    redKey: string = '';

    @property({ type: Enum(RedDisplayMode) })
    displayMode: RedDisplayMode = RedDisplayMode.AUTO;

    private _inst: IRed | null = null;
    private _signals: Signal<any>[] = [];
    private _display: RedDisplay | null = null;
    private _scheduled: boolean = false;

    onLoad(): void {
        const Ctor = getRed(this.redKey);
        if (!Ctor) {
            console.error(`[RedCom] redKey '${this.redKey}' not found. Did you import the class in RedAllReds.ts?`);
            return;
        }
        this._inst = new Ctor();
        this._inst.getSignals(this._signals);

        this._createDisplay();
    }
    private _createDisplay() {
        const ut = this.node.getComponent(UITransform);
        if (!ut) {
            console.warn(`[RedCom] node '${this.node.name}' has no UITransform; skip.`);
            return;
        }

        const dotNode = new Node('RedDot');
        this.node.addChild(dotNode);
        dotNode.setPosition(
            (1 - ut.anchorX) * ut.width,
            (1 - ut.anchorY) * ut.height,
            0,
        );

        this._display = dotNode.addComponent(RedDisplay);
        this._display.setRed(0, this.displayMode);
    }

    onEnable(): void {
        if (!this._inst) return;
        for (const s of this._signals) s.add(this._markDirty, this);
        this._markDirty();
    }

    onDisable(): void {
        if (!this._inst) return;
        for (const s of this._signals) s.remove(this._markDirty, this);
        if (this._scheduled) {
            this.unschedule(this._refreshNow);
            this._scheduled = false;
        }
    }
    onDestroy(): void {
        this._inst = null;
        this._display = null;
        this._signals.length = 0;
        this._scheduled = false;
        if (this._scheduled) {
            this.unschedule(this._refreshNow);
            this._scheduled = false;
        }
    }

    private _markDirty = (): void => {
        if (this._scheduled) return;
        this._scheduled = true;
        this.scheduleOnce(this._refreshNow, RED_REFRESH_DEBOUNCE);
    };

    private _refreshNow = (): void => {
        this._scheduled = false;
        if (!this._inst || !this._display) return;
        const number = this._inst.calcCount();
        this._display.setRed(number, this.displayMode);
    };

    /** 业务强刷：账号切换、发奖结算等场景，等不及 0.5s 防抖 */
    refresh(): void {
        if (this._scheduled) {
            this.unschedule(this._refreshNow);
            this._scheduled = false;
        }
        this._refreshNow();
    }
}