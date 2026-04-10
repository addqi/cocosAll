/**
 * 主角模块 — 对外统一导出
 */
export { PlayerControl }   from './PlayerControl';
export { PlayerAnimation, EPlayerAnim } from './anim';
export { PlayerCombat }    from './combat';
export { PlayerProperty, PlayerBuffOwner } from './property';
export { EPlayerState, type PlayerCtx } from './states';
export { playerConfig, type PlayerConfigData, type AnimEntry } from './config/playerConfig';
