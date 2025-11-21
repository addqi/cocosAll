import { _decorator, Component, Label, Node } from 'cc';
import { ProPertyMgr } from '../Base/Property/ProPertyMgr';
import { BaseValueProperty, ComputeValueProperty } from '../Base/Property/BaseValueProperty';
import { SpeedProId } from '../GlobalEnum/Enum';
const { ccclass, property } = _decorator;
export enum RoleSpeedProperty{
    MoveSpeed = 'moveSpeed_Value_Config'
    ,
}

@ccclass('RolePropertyMgr')
export class RolePropertyMgr extends Component {
    @property(Label)
    public speedLabel:Label = null;
    //速度

    public roleSpeed:ProPertyMgr = new ProPertyMgr();
    public uid: string = 'RolePropertyMgr';

    protected onLoad(): void {
        this.roleSpeed.register(new BaseValueProperty(100,SpeedProId.speedBaseValue));
        this.roleSpeed.register(new BaseValueProperty(0,SpeedProId.speedBuffValue));
        this.roleSpeed.register(new BaseValueProperty(0,SpeedProId.speedOtherValue));

        this.roleSpeed.register(new BaseValueProperty(0,SpeedProId.speedMulBuffValue));
        this.roleSpeed.register(new BaseValueProperty(0,SpeedProId.speedMulOtherValue));

        this.roleSpeed.register(new ComputeValueProperty(()=>
            this.roleSpeed.get(SpeedProId.speedBaseValue)+
            this.roleSpeed.get(SpeedProId.speedBuffValue)+
            this.roleSpeed.get(SpeedProId.speedOtherValue)
        ,SpeedProId.speedTotalValue));

        this.roleSpeed.register(new ComputeValueProperty(() => {
            const total = this.roleSpeed.get(SpeedProId.speedTotalValue);
            const mulBuff = this.roleSpeed.get(SpeedProId.speedMulBuffValue);
            const mulOther = this.roleSpeed.get(SpeedProId.speedMulOtherValue);

            // 乘法类型默认为 1，额外倍率以 0 表示无加成
            const multiplier = 1 + mulBuff + mulOther;
            return total * multiplier;
        }, SpeedProId.MoveSpeed));
    }

    protected update(dt: number): void {
        if (!this.speedLabel) {
            return;
        }

        const currentSpeed = this.roleSpeed.get(SpeedProId.MoveSpeed);
        console.log("当前速度：", currentSpeed);
        this.speedLabel.string = `当前速度：${currentSpeed.toFixed(2)}`;
    }

    public refreshSpeedDirty() {
        this.roleSpeed.getProperty(SpeedProId.speedTotalValue)?.makeDirty();
        this.roleSpeed.getProperty(SpeedProId.MoveSpeed)?.makeDirty();
    }

    public getPropertyManager() {
        return this.roleSpeed;
    }
}


