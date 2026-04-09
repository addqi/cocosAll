/**
 * 属性系统业务枚举
 * 定义游戏中具体有哪些属性（EPropertyId）以及属性由哪些节点组成（EPropertyConfigId）
 * 与 game/shared/config/ 下的属性 JSON 结构对应
 */

/**
 * 属性 ID 枚举
 * 与 game/shared/config/*.json 中 attribute 字段一致
 * 新增属性时需同步在此添加
 */
export enum EPropertyId {
    Hp = 'Hp',
    Attack = 'Attack',
    Defense = 'Defense',
    CritRate = 'CritRate',
    CritDmg = 'CritDmg',
    AttackSpeed = 'AttackSpeed',
    MoveSpeed = 'MoveSpeed',
}

/**
 * 属性节点部分枚举
 * 表示 Buff/修饰器作用于哪一个 valueNode，与 JSON 中 valueNodes 的 tag 对应
 *
 * 节点关系（以 Hp 为例）：
 *   Hp = Hp-Value × (1 + Hp-Mul-Buff + Hp-Mul-Other)
 *   Hp-Value = Hp-Value-Config + Hp-Value-Buff + Hp-Value-Other
 */
export enum EPropertyConfigId {
    /** 基础值节点（xxx-Value-Config），初始化时 setBase，可 Override/Clamp */
    BaseValueConfig = 'baseValue',
    /** 固定加成-Buff 节点（xxx-Value-Buff），Buff 来源的加法修饰 */
    BaseValueBuff = 'baseValueBuff',
    /** 固定加成-Other 节点（xxx-Value-Other），非 Buff 来源的加法修饰 */
    BaseValueOther = 'baseValueOther',
    /** 百分比加成-Buff 节点（xxx-Mul-Buff），value=0.5 表示 +50% */
    MulBuff = 'mulBuff',
    /** 百分比加成-Other 节点（xxx-Mul-Other），非 Buff 来源的乘法修饰 */
    MulOther = 'mulOther',
}
