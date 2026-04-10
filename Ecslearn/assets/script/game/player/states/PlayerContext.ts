import type { Node } from 'cc';
import type { StateMachine } from '../../../baseSystem/fsm';
import type { PlayerAnimation } from '../anim/PlayerAnimation';

/** 玩家状态枚举 */
export enum EPlayerState {
    Idle  = 'idle',
    Run   = 'run',
    Shoot = 'shoot',
}

/**
 * 玩家上下文 — 状态通过它操作玩家，不直接依赖 Component
 * 由 PlayerControl 创建并注入
 */
export interface PlayerCtx {
    anim: PlayerAnimation;
    node: Node;
    fsm: StateMachine<EPlayerState, PlayerCtx>;
}
