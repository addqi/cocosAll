import { _decorator, Component, Node } from 'cc';
import { BuffData, BuffEffectCtor } from './types';
import { BuffRuntimeInfo } from './BuffRuntimeInfo';
const { ccclass, property } = _decorator;
/**
 * BuffFactory - 根据 data.effectClass 创建具体 BuffEffect 实例
 * 你可以在这里注册效果类（由策划用字符串引用）
 */
@ccclass('BuffFactory')
export class BuffFactory extends Component {
    private static registry:Map<string,BuffEffectCtor>=new Map();

    static register(name:string,ctor:BuffEffectCtor){
        this.registry.set(name,ctor);
    }

    static createRuntime(data:BuffData,owner:any):BuffRuntimeInfo{
        const runtime=new BuffRuntimeInfo(data,owner);

        if(data.effectClass){
            const ctor = this.registry.get(data.effectClass);
            if (!ctor) {
                console.warn(`[BuffFactory] effectClass ${data.effectClass} 未注册`);
            } else {
                runtime.effect = new ctor(runtime);
            }
        }
        return runtime;
    }
}


