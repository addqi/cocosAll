import { Entity } from '../../baseSystem/ecs';

/**
 * ECS 实体注册表
 *
 * 全局唯一实例，通过 World.inst 访问。
 * GameLoop.onLoad 中 new World() 自动设置 inst。
 */
export class World {
    private static _inst: World;
    static get inst(): World { return this._inst; }

    private _entities: Entity[] = [];

    constructor() {
        World._inst = this;
    }

    add(entity: Entity): void {
        this._entities.push(entity);
    }

    remove(entity: Entity): void {
        const i = this._entities.indexOf(entity);
        if (i >= 0) this._entities.splice(i, 1);
    }

    all(): Entity[] {
        return this._entities;
    }
}
