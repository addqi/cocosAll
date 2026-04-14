import type { Node } from 'cc';
import type { IDamageable } from './IDamageable';

export interface ITargetable extends IDamageable {
    readonly node: Node;
}
