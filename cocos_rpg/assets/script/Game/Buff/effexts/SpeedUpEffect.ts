import { _decorator, Component, Node } from 'cc';
import { BuffEffectBase } from '../BuffEffectBase';
import { AttributeChange } from '../types';
import { SpeedProId } from '../../GlobalEnum/Enum';
import { BuffFactory } from '../BuffFactory';
const { ccclass, property } = _decorator;

@ccclass('SpeedUpEffect')
export class SpeedUpEffect extends BuffEffectBase {
    getChanges(): AttributeChange[] {
        const changes: AttributeChange[] = [];
        const add = this.data.addValue ?? 0;
        const mul = this.data.mulFactor ?? 0; // 乘法配置：支持直接填倍率(>1)或增量(<=1)
        const addTarget = this.data.targetAttr ?? SpeedProId.speedBuffValue;
        const mulTarget = this.data.mulTargetAttr ?? SpeedProId.speedMulBuffValue;
        const stack = this.runtime.stack || 1;

        if (add !== 0) {
            changes.push({
                attrId: addTarget,
                type: 'ADD',
                value: add * stack
            });
        }

        if (mul !== 0) {
            /**
             * 属性系统中的乘法是“额外倍率相加”，基础为 1。
             * 如果策划填 1.4，我们需要转换成 +0.4；如果直接填 0.4 也能兼容。
             */
            const extraMul = mul > 1 ? (mul - 1) : mul;
            if (extraMul !== 0) {
                changes.push({
                    attrId: mulTarget,
                    type: 'ADD',
                    value: extraMul * stack
                });
            }
        }

        return changes;
    }
    onAdd(): void {
        console.log("添加速度buff");
    }
    onRemove(): void {
        console.log("移除速度buff")
    }
}

BuffFactory.register('SpeedUpEffect', SpeedUpEffect);


