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

      _cclegacy._RF.push({}, "6ca8dlmieBMmby6ZKfAGV5K", "clientEvent", undefined);

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
//# sourceMappingURL=e2c0e63814adf08c6553669c97cd60db588479ce.js.map