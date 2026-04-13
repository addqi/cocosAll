import type { Node } from 'cc';
import type { StateMachine } from '../../../baseSystem/fsm';
import type { PlayerAnimation } from '../anim/PlayerAnimation';
import type { PlayerCombat } from '../combat/PlayerCombat';
import type { PlayerProperty } from '../property/playerProperty';
import type { EnemyControl } from '../../enemy/EnemyControl';
import type { HitEffectMgr } from '../../entity/HitEffectMgr';

export enum EPlayerState {
    Idle  = 'idle',
    Run   = 'run',
    Shoot = 'shoot',
    Hurt  = 'hurt',
    Dead  = 'dead',
}

export interface PlayerCtx {
    anim: PlayerAnimation;
    node: Node;
    /** 模型节点 — 翻转朝向只在这里做 */
    body: Node;
    fsm: StateMachine<EPlayerState, PlayerCtx>;
    combat: PlayerCombat;
    prop: PlayerProperty;
    targetEnemy: EnemyControl | null;
    findNearestEnemy: () => EnemyControl | null;
    /** 射击冷却倒计时，跨状态持续递减 */
    shootCooldown: number;
    hitEffectMgr: HitEffectMgr;
    /** 受击无敌帧倒计时 */
    invincibleTimer: number;
}
