import { EnemyBehaviorFactory } from './EnemyBehaviorFactory';
import type { EnemyBehaviorCtor } from './EnemyBehaviorFactory';

export function enemyBehavior(ctor: EnemyBehaviorCtor): void {
    const inst = new ctor();
    EnemyBehaviorFactory.register(inst.typeId, ctor);
}
