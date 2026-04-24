import type { Node } from 'cc';
import type { StateMachine } from '../../../baseSystem/fsm';
import type { PlayerAnimation } from '../anim/PlayerAnimation';
import type { PlayerCombat } from '../combat/PlayerCombat';
import type { PlayerProperty } from '../property/playerProperty';
import type { EnemyControl } from '../../enemy/EnemyControl';
import type { HitEffectMgr } from '../../entity/HitEffectMgr';
import type { PlayerBehavior } from '../base';

export enum EPlayerState {
    Idle   = 'idle',
    Run    = 'run',
    Attack = 'attack',
    Hurt   = 'hurt',
    Dead   = 'dead',
}

export interface PlayerCtx {
    anim: PlayerAnimation;
    node: Node;
    body: Node;
    fsm: StateMachine<EPlayerState, PlayerCtx>;
    behavior: PlayerBehavior;
    combat: PlayerCombat;
    prop: PlayerProperty;
    targetEnemy: EnemyControl | null;
    findNearestEnemy: () => EnemyControl | null;
    attackCooldown: number;
    hitEffectMgr: HitEffectMgr;
    invincibleTimer: number;
    /**
     * 蓄力流专用：当前持续按下 Attack 的累计秒数。
     * 仅在 shootMode.type === 'charge' 时由 ArcherBehavior.tickInput 维护。
     */
    chargeSec: number;
    /**
     * 蓄力流专用：松开瞬间由 behavior 冻结的蓄力时长，交给 AttackState 计算伤害倍率后清 0。
     * 非蓄力流始终为 0。
     */
    pendingChargeSec: number;
}
