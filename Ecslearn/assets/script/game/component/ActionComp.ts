import type { IComponent } from '../../baseSystem/ecs';

export enum EAction {
    MoveUp,
    MoveDown,
    MoveLeft,
    MoveRight,
    Attack,
    Dodge,
    Skill1,
    Skill2,
    Skill3,
}

export class ActionComp implements IComponent {
    /** 持续按住的动作 */
    active       = new Set<EAction>();
    /** 本帧刚按下的动作（单帧脉冲） */
    justPressed  = new Set<EAction>();
    /** 本帧刚抬起的动作（单帧脉冲） */
    justReleased = new Set<EAction>();
    /** 归一化移动方向，斜向自动变 0.707 */
    moveDir      = { x: 0, y: 0 };
}