import { EntityPropertyMgr } from '../shared/EntityPropertyMgr';
import type { PropertyBaseConfig } from '../shared/EntityPropertyMgr';
import playerConfig from './config/player.json';

/**
 * 玩家属性管理器
 *
 * 仅负责注入玩家配置（player.json），所有属性逻辑由 EntityPropertyMgr 提供。
 *
 * player.json 格式：
 *   { "Hp": { "base": 1000 }, "MoveSpeed": { "base": 100, "min": 10, "max": 100 } }
 *   - base：初始基础值
 *   - min/max（可选）：最终属性范围约束，自动转为永久 Clamp 修饰器
 *
 * 常用 API（继承自 EntityPropertyMgr）：
 *   getValue(EPropertyId.Hp)                                 → 获取最终值
 *   add(EPropertyId.Hp, EPropertyConfigId.BaseValueBuff, EPropertyAddType.Add, 100)  → 添加修饰器
 *   remove(handle)                                           → 移除修饰器
 */
export class PlayerProperty extends EntityPropertyMgr {
    constructor() {
        super();
        this.setInitialValues(playerConfig as PropertyBaseConfig);
    }
}
