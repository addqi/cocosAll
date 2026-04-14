import { PlayerBehaviorFactory } from './PlayerBehaviorFactory';
import type { PlayerBehaviorCtor } from './PlayerBehaviorFactory';

export function playerBehavior(ctor: PlayerBehaviorCtor): void {
    const inst = new ctor();
    PlayerBehaviorFactory.register(inst.typeId, ctor);
}
