import type { Sprite, Node } from 'cc';
import type { IBuffOwner } from '../../../baseSystem/buff';
import type { PlayerBehavior } from '../base';
import type { PlayerProperty } from '../property/playerProperty';
import type { PlayerCombat } from '../combat/PlayerCombat';
import { EntityBuffMgr } from '../../entity/EntityBuffMgr';
import { HitEffectMgr } from '../../entity/HitEffectMgr';
import { UpgradeManager } from '../../upgrade/UpgradeManager';
import { SkillSystem } from '../../skill/SkillSystem';
import { FlashWhite } from '../../vfx/FlashWhite';
import { DamagePopupMgr } from '../../vfx/DamagePopupMgr';
import type { PlayerServices } from './PlayerServices';

export interface RuntimeDeps {
    prop: PlayerProperty;
    combat: PlayerCombat;
    behavior: PlayerBehavior;
    bodySprite: Sprite;
    parentNode: Node;
}

export class PlayerRuntime implements PlayerServices {
    readonly buffOwner: IBuffOwner;
    readonly buffMgr: EntityBuffMgr;
    readonly hitEffectMgr: HitEffectMgr;
    readonly upgradeMgr: UpgradeManager;
    readonly skillSystem: SkillSystem;
    readonly flashWhite: FlashWhite;

    constructor(deps: RuntimeDeps) {
        this.buffOwner = {
            uid: 'player',
            getPropertyManager: () => deps.prop,
            heal: (amount: number) => { deps.combat.heal(amount); },
        };
        this.buffMgr = new EntityBuffMgr(deps.prop);
        this.hitEffectMgr = new HitEffectMgr();
        this.hitEffectMgr.add({ id: 'base-damage', effectClass: 'DamageHitEffect', priority: 0 });

        this.upgradeMgr = new UpgradeManager({
            buffMgr: this.buffMgr,
            buffOwner: this.buffOwner,
            hitEffectMgr: this.hitEffectMgr,
            setShootPolicy: (p: unknown) => { deps.behavior.onBehaviorCommand('set_shoot_policy', p); },
            sendBehaviorCommand: (cmd: string, ...args: unknown[]) => { deps.behavior.onBehaviorCommand(cmd, ...args); },
        });

        this.skillSystem = new SkillSystem();
        this.flashWhite = new FlashWhite(deps.bodySprite);
        DamagePopupMgr.inst.init(deps.parentNode);

        if (typeof (deps.behavior as any).setServices === 'function') {
            (deps.behavior as any).setServices(this);
        }
    }

    tick(dt: number): void {
        this.buffMgr.update(dt);
        this.skillSystem.tick(dt);
        this.flashWhite.tick(dt);
        DamagePopupMgr.inst.tick(dt);
    }
}
