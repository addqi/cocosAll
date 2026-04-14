import { playerBehavior } from '../../../baseSystem/player';
import { PlayerBehavior } from '../base';
import type { IAttackDecision, ISkillContextSource } from '../base';
import type { IState } from '../../../baseSystem/fsm';
import type { PlayerCtx } from '../states/PlayerContext';
import type { SkillContext } from '../../skill/SkillTypes';
import type { PlayerServices } from '../runtime/PlayerServices';

const NOT_IMPL = '[SummonerBehavior] 尚未实现';

@playerBehavior
export class SummonerBehavior extends PlayerBehavior {
    readonly typeId = 'summoner';

    private _services: PlayerServices | null = null;

    setServices(s: PlayerServices): void { this._services = s; }

    wantAttack(_d: IAttackDecision): boolean {
        console.warn(NOT_IMPL, 'wantAttack');
        return false;
    }

    createAttackState(): IState<PlayerCtx> {
        console.warn(NOT_IMPL, 'createAttackState');
        return { enter() {}, update() {}, exit() {} };
    }

    buildSkillContext(src: ISkillContextSource): SkillContext {
        return {
            playerProp: src.playerProp, playerCombat: src.playerCombat,
            playerNode: src.playerNode, hitEffectMgr: src.hitEffectMgr,
            buffMgr: src.buffMgr, buffOwner: src.buffOwner,
            mouseWorldPos: src.mouseWorldPos,
            behavior: this, services: this._services!,
        };
    }
}
