System.register(["__unresolved_0", "cc", "__unresolved_1", "__unresolved_2"], function (_export, _context) {
  "use strict";

  var _reporterNs, _cclegacy, __checkObsolete__, __checkObsoleteInNamespace__, _decorator, Component, UiManager, ConfigManager, _dec, _class, _crd, ccclass, property, Main;

  function _reportPossibleCrUseOfUiManager(extras) {
    _reporterNs.report("UiManager", "./manager/UiManager", _context.meta, extras);
  }

  function _reportPossibleCrUseOfConfigManager(extras) {
    _reporterNs.report("ConfigManager", "./manager/ConfigManager", _context.meta, extras);
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
    }, function (_unresolved_2) {
      UiManager = _unresolved_2.UiManager;
    }, function (_unresolved_3) {
      ConfigManager = _unresolved_3.ConfigManager;
    }],
    execute: function () {
      _crd = true;

      _cclegacy._RF.push({}, "386ebEaC1xEVL2ezvlgJTmU", "Main", undefined);

      __checkObsolete__(['_decorator', 'Component', 'instantiate', 'Node', 'Prefab', 'resources']);

      ({
        ccclass,
        property
      } = _decorator);

      _export("Main", Main = (_dec = ccclass('Main'), _dec(_class = class Main extends Component {
        start() {
          this.init();
        }

        update(deltaTime) {}

        init() {
          (_crd && ConfigManager === void 0 ? (_reportPossibleCrUseOfConfigManager({
            error: Error()
          }), ConfigManager) : ConfigManager).instance.loadCsv();
          (_crd && UiManager === void 0 ? (_reportPossibleCrUseOfUiManager({
            error: Error()
          }), UiManager) : UiManager).instance.showPanel("HomePanel");
        }

      }) || _class));

      _cclegacy._RF.pop();

      _crd = false;
    }
  };
});
//# sourceMappingURL=060089d590b384ad0739e757477b22db89d53121.js.map