import { Signal } from '../Signal';

export class GameEvents {
    /** 玩家点击了某个关卡按钮 */
    static readonly levelClicked: Signal<number> = new Signal<number>();
}
