import type { AnimEntry } from '../../player/config/playerConfig';

export interface EnemyConfigData {
    frameSize: number;
    displayWidth: number;
    displayHeight: number;
    anims: Record<string, AnimEntry>;
    detectionRange: number;
    attackRange: number;
    attackAngle: number;
    attackWindUp: number;
    attackCooldown: number;
    attackHitFrame: number;
    rangeTexture: string;
    hpBarWidth: number;
    hpBarHeight: number;
    idleTimeMin: number;
    idleTimeMax: number;
    wanderTimeMin: number;
    wanderTimeMax: number;
    wanderSpeedRatio: number;
    dissolveTime: number;
    noiseTexture: string;
}

export const enemyConfig: EnemyConfigData = {
    frameSize: 192,
    displayWidth: 150,
    displayHeight: 150,
    anims: {
        idle:   { path: 'Warrior/Warrior_Idle',   fps: 8,  loop: true },
        run:    { path: 'Warrior/Warrior_Run',     fps: 10, loop: true },
        attack: { path: 'Warrior/Warrior_Attack',  fps: 12, loop: false },
        die:    { path: 'Warrior/Warrior_Attack',  fps: 10, loop: false },
    },
    detectionRange: 200,
    attackRange: 50,
    attackAngle: 100,
    attackWindUp: 0.6,
    attackCooldown: 1.5,
    attackHitFrame: 2,
    rangeTexture: 'ui/round',
    hpBarWidth: 80,
    hpBarHeight: 8,
    idleTimeMin: 1,
    idleTimeMax: 3,
    wanderTimeMin: 1,
    wanderTimeMax: 2,
    wanderSpeedRatio: 0.4,
    dissolveTime: 0.8,
    noiseTexture: 'shader/noise',
};
