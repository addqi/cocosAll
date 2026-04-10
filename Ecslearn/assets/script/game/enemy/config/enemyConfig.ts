import type { AnimEntry } from '../../player/config/playerConfig';

export interface EnemyConfigData {
    frameSize: number;
    displayWidth: number;
    displayHeight: number;
    anims: Record<string, AnimEntry>;
}

export const enemyConfig: EnemyConfigData = {
    frameSize: 192,
    displayWidth: 150,
    displayHeight: 150,
    anims: {
        idle:   { path: 'Warrior/Warrior_Idle',   fps: 8,  loop: true },
        run:    { path: 'Warrior/Warrior_Run',     fps: 10, loop: true },
        attack: { path: 'Warrior/Warrior_Attack',  fps: 12, loop: false },
    },
};
