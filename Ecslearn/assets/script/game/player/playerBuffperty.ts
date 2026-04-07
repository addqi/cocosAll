import type { IBuffOwner } from '../../baseSystem/buff';
import type { EntityPropertyMgr } from '../shared/EntityPropertyMgr';
import { PlayerProperty } from './playerProperty';

/**
 * 玩家 Buff 挂载目标
 *
 * 实现 IBuffOwner，作为 EntityBuffMgr.addBuff() 的 owner 参数。
 * 将 PlayerProperty（EntityPropertyMgr）暴露给 Buff 系统，
 * 使 AttributeChangeResolver 能正确找到属性管理器。
 */
export class PlayerBuffOwner implements IBuffOwner {
    readonly uid: string;

    constructor(
        private readonly playerProperty: PlayerProperty,
        uid = 'player'
    ) {
        this.uid = uid;
    }

    getPropertyManager(): EntityPropertyMgr {
        return this.playerProperty;
    }
}
