import roomDefs from './rooms.json';

export interface Vec2Like { x: number; y: number }

export interface SpawnPoint {
    position: Vec2Like;
    allowedTypes: string[];
    weight: number;
}

export interface ObstacleInfo {
    position: Vec2Like;
    type: string;
}

export interface RoomDef {
    id: string;
    name: string;
    width: number;
    height: number;
    tileSize: number;
    playerSpawn: Vec2Like;
    warpGatePos: Vec2Like;
    spawnPoints: SpawnPoint[];
    obstacles: ObstacleInfo[];
    tags?: string[];
}

const _rooms = roomDefs as Record<string, RoomDef>;

export function getRoomDef(id: string): RoomDef | null {
    return _rooms[id] ?? null;
}

export function allRoomIds(): string[] {
    return Object.keys(_rooms);
}

export function getRoomsByTag(tag: string): RoomDef[] {
    return Object.values(_rooms).filter(r => r.tags?.includes(tag));
}

export function getRandomRoom(tag?: string): RoomDef | null {
    const pool = tag ? getRoomsByTag(tag) : Object.values(_rooms);
    if (pool.length === 0) return null;
    return pool[Math.floor(Math.random() * pool.length)];
}
