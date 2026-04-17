import { playerBehavior } from '../../../baseSystem/player';
import { PlayerBehavior } from '../base';
import type { IAttackDecision, ISkillContextSource } from '../base';
import type { IState } from '../../../baseSystem/fsm';
import type { PlayerCtx } from '../states/PlayerContext';
import type { SkillContext } from '../../skill/SkillTypes';
import type { PlayerServices } from '../runtime/PlayerServices';
import type { IShootPolicy } from '../../shoot/types';
import { HoldToShoot } from '../../shoot/ShootPolicies';
import { AttackExecutor } from '../../combat/attack/AttackExecutor';
import type { AttackSpec } from '../../combat/attack/AttackPayload';
import { ArcherAttackState } from './ArcherAttackState';

@playerBehavior
export class ArcherBehavior extends PlayerBehavior {
    readonly typeId = 'archer';

    private _shootPolicy: IShootPolicy = new HoldToShoot();
    private _services: PlayerServices | null = null;

    get shootPolicy(): IShootPolicy { return this._shootPolicy; }

    setServices(s: PlayerServices): void { this._services = s; }

    wantAttack(d: IAttackDecision): boolean {
        return this._shootPolicy.wantShoot(d.input, d.hasTarget, d.isMoving);
    }

    createAttackState(): IState<PlayerCtx> {
        return new ArcherAttackState();
    }

    buildSkillContext(src: ISkillContextSource): SkillContext {
        return {
            playerProp:    src.playerProp,
            playerCombat:  src.playerCombat,
            playerNode:    src.playerNode,
            hitEffectMgr:  src.hitEffectMgr,
            buffMgr:       src.buffMgr,
            buffOwner:     src.buffOwner,
            mouseWorldPos: src.mouseWorldPos,
            behavior:      this,
            services:      this._services!,
        };
    }

    onBehaviorCommand(cmd: string, ...args: unknown[]): void {
        if (cmd === 'set_shoot_policy') {
            this._shootPolicy = args[0] as IShootPolicy;
            return;
        }
        if (cmd === 'execute_attack') {
            AttackExecutor.execute(args[0] as AttackSpec);
            return;
        }
    }
}
