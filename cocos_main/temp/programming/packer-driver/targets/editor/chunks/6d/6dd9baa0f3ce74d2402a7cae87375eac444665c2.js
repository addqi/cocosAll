System.register(["__unresolved_0", "cc", "__unresolved_1", "__unresolved_2", "__unresolved_3"], function (_export, _context) {
  "use strict";

  var _reporterNs, _cclegacy, __checkObsolete__, __checkObsoleteInNamespace__, _decorator, instantiate, PhysicsSystem, resources, v3, CardManager, ConfigManager, Fighter, _dec, _class, _class2, _crd, ccclass, property, FigthManager;

  function _reportPossibleCrUseOfCardManager(extras) {
    _reporterNs.report("CardManager", "./CardManager", _context.meta, extras);
  }

  function _reportPossibleCrUseOfConfigManager(extras) {
    _reporterNs.report("ConfigManager", "./ConfigManager", _context.meta, extras);
  }

  function _reportPossibleCrUseOfFighter(extras) {
    _reporterNs.report("Fighter", "../battle/Fighter", _context.meta, extras);
  }

  return {
    setters: [function (_unresolved_) {
      _reporterNs = _unresolved_;
    }, function (_cc) {
      _cclegacy = _cc.cclegacy;
      __checkObsolete__ = _cc.__checkObsolete__;
      __checkObsoleteInNamespace__ = _cc.__checkObsoleteInNamespace__;
      _decorator = _cc._decorator;
      instantiate = _cc.instantiate;
      PhysicsSystem = _cc.PhysicsSystem;
      resources = _cc.resources;
      v3 = _cc.v3;
    }, function (_unresolved_2) {
      CardManager = _unresolved_2.CardManager;
    }, function (_unresolved_3) {
      ConfigManager = _unresolved_3.ConfigManager;
    }, function (_unresolved_4) {
      Fighter = _unresolved_4.Fighter;
    }],
    execute: function () {
      _crd = true;

      _cclegacy._RF.push({}, "a57bffxA51A1rmmLfn00bVh", "FigthManager", undefined);

      __checkObsolete__(['_decorator', 'CameraComponent', 'EventTouch', 'find', 'instantiate', 'Node', 'PhysicsSystem', 'Prefab', 'resources', 'v3', 'Vec3']);

      ({
        ccclass,
        property
      } = _decorator);

      _export("FigthManager", FigthManager = (_dec = ccclass("FigthManager"), _dec(_class = (_class2 = class FigthManager {
        constructor() {
          this.dicPanel = {};
          this.mainCamer = null;
          this.soliderParent = null;
          this.dicSolider = {};
          this.dicSoliderSrc = {};
          this._index = 1;
        }

        static get instance() {
          if (this._instance) {
            return this._instance;
          }

          this._instance = new FigthManager();
          return this._instance;
        }

        touchStart(touch) {
          let camera = this.mainCamer;

          if (camera && touch) {
            let ray = camera.screenPointToRay(touch.getLocationX(), touch.getLocationY());

            if (ray) {
              if (!PhysicsSystem.instance.raycastClosest(ray)) {
                return;
              }
            }
          }
        }

        touchEnd(touch) {
          let camera = this.mainCamer;

          if (camera && touch) {
            let ray = camera.screenPointToRay(touch.getLocationX(), touch.getLocationY());

            if (ray) {
              let raycastClosestResult = PhysicsSystem.instance.raycastClosestResult;
              let pos = v3(raycastClosestResult.hitPoint.x, 0, raycastClosestResult.hitPoint.z);
              let cardList = (_crd && CardManager === void 0 ? (_reportPossibleCrUseOfCardManager({
                error: Error()
              }), CardManager) : CardManager).instance.chooseCards;
              let cardInfo = this.getSoliderInfo(cardList);
              (_crd && CardManager === void 0 ? (_reportPossibleCrUseOfCardManager({
                error: Error()
              }), CardManager) : CardManager).instance.updateCard(cardList, (_crd && CardManager === void 0 ? (_reportPossibleCrUseOfCardManager({
                error: Error()
              }), CardManager) : CardManager).instance.cardArray);

              if (cardInfo) {
                this.addFighter(1, cardInfo, pos);
              }
            }
          }
        }

        addFighter(team, cardInfo, pos) {
          resources.load("prefab/fighter/Fighter", (err, prefab) => {
            if (err) {
              return;
            }

            let index = this._index++;
            let node = instantiate(prefab);
            let soliderScript = node.getComponent(_crd && Fighter === void 0 ? (_reportPossibleCrUseOfFighter({
              error: Error()
            }), Fighter) : Fighter);

            if (this.soliderParent) {
              this.soliderParent.addChild(node);
            }

            soliderScript.init(index, team, cardInfo, pos);

            if (!this.dicSolider.hasOwnProperty(team)) {
              this.dicSolider[team] = {};
            }

            this.dicSolider[team][index] = node;

            if (!this.dicSoliderSrc.hasOwnProperty(team)) {
              this.dicSoliderSrc[team] = {};
            }

            this.dicSoliderSrc[team][index] = soliderScript;
          });
        } //获取小兵信息


        getSoliderInfo(cardarr) {
          let cardInfo = cardarr[0];
          let obj = (_crd && ConfigManager === void 0 ? (_reportPossibleCrUseOfConfigManager({
            error: Error()
          }), ConfigManager) : ConfigManager).instance.queryAll("card", "type", cardInfo.type);

          if (obj) {
            for (let key in obj) {
              let info = obj[key];

              if (info.cardNum == cardarr.length) {
                return info;
              }
            }
          }
        }

        touchMove(touch) {
          let camera = this.mainCamer;

          if (camera && touch) {
            let ray = camera.screenPointToRay(touch.getLocationX(), touch.getLocationY());

            if (ray) {
              if (!PhysicsSystem.instance.raycastClosest(ray)) {
                return;
              }
            }
          }
        }

      }, _class2._instance = void 0, _class2)) || _class));

      _cclegacy._RF.pop();

      _crd = false;
    }
  };
});
//# sourceMappingURL=6dd9baa0f3ce74d2402a7cae87375eac444665c2.js.map