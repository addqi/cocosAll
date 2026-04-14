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
}
