/**
 * 行为注册入口
 *
 * 导入此文件即可触发所有 @enemyBehavior 装饰器，
 * 将行为类注册到 EnemyBehaviorFactory。
 * MinionControl 的 onLoad 在此之后调用 Factory.create()。
 *
 * 新增小怪类型时：
 * 1. 在下方加一行 import
 * 2. 在 EMinionType 枚举里加一项
 */
import './warrior/WarriorBehavior';
import './bomber/BomberBehavior';
import './ranger/RangerBehavior';

export enum EMinionType {
    Warrior = 'warrior',
    Bomber  = 'bomber',
    Ranger  = 'ranger',
}
