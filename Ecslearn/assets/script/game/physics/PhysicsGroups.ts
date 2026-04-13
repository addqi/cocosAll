/**
 * 碰撞分组位掩码，与编辑器「项目设置 → 物理 → 碰撞矩阵」的 Index 一一对应
 *
 * Index 0 = DEFAULT  → 1 << 0 = 1
 * Index 1 = player   → 1 << 1 = 2
 * Index 2 = enemy    → 1 << 2 = 4
 * ...以此类推
 */
export const PHY_GROUP = {
    DEFAULT: 1 << 0,
    Player:  1 << 1,
    Enemy:   1 << 2,
    NPC:     1 << 3,
    PBullet: 1 << 4,
    EBullet: 1 << 5,
    Wall:    1 << 6,
    Pickup:  1 << 7,
    Trigger: 1 << 8,
} as const;
