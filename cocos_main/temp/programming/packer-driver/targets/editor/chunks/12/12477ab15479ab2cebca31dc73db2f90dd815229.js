System.register(["__unresolved_0", "cc", "__unresolved_1"], function (_export, _context) {
  "use strict";

  var _reporterNs, _cclegacy, __checkObsolete__, __checkObsoleteInNamespace__, _decorator, oneToMultiListener, _dec, _class, _class2, _crd, ccclass, property, clientEvent;

  function _reportPossibleCrUseOfoneToMultiListener(extras) {
    _reporterNs.report("oneToMultiListener", "./oneToMultiListener", _context.meta, extras);
  }

  return {
    setters: [function (_unresolved_) {
      _reporterNs = _unresolved_;
    }, function (_cc) {
      _cclegacy = _cc.cclegacy;
      __checkObsolete__ = _cc.__checkObsolete__;
      __checkObsoleteInNamespace__ = _cc.__checkObsoleteInNamespace__;
      _decorator = _cc._decorator;
    }, function (_unresolved_2) {
      oneToMultiListener = _unresolved_2.oneToMultiListener;
    }],
    execute: function () {
      _crd = true;

      _cclegacy._RF.push({}, "28d4cMp3O5DJp9lpBCk86WL", "clientEvent", undefined);

      __checkObsolete__(['_decorator']);

      ({
        ccclass,
        property
      } = _decorator);

      _export("clientEvent", clientEvent = (_dec = ccclass("clientEvent"), _dec(_class = (_class2 = class clientEvent extends (_crd && oneToMultiListener === void 0 ? (_reportPossibleCrUseOfoneToMultiListener({
        error: Error()
      }), oneToMultiListener) : oneToMultiListener) {}, _class2.handlers = {}, _class2)) || _class));

      _cclegacy._RF.pop();

      _crd = false;
    }
  };
});
//# sourceMappingURL=12477ab15479ab2cebca31dc73db2f90dd815229.js.map