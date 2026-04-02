import { _decorator, Component, Node, Prefab, ProgressBar } from 'cc';
import { GeneralPropertyMgr } from '../Base/Property/GeneralPropertyMgr';
const { ccclass, property } = _decorator;

@ccclass('enemyMgr')
export class enemyMgr extends Component {
    /**敌人属性管理器 */
    enemyPropertyMgr: GeneralPropertyMgr = new GeneralPropertyMgr();
    /**敌人UID */
    enemyUid: string = 'enemyMgr';
    /**伤害飘字预制体 */
    @property(Prefab)
    damageLabelPrefab:Prefab = null;

    /**伤害飘字节点 */
    damageLabelNode:Node = null;
    /**伤害飘字对象池 */
    // damageLabelPool:List<Node> = new List<Node>();

    /**当前血量 */
    currentHp:number = 0;
    /**防御 */
    get defence(){
        return this.enemyPropertyMgr.get("Defence");
    }
    /**最大血量 */
    get maxHp(){
        return this.enemyPropertyMgr.get("Hp");
    }
    /**速度 */
    get speed(){
        return this.enemyPropertyMgr.get("Speed");
    }
    /**暴击率 */
    get critRate(){
        return this.enemyPropertyMgr.get("CritRate");
    }
    /**暴击伤害 */
    get critDamage(){
        return this.enemyPropertyMgr.get("CritDamage");
    }
    /**血量进度条 */
    @property(ProgressBar)
    hpProgressBar:ProgressBar = null;
    protected onLoad(): void {
        this.enemyPropertyMgr.initializeFromConfigs();
        this.currentHp =this.maxHp;
    }
    /**受到伤害 */
    onDamage(damage:number){
        /**计算伤害 */
        damage = this.calculateDamage(damage,this.defence);
        this.currentHp -= damage;
        /**更新血量进度条 */
        this.hpProgressBar.progress = this.currentHp/this.maxHp;
        if(this.currentHp <= 0){
            this.onDead();
        }
        /**生成伤害飘字 */
        this.spawnDamageText(damage);
    }
    /**计算伤害 */
    calculateDamage(damage:number,defence:number){
        return damage/(1+defence);
    }
    /**死亡 */
    onDead(){
        console.log("敌人死亡");
    }
    /**生成伤害飘字 */
    spawnDamageText(damage:number){
        
    }
}


