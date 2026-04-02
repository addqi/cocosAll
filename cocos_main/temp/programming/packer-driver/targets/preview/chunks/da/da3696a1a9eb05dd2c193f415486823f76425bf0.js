System.register(["cc"], function (_export, _context) {
  "use strict";

  var _cclegacy, __checkObsolete__, __checkObsoleteInNamespace__, _decorator, find, instantiate, Prefab, resources, _dec, _class, _class2, _crd, ccclass, property, UiManager;

  return {
    setters: [function (_cc) {
      _cclegacy = _cc.cclegacy;
      __checkObsolete__ = _cc.__checkObsolete__;
      __checkObsoleteInNamespace__ = _cc.__checkObsoleteInNamespace__;
      _decorator = _cc._decorator;
      find = _cc.find;
      instantiate = _cc.instantiate;
      Prefab = _cc.Prefab;
      resources = _cc.resources;
    }],
    execute: function () {
      _crd = true;

      _cclegacy._RF.push({}, "8aae4OUX3NEwaXeMToKj5Cx", "UiManager", undefined);

      __checkObsolete__(['_decorator', 'find', 'instantiate', 'Prefab', 'resources']);

      ({
        ccclass,
        property
      } = _decorator);

      _export("UiManager", UiManager = (_dec = ccclass("UiManager"), _dec(_class = (_class2 = class UiManager {
        constructor() {
          this.dicPanel = {};
        }

        static get instance() {
          if (this._instance) {
            return this._instance;
          }

          this._instance = new UiManager();
          return this._instance;
        }

        showPanel(name, func) {
          resources.load("prefab/ui/" + name, Prefab, (err, prefab) => {
            if (err) {
              console.log("加载错误" + err);
            }

            if (prefab) {
              var node = instantiate(prefab);
              var panel = node.getComponent(name);

              if (panel) {
                panel.init();
              }

              var parent = find("Canvas");

              if (parent) {
                parent.addChild(node);
              }

              if (!this.dicPanel[name]) {
                this.dicPanel[name] = panel;
              }
            }

            if (func) {
              func();
            }
          });
        }

        hidePanel(name) {
          var panel = this.dicPanel[name];

          if (panel) {
            panel.parent = null;
            panel.destroy();
            this.dicPanel[name] = null;
          }
        }

      }, _class2._instance = void 0, _class2)) || _class));

      _cclegacy._RF.pop();

      _crd = false;
    }
  };
});
//# sourceMappingURL=da3696a1a9eb05dd2c193f415486823f76425bf0.js.map