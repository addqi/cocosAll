System.register(["cc"], function (_export, _context) {
  "use strict";

  var _cclegacy, __checkObsolete__, __checkObsoleteInNamespace__, _decorator, find, instantiate, Prefab, resources, _dec, _class, _class2, _crd, ccclass, property, Uimanager;

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

      _cclegacy._RF.push({}, "23d46xBoYBMgIQPy+8e293n", "Uimanager", undefined);

      __checkObsolete__(['_decorator', 'Component', 'find', 'instantiate', 'Node', 'Prefab', 'resources']);

      ({
        ccclass,
        property
      } = _decorator);

      _export("Uimanager", Uimanager = (_dec = ccclass('Uimanager'), _dec(_class = (_class2 = class Uimanager {
        constructor() {
          this._dicPanel = {};
        }

        static get instance() {
          if (!this._instance) {
            this._instance = new Uimanager();
          }

          return this._instance;
        }

        showPanel(name, func) {
          resources.load("prefab/UI/" + name, Prefab, (err, prefab) => {
            if (err) {
              console.error("加载错误:", err);
              return;
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
                node.parent = parent;
              }

              if (!this._dicPanel[name]) {
                this._dicPanel[name] = panel;
              }
            }

            if (func) {
              func();
            }
          });
        }

        hidePanel(name) {
          var panel = this._dicPanel[name];

          if (panel) {
            console.log("成功销毁", panel);
            panel.node.parent = null;
            panel.node.destroy(); // panel.parent=null;
            // panel.destroy();

            delete this._dicPanel[name];
          }
        }

        start() {}

        update(deltaTime) {}

      }, _class2._instance = null, _class2)) || _class));

      _cclegacy._RF.pop();

      _crd = false;
    }
  };
});
//# sourceMappingURL=444eef0f99b503385abea6a9f7a953b8e1d93a30.js.map