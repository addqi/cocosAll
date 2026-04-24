import { _decorator, Component, Vec3, input, Input, EventKeyboard, KeyCode } from 'cc';
import { on, off, emit } from '../../baseSystem/util';
import { EPropertyAddType } from '../../baseSystem/properties';
import { EPropertyId, EPropertyConfigId } from '../config/enum/propertyEnum';
import {
    GameEvt,
    type EnemyDeathEvent,
    type GoldDropEvent,
    type GoldGainedEvent,
    type GoldPickupBeginEvent,
    type GoldPickupEndEvent,
    type GoldSpentEvent,
} from '../events/GameEvents';
import { GoldSystem } from '../gold/GoldSystem';
import { GoldSource } from '../gold/GoldTypes';
import { CoinFactory } from '../gold/CoinFactory';
import { PlayerControl } from '../player/PlayerControl';

const { ccclass, property } = _decorator;

/**
 * 金币系统场景调试 Logger（阶段 2 / 04 验收用）
 *
 * 挂在场景里任意节点即可使用。
 *
 * 打印：
 *   - 每 periodSec 秒：gold / combo / 场上金币 / PickupRange
 *   - 所有金币事件实时打印
 *
 * 热键：
 *   G  — 手动 +10 金（不触发 Kill，走直接入账）
 *   K  — 在玩家脚下模拟一次 EnemyDeath（触发完整链路：CoinFactory 弹金币 → 走近被吸）
 *   C  — 清空场上所有金币（CoinFactory.clearAll）
 *   X  — 扩大 PickupRange 到 300（方便不动就吸）
 *   Z  — 恢复 PickupRange 为 80
 *
 * 开发态挂一次即可，正式构建记得摘掉或加宏关掉。
 */
@ccclass('GoldDebugLogger')
export class GoldDebugLogger extends Component {

    @property({ tooltip: '状态打印间隔（秒），0 表示不打印' })
    periodSec = 0.5;

    @property({ tooltip: '是否监听并打印所有金币事件' })
    verboseEvents = true;

    private _acc = 0;
    /** 当前生效的 PickupRange modifier 句柄，用于一键还原 */
    private _rangeHandle = 0;

    onLoad(): void {
        if (this.verboseEvents) {
            on(GameEvt.EnemyDeath,      this._onEnemyDeath);
            on(GameEvt.GoldDrop,        this._onGoldDrop);
            on(GameEvt.GoldPickupBegin, this._onPickupBegin);
            on(GameEvt.GoldPickupEnd,   this._onPickupEnd);
            on(GameEvt.GoldGained,      this._onGoldGained);
            on(GameEvt.GoldSpent,       this._onGoldSpent);
        }
        input.on(Input.EventType.KEY_DOWN, this._onKey, this);

        console.log(
            '%c[GoldDebug] 就绪 — 热键 G(+10金) / K(模拟死亡) / C(清空金币) / X(扩大拾取) / Z(还原拾取)',
            'color:#FFD54F;font-weight:bold',
        );
    }

    onDestroy(): void {
        off(GameEvt.EnemyDeath,      this._onEnemyDeath);
        off(GameEvt.GoldDrop,        this._onGoldDrop);
        off(GameEvt.GoldPickupBegin, this._onPickupBegin);
        off(GameEvt.GoldPickupEnd,   this._onPickupEnd);
        off(GameEvt.GoldGained,      this._onGoldGained);
        off(GameEvt.GoldSpent,       this._onGoldSpent);
        input.off(Input.EventType.KEY_DOWN, this._onKey, this);
    }

    update(dt: number): void {
        if (this.periodSec <= 0) return;
        this._acc += dt;
        if (this._acc < this.periodSec) return;
        this._acc = 0;

        const sys = GoldSystem.inst;
        const pc = PlayerControl.instance;
        const range = pc ? pc.playerProp.getValue(EPropertyId.PickupRange) : '-';
        console.log(
            `[GoldDebug] gold=${sys.gold}  combo=${sys.combo}  onField=${CoinFactory.active.length}  pickupRange=${range}`,
        );
    }

    // ── 事件监听 ───────────────────────────────────────────────

    private _onEnemyDeath = (e: EnemyDeathEvent) => {
        console.log(
            `%c[GoldDebug][EnemyDeath] id=${e.enemyId || '-'} xp=${e.xpReward} goldDrop=${e.goldDrop} pos=(${e.worldPos.x.toFixed(0)},${e.worldPos.y.toFixed(0)})`,
            'color:#EF9A9A',
        );
    };
    private _onGoldDrop = (e: GoldDropEvent) => {
        console.log(`%c[GoldDebug][GoldDrop] amount=${e.amount} pos=(${e.worldPos.x.toFixed(0)},${e.worldPos.y.toFixed(0)})`, 'color:#FFE082');
    };
    private _onPickupBegin = (e: GoldPickupBeginEvent) => {
        console.log(`%c[GoldDebug][PickupBegin] amount=${e.amount}`, 'color:#81D4FA');
    };
    private _onPickupEnd = (e: GoldPickupEndEvent) => {
        console.log(`%c[GoldDebug][PickupEnd] amount=${e.amount}`, 'color:#80CBC4');
    };
    private _onGoldGained = (e: GoldGainedEvent) => {
        console.log(
            `%c[Gold] +${e.final}  total=${GoldSystem.inst.gold}  source=${e.source}`,
            'color:#A5D6A7;font-weight:bold',
        );
    };
    private _onGoldSpent = (e: GoldSpentEvent) => {
        console.log(`%c[GoldDebug][GoldSpent] -${e.amount}  reason=${e.reason}`, 'color:#F48FB1');
    };

    // ── 热键 ────────────────────────────────────────────────

    private _onKey = (e: EventKeyboard) => {
        switch (e.keyCode) {
            case KeyCode.KEY_G: this._cheatAdd10();        break;
            case KeyCode.KEY_K: this._fakeEnemyDeath();    break;
            case KeyCode.KEY_C: CoinFactory.clearAll();    break;
            case KeyCode.KEY_X: this._setPickupRange(300); break;
            case KeyCode.KEY_Z: this._setPickupRange(80);  break;
            default: break;
        }
    };

    private _cheatAdd10(): void {
        // 直接入账分支（非 Kill），不生成金币物件，用于验证 GoldGained / _commit 路径
        GoldSystem.inst.gainGold({ source: GoldSource.Cheat, baseAmount: 10 });
    }

    private _fakeEnemyDeath(): void {
        const pc = PlayerControl.instance;
        if (!pc) {
            console.warn('[GoldDebug] 没有 Player，K 键失效');
            return;
        }
        const p = pc.body.worldPosition;
        // 在玩家附近 150px 外随机点生成一枚"掉落"，测试走近自动吸
        const angle = Math.random() * Math.PI * 2;
        const r = 150;
        const pos = new Vec3(p.x + Math.cos(angle) * r, p.y + Math.sin(angle) * r, p.z);
        const payload: EnemyDeathEvent = {
            enemyId: 'fake',
            xpReward: 0,
            goldDrop: 5,
            worldPos: pos,
            killerId: 'player',
        };
        emit(GameEvt.EnemyDeath, payload);
    }

    /**
     * 通过属性加法节点临时拨动 PickupRange（走正式属性 API，不污染 base）
     * target === 80 时表示还原 = 移除现有加成
     */
    private _setPickupRange(target: number): void {
        const pc = PlayerControl.instance;
        if (!pc) {
            console.warn('[GoldDebug] 没有 Player，热键失效');
            return;
        }

        if (this._rangeHandle) {
            pc.playerProp.remove(this._rangeHandle);
            this._rangeHandle = 0;
        }

        const cur = pc.playerProp.getValue(EPropertyId.PickupRange);
        const delta = target - cur;
        if (delta !== 0) {
            this._rangeHandle = pc.playerProp.add(
                EPropertyId.PickupRange,
                EPropertyConfigId.BaseValueOther,
                EPropertyAddType.Add,
                delta,
            );
        }
        console.log(
            `[GoldDebug] PickupRange ${cur} → ${pc.playerProp.getValue(EPropertyId.PickupRange)}`,
        );
    }
}
