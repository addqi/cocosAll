System.register(["__unresolved_0", "cc", "__unresolved_1", "__unresolved_2", "__unresolved_3"], function (_export, _context) {
  "use strict";

  var _reporterNs, _cclegacy, __checkObsolete__, __checkObsoleteInNamespace__, _decorator, Component, instantiate, PhysicsSystem, resources, v3, CardManager, ConfigManager, Solider, _dec, _class, _class2, _crd, ccclass, property, FightManager;

  function _reportPossibleCrUseOfCardManager(extras) {
    _reporterNs.report("CardManager", "./CardManager", _context.meta, extras);
  }

  function _reportPossibleCrUseOfConfigManager(extras) {
    _reporterNs.report("ConfigManager", "./ConfigManager", _context.meta, extras);
  }

  function _reportPossibleCrUseOfSolider(extras) {
    _reporterNs.report("Solider", "../Solider", _context.meta, extras);
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
      PhysicsSystem = _cc.PhysicsSystem;
      resources = _cc.resources;
      v3 = _cc.v3;
    }, function (_unresolved_2) {
      CardManager = _unresolved_2.CardManager;
    }, function (_unresolved_3) {
      ConfigManager = _unresolved_3.ConfigManager;
    }, function (_unresolved_4) {
      Solider = _unresolved_4.Solider;
    }],
    execute: function () {
      _crd = true;

      _cclegacy._RF.push({}, "eda9fWd8FVEpaZFXSnp8REs", "FightManager", undefined);

      __checkObsolete__(['_decorator', 'Camera', 'CameraComponent', 'Component', 'EventTouch', 'find', 'instantiate', 'Node', 'PhysicsSystem', 'Prefab', 'resources', 'v3', 'Vec3']);

      ({
        ccclass,
        property
      } = _decorator);

      _export("FightManager", FightManager = (_dec = ccclass('FightManager'), _dec(_class = (_class2 = class FightManager extends Component {
        constructor(...args) {
          super(...args);
          this._dicPanel = {};
          this.camera = void 0;
          this.soliderParent = void 0;
          //士兵父节点
          this.dicSolider = {};
          //士兵字典
          this.dicSoliderSrc = {};
          this._index = 1;
        }

        //士兵脚本字典
        static get instance() {
          if (!this._instance) {
            this._instance = new FightManager();
          }

          return this._instance;
        }

        touchStart(event) {
          let camera = this.camera;

          if (camera && event) {
            let ray = camera.screenPointToRay(event.getLocation().x, event.getLocation().y);

            if (ray) {
              if (!PhysicsSystem.instance.raycastClosest(ray)) {
                return;
              }
            }
          }
        }

        touchMove(event) {
          let camera = this.camera;

          if (camera && event) {
            let ray = camera.screenPointToRay(event.getLocation().x, event.getLocation().y);

            if (ray) {
              if (!PhysicsSystem.instance.raycastClosest(ray)) {
                return;
              }
            }
          }
        }

        touchEnd(touch) {
          console.log("鼠标结束");
          let camera = this.camera;

          if (camera && touch) {
            let ray = camera.screenPointToRay(touch.getLocationX(), touch.getLocationY());
            console.log("ray:" + ray);

            if (ray) {
              PhysicsSystem.instance.raycastClosest(ray);
              let raycastClosestResult = PhysicsSystem.instance.raycastClosestResult;
              console.log("ray:" + raycastClosestResult.hitPoint);
              let pos = v3(raycastClosestResult.hitPoint.x, 0, raycastClosestResult.hitPoint.z);
              console.log("pos:" + pos);
              let cardList = (_crd && CardManager === void 0 ? (_reportPossibleCrUseOfCardManager({
                error: Error()
              }), CardManager) : CardManager).instance.chooseCards;
              let cardInfo = this.getSoliderInfo(cardList);
              (_crd && CardManager === void 0 ? (_reportPossibleCrUseOfCardManager({
                error: Error()
              }), CardManager) : CardManager).instance.updateCard(cardList, (_crd && CardManager === void 0 ? (_reportPossibleCrUseOfCardManager({
                error: Error()
              }), CardManager) : CardManager).instance.cardArry);
              console.log("准备创建:");

              if (cardInfo) {
                this.addSolider(1, pos, cardInfo);
              }
            }
          }
        }

        //小兵id
        addSolider(team, pos, cardInfo) {
          console.log("可以创建一个:");
          resources.load("prefab/solider/solider", (err, prefab) => {
            if (err) {
              console.error("加载错误:", err);
              return;
            }

            console.log("成功创建一个");
            let index = this._index++;
            let node = instantiate(prefab);
            this.soliderParent.addChild(node);
            let soliderScript = node.getComponent(_crd && Solider === void 0 ? (_reportPossibleCrUseOfSolider({
              error: Error()
            }), Solider) : Solider);
            soliderScript.init(index, team, pos, cardInfo);

            if (!this.dicSolider.hasOwnProperty(team)) {
              this.dicSolider[team] = {};
            }

            this.dicSolider[team][index] = node;
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

          return cardInfo; //临时返回
        }

        touchCancel(event) {
          let camera = this.camera;

          if (camera && event) {
            let ray = camera.screenPointToRay(event.getLocation().x, event.getLocation().y);

            if (ray) {
              if (!PhysicsSystem.instance.raycastClosest(ray)) {
                return;
              }
            }
          }
        }

      }, _class2._instance = null, _class2)) || _class));

      _cclegacy._RF.pop();

      _crd = false;
    }
  };
});
//# sourceMappingURL=53f5d7a59698272f4794ee055d43ea08ab2b88d7.js.map