import { PlayerBehaviorBase } from '../../../baseSystem/player';
import type { IState } from '../../../baseSystem/fsm';
import type { PlayerCtx } from '../states/PlayerContext';
import type { SkillContext } from '../../skill/SkillTypes';
import type { IAttackDecision, ISkillContextSource } from './types';

/**
 * 游戏层职业行为抽象。
 *
 * PlayerControl 只依赖这个类型；
 * 具体职业（弓箭手 / 战士 / 召唤师）各自实现。
 */
export abstract class PlayerBehavior extends PlayerBehaviorBase {
    /** 当前帧是否想要攻击（取代旧 IShootPolicy.wantShoot） */
    abstract wantAttack(decision: IAttackDecision): boolean;

    /** 返回本职业的攻击状态实例（各职业各自决定攻击表现） */
    abstract createAttackState(): IState<PlayerCtx>;

    /** 用公共数据源组装完整 SkillContext，职业私货由子类注入 */
    abstract buildSkillContext(source: ISkillContextSource): SkillContext;

    /** 升级系统 behavior_command handler 的入口，默认空实现 */
    onBehaviorCommand(_cmd: string, ..._args: unknown[]): void {}
}
