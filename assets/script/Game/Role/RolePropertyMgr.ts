import { _decorator, Component, Label, Node } from 'cc';
import { GeneralPropertyMgr } from '../Base/Property/GeneralPropertyMgr';
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
    public propertyManager: GeneralPropertyMgr = new GeneralPropertyMgr();
    public uid: string = 'RolePropertyMgr';
    protected onLoad(): void {
        this.propertyManager.initializeFromConfigs();
    }

    protected update(dt: number): void {
        if (!this.speedLabel) {
            return;
        }

        const currentSpeed = this.propertyManager.get(SpeedProId.MoveSpeed);
        console.log("当前速度：", currentSpeed);
        this.speedLabel.string = `当前速度：${currentSpeed.toFixed(2)}`;
    }

    public refreshSpeedDirty() {
        this.refreshPropertyDirty([
            SpeedProId.speedTotalValue,
            SpeedProId.MoveSpeed,
        ]);
    }

    public refreshPropertyDirty(attrIds?: string[]) {
        this.propertyManager.markDirty(attrIds);
    }

    public getPropertyManager(id: string) {
        return this.propertyManager.getProperty(id);
    }
}


