System.register(["__unresolved_0", "cc", "__unresolved_1", "__unresolved_2"], function (_export, _context) {
  "use strict";

  var _reporterNs, _cclegacy, __checkObsolete__, __checkObsoleteInNamespace__, _decorator, Component, instantiate, Node, resources, v3, Vec3, FightetModel, BattleManager, _dec, _dec2, _class, _class2, _descriptor, _crd, ccclass, property, Fighter;

  function _initializerDefineProperty(target, property, descriptor, context) { if (!descriptor) return; Object.defineProperty(target, property, { enumerable: descriptor.enumerable, configurable: descriptor.configurable, writable: descriptor.writable, value: descriptor.initializer ? descriptor.initializer.call(context) : void 0 }); }

  function _applyDecoratedDescriptor(target, property, decorators, descriptor, context) { var desc = {}; Object.keys(descriptor).forEach(function (key) { desc[key] = descriptor[key]; }); desc.enumerable = !!desc.enumerable; desc.configurable = !!desc.configurable; if ('value' in desc || desc.initializer) { desc.writable = true; } desc = decorators.slice().reverse().reduce(function (desc, decorator) { return decorator(target, property, desc) || desc; }, desc); if (context && desc.initializer !== void 0) { desc.value = desc.initializer ? desc.initializer.call(context) : void 0; desc.initializer = undefined; } if (desc.initializer === void 0) { Object.defineProperty(target, property, desc); desc = null; } return desc; }

  function _initializerWarningHelper(descriptor, context) { throw new Error('Decorating class property failed. Please ensure that ' + 'transform-class-properties is enabled and runs after the decorators transform.'); }

  function _reportPossibleCrUseOfFightetModel(extras) {
    _reporterNs.report("FightetModel", "./FightetModel", _context.meta, extras);
  }

  function _reportPossibleCrUseOfBattleManager(extras) {
    _reporterNs.report("BattleManager", "../manager/BattleManager", _context.meta, extras);
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
      instantiate = _cc.instantiate;
      Node = _cc.Node;
      resources = _cc.resources;
      v3 = _cc.v3;
      Vec3 = _cc.Vec3;
    }, function (_unresolved_2) {
      FightetModel = _unresolved_2.FightetModel;
    }, function (_unresolved_3) {
      BattleManager = _unresolved_3.BattleManager;
    }],
    execute: function () {
      _crd = true;

      _cclegacy._RF.push({}, "de9e6riAJtMdZbRechQgS02", "Fighter", undefined);

      __checkObsolete__(['_decorator', 'Component', 'instantiate', 'Node', 'Prefab', 'resources', 'v3', 'Vec2', 'Vec3']);

      ({
        ccclass,
        property
      } = _decorator);

      _export("Fighter", Fighter = (_dec = ccclass('Fighter'), _dec2 = property(Node), _dec(_class = (_class2 = class Fighter extends Component {
        constructor() {
          super(...arguments);

          _initializerDefineProperty(this, "model", _descriptor, this);

          this.speed = 5;
          this._index = void 0;
          this._team = void 0;
          this._soliderInfo = void 0;
          this._startPos = void 0;
          this._target = void 0;
          this._fighterModel = void 0;
          this._isAttack = false;
          this._direction = new Vec3();
          this._currentPos = new Vec3();
          this._forward = new Vec3();
          this._tagetPos = new Vec3();
          this.offset = new Vec3();
          this.coolTime = 0.5;
        }

        init(index, team, soliderInfo, startPos) {
          var self = this;
          this._index = index;
          this._team = team;
          this._soliderInfo = soliderInfo;
          this._startPos = startPos;
          this.node.position = startPos;
          var rotationY = 0;

          if (team == 2) {
            rotationY = 0;
          } else if (team == 1) {
            rotationY = 180;
          }

          this.node.eulerAngles = v3(0, rotationY, 0);
          this.scheduleOnce(() => {
            resources.load("prefab/solider/" + soliderInfo.soliderName, (err, prefab) => {
              if (err) {
                return;
              }

              var _model = instantiate(prefab);

              this._fighterModel = _model.getComponent(_crd && FightetModel === void 0 ? (_reportPossibleCrUseOfFightetModel({
                error: Error()
              }), FightetModel) : FightetModel);

              this._fighterModel.updateinfo(self);

              this._fighterModel.playAni("idle");

              self.model.addChild(_model);
            });
          }, 0.2);

          this._findEnemy();
        }

        get team() {
          return this._team;
        }

        _findEnemy() {
          this._isAttack = false;
          this._target = (_crd && BattleManager === void 0 ? (_reportPossibleCrUseOfBattleManager({
            error: Error()
          }), BattleManager) : BattleManager).instance.gameManager.getWallNode(1);
        }

        lateUpdate(dt) {
          if ((_crd && BattleManager === void 0 ? (_reportPossibleCrUseOfBattleManager({
            error: Error()
          }), BattleManager) : BattleManager).instance.isGameOver) {
            return;
          }

          if (this._target) {
            var targetPos = v3(this._target.position.x, this._target.position.y, this._target.position.z);

            this._tagetPos.set(targetPos);

            this.offset = this._tagetPos.subtract(this.node.position);
            var diss = Math.floor(this.offset.length() - 5);
            console.log("diss:" + diss);

            if (diss <= 3) {
              console.log("攻击范围内:" + this.coolTime); // this._isAttack = true;

              if (this.coolTime <= 0) {
                this.soliderAttack();
              } else {
                this.coolTime -= dt;
              }
            } else {
              if (this._fighterModel) {
                this._fighterModel.playAni("run", true);
              }

              this._direction.set(this.offset);

              this._direction.x += Math.floor(Math.random() * 0.2) - 0.1;
              this._direction.z += Math.floor(Math.random() * 0.2) - 0.1;

              this._direction.normalize();

              this._direction.y = 0;

              this._forward.set(this._direction);

              this._forward.normalize(); // this.node.forward = this._forward;


              this._direction = this._direction.multiplyScalar(this.speed / 100);
              this._direction.y = 0;

              this._currentPos.set(this.node.position);

              this._currentPos.add(this._direction);

              this.node.position = this._currentPos;
            }
          }
        }

        soliderAttack() {
          if (this.coolTime > 0) {
            this._fighterModel.playAni("idle", true);

            return;
          }

          if (this._fighterModel) {
            this._isAttack = true;

            this._fighterModel.playAni("attack", false, () => {
              this._isAttack = false;

              if (this._target) {
                var damage = 50;
                (_crd && BattleManager === void 0 ? (_reportPossibleCrUseOfBattleManager({
                  error: Error()
                }), BattleManager) : BattleManager).instance.onDamage(damage);
              }
            });
          }
        }

      }, (_descriptor = _applyDecoratedDescriptor(_class2.prototype, "model", [_dec2], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      })), _class2)) || _class));

      _cclegacy._RF.pop();

      _crd = false;
    }
  };
});
//# sourceMappingURL=dc2988e6c34cfd74822e861538d6e5a0ee44b68f.js.map