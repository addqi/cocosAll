System.register(["__unresolved_0", "cc", "__unresolved_1", "__unresolved_2"], function (_export, _context) {
  "use strict";

  var _reporterNs, _cclegacy, __checkObsolete__, __checkObsoleteInNamespace__, _decorator, Component, Vec3, SoliderModel, BattleManager, _dec, _class, _crd, ccclass, property, Solider;

  function _reportPossibleCrUseOfSoliderModel(extras) {
    _reporterNs.report("SoliderModel", "./battle/SoliderModel", _context.meta, extras);
  }

  function _reportPossibleCrUseOfBattleManager(extras) {
    _reporterNs.report("BattleManager", "./manager/BattleManager", _context.meta, extras);
  }

  return {
    setters: [function (_unresolved_) {
      _reporterNs = _unresolved_;
    }, function (_cc) {
      _cclegacy = _cc.cclegacy;
      __checkObsolete__ = _cc.__checkObsolete__;
      __checkObsoleteInNamespace__ = _cc.__checkObsoleteInNamespace__;
      _decorator = _cc._decorator;
      Component = _cc.Component;
      Vec3 = _cc.Vec3;
    }, function (_unresolved_2) {
      SoliderModel = _unresolved_2.SoliderModel;
    }, function (_unresolved_3) {
      BattleManager = _unresolved_3.BattleManager;
    }],
    execute: function () {
      _crd = true;

      _cclegacy._RF.push({}, "ad1fby91fVLHaF7CkqI7q/q", "Solider", undefined);

      __checkObsolete__(['_decorator', 'animation', 'Component', 'find', 'game', 'Node', 'SkeletalAnimation', 'TiledObjectGroup', 'Vec3', 'Vec4']);

      ({
        ccclass,
        property
      } = _decorator);

      _export("Solider", Solider = (_dec = ccclass('Solider'), _dec(_class = class Solider extends Component {
        constructor(...args) {
          super(...args);
          this._index = 0;
          //小兵编号
          this._team = 0;
          //小兵队伍
          this._cardInfo = {};
          //
          this._startPos = new Vec3();
          //小兵初始位置
          this.speed = 3;
          //小兵移动速度
          this._target = null;
          //移动目标
          this._damage = 50;
          this._isAttack = false;
          this.direction = new Vec3();
          this.currentPos = new Vec3();
          //当前位置
          this.forward = new Vec3();
          this.coolTime = 0;
        }

        //小兵攻击力
        // @property(Node)
        // model: Node = null;
        // @property(SkeletalAnimation)
        // animation: SkeletalAnimation = null;
        start() {}

        update(deltaTime) {} // 初始化


        init(index, team, pos, cardInfo) {
          this.node.setPosition(pos);
          this._startPos = pos;
          this._index = index;
          this._team = team;
          this._cardInfo = cardInfo; //获取卡牌信息 
          // 小兵队伍

          if (team == 1) {
            this.node.eulerAngles = new Vec3(0, 180, 0); // this.node.scale=new Vec3(-1*this.node.scale.x,this.node.scale.y,this.node.scale.z);
          } else if (team == 2) {}

          let _model = this.node.children[0];

          let _fightModel = _model.getComponent(_crd && SoliderModel === void 0 ? (_reportPossibleCrUseOfSoliderModel({
            error: Error()
          }), SoliderModel) : SoliderModel);

          _fightModel.updateInfo(this);

          _fightModel.playAni("run", true);

          this._findEnemy();
        }

        get team() {
          return this._team;
        } // 找到敌人


        _findEnemy() {
          this._target = (_crd && BattleManager === void 0 ? (_reportPossibleCrUseOfBattleManager({
            error: Error()
          }), BattleManager) : BattleManager).instance._gameManger.getWallNode(this._team);

          if (this._target) {
            console.log("找到敌人");
          }
        }

        lateUpdate(dt) {
          if (this._target) {
            let targetPos = this._target.getPosition().clone();

            let offset = targetPos.subtract(this.node.getPosition().clone());
            let diss = Math.floor(offset.length()); // console.log("diss距离是:"+diss);

            if (diss <= 1.5) {
              this.soliderAttack(dt);
            } else {
              this.node.children[0].getComponent(_crd && SoliderModel === void 0 ? (_reportPossibleCrUseOfSoliderModel({
                error: Error()
              }), SoliderModel) : SoliderModel).playAni("run", true); // console.log("不在攻击范围内:");
              // this._isAttack = false;

              this.direction.set(offset);
              this.direction.x += Math.floor(Math.random() * 0.2) - 0.1;
              this.direction.z += Math.floor(Math.random() * 0.2) - 0.1;
              this.direction.y = 0;
              this.direction.normalize();
              let forward = new Vec3();
              forward.set(this.direction);
              forward.normalize(); // this.node.forward = forward;
              // this.node.eulerAngles=new Vec3(0,180,0);

              this.forward = forward;
              this.direction = this.direction.multiplyScalar(this.speed / 100);
              this.direction.y = 0;
              this.currentPos.set(this.node.position);
              this.currentPos.add(this.direction);
              this.node.position = this.currentPos;
            }
          }
        } // Solider.ts


        soliderAttack(dt) {
          this.node.position = this.currentPos; // 恢复位置

          if (this.coolTime > 0 && !this._isAttack) {
            this.node.children[0].getComponent(_crd && SoliderModel === void 0 ? (_reportPossibleCrUseOfSoliderModel({
              error: Error()
            }), SoliderModel) : SoliderModel).playAni("idle", true);
            this.coolTime -= dt;
          } else if (this.coolTime <= 0) {
            this._isAttack = true; // 播放攻击动画，并在完成后切换回 idle

            this.node.children[0].getComponent(_crd && SoliderModel === void 0 ? (_reportPossibleCrUseOfSoliderModel({
              error: Error()
            }), SoliderModel) : SoliderModel).playAni("attack", false, () => {
              this._isAttack = false;
              console.log("攻击动画完成");

              if (this._target) {
                (_crd && BattleManager === void 0 ? (_reportPossibleCrUseOfBattleManager({
                  error: Error()
                }), BattleManager) : BattleManager).instance.onDamege(this._damage, this._team);
              } // 攻击完成后强制切换回 idle


              this.node.children[0].getComponent(_crd && SoliderModel === void 0 ? (_reportPossibleCrUseOfSoliderModel({
                error: Error()
              }), SoliderModel) : SoliderModel).playAni("idle", true);
            });
            this.coolTime = 0.5;
          }
        }

      }) || _class));

      _cclegacy._RF.pop();

      _crd = false;
    }
  };
});
//# sourceMappingURL=f278c57ca5236316e31b5a6656db0ba15efef75f.js.map