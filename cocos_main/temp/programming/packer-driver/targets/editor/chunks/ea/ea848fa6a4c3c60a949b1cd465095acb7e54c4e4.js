System.register(["__unresolved_0", "cc", "__unresolved_1", "__unresolved_2", "__unresolved_3"], function (_export, _context) {
  "use strict";

  var _reporterNs, _cclegacy, __checkObsolete__, __checkObsoleteInNamespace__, _decorator, Camera, Component, instantiate, Node, Prefab, resources, clientEvent, BattleManager, FightManager, _dec, _dec2, _dec3, _dec4, _dec5, _class, _class2, _descriptor, _descriptor2, _descriptor3, _descriptor4, _crd, ccclass, property, GameManager;

  function _initializerDefineProperty(target, property, descriptor, context) { if (!descriptor) return; Object.defineProperty(target, property, { enumerable: descriptor.enumerable, configurable: descriptor.configurable, writable: descriptor.writable, value: descriptor.initializer ? descriptor.initializer.call(context) : void 0 }); }

  function _applyDecoratedDescriptor(target, property, decorators, descriptor, context) { var desc = {}; Object.keys(descriptor).forEach(function (key) { desc[key] = descriptor[key]; }); desc.enumerable = !!desc.enumerable; desc.configurable = !!desc.configurable; if ('value' in desc || desc.initializer) { desc.writable = true; } desc = decorators.slice().reverse().reduce(function (desc, decorator) { return decorator(target, property, desc) || desc; }, desc); if (context && desc.initializer !== void 0) { desc.value = desc.initializer ? desc.initializer.call(context) : void 0; desc.initializer = undefined; } if (desc.initializer === void 0) { Object.defineProperty(target, property, desc); desc = null; } return desc; }

  function _initializerWarningHelper(descriptor, context) { throw new Error('Decorating class property failed. Please ensure that ' + 'transform-class-properties is enabled and runs after the decorators transform.'); }

  function _reportPossibleCrUseOfclientEvent(extras) {
    _reporterNs.report("clientEvent", "../utils/clientEvent", _context.meta, extras);
  }

  function _reportPossibleCrUseOfBattleManager(extras) {
    _reporterNs.report("BattleManager", "./BattleManager", _context.meta, extras);
  }

  function _reportPossibleCrUseOfFightManager(extras) {
    _reporterNs.report("FightManager", "./FightManager", _context.meta, extras);
  }

  return {
    setters: [function (_unresolved_) {
      _reporterNs = _unresolved_;
    }, function (_cc) {
      _cclegacy = _cc.cclegacy;
      __checkObsolete__ = _cc.__checkObsolete__;
      __checkObsoleteInNamespace__ = _cc.__checkObsoleteInNamespace__;
      _decorator = _cc._decorator;
      Camera = _cc.Camera;
      Component = _cc.Component;
      instantiate = _cc.instantiate;
      Node = _cc.Node;
      Prefab = _cc.Prefab;
      resources = _cc.resources;
    }, function (_unresolved_2) {
      clientEvent = _unresolved_2.clientEvent;
    }, function (_unresolved_3) {
      BattleManager = _unresolved_3.BattleManager;
    }, function (_unresolved_4) {
      FightManager = _unresolved_4.FightManager;
    }],
    execute: function () {
      _crd = true;

      _cclegacy._RF.push({}, "3ba70TZ7iVE75t0JmR1Bryr", "GameManager", undefined);

      __checkObsolete__(['_decorator', 'Camera', 'Component', 'find', 'instantiate', 'Node', 'Prefab', 'resources']);

      ({
        ccclass,
        property
      } = _decorator);

      _export("GameManager", GameManager = (_dec = ccclass('GameManager'), _dec2 = property(Node), _dec3 = property(Node), _dec4 = property(Camera), _dec5 = property(Node), _dec(_class = (_class2 = class GameManager extends Component {
        constructor(...args) {
          super(...args);

          _initializerDefineProperty(this, "dfNode", _descriptor, this);

          _initializerDefineProperty(this, "myNode", _descriptor2, this);

          //生成人物模型
          _initializerDefineProperty(this, "camera", _descriptor3, this);

          _initializerDefineProperty(this, "soliderNode", _descriptor4, this);
        }

        onEnable() {
          (_crd && clientEvent === void 0 ? (_reportPossibleCrUseOfclientEvent({
            error: Error()
          }), clientEvent) : clientEvent).on("CreatorPlayer", this.onCreatorPalyer, this);
        }

        onDisable() {
          (_crd && clientEvent === void 0 ? (_reportPossibleCrUseOfclientEvent({
            error: Error()
          }), clientEvent) : clientEvent).off("CreatorPlayer", this.onCreatorPalyer, this);
        }

        onCreatorPalyer() {
          resources.load("prefab/player/player", Prefab, (err, prefab) => {
            if (err) {
              console.error("加载错误:", err);
              return;
            }

            if (prefab) {
              let node = instantiate(prefab);
              this.dfNode.addChild(node);
            }
          });
          resources.load("prefab/player/player", Prefab, (err, prefab) => {
            if (err) {
              console.error("加载错误:", err);
              return;
            }

            if (prefab) {
              let node = instantiate(prefab);
              this.myNode.addChild(node);
            }
          });
          (_crd && BattleManager === void 0 ? (_reportPossibleCrUseOfBattleManager({
            error: Error()
          }), BattleManager) : BattleManager).instance.initBattleInfo(this);
          (_crd && FightManager === void 0 ? (_reportPossibleCrUseOfFightManager({
            error: Error()
          }), FightManager) : FightManager).instance.camera = this.camera;
          (_crd && FightManager === void 0 ? (_reportPossibleCrUseOfFightManager({
            error: Error()
          }), FightManager) : FightManager).instance.soliderParent = this.soliderNode;
        }

        get mainCamera() {
          return this.camera;
        }

        getWallNode(team) {
          if (team == 1) {
            return this.dfNode;
          } else if (team == 2) {
            return this.myNode;
          }
        }

      }, (_descriptor = _applyDecoratedDescriptor(_class2.prototype, "dfNode", [_dec2], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor2 = _applyDecoratedDescriptor(_class2.prototype, "myNode", [_dec3], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor3 = _applyDecoratedDescriptor(_class2.prototype, "camera", [_dec4], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor4 = _applyDecoratedDescriptor(_class2.prototype, "soliderNode", [_dec5], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      })), _class2)) || _class));

      _cclegacy._RF.pop();

      _crd = false;
    }
  };
});
//# sourceMappingURL=ea848fa6a4c3c60a949b1cd465095acb7e54c4e4.js.map