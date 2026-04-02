System.register(["__unresolved_0", "cc", "__unresolved_1", "__unresolved_2"], function (_export, _context) {
  "use strict";

  var _reporterNs, _cclegacy, __checkObsolete__, __checkObsoleteInNamespace__, _decorator, Component, Uimanager, ConfigManager, _dec, _class, _crd, ccclass, property, Map;

  function _reportPossibleCrUseOfUimanager(extras) {
    _reporterNs.report("Uimanager", "./manager/Uimanager", _context.meta, extras);
  }

  function _reportPossibleCrUseOfConfigManager(extras) {
    _reporterNs.report("ConfigManager", "../res/scripts/manager/ConfigManager", _context.meta, extras);
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
      Uimanager = _unresolved_2.Uimanager;
    }, function (_unresolved_3) {
      ConfigManager = _unresolved_3.ConfigManager;
    }],
    execute: function () {
      _crd = true;

      _cclegacy._RF.push({}, "6709dHUQKdD5JLdnUVA6W2o", "Map", undefined);

      __checkObsolete__(['_decorator', 'Component', 'instantiate', 'Node', 'Prefab', 'resources']);

      ({
        ccclass,
        property
      } = _decorator);

      _export("Map", Map = (_dec = ccclass('Map'), _dec(_class = class Map extends Component {
        onLoad() {
          this.init();
        }

        update(deltaTime) {}

        init() {
          (_crd && ConfigManager === void 0 ? (_reportPossibleCrUseOfConfigManager({
            error: Error()
          }), ConfigManager) : ConfigManager).instance.loadCsv(); //加载数据表

          (_crd && Uimanager === void 0 ? (_reportPossibleCrUseOfUimanager({
            error: Error()
          }), Uimanager) : Uimanager).instance.showPanel("HomePanel");
        }

      }) || _class));

      _cclegacy._RF.pop();

      _crd = false;
    }
  };
});
//# sourceMappingURL=21a2d745ccd3c6d35666f0854e805bbbbda9c3ea.js.map