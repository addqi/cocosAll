export { EnemyProperty } from './EnemyProperty';
export { EnemyBuffOwner } from './EnemyBuffOwner';
export { EnemyCombat } from './EnemyCombat';

export { EnemyBase } from './base/EnemyBase';
export { EMobState } from './base/types';

// 向后兼容：外部代码可能 import { EnemyControl }
export { EnemyBase as EnemyControl } from './base/EnemyBase';

export { MinionControl } from './minion/MinionControl';
export { MinionBehavior } from './minion/MinionBehavior';
