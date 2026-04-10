import type { Node } from 'cc';
import type { StateMachine } from '../../../baseSystem/fsm';
import type { PlayerAnimation } from '../anim/PlayerAnimation';
import type { PlayerCombat } from '../combat/PlayerCombat';
import type { EnemyControl } from '../../enemy/EnemyControl';

export enum EPlayerState {
    Idle  = 'idle',
    Run   = 'run',
    Shoot = 'shoot',
}

export interface PlayerCtx {
    anim: PlayerAnimation;
    node: Node;
    /** 模型节点 — 翻转朝向只在这里做 */
    body: Node;
    fsm: StateMachine<EPlayerState, PlayerCtx>;
    combat: PlayerCombat | null;
    targetEnemy: EnemyControl | null;
}
