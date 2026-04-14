export interface IDamageable {
    readonly isDead: boolean;
    applyDamage(rawDmg: number): number;
}
