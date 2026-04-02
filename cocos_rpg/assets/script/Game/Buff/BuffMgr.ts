import { _decorator, Component, Node } from 'cc';
import { BuffRuntimeInfo } from './BuffRuntimeInfo';
import { BuffData } from './types';
import { AttributeChangeResolver } from './AttributeChangeResolver';
import { BuffFactory } from './BuffFactory';
const { ccclass, property } = _decorator;

@ccclass('BuffMgr')
export class BuffMgr {
    private owner: any;
    private buffMap: Map<number, BuffRuntimeInfo> = new Map();

    constructor(owner: any) {
        this.owner = owner;
    }
    /**添加buff */
    addBuff(data: BuffData): BuffRuntimeInfo {
        const id = data.id;
        let runtime = this.buffMap.get(id)
        if (runtime) {
            runtime.addStack();
            // 重新应用变化（先移除旧变化，然后重新 apply）
            AttributeChangeResolver.removeChanges(runtime);
            AttributeChangeResolver.applyChanges(runtime);
            runtime.effect?.onAdd?.();
            return runtime;
        }
        // 创建 runtime，并创建 effect（工厂）
        runtime = BuffFactory.createRuntime(data, this.owner);
        // effect 必须存在或至少 runtime 有 data
        if (runtime.effect) {
            // apply declaration -> 生成 modifier 并记录
            AttributeChangeResolver.applyChanges(runtime);
            runtime.effect.onAdd?.();
        } else {
            // 若没有 effect，但仍支持声明式的变化（可直接生成 changes）
            // none
        }
        this.buffMap.set(id, runtime);
        return runtime;
    }
    /**移除buff */
    removeBuff(buffId:number){
        const runtime = this.buffMap.get(buffId);
        if(!runtime){
            console.error("未找到对应buff");
            return;
        }
        runtime.effect?.onRemove?.();

        AttributeChangeResolver.removeChanges(runtime);
        
        this.buffMap.delete(buffId);
    }

    hasBuff(buffId:number):boolean{
        return (this.buffMap.get(buffId))!=null;
    }
    /**获取runtime */
    get(buffId):BuffRuntimeInfo|undefined{
        return(this.buffMap.get(buffId));
    }
    update(dt:number){
        const removeList:number[]=[];

        this.buffMap.forEach((runtime, id) => {
            // 持续时间递减
            if (runtime.data.duration && runtime.data.duration > 0) {
                runtime.remainTime -= dt;
            }

            // Tick
            if (runtime.data.tickInterval && runtime.data.tickInterval > 0) {
                runtime.tickTimer -= dt;
                if (runtime.tickTimer <= 0) {
                    runtime.tickTimer = runtime.data.tickInterval!;
                    runtime.effect?.onTick?.(dt);
                }
            }

            // 过期
            if (runtime.expired) {
                removeList.push(id);
            }
        });

        for (const id of removeList) {
            this.removeBuff(id);
        }
    }
}


