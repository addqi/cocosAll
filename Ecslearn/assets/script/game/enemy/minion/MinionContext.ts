import type { Node } from 'cc';
import type { StateMachine } from '../../../baseSystem/fsm';
import type { EnemyAnimation } from '../anim/EnemyAnimation';
import type { EnemyProperty } from '../EnemyProperty';
import type { EnemyCombat } from '../EnemyCombat';
import type { EnemyConfigData } from '../config/enemyConfig';
import type { EnemyVisual } from '../base/EnemyVisual';
import type { EnemyMovement } from '../base/EnemyMovement';
import type { MinionBehavior } from './MinionBehavior';
import type { EMobState } from '../base/types';

export interface IMinionCtx {
    readonly behavior: MinionBehavior;
    readonly visual: EnemyVisual;
    readonly movement: EnemyMovement;
    readonly cfg: EnemyConfigData;
    readonly node: Node;
    readonly body: Node;
    readonly anim: EnemyAnimation;
    readonly prop: EnemyProperty;
    readonly combat: EnemyCombat;
    readonly groundFX: Node;
    readonly uiAnchor: Node;
    fsm: StateMachine<EMobState, IMinionCtx>;
    facingAngle: number;
    xpGranted: boolean;
    /** Ranger 等子类存放自定义指示器节点引用 */
    indicatorHandle?: unknown;
}
