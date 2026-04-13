/**
 * 向后兼容层
 *
 * 旧代码通过 `import { EnemyControl } from '../enemy/EnemyControl'` 引用。
 * 现在 EnemyBase 是所有敌人的公共基类，MinionControl 是小怪实现。
 * 此文件保持旧导入路径可用。
 */
export { EnemyBase as EnemyControl } from './base/EnemyBase';
export { EMobState } from './base/types';
