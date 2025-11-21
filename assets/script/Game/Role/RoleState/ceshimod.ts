import { _decorator, Component, Node } from 'cc';
import { RoleMgr } from '../RoleMgr';
import { BuffData } from '../../Buff/types';
import { SpeedProId } from '../../GlobalEnum/Enum';
const { ccclass, property } = _decorator;

@ccclass('ceshimod')
export class ceshimod extends Component {
    @property(RoleMgr)
    role:RoleMgr;

    private speedBuffConfig: BuffData = {
        id: 10001,
        name: '测试速度Buff',
        duration: 5,
        maxStack: 3,
        effectClass: 'SpeedUpEffect',
        targetAttr: SpeedProId.speedMulBuffValue,
        mulFactor: 1.4,
    };

    onclickAddBuff(){
        if(!this.role){
            console.warn('[ceshimod] 未绑定 RoleMgr，无法添加 buff');
            return;
        }
        this.role.getBuffMgr()?.addBuff(this.speedBuffConfig);
    }
    onclickRemoveBuff(){
        if(!this.role){
            console.warn('[ceshimod] 未绑定 RoleMgr，无法移除 buff');
            return;
        }
        this.role.getBuffMgr()?.removeBuff(this.speedBuffConfig.id);
    }
}


