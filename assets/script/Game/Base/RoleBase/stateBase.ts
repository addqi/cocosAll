import { _decorator, Component, Node } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('stateBase')
export abstract class stateBase  {
    /**
     * 进入状态
     */ 
    abstract enterState(): void;
    
    /**
     * 更新状态
     */
    abstract updateState(dt: number): void;

    /**
     * 退出状态
     */

    abstract exitState(): void;
}


