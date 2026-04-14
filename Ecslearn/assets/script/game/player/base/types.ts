import type { Vec3, Node } from 'cc';
import type { ActionComp } from '../../component';
import type { IBuffOwner } from '../../../baseSystem/buff';
import type { PlayerCombat } from '../combat/PlayerCombat';
import type { PlayerProperty } from '../property/playerProperty';
import type { EntityBuffMgr } from '../../entity/EntityBuffMgr';
import type { HitEffectMgr } from '../../entity/HitEffectMgr';

/** PlayerControl 传给行为层的攻击决策输入 */
export interface IAttackDecision {
    input: ActionComp;
    hasTarget: boolean;
    isMoving: boolean;
}

/** buildSkillContext 的公共数据源，不含职业私货 */
export interface ISkillContextSource {
    playerProp: PlayerProperty;
    playerCombat: PlayerCombat;
    playerNode: Node;
    hitEffectMgr: HitEffectMgr;
    buffMgr: EntityBuffMgr;
    buffOwner: IBuffOwner;
    mouseWorldPos: Vec3;
}
