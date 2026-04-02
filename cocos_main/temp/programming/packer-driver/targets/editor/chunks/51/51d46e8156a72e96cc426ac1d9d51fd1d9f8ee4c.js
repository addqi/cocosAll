System.register(["__unresolved_0", "cc"], function (_export, _context) {
  "use strict";

  var _reporterNs, _cclegacy, __checkObsolete__, __checkObsoleteInNamespace__, _decorator, AnimationClip, Component, Material, SkeletalAnimationComponent, SkinningModelComponent, _dec, _dec2, _dec3, _dec4, _class, _class2, _descriptor, _descriptor2, _descriptor3, _crd, ccclass, property, FightetModel;

  function _initializerDefineProperty(target, property, descriptor, context) { if (!descriptor) return; Object.defineProperty(target, property, { enumerable: descriptor.enumerable, configurable: descriptor.configurable, writable: descriptor.writable, value: descriptor.initializer ? descriptor.initializer.call(context) : void 0 }); }

  function _applyDecoratedDescriptor(target, property, decorators, descriptor, context) { var desc = {}; Object.keys(descriptor).forEach(function (key) { desc[key] = descriptor[key]; }); desc.enumerable = !!desc.enumerable; desc.configurable = !!desc.configurable; if ('value' in desc || desc.initializer) { desc.writable = true; } desc = decorators.slice().reverse().reduce(function (desc, decorator) { return decorator(target, property, desc) || desc; }, desc); if (context && desc.initializer !== void 0) { desc.value = desc.initializer ? desc.initializer.call(context) : void 0; desc.initializer = undefined; } if (desc.initializer === void 0) { Object.defineProperty(target, property, desc); desc = null; } return desc; }

  function _initializerWarningHelper(descriptor, context) { throw new Error('Decorating class property failed. Please ensure that ' + 'transform-class-properties is enabled and runs after the decorators transform.'); }

  function _reportPossibleCrUseOfFighter(extras) {
    _reporterNs.report("Fighter", "./Fighter", _context.meta, extras);
  }

  return {
    setters: [function (_unresolved_) {
      _reporterNs = _unresolved_;
    }, function (_cc) {
      _cclegacy = _cc.cclegacy;
      __checkObsolete__ = _cc.__checkObsolete__;
      __checkObsoleteInNamespace__ = _cc.__checkObsoleteInNamespace__;
      _decorator = _cc._decorator;
      AnimationClip = _cc.AnimationClip;
      Component = _cc.Component;
      Material = _cc.Material;
      SkeletalAnimationComponent = _cc.SkeletalAnimationComponent;
      SkinningModelComponent = _cc.SkinningModelComponent;
    }],
    execute: function () {
      _crd = true;

      _cclegacy._RF.push({}, "c544enudnlGhakmp0LA7ZfF", "FightetModel", undefined);

      __checkObsolete__(['_decorator', 'AnimationClip', 'Component', 'Material', 'Node', 'SkeletalAnimationComponent', 'SkeletalAnimationState', 'SkinningModelComponent']);

      ({
        ccclass,
        property
      } = _decorator);

      _export("FightetModel", FightetModel = (_dec = ccclass('FightetModel'), _dec2 = property([SkinningModelComponent]), _dec3 = property(SkeletalAnimationComponent), _dec4 = property([Material]), _dec(_class = (_class2 = class FightetModel extends Component {
        constructor(...args) {
          super(...args);

          _initializerDefineProperty(this, "model", _descriptor, this);

          _initializerDefineProperty(this, "ani", _descriptor2, this);

          _initializerDefineProperty(this, "arrayMaterial", _descriptor3, this);

          this._fighter = null;
          this._currentAni = "";
          this._aniState = void 0;
        }

        updateinfo(fighter) {
          this._fighter = fighter;
          this.updateModel(this._fighter.team); // this.ani.play("idle")
        }

        updateModel(team) {
          let index = 0;

          if (team == 1) {
            index = 1;
          } else {
            index = 0;
          }

          for (let i = 0; i < this.model.length; i++) {
            let _model = this.model[i];

            if (_model) {
              let count = _model.materials.length;
              let arr = [];

              for (let j = 0; j < count; j++) {
                arr.push(this.arrayMaterial[index]);
              }

              _model.materials = arr;
            }
          }
        }

        playAni(aniName, isLoop = false, callback) {
          if (aniName == this._currentAni) return;
          this._currentAni = aniName;
          this.scheduleOnce(() => {
            this.ani.play(aniName);
            this._aniState = this.ani.getState(aniName);

            if (this._aniState) {
              if (isLoop) {
                this._aniState.wrapMode = AnimationClip.WrapMode.Loop;
              } else {
                this._aniState.wrapMode = AnimationClip.WrapMode.Normal;
              }
            }

            if (!isLoop) {
              this.ani.once(SkeletalAnimationComponent.EventType.FINISHED, () => {
                this._currentAni = "";
                callback && callback();
              });
            }
          }, 0.1);
        }

      }, (_descriptor = _applyDecoratedDescriptor(_class2.prototype, "model", [_dec2], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return [];
        }
      }), _descriptor2 = _applyDecoratedDescriptor(_class2.prototype, "ani", [_dec3], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor3 = _applyDecoratedDescriptor(_class2.prototype, "arrayMaterial", [_dec4], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return [];
        }
      })), _class2)) || _class));

      _cclegacy._RF.pop();

      _crd = false;
    }
  };
});
//# sourceMappingURL=51d46e8156a72e96cc426ac1d9d51fd1d9f8ee4c.js.map