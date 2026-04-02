export enum RoleState {
    IDLE = 'idle',
    WALK = 'walk',
    RUN = 'run',
    ATTACK = 'attack',
    DEAD = 'dead',
}

export enum RoleAnim{
    IDLE = 'idle',
    WALK = 'walk',
    RUN = 'run',
    ATTACK = 'attack',
    DEAD = 'dead',
}


/**
 * 属性修饰器类型
 * 定义修饰器对数值的影响方式
 */
export enum EModifierMergeType {
    /** 加法，例如：+10 */
    Additive,

    /** 乘法，例如：×1.2 */
    Multiplicative,

    /** 覆盖，当多个覆盖取优先级最高 */
    Override,

    /** 限制范围（Clamp） */
    Clamp,
}

export enum SpeedProId {
    // 1. 基础数值（加法）
    /**基础速度配置 */
    speedBaseValue = "MoveSpeed-Value-Config",
    /**基础速度Buff */
    speedBuffValue   = "MoveSpeed-Value-Buff",
    /**基础速度其他 */
    speedOtherValue  = "MoveSpeed-Value-Other",

    // 2. 计算 Value（加法后的总值）
    /**基础速度总值 */
    speedTotalValue        = "MoveSpeed-Value",

    // 3. 乘法（乘区）
    /**基础速度乘法Buff */
    speedMulBuffValue     = "MoveSpeed-Mul-Buff",
    /**基础速度乘法其他 */
    speedMulOtherValue    = "MoveSpeed-Mul-Other",

    // 4. 最终属性
    MoveSpeed              = "MoveSpeed",
}