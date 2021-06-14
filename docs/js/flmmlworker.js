(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
module.exports = require("./lib");

}).call(this,require("TwOfRe"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/..\\..\\node_modules\\wav-encoder\\index.js","/..\\..\\node_modules\\wav-encoder")
},{"./lib":4,"TwOfRe":12,"buffer":9}],2:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
const InlineWorker = require("inline-worker");
const EncoderWorker = require("./EncoderWorker");

var instance = null;

function Encoder(format) {
  var _this = this;

  format = format || {};

  this.format = {
    floatingPoint: !!(format.floatingPoint),
    bitDepth: (format.bitDepth|0) || 16,
  };
  this._worker = new InlineWorker(EncoderWorker, EncoderWorker.self);
  this._worker.onmessage = function(e) {
    var data = e.data;
    var callback = _this._callbacks[data.callbackId];

    if (callback) {
      if (data.type === "encoded") {
        callback.resolve(data.buffer);
      } else {
        callback.reject(new Error(data.message));
      }
    }

    _this._callbacks[data.callbackId] = null;
  };
  this._callbacks = [];
}

Encoder.encode = function encode(audioData, format) {
  if (instance === null) {
    instance = new Encoder();
  }
  return instance.encode(audioData, format);
};

Encoder.prototype.encode = function encode(audioData, format) {
  var _this = this;

  if (format == null || typeof format !== "object") {
    format = this.format;
  }
  return new Promise(function(resolve, reject) {
    var callbackId = _this._callbacks.length;
    var numberOfChannels = audioData.channelData.length;
    var length = audioData.channelData[0].length;
    var sampleRate = audioData.sampleRate;
    var buffers = audioData.channelData.map(function(data) {
      return data.buffer;
    });

    _this._callbacks.push({ resolve: resolve, reject: reject });

    audioData = {
      numberOfChannels: numberOfChannels,
      length: length,
      sampleRate: sampleRate,
      buffers: buffers
    };

    _this._worker.postMessage({
      type: "encode", audioData: audioData, format: format, callbackId: callbackId,
    }, audioData.buffers);
  });
};

module.exports = Encoder;

}).call(this,require("TwOfRe"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/..\\..\\node_modules\\wav-encoder\\lib\\Encoder.js","/..\\..\\node_modules\\wav-encoder\\lib")
},{"./EncoderWorker":3,"TwOfRe":12,"buffer":9,"inline-worker":7}],3:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
var dataview2 = require("dataview2");

var self = {};

function encoder() {
  self.onmessage = function(e) {
    if (e.data.type === "encode") {
      self.encode(e.data.callbackId, e.data.audioData, e.data.format);
    }
  };

  self.encode = function(callbackId, audioData, format) {
    function successCallback(buffer) {
      self.postMessage({
        type: "encoded",
        callbackId: callbackId,
        buffer: buffer,
      }, [ buffer ]);
    }

    function errorCallback(err) {
      self.postMessage({
        type: "error",
        callbackId: callbackId,
        message: err.message,
      });
    }

    self.encodeWav(audioData, format).then(successCallback, errorCallback);
  };

  self.encodeWav = function(audioData, format) {
    format.floatingPoint = !!format.floatingPoint;
    format.bitDepth = (format.bitDepth|0) || 16;

    return new Promise(function(resolve) {
      var numberOfChannels = audioData.numberOfChannels;
      var sampleRate = audioData.sampleRate;
      var bytes = format.bitDepth >> 3;
      var length = audioData.length * numberOfChannels * bytes;
      var writer = new BufferWriter(44 + length);

      writer.writeString("RIFF"); // RIFF header
      writer.writeUint32(writer.length - 8); // file length
      writer.writeString("WAVE"); // RIFF Type

      writer.writeString("fmt "); // format chunk identifier
      writer.writeUint32(16);     // format chunk length
      writer.writeUint16(format.floatingPoint ? 0x0003 : 0x0001); // format (PCM)
      writer.writeUint16(numberOfChannels); // number of channels
      writer.writeUint32(sampleRate);       // sample rate
      writer.writeUint32(sampleRate * numberOfChannels * bytes); // byte rate
      writer.writeUint16(numberOfChannels * bytes); // block size
      writer.writeUint16(format.bitDepth); // bits per sample

      writer.writeString("data"); // data chunk identifier
      writer.writeUint32(length); // data chunk length

      var channelData = audioData.buffers.map(function(buffer) {
        return new Float32Array(buffer);
      });

      writer.writePCM(channelData, format);

      resolve(writer.buffer);
    });
  };

  function BufferWriter(length) {
    if (typeof dataview2 !== "undefined") {
      this.buffer = new dataview2.Buffer2(length);
      this.view = new dataview2.DataView2(this.buffer);
    } else {
      this.buffer = new ArrayBuffer(length);
      this.view = new DataView(this.buffer);
    }
    this.length = length;
    this.pos = 0;
  }

  BufferWriter.prototype.writeUint8 = function(data) {
    this.view.setUint8(this.pos, data);
    this.pos += 1;
  };

  BufferWriter.prototype.writeUint16 = function(data) {
    this.view.setUint16(this.pos, data, true);
    this.pos += 2;
  };

  BufferWriter.prototype.writeUint32 = function(data) {
    this.view.setUint32(this.pos, data, true);
    this.pos += 4;
  };

  BufferWriter.prototype.writeString = function(data) {
    for (var i = 0; i < data.length; i++) {
      this.writeUint8(data.charCodeAt(i));
    }
  };

  BufferWriter.prototype.writePCM8 = function(x) {
    x = Math.max(-128, Math.min(x * 128, 127))|0;
    this.view.setInt8(this.pos, x);
    this.pos += 1;
  };

  BufferWriter.prototype.writePCM16 = function(x) {
    x = Math.max(-32768, Math.min(x * 32768, 32767))|0;
    this.view.setInt16(this.pos, x, true);
    this.pos += 2;
  };

  BufferWriter.prototype.writePCM24 = function(x) {
    x = Math.max(-8388608, Math.min(x * 8388608, 8388607))|0;
    this.view.setUint8(this.pos + 0, (x >>  0) & 0xff);
    this.view.setUint8(this.pos + 1, (x >>  8) & 0xff);
    this.view.setUint8(this.pos + 2, (x >> 16) & 0xff);
    this.pos += 3;
  };

  BufferWriter.prototype.writePCM32 = function(x) {
    x = Math.max(-2147483648, Math.min(x * 2147483648, 2147483647))|0;
    this.view.setInt32(this.pos, x, true);
    this.pos += 4;
  };

  BufferWriter.prototype.writePCM32F = function(x) {
    this.view.setFloat32(this.pos, x, true);
    this.pos += 4;
  };

  BufferWriter.prototype.writePCM64F = function(x) {
    this.view.setFloat64(this.pos, x, true);
    this.pos += 8;
  };

  BufferWriter.prototype.writePCM = function(channelData, format) {
    var length = channelData[0].length;
    var numberOfChannels = channelData.length;
    var method = "writePCM" + format.bitDepth;

    if (format.floatingPoint) {
      method += "F";
    }

    if (!this[method]) {
      throw new Error("not suppoerted bit depth " + format.bitDepth);
    }

    for (var i = 0; i < length; i++) {
      for (var ch = 0; ch < numberOfChannels; ch++) {
        this[method](channelData[ch][i]);
      }
    }
  };

  self.BufferWriter = BufferWriter;
}

encoder.self = encoder.util = self;

module.exports = encoder;

}).call(this,require("TwOfRe"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/..\\..\\node_modules\\wav-encoder\\lib\\EncoderWorker.js","/..\\..\\node_modules\\wav-encoder\\lib")
},{"TwOfRe":12,"buffer":9,"dataview2":5}],4:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
module.exports = require("./Encoder");

}).call(this,require("TwOfRe"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/..\\..\\node_modules\\wav-encoder\\lib\\index.js","/..\\..\\node_modules\\wav-encoder\\lib")
},{"./Encoder":2,"TwOfRe":12,"buffer":9}],5:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
var BufferDataView = require("buffer-dataview");

function DataView2(buffer) {
  if (global.Buffer && buffer instanceof global.Buffer) {
    return new BufferDataView(buffer);
  }
  return new DataView(buffer);
}

function Buffer2(n) {
  if (global.Buffer) {
    return new global.Buffer(n);
  }
  return new Uint8Array(n).buffer;
}

module.exports = {
  DataView2: DataView2,
  Buffer2: Buffer2,
};

}).call(this,require("TwOfRe"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/..\\..\\node_modules\\wav-encoder\\node_modules\\dataview2\\index.js","/..\\..\\node_modules\\wav-encoder\\node_modules\\dataview2")
},{"TwOfRe":12,"buffer":9,"buffer-dataview":6}],6:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){

/**
 * Module exports.
 */

module.exports = DataView;

/**
 * Very minimal `DataView` implementation that wraps (doesn't *copy*)
 * Node.js Buffer instances.
 *
 *  Spec: http://www.khronos.org/registry/typedarray/specs/latest/#8
 *  MDN: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Typed_arrays/DataView
 *
 * @param {Buffer} buffer
 * @param {Number} byteOffset (optional)
 * @param {Number} byteLength (optional)
 * @api public
 */

function DataView (buffer, byteOffset, byteLength) {
  if (!(this instanceof DataView)) throw new TypeError('Constructor DataView requires \'new\'');
  if (!buffer || null == buffer.length) throw new TypeError('First argument to DataView constructor must be a Buffer');
  if (null == byteOffset) byteOffset = 0;
  if (null == byteLength) byteLength = buffer.length;
  this.buffer = buffer;
  this.byteOffset = byteOffset | 0;
  this.byteLength = byteLength | 0;
}

/**
 * "Get" functions.
 */

DataView.prototype.getInt8 = function (byteOffset) {
  if (arguments.length < 1) throw new TypeError('invalid_argument');
  var offset = this.byteOffset + (byteOffset | 0);
  var max = this.byteOffset + this.byteLength - 1;
  if (offset < this.byteOffset || offset > max) {
    throw new RangeError('Offset is outside the bounds of the DataView');
  }
  return this.buffer.readInt8(offset);
};

DataView.prototype.getUint8 = function (byteOffset) {
  if (arguments.length < 1) throw new TypeError('invalid_argument');
  var offset = this.byteOffset + (byteOffset | 0);
  var max = this.byteOffset + this.byteLength - 1;
  if (offset < this.byteOffset || offset > max) {
    throw new RangeError('Offset is outside the bounds of the DataView');
  }
  return this.buffer.readUInt8(offset);
};

DataView.prototype.getInt16 = function (byteOffset, littleEndian) {
  if (arguments.length < 1) throw new TypeError('invalid_argument');
  var offset = this.byteOffset + (byteOffset | 0);
  var max = this.byteOffset + this.byteLength - 1;
  if (offset < this.byteOffset || offset > max) {
    throw new RangeError('Offset is outside the bounds of the DataView');
  }
  if (littleEndian) {
    return this.buffer.readInt16LE(offset);
  } else {
    return this.buffer.readInt16BE(offset);
  }
};

DataView.prototype.getUint16 = function (byteOffset, littleEndian) {
  if (arguments.length < 1) throw new TypeError('invalid_argument');
  var offset = this.byteOffset + (byteOffset | 0);
  var max = this.byteOffset + this.byteLength - 1;
  if (offset < this.byteOffset || offset > max) {
    throw new RangeError('Offset is outside the bounds of the DataView');
  }
  if (littleEndian) {
    return this.buffer.readUInt16LE(offset);
  } else {
    return this.buffer.readUInt16BE(offset);
  }
};

DataView.prototype.getInt32 = function (byteOffset, littleEndian) {
  if (arguments.length < 1) throw new TypeError('invalid_argument');
  var offset = this.byteOffset + (byteOffset | 0);
  var max = this.byteOffset + this.byteLength - 1;
  if (offset < this.byteOffset || offset > max) {
    throw new RangeError('Offset is outside the bounds of the DataView');
  }
  if (littleEndian) {
    return this.buffer.readInt32LE(offset);
  } else {
    return this.buffer.readInt32BE(offset);
  }
};

DataView.prototype.getUint32 = function (byteOffset, littleEndian) {
  if (arguments.length < 1) throw new TypeError('invalid_argument');
  var offset = this.byteOffset + (byteOffset | 0);
  var max = this.byteOffset + this.byteLength - 1;
  if (offset < this.byteOffset || offset > max) {
    throw new RangeError('Offset is outside the bounds of the DataView');
  }
  if (littleEndian) {
    return this.buffer.readUInt32LE(offset);
  } else {
    return this.buffer.readUInt32BE(offset);
  }
};

DataView.prototype.getFloat32 = function (byteOffset, littleEndian) {
  if (arguments.length < 1) throw new TypeError('invalid_argument');
  var offset = this.byteOffset + (byteOffset | 0);
  var max = this.byteOffset + this.byteLength - 1;
  if (offset < this.byteOffset || offset > max) {
    throw new RangeError('Offset is outside the bounds of the DataView');
  }
  if (littleEndian) {
    return this.buffer.readFloatLE(offset);
  } else {
    return this.buffer.readFloatBE(offset);
  }
};

DataView.prototype.getFloat64 = function (byteOffset, littleEndian) {
  if (arguments.length < 1) throw new TypeError('invalid_argument');
  var offset = this.byteOffset + (byteOffset | 0);
  var max = this.byteOffset + this.byteLength - 1;
  if (offset < this.byteOffset || offset > max) {
    throw new RangeError('Offset is outside the bounds of the DataView');
  }
  if (littleEndian) {
    return this.buffer.readDoubleLE(offset);
  } else {
    return this.buffer.readDoubleBE(offset);
  }
};

/**
 * "Set" functions.
 */

DataView.prototype.setInt8 = function (byteOffset, value) {
  if (arguments.length < 2) throw new TypeError('invalid_argument');
  var offset = this.byteOffset + (byteOffset | 0);
  var max = this.byteOffset + this.byteLength - 1;
  if (offset < this.byteOffset || offset > max) {
    throw new RangeError('Offset is outside the bounds of the DataView');
  }
  // wrap the `value` from -128 to 128
  value = ((value + 128) & 255) - 128;
  this.buffer.writeInt8(value, offset);
};

DataView.prototype.setUint8 = function (byteOffset, value) {
  if (arguments.length < 2) throw new TypeError('invalid_argument');
  var offset = this.byteOffset + (byteOffset | 0);
  var max = this.byteOffset + this.byteLength - 1;
  if (offset < this.byteOffset || offset > max) {
    throw new RangeError('Offset is outside the bounds of the DataView');
  }
  // wrap the `value` from 0 to 255
  value = value & 255;
  this.buffer.writeUInt8(value, offset);
};

DataView.prototype.setInt16 = function (byteOffset, value, littleEndian) {
  if (arguments.length < 2) throw new TypeError('invalid_argument');
  var offset = this.byteOffset + (byteOffset | 0);
  var max = this.byteOffset + this.byteLength - 1;
  if (offset < this.byteOffset || offset > max) {
    throw new RangeError('Offset is outside the bounds of the DataView');
  }
  // wrap the `value` from -32768 to 32768
  value = ((value + 32768) & 65535) - 32768;
  if (littleEndian) {
    this.buffer.writeInt16LE(value, offset);
  } else {
    this.buffer.writeInt16BE(value, offset);
  }
};

DataView.prototype.setUint16 = function (byteOffset, value, littleEndian) {
  if (arguments.length < 2) throw new TypeError('invalid_argument');
  var offset = this.byteOffset + (byteOffset | 0);
  var max = this.byteOffset + this.byteLength - 1;
  if (offset < this.byteOffset || offset > max) {
    throw new RangeError('Offset is outside the bounds of the DataView');
  }
  // wrap the `value` from 0 to 65535
  value = value & 65535;
  if (littleEndian) {
    this.buffer.writeUInt16LE(value, offset);
  } else {
    this.buffer.writeUInt16BE(value, offset);
  }
};

DataView.prototype.setInt32 = function (byteOffset, value, littleEndian) {
  if (arguments.length < 2) throw new TypeError('invalid_argument');
  var offset = this.byteOffset + (byteOffset | 0);
  var max = this.byteOffset + this.byteLength - 1;
  if (offset < this.byteOffset || offset > max) {
    throw new RangeError('Offset is outside the bounds of the DataView');
  }
  // wrap the `value` from -2147483648 to 2147483648
  value |= 0;
  if (littleEndian) {
    this.buffer.writeInt32LE(value, offset);
  } else {
    this.buffer.writeInt32BE(value, offset);
  }
};

DataView.prototype.setUint32 = function (byteOffset, value, littleEndian) {
  if (arguments.length < 2) throw new TypeError('invalid_argument');
  var offset = this.byteOffset + (byteOffset | 0);
  var max = this.byteOffset + this.byteLength - 1;
  if (offset < this.byteOffset || offset > max) {
    throw new RangeError('Offset is outside the bounds of the DataView');
  }
  // wrap the `value` from 0 to 4294967295
  value = value >>> 0;
  if (littleEndian) {
    this.buffer.writeUInt32LE(value, offset);
  } else {
    this.buffer.writeUInt32BE(value, offset);
  }
};

DataView.prototype.setFloat32 = function (byteOffset, value, littleEndian) {
  if (arguments.length < 2) throw new TypeError('invalid_argument');
  var offset = this.byteOffset + (byteOffset | 0);
  var max = this.byteOffset + this.byteLength - 1;
  if (offset < this.byteOffset || offset > max) {
    throw new RangeError('Offset is outside the bounds of the DataView');
  }
  if (littleEndian) {
    this.buffer.writeFloatLE(value, offset);
  } else {
    this.buffer.writeFloatBE(value, offset);
  }
};

DataView.prototype.setFloat64 = function (byteOffset, value, littleEndian) {
  if (arguments.length < 2) throw new TypeError('invalid_argument');
  var offset = this.byteOffset + (byteOffset | 0);
  var max = this.byteOffset + this.byteLength - 1;
  if (offset < this.byteOffset || offset > max) {
    throw new RangeError('Offset is outside the bounds of the DataView');
  }
  if (littleEndian) {
    this.buffer.writeDoubleLE(value, offset);
  } else {
    this.buffer.writeDoubleBE(value, offset);
  }
};

}).call(this,require("TwOfRe"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/..\\..\\node_modules\\wav-encoder\\node_modules\\dataview2\\node_modules\\buffer-dataview\\dataview.js","/..\\..\\node_modules\\wav-encoder\\node_modules\\dataview2\\node_modules\\buffer-dataview")
},{"TwOfRe":12,"buffer":9}],7:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
var WORKER_ENABLED = !!(global === global.window && global.URL && global.Blob && global.Worker);

function InlineWorker(func, self) {
  var _this = this;
  var functionBody;

  self = self || {};

  if (WORKER_ENABLED) {
    functionBody = func.toString().trim().match(
      /^function\s*\w*\s*\([\w\s,]*\)\s*{([\w\W]*?)}$/
    )[1];

    return new global.Worker(global.URL.createObjectURL(
      new global.Blob([ functionBody ], { type: "text/javascript" })
    ));
  }

  function postMessage(data) {
    setTimeout(function() {
      _this.onmessage({ data: data });
    }, 0);
  }

  this.self = self;
  this.self.postMessage = postMessage;

  setTimeout(function() {
    func.call(self, self);
  }, 0);
}

InlineWorker.prototype.postMessage = function postMessage(data) {
  var _this = this;

  setTimeout(function() {
    _this.self.onmessage({ data: data });
  }, 0);
};

module.exports = InlineWorker;

}).call(this,require("TwOfRe"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/..\\..\\node_modules\\wav-encoder\\node_modules\\inline-worker\\index.js","/..\\..\\node_modules\\wav-encoder\\node_modules\\inline-worker")
},{"TwOfRe":12,"buffer":9}],8:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
var fmgenAs;
(function (fmgenAs) {
    var JaggArray = (function () {
        function JaggArray() {
        }
        JaggArray.I2 = function (s1, s2) {
            var a = new Array(s1);
            for (var i = 0; i < s1; i++) {
                a[i] = new Array(s2);
            }
            return a;
        };
        JaggArray.I3 = function (s1, s2, s3) {
            var a = new Array(s1);
            for (var i = 0; i < s1; i++) {
                a[i] = new Array(s2);
                for (var j = 0; j < s2; j++) {
                    a[i][j] = new Array(s3);
                }
            }
            return a;
        };
        return JaggArray;
    })();
    fmgenAs.JaggArray = JaggArray;
})(fmgenAs || (fmgenAs = {}));


var fmgenAs;
(function (fmgenAs) {
    var Operator = (function () {
        function Operator() {
            this.chip_ = null;
            this.ar_ = this.dr_ = this.sr_ = this.rr_ = this.key_scale_rate_ = 0;
            this.ams_ = Operator.amtable[0][0];
            this.mute_ = false;
            this.keyon_ = false;
            this.tl_out_ = 0;
            this.ssg_type_ = 0;
            this.multiple_ = 0;
            this.detune_ = 0;
            this.detune2_ = 0;
            this.ms_ = 0;
        }
        Operator.prototype.SetChip = function (chip) {
            this.chip_ = chip;
        };
        Operator.prototype.Reset = function () {
            this.tl_ = this.tl_latch_ = 127;
            this.ShiftPhase(fmgenAs.EGPhase.off);
            this.eg_count_ = 0;
            this.eg_curve_count_ = 0;
            this.ssg_phase_ = 0;
            this.pg_count_ = 0;
            this.out_ = this.out2_ = 0;
            this.param_changed_ = true;
        };
        Operator.prototype.SetDPBN = function (dp, bn) {
            this.dp_ = dp;
            this.bn_ = bn;
            this.param_changed_ = true;
        };
        Operator.prototype.Prepare = function () {
            if (this.param_changed_ === false) {
                return;
            }
            this.param_changed_ = false;
            this.pg_diff_ = ((this.dp_ + Operator.dttable[this.detune_ + this.bn_]) * this.chip_.GetMulValue(this.detune2_, this.multiple_));
            this.pg_diff_lfo_ = this.pg_diff_ >> 11;
            this.key_scale_rate_ = this.bn_ >> (3 - this.ks_);
            this.tl_out_ = this.mute_ ? 0x3ff : this.tl_ * 8;
            switch (this.eg_phase_) {
                case fmgenAs.EGPhase.attack:
                    this.SetEGRate(this.ar_ !== 0 ? Math.min(63, this.ar_ + this.key_scale_rate_) : 0);
                    break;
                case fmgenAs.EGPhase.decay:
                    this.SetEGRate(this.dr_ !== 0 ? Math.min(63, this.dr_ + this.key_scale_rate_) : 0);
                    this.eg_level_on_next_phase_ = this.sl_ * 8;
                    break;
                case fmgenAs.EGPhase.sustain:
                    this.SetEGRate(this.sr_ !== 0 ? Math.min(63, this.sr_ + this.key_scale_rate_) : 0);
                    break;
                case fmgenAs.EGPhase.release:
                    this.SetEGRate(Math.min(63, this.rr_ + this.key_scale_rate_));
                    break;
            }
            if (this.ssg_type_ !== 0 && (this.eg_phase_ !== fmgenAs.EGPhase.release)) {
                var m = (this.ar_ >= ((this.ssg_type_ === 8 || this.ssg_type_ === 12) ? 56 : 60)) ? 1 : 0;
                this.ssg_offset_ = Operator.ssgenvtable[this.ssg_type_ & 7][m][this.ssg_phase_][0] * 0x200;
                this.ssg_vector_ = Operator.ssgenvtable[this.ssg_type_ & 7][m][this.ssg_phase_][1];
            }
            this.ams_ = Operator.amtable[this.type_ | 0][this.amon_ ? (this.ms_ >> 4) & 3 : 0];
            this.EGUpdate();
        };
        Operator.prototype.ShiftPhase = function (nextphase) {
            switch (nextphase) {
                case fmgenAs.EGPhase.attack:
                    this.tl_ = this.tl_latch_;
                    if (this.ssg_type_ !== 0) {
                        this.ssg_phase_ = this.ssg_phase_ + 1;
                        if (this.ssg_phase_ > 2)
                            this.ssg_phase_ = 1;
                        var m = (this.ar_ >= ((this.ssg_type_ === 8 || this.ssg_type_ === 12) ? 56 : 60)) ? 1 : 0;
                        this.ssg_offset_ = Operator.ssgenvtable[this.ssg_type_ & 7][m][this.ssg_phase_][0] * 0x200;
                        this.ssg_vector_ = Operator.ssgenvtable[this.ssg_type_ & 7][m][this.ssg_phase_][1];
                    }
                    if ((this.ar_ + this.key_scale_rate_) < 62) {
                        this.SetEGRate(this.ar_ !== 0 ? Math.min(63, this.ar_ + this.key_scale_rate_) : 0);
                        this.eg_phase_ = fmgenAs.EGPhase.attack;
                        break;
                    }
                case fmgenAs.EGPhase.decay:
                    if (this.sl_ !== 0) {
                        this.eg_level_ = 0;
                        this.eg_level_on_next_phase_ = ((this.ssg_type_ !== 0) ? Math.min(this.sl_ * 8, 0x200) : this.sl_ * 8);
                        this.SetEGRate(this.dr_ !== 0 ? Math.min(63, this.dr_ + this.key_scale_rate_) : 0);
                        this.eg_phase_ = fmgenAs.EGPhase.decay;
                        break;
                    }
                case fmgenAs.EGPhase.sustain:
                    this.eg_level_ = this.sl_ * 8;
                    this.eg_level_on_next_phase_ = (this.ssg_type_ !== 0) ? 0x200 : 0x400;
                    this.SetEGRate(this.sr_ !== 0 ? Math.min(63, this.sr_ + this.key_scale_rate_) : 0);
                    this.eg_phase_ = fmgenAs.EGPhase.sustain;
                    break;
                case fmgenAs.EGPhase.release:
                    if (this.ssg_type_ !== 0) {
                        this.eg_level_ = this.eg_level_ * this.ssg_vector_ + this.ssg_offset_;
                        this.ssg_vector_ = 1;
                        this.ssg_offset_ = 0;
                    }
                    if (this.eg_phase_ === fmgenAs.EGPhase.attack || (this.eg_level_ < 955)) {
                        this.eg_level_on_next_phase_ = 0x400;
                        this.SetEGRate(Math.min(63, this.rr_ + this.key_scale_rate_));
                        this.eg_phase_ = fmgenAs.EGPhase.release;
                        break;
                    }
                case fmgenAs.EGPhase.off:
                default:
                    this.eg_level_ = 955;
                    this.eg_level_on_next_phase_ = 955;
                    this.EGUpdate();
                    this.SetEGRate(0);
                    this.eg_phase_ = fmgenAs.EGPhase.off;
                    break;
            }
        };
        Operator.prototype.SetFNum = function (f) {
            this.dp_ = (f & 2047) << ((f >> 11) & 7);
            this.bn_ = Operator.notetable[(f >> 7) & 127];
            this.param_changed_ = true;
        };
        Operator.prototype.SINE = function (s) {
            return Operator.sinetable[(s) & (1024 - 1)];
        };
        Operator.prototype.LogToLin = function (a) {
            return (a < 8192) ? Operator.cltable[a] : 0;
        };
        Operator.prototype.EGUpdate = function () {
            var a = (this.ssg_type_ === 0) ? this.tl_out_ + this.eg_level_ : this.tl_out_ + this.eg_level_ * this.ssg_vector_ + this.ssg_offset_;
            this.eg_out_ = (a < 0x3ff) ? a << (1 + 2) : 0x3ff << (1 + 2);
        };
        Operator.prototype.SetEGRate = function (rate) {
            this.eg_rate_ = rate;
            this.eg_count_diff_ = Operator.decaytable2[(rate / 4) | 0] * this.chip_.GetRatio();
        };
        Operator.prototype.EGCalc = function () {
            this.eg_count_ = (2047 * 3) << 7;
            if (this.eg_phase_ === fmgenAs.EGPhase.attack) {
                var c = Operator.attacktable[this.eg_rate_][this.eg_curve_count_ & 7];
                if (c >= 0) {
                    this.eg_level_ -= 1 + (this.eg_level_ >> c);
                    if (this.eg_level_ <= 0)
                        this.ShiftPhase(fmgenAs.EGPhase.decay);
                }
                this.EGUpdate();
            }
            else {
                if (this.ssg_type_ === 0) {
                    this.eg_level_ += Operator.decaytable1[this.eg_rate_][this.eg_curve_count_ & 7];
                    if (this.eg_level_ >= this.eg_level_on_next_phase_)
                        this.ShiftPhase(this.eg_phase_ + 1);
                    this.EGUpdate();
                }
                else {
                    this.eg_level_ += 4 * Operator.decaytable1[this.eg_rate_][this.eg_curve_count_ & 7];
                    if (this.eg_level_ >= this.eg_level_on_next_phase_) {
                        this.EGUpdate();
                        switch (this.eg_phase_) {
                            case fmgenAs.EGPhase.decay:
                                this.ShiftPhase(fmgenAs.EGPhase.sustain);
                                break;
                            case fmgenAs.EGPhase.sustain:
                                this.ShiftPhase(fmgenAs.EGPhase.attack);
                                break;
                            case fmgenAs.EGPhase.release:
                                this.ShiftPhase(fmgenAs.EGPhase.off);
                                break;
                        }
                    }
                }
            }
            this.eg_curve_count_++;
        };
        Operator.prototype.EGStep = function () {
            this.eg_count_ -= this.eg_count_diff_;
            if (this.eg_count_ <= 0)
                this.EGCalc();
        };
        Operator.prototype.PGCalc = function () {
            var ret = this.pg_count_;
            this.pg_count_ += this.pg_diff_;
            return ret;
        };
        Operator.prototype.PGCalcL = function () {
            var ret = this.pg_count_;
            this.pg_count_ += this.pg_diff_ + ((this.pg_diff_lfo_ * this.chip_.GetPMV()) >> 5);
            return ret;
        };
        Operator.prototype.Calc = function (ii) {
            this.eg_count_ -= this.eg_count_diff_;
            if (this.eg_count_ <= 0) {
                this.eg_count_ = (2047 * 3) << 7;
                if (this.eg_phase_ === fmgenAs.EGPhase.attack) {
                    var c = Operator.attacktable[this.eg_rate_][this.eg_curve_count_ & 7];
                    if (c >= 0) {
                        this.eg_level_ -= 1 + (this.eg_level_ >> c);
                        if (this.eg_level_ <= 0)
                            this.ShiftPhase(fmgenAs.EGPhase.decay);
                    }
                }
                else {
                    this.eg_level_ += Operator.decaytable1[this.eg_rate_][this.eg_curve_count_ & 7];
                    if (this.eg_level_ >= this.eg_level_on_next_phase_)
                        this.ShiftPhase(this.eg_phase_ + 1);
                }
                var a = this.tl_out_ + this.eg_level_;
                this.eg_out_ = (a < 0x3ff) ? a << (1 + 2) : 0x3ff << (1 + 2);
                this.eg_curve_count_++;
            }
            this.out2_ = this.out_;
            var pgo = this.pg_count_;
            this.pg_count_ += this.pg_diff_;
            var pgin = pgo >> (20 + 9 - 10);
            pgin += ii >> (20 + 9 - 10 - (2 + Operator.IS2EC_SHIFT));
            var sino = this.eg_out_ + Operator.sinetable[pgin & (1024 - 1)];
            this.out_ = (sino < 8192) ? Operator.cltable[sino] : 0;
            return this.out_;
        };
        Operator.prototype.CalcL = function (ii) {
            this.eg_count_ -= this.eg_count_diff_;
            if (this.eg_count_ <= 0) {
                this.eg_count_ = (2047 * 3) << 7;
                if (this.eg_phase_ === fmgenAs.EGPhase.attack) {
                    var c = Operator.attacktable[this.eg_rate_][this.eg_curve_count_ & 7];
                    if (c >= 0) {
                        this.eg_level_ -= 1 + (this.eg_level_ >> c);
                        if (this.eg_level_ <= 0)
                            this.ShiftPhase(fmgenAs.EGPhase.decay);
                    }
                }
                else {
                    this.eg_level_ += Operator.decaytable1[this.eg_rate_][this.eg_curve_count_ & 7];
                    if (this.eg_level_ >= this.eg_level_on_next_phase_)
                        this.ShiftPhase(this.eg_phase_ + 1);
                }
                var a = this.tl_out_ + this.eg_level_;
                this.eg_out_ = (a < 0x3ff) ? a << (1 + 2) : 0x3ff << (1 + 2);
                this.eg_curve_count_++;
            }
            var pgo = this.pg_count_;
            this.pg_count_ += this.pg_diff_ + ((this.pg_diff_lfo_ * this.chip_.pmv_) >> 5);
            var pgin = pgo >> (20 + 9 - 10);
            pgin += ii >> (20 + 9 - 10 - (2 + Operator.IS2EC_SHIFT));
            var sino = this.eg_out_ + Operator.sinetable[pgin & (1024 - 1)] + this.ams_[this.chip_.aml_];
            this.out_ = (sino < 8192) ? Operator.cltable[sino] : 0;
            return this.out_;
        };
        Operator.prototype.CalcN = function (noise) {
            this.EGStep();
            var lv = Math.max(0, 0x3ff - (this.tl_out_ + this.eg_level_)) << 1;
            noise = (noise & 1) - 1;
            this.out_ = (lv + noise) ^ noise;
            return this.out_;
        };
        Operator.prototype.CalcFB = function (fb) {
            this.eg_count_ -= this.eg_count_diff_;
            if (this.eg_count_ <= 0) {
                this.eg_count_ = (2047 * 3) << 7;
                if (this.eg_phase_ === fmgenAs.EGPhase.attack) {
                    var c = Operator.attacktable[this.eg_rate_][this.eg_curve_count_ & 7];
                    if (c >= 0) {
                        this.eg_level_ -= 1 + (this.eg_level_ >> c);
                        if (this.eg_level_ <= 0)
                            this.ShiftPhase(fmgenAs.EGPhase.decay);
                    }
                }
                else {
                    this.eg_level_ += Operator.decaytable1[this.eg_rate_][this.eg_curve_count_ & 7];
                    if (this.eg_level_ >= this.eg_level_on_next_phase_)
                        this.ShiftPhase(this.eg_phase_ + 1);
                }
                var a = this.tl_out_ + this.eg_level_;
                this.eg_out_ = (a < 0x3ff) ? a << (1 + 2) : 0x3ff << (1 + 2);
                this.eg_curve_count_++;
            }
            var ii = this.out_ + this.out2_;
            this.out2_ = this.out_;
            var pgo = this.pg_count_;
            this.pg_count_ += this.pg_diff_;
            var pgin = pgo >> (20 + 9 - 10);
            if (fb < 31) {
                pgin += ((ii << (1 + Operator.IS2EC_SHIFT)) >> fb) >> (20 + 9 - 10);
            }
            var sino = this.eg_out_ + Operator.sinetable[pgin & (1024 - 1)];
            this.out_ = (sino < 8192) ? Operator.cltable[sino] : 0;
            return this.out2_;
        };
        Operator.prototype.CalcFBL = function (fb) {
            this.eg_count_ -= this.eg_count_diff_;
            if (this.eg_count_ <= 0) {
                this.eg_count_ = (2047 * 3) << 7;
                if (this.eg_phase_ === fmgenAs.EGPhase.attack) {
                    var c = Operator.attacktable[this.eg_rate_][this.eg_curve_count_ & 7];
                    if (c >= 0) {
                        this.eg_level_ -= 1 + (this.eg_level_ >> c);
                        if (this.eg_level_ <= 0)
                            this.ShiftPhase(fmgenAs.EGPhase.decay);
                    }
                }
                else {
                    this.eg_level_ += Operator.decaytable1[this.eg_rate_][this.eg_curve_count_ & 7];
                    if (this.eg_level_ >= this.eg_level_on_next_phase_)
                        this.ShiftPhase(this.eg_phase_ + 1);
                }
                var a = this.tl_out_ + this.eg_level_;
                this.eg_out_ = (a < 0x3ff) ? a << (1 + 2) : 0x3ff << (1 + 2);
                this.eg_curve_count_++;
            }
            var ii = this.out_ + this.out2_;
            this.out2_ = this.out_;
            var pgo = this.pg_count_;
            this.pg_count_ += this.pg_diff_ + ((this.pg_diff_lfo_ * this.chip_.pmv_) >> 5);
            var pgin = pgo >> (20 + 9 - 10);
            if (fb < 31) {
                pgin += ((ii << (1 + Operator.IS2EC_SHIFT)) >> fb) >> (20 + 9 - 10);
            }
            var sino = this.eg_out_ + Operator.sinetable[pgin & (1024 - 1)] + this.ams_[this.chip_.aml_];
            this.out_ = (sino < 8192) ? Operator.cltable[sino] : 0;
            return this.out_;
        };
        Operator.prototype.ResetFB = function () {
            this.out_ = this.out2_ = 0;
        };
        Operator.prototype.KeyOn = function () {
            if (!this.keyon_) {
                this.keyon_ = true;
                if (this.eg_phase_ === fmgenAs.EGPhase.off || this.eg_phase_ === fmgenAs.EGPhase.release) {
                    this.ssg_phase_ = -1;
                    this.ShiftPhase(fmgenAs.EGPhase.attack);
                    this.EGUpdate();
                    this.in2_ = this.out_ = this.out2_ = 0;
                    this.pg_count_ = 0;
                }
            }
        };
        Operator.prototype.KeyOff = function () {
            if (this.keyon_) {
                this.keyon_ = false;
                this.ShiftPhase(fmgenAs.EGPhase.release);
            }
        };
        Operator.prototype.IsOn = function () {
            return this.eg_phase_ !== fmgenAs.EGPhase.off;
        };
        Operator.prototype.SetDT = function (dt) {
            this.detune_ = dt * 0x20;
            this.param_changed_ = true;
        };
        Operator.prototype.SetDT2 = function (dt2) {
            this.detune2_ = dt2 & 3;
            this.param_changed_ = true;
        };
        Operator.prototype.SetMULTI = function (mul) {
            this.multiple_ = mul;
            this.param_changed_ = true;
        };
        Operator.prototype.SetTL = function (tl, csm) {
            if (!csm) {
                this.tl_ = tl;
                this.param_changed_ = true;
            }
            this.tl_latch_ = tl;
        };
        Operator.prototype.SetAR = function (ar) {
            this.ar_ = ar;
            this.param_changed_ = true;
        };
        Operator.prototype.SetDR = function (dr) {
            this.dr_ = dr;
            this.param_changed_ = true;
        };
        Operator.prototype.SetSR = function (sr) {
            this.sr_ = sr;
            this.param_changed_ = true;
        };
        Operator.prototype.SetSL = function (sl) {
            this.sl_ = sl;
            this.param_changed_ = true;
        };
        Operator.prototype.SetRR = function (rr) {
            this.rr_ = rr;
            this.param_changed_ = true;
        };
        Operator.prototype.SetKS = function (ks) {
            this.ks_ = ks;
            this.param_changed_ = true;
        };
        Operator.prototype.SetAMON = function (amon) {
            this.amon_ = amon;
            this.param_changed_ = true;
        };
        Operator.prototype.Mute = function (mute) {
            this.mute_ = mute;
            this.param_changed_ = true;
        };
        Operator.prototype.SetMS = function (ms) {
            this.ms_ = ms;
            this.param_changed_ = true;
        };
        Operator.prototype.Out = function () {
            return this.out_;
        };
        Operator.prototype.Refresh = function () {
            this.param_changed_ = true;
        };
        Operator.notetable = [
            0, 0, 0, 0, 0, 0, 0, 1, 2, 3, 3, 3, 3, 3, 3, 3,
            4, 4, 4, 4, 4, 4, 4, 5, 6, 7, 7, 7, 7, 7, 7, 7,
            8, 8, 8, 8, 8, 8, 8, 9, 10, 11, 11, 11, 11, 11, 11, 11,
            12, 12, 12, 12, 12, 12, 12, 13, 14, 15, 15, 15, 15, 15, 15, 15,
            16, 16, 16, 16, 16, 16, 16, 17, 18, 19, 19, 19, 19, 19, 19, 19,
            20, 20, 20, 20, 20, 20, 20, 21, 22, 23, 23, 23, 23, 23, 23, 23,
            24, 24, 24, 24, 24, 24, 24, 25, 26, 27, 27, 27, 27, 27, 27, 27,
            28, 28, 28, 28, 28, 28, 28, 29, 30, 31, 31, 31, 31, 31, 31, 31
        ];
        Operator.dttable = [
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 2, 2, 2, 2, 2, 2, 2, 2, 4, 4, 4, 4,
            4, 6, 6, 6, 8, 8, 8, 10, 10, 12, 12, 14, 16, 16, 16, 16,
            2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 8, 8, 8, 10,
            10, 12, 12, 14, 16, 16, 18, 20, 22, 24, 26, 28, 32, 32, 32, 32,
            4, 4, 4, 4, 4, 6, 6, 6, 8, 8, 8, 10, 10, 12, 12, 14,
            16, 16, 18, 20, 22, 24, 26, 28, 32, 34, 38, 40, 44, 44, 44, 44,
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, -2, -2, -2, -2, -2, -2, -2, -2, -4, -4, -4, -4,
            -4, -6, -6, -6, -8, -8, -8, -10, -10, -12, -12, -14, -16, -16, -16, -16,
            -2, -2, -2, -2, -4, -4, -4, -4, -4, -6, -6, -6, -8, -8, -8, -10,
            -10, -12, -12, -14, -16, -16, -18, -20, -22, -24, -26, -28, -32, -32, -32, -32,
            -4, -4, -4, -4, -4, -6, -6, -6, -8, -8, -8, -10, -10, -12, -12, -14,
            -16, -16, -18, -20, -22, -24, -26, -28, -32, -34, -38, -40, -44, -44, -44, -44
        ];
        Operator.decaytable1 = [
            [0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0],
            [1, 1, 1, 1, 1, 1, 1, 1], [1, 1, 1, 1, 1, 1, 1, 1],
            [1, 1, 1, 1, 1, 1, 1, 1], [1, 1, 1, 1, 1, 1, 1, 1],
            [1, 1, 1, 0, 1, 1, 1, 0], [1, 1, 1, 0, 1, 1, 1, 0],
            [1, 0, 1, 0, 1, 0, 1, 0], [1, 1, 1, 0, 1, 0, 1, 0],
            [1, 1, 1, 0, 1, 1, 1, 0], [1, 1, 1, 1, 1, 1, 1, 0],
            [1, 0, 1, 0, 1, 0, 1, 0], [1, 1, 1, 0, 1, 0, 1, 0],
            [1, 1, 1, 0, 1, 1, 1, 0], [1, 1, 1, 1, 1, 1, 1, 0],
            [1, 0, 1, 0, 1, 0, 1, 0], [1, 1, 1, 0, 1, 0, 1, 0],
            [1, 1, 1, 0, 1, 1, 1, 0], [1, 1, 1, 1, 1, 1, 1, 0],
            [1, 0, 1, 0, 1, 0, 1, 0], [1, 1, 1, 0, 1, 0, 1, 0],
            [1, 1, 1, 0, 1, 1, 1, 0], [1, 1, 1, 1, 1, 1, 1, 0],
            [1, 0, 1, 0, 1, 0, 1, 0], [1, 1, 1, 0, 1, 0, 1, 0],
            [1, 1, 1, 0, 1, 1, 1, 0], [1, 1, 1, 1, 1, 1, 1, 0],
            [1, 0, 1, 0, 1, 0, 1, 0], [1, 1, 1, 0, 1, 0, 1, 0],
            [1, 1, 1, 0, 1, 1, 1, 0], [1, 1, 1, 1, 1, 1, 1, 0],
            [1, 0, 1, 0, 1, 0, 1, 0], [1, 1, 1, 0, 1, 0, 1, 0],
            [1, 1, 1, 0, 1, 1, 1, 0], [1, 1, 1, 1, 1, 1, 1, 0],
            [1, 0, 1, 0, 1, 0, 1, 0], [1, 1, 1, 0, 1, 0, 1, 0],
            [1, 1, 1, 0, 1, 1, 1, 0], [1, 1, 1, 1, 1, 1, 1, 0],
            [1, 0, 1, 0, 1, 0, 1, 0], [1, 1, 1, 0, 1, 0, 1, 0],
            [1, 1, 1, 0, 1, 1, 1, 0], [1, 1, 1, 1, 1, 1, 1, 0],
            [1, 0, 1, 0, 1, 0, 1, 0], [1, 1, 1, 0, 1, 0, 1, 0],
            [1, 1, 1, 0, 1, 1, 1, 0], [1, 1, 1, 1, 1, 1, 1, 0],
            [1, 1, 1, 1, 1, 1, 1, 1], [2, 1, 1, 1, 2, 1, 1, 1],
            [2, 1, 2, 1, 2, 1, 2, 1], [2, 2, 2, 1, 2, 2, 2, 1],
            [2, 2, 2, 2, 2, 2, 2, 2], [4, 2, 2, 2, 4, 2, 2, 2],
            [4, 2, 4, 2, 4, 2, 4, 2], [4, 4, 4, 2, 4, 4, 4, 2],
            [4, 4, 4, 4, 4, 4, 4, 4], [8, 4, 4, 4, 8, 4, 4, 4],
            [8, 4, 8, 4, 8, 4, 8, 4], [8, 8, 8, 4, 8, 8, 8, 4],
            [16, 16, 16, 16, 16, 16, 16, 16], [16, 16, 16, 16, 16, 16, 16, 16],
            [16, 16, 16, 16, 16, 16, 16, 16], [16, 16, 16, 16, 16, 16, 16, 16]
        ];
        Operator.decaytable2 = [
            1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2047, 2047, 2047, 2047, 2047
        ];
        Operator.attacktable = [
            [-1, -1, -1, -1, -1, -1, -1, -1], [-1, -1, -1, -1, -1, -1, -1, -1],
            [4, 4, 4, 4, 4, 4, 4, 4], [4, 4, 4, 4, 4, 4, 4, 4],
            [4, 4, 4, 4, 4, 4, 4, 4], [4, 4, 4, 4, 4, 4, 4, 4],
            [4, 4, 4, -1, 4, 4, 4, -1], [4, 4, 4, -1, 4, 4, 4, -1],
            [4, -1, 4, -1, 4, -1, 4, -1], [4, 4, 4, -1, 4, -1, 4, -1],
            [4, 4, 4, -1, 4, 4, 4, -1], [4, 4, 4, 4, 4, 4, 4, -1],
            [4, -1, 4, -1, 4, -1, 4, -1], [4, 4, 4, -1, 4, -1, 4, -1],
            [4, 4, 4, -1, 4, 4, 4, -1], [4, 4, 4, 4, 4, 4, 4, -1],
            [4, -1, 4, -1, 4, -1, 4, -1], [4, 4, 4, -1, 4, -1, 4, -1],
            [4, 4, 4, -1, 4, 4, 4, -1], [4, 4, 4, 4, 4, 4, 4, -1],
            [4, -1, 4, -1, 4, -1, 4, -1], [4, 4, 4, -1, 4, -1, 4, -1],
            [4, 4, 4, -1, 4, 4, 4, -1], [4, 4, 4, 4, 4, 4, 4, -1],
            [4, -1, 4, -1, 4, -1, 4, -1], [4, 4, 4, -1, 4, -1, 4, -1],
            [4, 4, 4, -1, 4, 4, 4, -1], [4, 4, 4, 4, 4, 4, 4, -1],
            [4, -1, 4, -1, 4, -1, 4, -1], [4, 4, 4, -1, 4, -1, 4, -1],
            [4, 4, 4, -1, 4, 4, 4, -1], [4, 4, 4, 4, 4, 4, 4, -1],
            [4, -1, 4, -1, 4, -1, 4, -1], [4, 4, 4, -1, 4, -1, 4, -1],
            [4, 4, 4, -1, 4, 4, 4, -1], [4, 4, 4, 4, 4, 4, 4, -1],
            [4, -1, 4, -1, 4, -1, 4, -1], [4, 4, 4, -1, 4, -1, 4, -1],
            [4, 4, 4, -1, 4, 4, 4, -1], [4, 4, 4, 4, 4, 4, 4, -1],
            [4, -1, 4, -1, 4, -1, 4, -1], [4, 4, 4, -1, 4, -1, 4, -1],
            [4, 4, 4, -1, 4, 4, 4, -1], [4, 4, 4, 4, 4, 4, 4, -1],
            [4, -1, 4, -1, 4, -1, 4, -1], [4, 4, 4, -1, 4, -1, 4, -1],
            [4, 4, 4, -1, 4, 4, 4, -1], [4, 4, 4, 4, 4, 4, 4, -1],
            [4, 4, 4, 4, 4, 4, 4, 4], [3, 4, 4, 4, 3, 4, 4, 4],
            [3, 4, 3, 4, 3, 4, 3, 4], [3, 3, 3, 4, 3, 3, 3, 4],
            [3, 3, 3, 3, 3, 3, 3, 3], [2, 3, 3, 3, 2, 3, 3, 3],
            [2, 3, 2, 3, 2, 3, 2, 3], [2, 2, 2, 3, 2, 2, 2, 3],
            [2, 2, 2, 2, 2, 2, 2, 2], [1, 2, 2, 2, 1, 2, 2, 2],
            [1, 2, 1, 2, 1, 2, 1, 2], [1, 1, 1, 2, 1, 1, 1, 2],
            [0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0]
        ];
        Operator.ssgenvtable = [
            [[[1, 1], [1, 1], [1, 1]],
                [[0, 1], [1, 1], [1, 1]]],
            [[[0, 1], [2, 0], [2, 0]],
                [[0, 1], [2, 0], [2, 0]]],
            [[[1, -1], [0, 1], [1, -1]],
                [[0, 1], [1, -1], [0, 1]]],
            [[[1, -1], [0, 0], [0, 0]],
                [[0, 1], [0, 0], [0, 0]]],
            [[[2, -1], [2, -1], [2, -1]],
                [[1, -1], [2, -1], [2, -1]]],
            [[[1, -1], [0, 0], [0, 0]],
                [[1, -1], [0, 0], [0, 0]]],
            [[[0, 1], [1, -1], [0, 1]],
                [[1, -1], [0, 1], [1, -1]]],
            [[[0, 1], [2, 0], [2, 0]],
                [[1, -1], [2, 0], [2, 0]]]
        ];
        Operator.sinetable = (function () {
            var sinetable = [];
            var log2 = Math.log(2.0);
            for (var i = 0; i < 1024 / 2; i++) {
                var r = (i * 2 + 1) * Math.PI / 1024;
                var q = -256 * Math.log(Math.sin(r)) / log2;
                var s = Math.floor(q + 0.5) + 1;
                sinetable[i] = s * 2;
                sinetable[1024 / 2 + i | 0] = s * 2 + 1;
            }
            return sinetable;
        })();
        Operator.cltable = (function () {
            var cltable = [];
            var i, j;
            for (i = 0, j = 0; i < 256; i++) {
                var v = Math.floor(Math.pow(2.0, 13.0 - i / 256.0));
                v = (v + 2) & ~3;
                cltable[j++] = v;
                cltable[j++] = -v;
            }
            i = j;
            while (j < 8192) {
                cltable[j++] = cltable[i++ - 512] / 2 | 0;
            }
            return cltable;
        })();
        Operator.amtable = (function () {
            var amtable = fmgenAs.JaggArray.I3(2, 8, 256);
            var i, j;
            var amt = [
                [31, 6, 4, 3],
                [31, 2, 1, 0],
            ];
            for (var type = 0; type < 2; type++) {
                for (i = 0; i < 4; i++) {
                    for (j = 0; j < 256; j++) {
                        amtable[type][i][j] = (((j * 4) >> amt[type][i]) * 2) << 2;
                    }
                }
            }
            return amtable;
        })();
        Operator.IS2EC_SHIFT = ((20 + 9) - 13);
        return Operator;
    })();
    fmgenAs.Operator = Operator;
})(fmgenAs || (fmgenAs = {}));


var fmgenAs;
(function (fmgenAs) {
    var Channel4 = (function () {
        function Channel4() {
            this.buf = new Array(4);
            this.ix = new Array(3);
            this.ox = new Array(3);
            this.op = [
                new fmgenAs.Operator(),
                new fmgenAs.Operator(),
                new fmgenAs.Operator(),
                new fmgenAs.Operator()
            ];
            this.SetAlgorithm(0);
            this.pms = Channel4.pmtable[0][0];
        }
        Channel4.prototype.SetType = function (type) {
            for (var i = 0; i < 4; i++)
                this.op[i].type_ = type;
        };
        Channel4.prototype.SetFB = function (feedback) {
            this.fb = Channel4.fbtable[feedback];
        };
        Channel4.prototype.SetMS = function (ms) {
            this.op[0].SetMS(ms);
            this.op[1].SetMS(ms);
            this.op[2].SetMS(ms);
            this.op[3].SetMS(ms);
        };
        Channel4.prototype.Mute = function (m) {
            for (var i = 0; i < 4; i++)
                this.op[i].Mute(m);
        };
        Channel4.prototype.Refresh = function () {
            for (var i = 0; i < 4; i++)
                this.op[i].Refresh();
        };
        Channel4.prototype.SetChip = function (chip) {
            this.chip_ = chip;
            for (var i = 0; i < 4; i++)
                this.op[i].SetChip(chip);
        };
        Channel4.prototype.Reset = function () {
            this.op[0].Reset();
            this.op[1].Reset();
            this.op[2].Reset();
            this.op[3].Reset();
        };
        Channel4.prototype.Prepare = function () {
            var op = this.op;
            op[0].Prepare();
            op[1].Prepare();
            op[2].Prepare();
            op[3].Prepare();
            this.pms = Channel4.pmtable[op[0].type_][op[0].ms_ & 7];
            var key = (op[0].IsOn() || op[1].IsOn() || op[2].IsOn() || op[3].IsOn()) ? 1 : 0;
            var lfo = (op[0].ms_ & (op[0].amon_ || op[1].amon_ || op[2].amon_ || op[3].amon_ ? 0x37 : 7)) ? 2 : 0;
            return key | lfo;
        };
        Channel4.prototype.SetFNum = function (f) {
            for (var i = 0; i < 4; i++)
                this.op[i].SetFNum(f);
        };
        Channel4.prototype.SetKCKF = function (kc, kf) {
            var oct = 19 - ((kc >> 4) & 7);
            var kcv = Channel4.kctable[kc & 0x0f];
            kcv = ((kcv + 2) / 4 | 0) * 4;
            var dp = kcv * Channel4.kftable[kf & 0x3f];
            dp >>= 16 + 3;
            dp <<= 16 + 3;
            dp >>= oct;
            var bn = (kc >> 2) & 31;
            this.op[0].SetDPBN(dp, bn);
            this.op[1].SetDPBN(dp, bn);
            this.op[2].SetDPBN(dp, bn);
            this.op[3].SetDPBN(dp, bn);
        };
        Channel4.prototype.KeyControl = function (key) {
            var op = this.op;
            if (key & 0x1)
                op[0].KeyOn();
            else
                op[0].KeyOff();
            if (key & 0x2)
                op[1].KeyOn();
            else
                op[1].KeyOff();
            if (key & 0x4)
                op[2].KeyOn();
            else
                op[2].KeyOff();
            if (key & 0x8)
                op[3].KeyOn();
            else
                op[3].KeyOff();
        };
        Channel4.prototype.SetAlgorithm = function (algo) {
            var iotable = Channel4.iotable;
            this.ix[0] = iotable[algo][0];
            this.ox[0] = iotable[algo][1];
            this.ix[1] = iotable[algo][2];
            this.ox[1] = iotable[algo][3];
            this.ix[2] = iotable[algo][4];
            this.ox[2] = iotable[algo][5];
            this.op[0].ResetFB();
            this.algo_ = algo;
        };
        Channel4.prototype.GetAlgorithm = function () {
            return this.algo_;
        };
        Channel4.prototype.Calc = function () {
            var r = 0;
            switch (this.algo_) {
                case 0:
                    this.op[2].Calc(this.op[1].Out());
                    this.op[1].Calc(this.op[0].Out());
                    r = this.op[3].Calc(this.op[2].Out());
                    this.op[0].CalcFB(this.fb);
                    break;
                case 1:
                    this.op[2].Calc(this.op[0].Out() + this.op[1].Out());
                    this.op[1].Calc(0);
                    r = this.op[3].Calc(this.op[2].Out());
                    this.op[0].CalcFB(this.fb);
                    break;
                case 2:
                    this.op[2].Calc(this.op[1].Out());
                    this.op[1].Calc(0);
                    r = this.op[3].Calc(this.op[0].Out() + this.op[2].Out());
                    this.op[0].CalcFB(this.fb);
                    break;
                case 3:
                    this.op[2].Calc(0);
                    this.op[1].Calc(this.op[0].Out());
                    r = this.op[3].Calc(this.op[1].Out() + this.op[2].Out());
                    this.op[0].CalcFB(this.fb);
                    break;
                case 4:
                    this.op[2].Calc(0);
                    r = this.op[1].Calc(this.op[0].Out());
                    r += this.op[3].Calc(this.op[2].Out());
                    this.op[0].CalcFB(this.fb);
                    break;
                case 5:
                    r = this.op[2].Calc(this.op[0].Out());
                    r += this.op[1].Calc(this.op[0].Out());
                    r += this.op[3].Calc(this.op[0].Out());
                    this.op[0].CalcFB(this.fb);
                    break;
                case 6:
                    r = this.op[2].Calc(0);
                    r += this.op[1].Calc(this.op[0].Out());
                    r += this.op[3].Calc(0);
                    this.op[0].CalcFB(this.fb);
                    break;
                case 7:
                    r = this.op[2].Calc(0);
                    r += this.op[1].Calc(0);
                    r += this.op[3].Calc(0);
                    r += this.op[0].CalcFB(this.fb);
                    break;
            }
            return r;
        };
        Channel4.prototype.CalcL = function () {
            this.chip_.SetPMV(this.pms[this.chip_.GetPML()]);
            var r = 0;
            switch (this.algo_) {
                case 0:
                    this.op[2].CalcL(this.op[1].Out());
                    this.op[1].CalcL(this.op[0].Out());
                    r = this.op[3].CalcL(this.op[2].Out());
                    this.op[0].CalcFBL(this.fb);
                    break;
                case 1:
                    this.op[2].CalcL(this.op[0].Out() + this.op[1].Out());
                    this.op[1].CalcL(0);
                    r = this.op[3].CalcL(this.op[2].Out());
                    this.op[0].CalcFBL(this.fb);
                    break;
                case 2:
                    this.op[2].CalcL(this.op[1].Out());
                    this.op[1].CalcL(0);
                    r = this.op[3].CalcL(this.op[0].Out() + this.op[2].Out());
                    this.op[0].CalcFBL(this.fb);
                    break;
                case 3:
                    this.op[2].CalcL(0);
                    this.op[1].CalcL(this.op[0].Out());
                    r = this.op[3].CalcL(this.op[1].Out() + this.op[2].Out());
                    this.op[0].CalcFBL(this.fb);
                    break;
                case 4:
                    this.op[2].CalcL(0);
                    r = this.op[1].CalcL(this.op[0].Out());
                    r += this.op[3].CalcL(this.op[2].Out());
                    this.op[0].CalcFBL(this.fb);
                    break;
                case 5:
                    r = this.op[2].CalcL(this.op[0].Out());
                    r += this.op[1].CalcL(this.op[0].Out());
                    r += this.op[3].CalcL(this.op[0].Out());
                    this.op[0].CalcFBL(this.fb);
                    break;
                case 6:
                    r = this.op[2].CalcL(0);
                    r += this.op[1].CalcL(this.op[0].Out());
                    r += this.op[3].CalcL(0);
                    this.op[0].CalcFBL(this.fb);
                    break;
                case 7:
                    r = this.op[2].CalcL(0);
                    r += this.op[1].CalcL(0);
                    r += this.op[3].CalcL(0);
                    r += this.op[0].CalcFBL(this.fb);
                    break;
            }
            return r;
        };
        Channel4.prototype.CalcN = function (noise) {
            this.buf[1] = this.buf[2] = this.buf[3] = 0;
            this.buf[0] = this.op[0].Out();
            this.op[0].CalcFB(this.fb);
            this.buf[this.ox[0]] += this.op[1].Calc(this.buf[this.ix[0]]);
            this.buf[this.ox[1]] += this.op[2].Calc(this.buf[this.ix[1]]);
            var o = this.op[3].Out();
            this.op[3].CalcN(noise);
            return this.buf[this.ox[2]] + o;
        };
        Channel4.prototype.CalcLN = function (noise) {
            this.chip_.SetPMV(this.pms[this.chip_.GetPML()]);
            this.buf[1] = this.buf[2] = this.buf[3] = 0;
            this.buf[0] = this.op[0].Out();
            this.op[0].CalcFBL(this.fb);
            this.buf[this.ox[0]] += this.op[1].CalcL(this.buf[this.ix[0]]);
            this.buf[this.ox[1]] += this.op[2].CalcL(this.buf[this.ix[1]]);
            var o = this.op[3].Out();
            this.op[3].CalcN(noise);
            return this.buf[this.ox[2]] + o;
        };
        Channel4.fbtable = [
            31, 7, 6, 5, 4, 3, 2, 1
        ];
        Channel4.kftable = [
            65536, 65595, 65654, 65713, 65773, 65832, 65891, 65951,
            66010, 66070, 66130, 66189, 66249, 66309, 66369, 66429,
            66489, 66549, 66609, 66669, 66729, 66789, 66850, 66910,
            66971, 67031, 67092, 67152, 67213, 67273, 67334, 67395,
            67456, 67517, 67578, 67639, 67700, 67761, 67822, 67883,
            67945, 68006, 68067, 68129, 68190, 68252, 68314, 68375,
            68437, 68499, 68561, 68623, 68685, 68747, 68809, 68871,
            68933, 68995, 69057, 69120, 69182, 69245, 69307, 69370
        ];
        Channel4.kctable = [
            5197, 5506, 5833, 6180, 6180, 6547, 6937, 7349,
            7349, 7786, 8249, 8740, 8740, 9259, 9810, 10394
        ];
        Channel4.iotable = [
            [0, 1, 1, 2, 2, 3], [1, 0, 0, 1, 1, 2],
            [1, 1, 1, 0, 0, 2], [0, 1, 2, 1, 1, 2],
            [0, 1, 2, 2, 2, 1], [0, 1, 0, 1, 0, 1],
            [0, 1, 2, 1, 2, 1], [1, 0, 1, 0, 1, 0]
        ];
        Channel4.pmtable = (function () {
            var pmtable = fmgenAs.JaggArray.I3(2, 8, 256);
            var i, j;
            var pms = [
                [0, 1 / 360.0, 2 / 360.0, 3 / 360.0, 4 / 360.0, 6 / 360.0, 12 / 360.0, 24 / 360.0],
                [0, 1 / 480.0, 2 / 480.0, 4 / 480.0, 10 / 480.0, 20 / 480.0, 80 / 480.0, 140 / 480.0]
            ];
            for (var type = 0; type < 2; type++) {
                for (i = 0; i < 8; i++) {
                    var pmb = pms[type][i];
                    for (j = 0; j < 256; j++) {
                        var v = Math.pow(2.0, pmb * (2 * j - 256 + 1) / (256 - 1));
                        var w = 0.6 * pmb * Math.sin(2 * j * Math.PI / 256) + 1;
                        pmtable[type][i][j] = (0x10000 * (w - 1)) | 0;
                    }
                }
            }
            return pmtable;
        })();
        return Channel4;
    })();
    fmgenAs.Channel4 = Channel4;
})(fmgenAs || (fmgenAs = {}));


var fmgenAs;
(function (fmgenAs) {
    var dt2lv = [
        1.0, 1.414, 1.581, 1.732
    ];
    var Chip = (function () {
        function Chip() {
            this.ratio_ = 0;
            this.aml_ = 0;
            this.pml_ = 0;
            this.pmv_ = 0;
            this.multable_ = fmgenAs.JaggArray.I2(4, 16);
        }
        Chip.prototype.Chip = function () {
            this.MakeTable();
        };
        Chip.prototype.SetRatio = function (ratio) {
            if (this.ratio_ !== ratio) {
                this.ratio_ = ratio;
                this.MakeTable();
            }
        };
        Chip.prototype.SetAML = function (l) {
            this.aml_ = l & (256 - 1);
        };
        Chip.prototype.SetPML = function (l) {
            this.pml_ = l & (256 - 1);
        };
        Chip.prototype.SetPMV = function (pmv) {
            this.pmv_ = pmv;
        };
        Chip.prototype.GetMulValue = function (dt2, mul) {
            return this.multable_[dt2][mul];
        };
        Chip.prototype.GetAML = function () {
            return this.aml_;
        };
        Chip.prototype.GetPML = function () {
            return this.pml_;
        };
        Chip.prototype.GetPMV = function () {
            return this.pmv_;
        };
        Chip.prototype.GetRatio = function () {
            return this.ratio_;
        };
        Chip.prototype.MakeTable = function () {
            var h, l;
            for (h = 0; h < 4; h++) {
                var rr = dt2lv[h] * this.ratio_ / (1 << (2 + 7 - 9));
                for (l = 0; l < 16; l++) {
                    var mul = (l !== 0) ? l * 2 : 1;
                    this.multable_[h][l] = (mul * rr) | 0;
                }
            }
        };
        return Chip;
    })();
    fmgenAs.Chip = Chip;
})(fmgenAs || (fmgenAs = {}));


var fmgenAs;
(function (fmgenAs) {
    var EGPhase = (function () {
        function EGPhase() {
        }
        EGPhase.next = 0;
        EGPhase.attack = 1;
        EGPhase.decay = 2;
        EGPhase.sustain = 3;
        EGPhase.release = 4;
        EGPhase.off = 5;
        return EGPhase;
    })();
    fmgenAs.EGPhase = EGPhase;
})(fmgenAs || (fmgenAs = {}));





var fmgenAs;
(function (fmgenAs) {
    var Timer = (function () {
        function Timer() {
            this.regta = new Array(2);
        }
        Timer.prototype.Reset = function () {
            this.timera_count = 0;
            this.timerb_count = 0;
        };
        Timer.prototype.Count = function (us) {
            var f = false;
            if (this.timera_count !== 0) {
                this.timera_count -= us << 16;
                if (this.timera_count <= 0) {
                    f = true;
                    this.TimerA();
                    while (this.timera_count <= 0)
                        this.timera_count += this.timera;
                    if (this.regtc & 4)
                        this.SetStatus(1);
                }
            }
            if (this.timerb_count !== 0) {
                this.timerb_count -= us << 12;
                if (this.timerb_count <= 0) {
                    f = true;
                    while (this.timerb_count <= 0)
                        this.timerb_count += this.timerb;
                    if (this.regtc & 8)
                        this.SetStatus(2);
                }
            }
            return f;
        };
        Timer.prototype.GetNextEvent = function () {
            var ta = ((this.timera_count + 0xffff) >> 16) - 1;
            var tb = ((this.timerb_count + 0xfff) >> 12) - 1;
            return (ta < tb ? ta : tb) + 1;
        };
        Timer.prototype.SetStatus = function (bit) { };
        Timer.prototype.ResetStatus = function (bit) { };
        Timer.prototype.SetTimerBase = function (clock) {
            this.timer_step = (1000000.0 * 65536 / clock) | 0;
        };
        Timer.prototype.SetTimerA = function (addr, data) {
            var tmp;
            this.regta[addr & 1] = data | 0;
            tmp = (this.regta[0] << 2) + (this.regta[1] & 3);
            this.timera = (1024 - tmp) * this.timer_step;
        };
        Timer.prototype.SetTimerB = function (data) {
            this.timerb = (256 - data) * this.timer_step;
        };
        Timer.prototype.SetTimerControl = function (data) {
            var tmp = this.regtc ^ data;
            this.regtc = data | 0;
            if (data & 0x10)
                this.ResetStatus(1);
            if (data & 0x20)
                this.ResetStatus(2);
            if (tmp & 0x01)
                this.timera_count = (data & 1) ? this.timera : 0;
            if (tmp & 0x02)
                this.timerb_count = (data & 2) ? this.timerb : 0;
        };
        Timer.prototype.TimerA = function () { };
        return Timer;
    })();
    fmgenAs.Timer = Timer;
})(fmgenAs || (fmgenAs = {}));


var fmgenAs;
(function (fmgenAs) {
    var OpType = (function () {
        function OpType() {
        }
        OpType.typeN = 0;
        OpType.typeM = 1;
        return OpType;
    })();
    fmgenAs.OpType = OpType;
})(fmgenAs || (fmgenAs = {}));


var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var fmgenAs;
(function (fmgenAs) {
    var OPM = (function (_super) {
        __extends(OPM, _super);
        function OPM() {
            _super.call(this);
            this.amplevel = 16384;
            this.kc = new Array(8);
            this.kf = new Array(8);
            this.pan = new Array(8);
            this.chip = new fmgenAs.Chip();
            this.buf = new Array(4);
            this.ch = [
                new fmgenAs.Channel4(), new fmgenAs.Channel4(),
                new fmgenAs.Channel4(), new fmgenAs.Channel4(),
                new fmgenAs.Channel4(), new fmgenAs.Channel4(),
                new fmgenAs.Channel4(), new fmgenAs.Channel4()
            ];
            this.lfo_count_ = 0;
            this.lfo_count_prev_ = ~0;
            OPM.BuildLFOTable();
            for (var i = 0; i < 8; i++) {
                this.ch[i].SetChip(this.chip);
                this.ch[i].SetType(fmgenAs.OpType.typeM);
            }
            this.ix = this.ch[0].ix;
            this.ox = this.ch[0].ox;
        }
        OPM.BuildLFOTable = function () {
            if (this.s_init)
                return;
            for (var type = 0; type < 4; type++) {
                var r = 0;
                for (var c = 0; c < 512; c++) {
                    var a = 0;
                    var p = 0;
                    switch (type) {
                        case 0:
                            p = (((c + 0x100) & 0x1ff) / 2) - 0x80;
                            a = 0xff - c / 2;
                            break;
                        case 1:
                            a = c < 0x100 ? 0xff : 0;
                            p = c < 0x100 ? 0x7f : -0x80;
                            break;
                        case 2:
                            p = (c + 0x80) & 0x1ff;
                            p = p < 0x100 ? p - 0x80 : 0x17f - p;
                            a = c < 0x100 ? 0xff - c : c - 0x100;
                            break;
                        case 3:
                            if ((c & 3) === 0)
                                r = ((Math.random() * 32768 | 0) / 17) & 0xff;
                            a = r;
                            p = r - 0x80;
                            break;
                    }
                    this.amtable[type][c] = a;
                    this.pmtable[type][c] = -p - 1;
                }
            }
            this.s_init = true;
        };
        OPM.prototype.Init = function (c, rf) {
            if (!this.SetRate(c, rf))
                return false;
            this.Reset();
            this.SetVolume(0);
            this.SetChannelMask(0);
            return true;
        };
        OPM.prototype.SetRate = function (c, r) {
            this.clock = c;
            this.pcmrate = r;
            this.rate = r;
            this.RebuildTimeTable();
            return true;
        };
        OPM.prototype.SetChannelMask = function (mask) {
            for (var i = 0; i < 8; i++)
                this.ch[i].Mute((mask & (1 << i)) !== 0);
        };
        OPM.prototype.Reset = function () {
            var i;
            for (i = 0x0; i < 0x100; i++)
                this.SetReg(i, 0);
            this.SetReg(0x19, 0x80);
            _super.prototype.Reset.call(this);
            this.status = 0;
            this.noise = 12345;
            this.noisecount = 0;
            for (i = 0; i < 8; i++)
                this.ch[i].Reset();
        };
        OPM.prototype.RebuildTimeTable = function () {
            var fmclock = this.clock / 64 | 0;
            this.rateratio = ((fmclock << 7) + (this.rate / 2)) / this.rate | 0;
            this.SetTimerBase(fmclock);
            this.chip.SetRatio(this.rateratio);
        };
        OPM.prototype.TimerA = function () {
            if (this.regtc & 0x80) {
                for (var i = 0; i < 8; i++) {
                    this.ch[i].KeyControl(0x0);
                    this.ch[i].KeyControl(0xf);
                }
            }
        };
        OPM.prototype.SetVolume = function (db) {
            db = Math.min(db, 20);
            if (db > -192)
                this.fmvolume = 16384 * Math.pow(10.0, db / 40.0) | 0;
            else
                this.fmvolume = 0;
        };
        OPM.prototype.SetExpression = function (amp) {
            this.amplevel = amp * 16384 | 0;
        };
        OPM.prototype.ReadStatus = function () {
            return this.status & 0x03;
        };
        OPM.prototype.SetStatus = function (bits) {
            if ((this.status & bits) === 0) {
                this.status |= bits;
                this.Intr(true);
            }
        };
        OPM.prototype.ResetStatus = function (bits) {
            if (this.status & bits) {
                this.status &= ~bits;
                if (this.status === 0)
                    this.Intr(false);
            }
        };
        OPM.prototype.SetReg = function (addr, data) {
            if (addr >= 0x100)
                return;
            var c = addr & 7;
            switch (addr & 0xff) {
                case 0x01:
                    if (data & 2) {
                        this.lfo_count_ = 0;
                        this.lfo_count_prev_ = ~0;
                    }
                    this.reg01 = data;
                    break;
                case 0x08:
                    if ((this.regtc & 0x80) === 0) {
                        this.ch[data & 7].KeyControl(data >> 3);
                    }
                    else {
                        c = data & 7;
                        if ((data & 0x08) === 0)
                            this.ch[c].op[0].KeyOff();
                        if ((data & 0x10) === 0)
                            this.ch[c].op[1].KeyOff();
                        if ((data & 0x20) === 0)
                            this.ch[c].op[2].KeyOff();
                        if ((data & 0x40) === 0)
                            this.ch[c].op[3].KeyOff();
                    }
                    break;
                case 0x10:
                case 0x11:
                    this.SetTimerA(addr, data);
                    break;
                case 0x12:
                    this.SetTimerB(data);
                    break;
                case 0x14:
                    this.SetTimerControl(data);
                    break;
                case 0x18:
                    this.lfofreq = data;
                    this.lfo_count_diff_ = this.rateratio * ((16 + (this.lfofreq & 15)) << (16 - 4 - 7)) / (1 << (15 - (this.lfofreq >> 4)));
                    break;
                case 0x19:
                    if (data & 0x80)
                        this.pmd = data & 0x7f;
                    else
                        this.amd = data & 0x7f;
                    break;
                case 0x1b:
                    this.lfowaveform = data & 3;
                    break;
                case 0x20:
                case 0x21:
                case 0x22:
                case 0x23:
                case 0x24:
                case 0x25:
                case 0x26:
                case 0x27:
                    this.ch[c].SetFB((data >> 3) & 7);
                    this.ch[c].SetAlgorithm(data & 7);
                    this.pan[c] = (data >> 6) & 3;
                    break;
                case 0x28:
                case 0x29:
                case 0x2a:
                case 0x2b:
                case 0x2c:
                case 0x2d:
                case 0x2e:
                case 0x2f:
                    this.kc[c] = data;
                    this.ch[c].SetKCKF(this.kc[c], this.kf[c]);
                    break;
                case 0x30:
                case 0x31:
                case 0x32:
                case 0x33:
                case 0x34:
                case 0x35:
                case 0x36:
                case 0x37:
                    this.kf[c] = data >> 2;
                    this.ch[c].SetKCKF(this.kc[c], this.kf[c]);
                    break;
                case 0x38:
                case 0x39:
                case 0x3a:
                case 0x3b:
                case 0x3c:
                case 0x3d:
                case 0x3e:
                case 0x3f:
                    this.ch[c].SetMS((data << 4) | (data >> 4));
                    break;
                case 0x0f:
                    this.noisedelta = data;
                    this.noisecount = 0;
                    break;
                default:
                    if (addr >= 0x40)
                        this.SetParameter(addr, data);
                    break;
            }
        };
        OPM.prototype.SetParameter = function (addr, data) {
            var slot = OPM.slottable[(addr >> 3) & 3];
            var op = this.ch[addr & 7].op[slot];
            switch ((addr >> 5) & 7) {
                case 2:
                    op.SetDT((data >> 4) & 0x07);
                    op.SetMULTI(data & 0x0f);
                    break;
                case 3:
                    op.SetTL(data & 0x7f, (this.regtc & 0x80) !== 0);
                    break;
                case 4:
                    op.SetKS((data >> 6) & 3);
                    op.SetAR((data & 0x1f) * 2);
                    break;
                case 5:
                    op.SetDR((data & 0x1f) * 2);
                    op.SetAMON((data & 0x80) !== 0);
                    break;
                case 6:
                    op.SetSR((data & 0x1f) * 2);
                    op.SetDT2((data >> 6) & 3);
                    break;
                case 7:
                    op.SetSL(OPM.sltable[(data >> 4) & 15]);
                    op.SetRR((data & 0x0f) * 4 + 2);
                    break;
            }
        };
        OPM.prototype.Mix = function (buffer, start, nsamples) {
            var i;
            var activech = 0;
            for (i = 0; i < 8; i++)
                activech = (activech << 2) | this.ch[i].Prepare();
            if (activech & 0x5555) {
                if (this.reg01 & 0x02)
                    activech &= 0x5555;
                var a, c, r, o, ii;
                var pgex, pgin, sino;
                var al = this.ch[0].algo_;
                var fb = this.ch[0].fb;
                var op0 = this.ch[0].op[0];
                var op1 = this.ch[0].op[1];
                var op2 = this.ch[0].op[2];
                var op3 = this.ch[0].op[3];
                var buf = this.buf;
                var ix = this.ix;
                var ox = this.ox;
                var cltable = OPM.cltable;
                var sinetable = OPM.sinetable;
                var attacktable = OPM.attacktable;
                var decaytable1 = OPM.decaytable1;
                if (this.lfowaveform !== 3) {
                    var pmtable = OPM.pmtable;
                    var amtable = OPM.amtable;
                }
                for (i = start; i < start + nsamples; i++) {
                    if (this.lfowaveform !== 3) {
                        c = (this.lfo_count_ >> 15) & 0x1fe;
                        this.chip.pml_ = (pmtable[this.lfowaveform][c] * this.pmd / 128 + 0x80) & (256 - 1);
                        this.chip.aml_ = (amtable[this.lfowaveform][c] * this.amd / 128) & (256 - 1);
                    }
                    else {
                        if ((this.lfo_count_ ^ this.lfo_count_prev_) & ~((1 << 17) - 1)) {
                            c = ((Math.random() * 32768 | 0) / 17) & 0xff;
                            this.chip.pml_ = ((c - 0x80) * this.pmd / 128 + 0x80) & (256 - 1);
                            this.chip.aml_ = (c * this.amd / 128) & (256 - 1);
                        }
                    }
                    this.lfo_count_prev_ = this.lfo_count_;
                    this.lfo_step_++;
                    if ((this.lfo_step_ & 7) === 0) {
                        this.lfo_count_ += this.lfo_count_diff_;
                    }
                    r = 0;
                    if (activech & 0x4000) {
                        if (activech & 0xaaaa) {
                            this.ch[0].chip_.pmv_ = this.ch[0].pms[this.ch[0].chip_.pml_];
                            buf[1] = buf[2] = buf[3] = 0;
                            buf[0] = op0.out_;
                            op0.eg_count_ -= op0.eg_count_diff_;
                            if (op0.eg_count_ <= 0) {
                                op0.eg_count_ = (2047 * 3) << 7;
                                if (op0.eg_phase_ === fmgenAs.EGPhase.attack) {
                                    c = attacktable[op0.eg_rate_][op0.eg_curve_count_ & 7];
                                    if (c >= 0) {
                                        op0.eg_level_ -= 1 + (op0.eg_level_ >> c);
                                        if (op0.eg_level_ <= 0)
                                            op0.ShiftPhase(fmgenAs.EGPhase.decay);
                                    }
                                }
                                else {
                                    op0.eg_level_ += decaytable1[op0.eg_rate_][op0.eg_curve_count_ & 7];
                                    if (op0.eg_level_ >= op0.eg_level_on_next_phase_)
                                        op0.ShiftPhase(op0.eg_phase_ + 1);
                                }
                                a = op0.tl_out_ + op0.eg_level_;
                                op0.eg_out_ = (a < 0x3ff) ? a << (1 + 2) : 0x3ff << (1 + 2);
                                op0.eg_curve_count_++;
                            }
                            ii = op0.out_ + op0.out2_;
                            op0.out2_ = op0.out_;
                            pgex = op0.pg_count_;
                            op0.pg_count_ += op0.pg_diff_ + ((op0.pg_diff_lfo_ * op0.chip_.pmv_) >> 5);
                            pgin = pgex >> (20 + 9 - 10);
                            if (fb < 31) {
                                pgin += ((ii << (1 + fmgenAs.Operator.IS2EC_SHIFT)) >> fb) >> (20 + 9 - 10);
                            }
                            sino = op0.eg_out_ + sinetable[pgin & (1024 - 1)] + op0.ams_[op0.chip_.aml_];
                            op0.out_ = (sino < 8192) ? cltable[sino] : 0;
                            op1.eg_count_ -= op1.eg_count_diff_;
                            if (op1.eg_count_ <= 0) {
                                op1.eg_count_ = (2047 * 3) << 7;
                                if (op1.eg_phase_ === fmgenAs.EGPhase.attack) {
                                    c = attacktable[op1.eg_rate_][op1.eg_curve_count_ & 7];
                                    if (c >= 0) {
                                        op1.eg_level_ -= 1 + (op1.eg_level_ >> c);
                                        if (op1.eg_level_ <= 0)
                                            op1.ShiftPhase(fmgenAs.EGPhase.decay);
                                    }
                                }
                                else {
                                    op1.eg_level_ += decaytable1[op1.eg_rate_][op1.eg_curve_count_ & 7];
                                    if (op1.eg_level_ >= op1.eg_level_on_next_phase_)
                                        op1.ShiftPhase(op1.eg_phase_ + 1);
                                }
                                a = op1.tl_out_ + op1.eg_level_;
                                op1.eg_out_ = (a < 0x3ff) ? a << (1 + 2) : 0x3ff << (1 + 2);
                                op1.eg_curve_count_++;
                            }
                            ii = buf[ix[0]];
                            op1.out2_ = op1.out_;
                            pgex = op1.pg_count_;
                            op1.pg_count_ += op1.pg_diff_ + ((op1.pg_diff_lfo_ * op1.chip_.pmv_) >> 5);
                            pgin = pgex >> (20 + 9 - 10);
                            pgin += ii >> (20 + 9 - 10 - (2 + fmgenAs.Operator.IS2EC_SHIFT));
                            sino = op1.eg_out_ + sinetable[pgin & (1024 - 1)] + op1.ams_[op1.chip_.aml_];
                            op1.out_ = (sino < 8192) ? cltable[sino] : 0;
                            buf[ox[0]] += op1.out_;
                            op2.eg_count_ -= op2.eg_count_diff_;
                            if (op2.eg_count_ <= 0) {
                                op2.eg_count_ = (2047 * 3) << 7;
                                if (op2.eg_phase_ === fmgenAs.EGPhase.attack) {
                                    c = attacktable[op2.eg_rate_][op2.eg_curve_count_ & 7];
                                    if (c >= 0) {
                                        op2.eg_level_ -= 1 + (op2.eg_level_ >> c);
                                        if (op2.eg_level_ <= 0)
                                            op2.ShiftPhase(fmgenAs.EGPhase.decay);
                                    }
                                }
                                else {
                                    op2.eg_level_ += decaytable1[op2.eg_rate_][op2.eg_curve_count_ & 7];
                                    if (op2.eg_level_ >= op2.eg_level_on_next_phase_)
                                        op2.ShiftPhase(op2.eg_phase_ + 1);
                                }
                                a = op2.tl_out_ + op2.eg_level_;
                                op2.eg_out_ = (a < 0x3ff) ? a << (1 + 2) : 0x3ff << (1 + 2);
                                op2.eg_curve_count_++;
                            }
                            ii = buf[ix[1]];
                            op2.out2_ = op2.out_;
                            pgex = op2.pg_count_;
                            op2.pg_count_ += op2.pg_diff_ + ((op2.pg_diff_lfo_ * op2.chip_.pmv_) >> 5);
                            pgin = pgex >> (20 + 9 - 10);
                            pgin += ii >> (20 + 9 - 10 - (2 + fmgenAs.Operator.IS2EC_SHIFT));
                            sino = op2.eg_out_ + sinetable[pgin & (1024 - 1)] + op2.ams_[op2.chip_.aml_];
                            op2.out_ = (sino < 8192) ? cltable[sino] : 0;
                            buf[ox[1]] += op2.out_;
                            op3.eg_count_ -= op3.eg_count_diff_;
                            if (op3.eg_count_ <= 0) {
                                op3.eg_count_ = (2047 * 3) << 7;
                                if (op3.eg_phase_ === fmgenAs.EGPhase.attack) {
                                    c = attacktable[op3.eg_rate_][op3.eg_curve_count_ & 7];
                                    if (c >= 0) {
                                        op3.eg_level_ -= 1 + (op3.eg_level_ >> c);
                                        if (op3.eg_level_ <= 0)
                                            op3.ShiftPhase(fmgenAs.EGPhase.decay);
                                    }
                                }
                                else {
                                    op3.eg_level_ += decaytable1[op3.eg_rate_][op3.eg_curve_count_ & 7];
                                    if (op3.eg_level_ >= op3.eg_level_on_next_phase_)
                                        op3.ShiftPhase(op3.eg_phase_ + 1);
                                }
                                a = op3.tl_out_ + op3.eg_level_;
                                op3.eg_out_ = (a < 0x3ff) ? a << (1 + 2) : 0x3ff << (1 + 2);
                                op3.eg_curve_count_++;
                            }
                            ii = buf[ix[2]];
                            op3.out2_ = op3.out_;
                            pgex = op3.pg_count_;
                            op3.pg_count_ += op3.pg_diff_ + ((op3.pg_diff_lfo_ * op3.chip_.pmv_) >> 5);
                            pgin = pgex >> (20 + 9 - 10);
                            pgin += ii >> (20 + 9 - 10 - (2 + fmgenAs.Operator.IS2EC_SHIFT));
                            sino = op3.eg_out_ + sinetable[pgin & (1024 - 1)] + op3.ams_[op3.chip_.aml_];
                            op3.out_ = (sino < 8192) ? cltable[sino] : 0;
                            r = buf[ox[2]] + op3.out_;
                        }
                        else {
                            buf[1] = buf[2] = buf[3] = 0;
                            buf[0] = op0.out_;
                            op0.eg_count_ -= op0.eg_count_diff_;
                            if (op0.eg_count_ <= 0) {
                                op0.eg_count_ = (2047 * 3) << 7;
                                if (op0.eg_phase_ === fmgenAs.EGPhase.attack) {
                                    c = attacktable[op0.eg_rate_][op0.eg_curve_count_ & 7];
                                    if (c >= 0) {
                                        op0.eg_level_ -= 1 + (op0.eg_level_ >> c);
                                        if (op0.eg_level_ <= 0)
                                            op0.ShiftPhase(fmgenAs.EGPhase.decay);
                                    }
                                }
                                else {
                                    op0.eg_level_ += decaytable1[op0.eg_rate_][op0.eg_curve_count_ & 7];
                                    if (op0.eg_level_ >= op0.eg_level_on_next_phase_)
                                        op0.ShiftPhase(op0.eg_phase_ + 1);
                                }
                                a = op0.tl_out_ + op0.eg_level_;
                                op0.eg_out_ = (a < 0x3ff) ? a << (1 + 2) : 0x3ff << (1 + 2);
                                op0.eg_curve_count_++;
                            }
                            ii = op0.out_ + op0.out2_;
                            op0.out2_ = op0.out_;
                            pgex = op0.pg_count_;
                            op0.pg_count_ += op0.pg_diff_;
                            pgin = pgex >> (20 + 9 - 10);
                            if (fb < 31) {
                                pgin += ((ii << (1 + fmgenAs.Operator.IS2EC_SHIFT)) >> fb) >> (20 + 9 - 10);
                            }
                            sino = op0.eg_out_ + sinetable[pgin & (1024 - 1)];
                            op0.out_ = (sino < 8192) ? cltable[sino] : 0;
                            op1.eg_count_ -= op1.eg_count_diff_;
                            if (op1.eg_count_ <= 0) {
                                op1.eg_count_ = (2047 * 3) << 7;
                                if (op1.eg_phase_ === fmgenAs.EGPhase.attack) {
                                    c = attacktable[op1.eg_rate_][op1.eg_curve_count_ & 7];
                                    if (c >= 0) {
                                        op1.eg_level_ -= 1 + (op1.eg_level_ >> c);
                                        if (op1.eg_level_ <= 0)
                                            op1.ShiftPhase(fmgenAs.EGPhase.decay);
                                    }
                                }
                                else {
                                    op1.eg_level_ += decaytable1[op1.eg_rate_][op1.eg_curve_count_ & 7];
                                    if (op1.eg_level_ >= op1.eg_level_on_next_phase_)
                                        op1.ShiftPhase(op1.eg_phase_ + 1);
                                }
                                a = op1.tl_out_ + op1.eg_level_;
                                op1.eg_out_ = (a < 0x3ff) ? a << (1 + 2) : 0x3ff << (1 + 2);
                                op1.eg_curve_count_++;
                            }
                            ii = buf[ix[0]];
                            op1.out2_ = op1.out_;
                            pgex = op1.pg_count_;
                            op1.pg_count_ += op1.pg_diff_;
                            pgin = pgex >> (20 + 9 - 10);
                            pgin += ii >> (20 + 9 - 10 - (2 + fmgenAs.Operator.IS2EC_SHIFT));
                            sino = op1.eg_out_ + sinetable[pgin & (1024 - 1)];
                            op1.out_ = (sino < 8192) ? cltable[sino] : 0;
                            buf[ox[0]] += op1.out_;
                            op2.eg_count_ -= op2.eg_count_diff_;
                            if (op2.eg_count_ <= 0) {
                                op2.eg_count_ = (2047 * 3) << 7;
                                if (op2.eg_phase_ === fmgenAs.EGPhase.attack) {
                                    c = attacktable[op2.eg_rate_][op2.eg_curve_count_ & 7];
                                    if (c >= 0) {
                                        op2.eg_level_ -= 1 + (op2.eg_level_ >> c);
                                        if (op2.eg_level_ <= 0)
                                            op2.ShiftPhase(fmgenAs.EGPhase.decay);
                                    }
                                }
                                else {
                                    op2.eg_level_ += decaytable1[op2.eg_rate_][op2.eg_curve_count_ & 7];
                                    if (op2.eg_level_ >= op2.eg_level_on_next_phase_)
                                        op2.ShiftPhase(op2.eg_phase_ + 1);
                                }
                                a = op2.tl_out_ + op2.eg_level_;
                                op2.eg_out_ = (a < 0x3ff) ? a << (1 + 2) : 0x3ff << (1 + 2);
                                op2.eg_curve_count_++;
                            }
                            ii = buf[ix[1]];
                            op2.out2_ = op2.out_;
                            pgex = op2.pg_count_;
                            op2.pg_count_ += op2.pg_diff_;
                            pgin = pgex >> (20 + 9 - 10);
                            pgin += ii >> (20 + 9 - 10 - (2 + fmgenAs.Operator.IS2EC_SHIFT));
                            sino = op2.eg_out_ + sinetable[pgin & (1024 - 1)];
                            op2.out_ = (sino < 8192) ? cltable[sino] : 0;
                            buf[ox[1]] += op2.out_;
                            op3.eg_count_ -= op3.eg_count_diff_;
                            if (op3.eg_count_ <= 0) {
                                op3.eg_count_ = (2047 * 3) << 7;
                                if (op3.eg_phase_ === fmgenAs.EGPhase.attack) {
                                    c = attacktable[op3.eg_rate_][op3.eg_curve_count_ & 7];
                                    if (c >= 0) {
                                        op3.eg_level_ -= 1 + (op3.eg_level_ >> c);
                                        if (op3.eg_level_ <= 0)
                                            op3.ShiftPhase(fmgenAs.EGPhase.decay);
                                    }
                                }
                                else {
                                    op3.eg_level_ += decaytable1[op3.eg_rate_][op3.eg_curve_count_ & 7];
                                    if (op3.eg_level_ >= op3.eg_level_on_next_phase_)
                                        op3.ShiftPhase(op3.eg_phase_ + 1);
                                }
                                a = op3.tl_out_ + op3.eg_level_;
                                op3.eg_out_ = (a < 0x3ff) ? a << (1 + 2) : 0x3ff << (1 + 2);
                                op3.eg_curve_count_++;
                            }
                            ii = buf[ix[2]];
                            op3.out2_ = op3.out_;
                            pgex = op3.pg_count_;
                            op3.pg_count_ += op3.pg_diff_;
                            pgin = pgex >> (20 + 9 - 10);
                            pgin += ii >> (20 + 9 - 10 - (2 + fmgenAs.Operator.IS2EC_SHIFT));
                            sino = op3.eg_out_ + sinetable[pgin & (1024 - 1)];
                            op3.out_ = (sino < 8192) ? cltable[sino] : 0;
                            r = buf[ox[2]] + op3.out_;
                        }
                        buffer[i] = ((((r * this.fmvolume) >> 14) * this.amplevel) >> 14) / 8192.0;
                    }
                }
            }
            else {
                buffer.set(msgr.emptyBuffer.subarray(0, nsamples), start);
            }
        };
        OPM.prototype.Intr = function (f) {
        };
        OPM.prototype.IsOn = function (c) {
            var c4 = this.ch[c & 7];
            switch (c4.algo_) {
                case 0:
                case 1:
                case 2:
                case 3:
                    return (c4.op[3].eg_phase_ !== fmgenAs.EGPhase.off);
                case 4:
                    return (c4.op[1].eg_phase_ !== fmgenAs.EGPhase.off) || (c4.op[3].eg_phase_ !== fmgenAs.EGPhase.off);
                case 5:
                case 6:
                    return (c4.op[1].eg_phase_ !== fmgenAs.EGPhase.off) || (c4.op[2].eg_phase_ !== fmgenAs.EGPhase.off) || (c4.op[3].eg_phase_ !== fmgenAs.EGPhase.off);
                case 7:
                    return (c4.op[0].eg_phase_ !== fmgenAs.EGPhase.off) || (c4.op[1].eg_phase_ !== fmgenAs.EGPhase.off) || (c4.op[2].eg_phase_ !== fmgenAs.EGPhase.off) || (c4.op[3].eg_phase_ !== fmgenAs.EGPhase.off);
            }
            return false;
        };
        OPM.s_init = false;
        OPM.amtable = fmgenAs.JaggArray.I2(4, 512);
        OPM.pmtable = fmgenAs.JaggArray.I2(4, 512);
        OPM.sltable = [
            0, 4, 8, 12, 16, 20, 24, 28,
            32, 36, 40, 44, 48, 52, 56, 124,
        ];
        OPM.slottable = [
            0, 2, 1, 3
        ];
        OPM.decaytable1 = fmgenAs.Operator.decaytable1;
        OPM.attacktable = fmgenAs.Operator.attacktable;
        OPM.sinetable = fmgenAs.Operator.sinetable;
        OPM.cltable = fmgenAs.Operator.cltable;
        return OPM;
    })(fmgenAs.Timer);
    fmgenAs.OPM = OPM;
})(fmgenAs || (fmgenAs = {}));


var flmml;
(function (flmml) {
    var MFormant = (function () {
        function MFormant() {
            this.m_ca0 = 0.00000811044;
            this.m_ca1 = 8.943665402;
            this.m_ca2 = -36.83889529;
            this.m_ca3 = 92.01697887;
            this.m_ca4 = -154.337906;
            this.m_ca5 = 181.6233289;
            this.m_ca6 = -151.8651235;
            this.m_ca7 = 89.09614114;
            this.m_ca8 = -35.10298511;
            this.m_ca9 = 8.388101016;
            this.m_caA = -0.923313471;
            this.m_ce0 = 0.00000436215;
            this.m_ce1 = 8.90438318;
            this.m_ce2 = -36.55179099;
            this.m_ce3 = 91.05750846;
            this.m_ce4 = -152.422234;
            this.m_ce5 = 179.1170248;
            this.m_ce6 = -149.6496211;
            this.m_ce7 = 87.78352223;
            this.m_ce8 = -34.60687431;
            this.m_ce9 = 8.282228154;
            this.m_ceA = -0.914150747;
            this.m_ci0 = 0.00000333819;
            this.m_ci1 = 8.893102966;
            this.m_ci2 = -36.49532826;
            this.m_ci3 = 90.96543286;
            this.m_ci4 = -152.4545478;
            this.m_ci5 = 179.4835618;
            this.m_ci6 = -150.315433;
            this.m_ci7 = 88.43409371;
            this.m_ci8 = -34.98612086;
            this.m_ci9 = 8.407803364;
            this.m_ciA = -0.932568035;
            this.m_co0 = 0.00000113572;
            this.m_co1 = 8.994734087;
            this.m_co2 = -37.2084849;
            this.m_co3 = 93.22900521;
            this.m_co4 = -156.6929844;
            this.m_co5 = 184.596544;
            this.m_co6 = -154.3755513;
            this.m_co7 = 90.49663749;
            this.m_co8 = -35.58964535;
            this.m_co9 = 8.478996281;
            this.m_coA = -0.929252233;
            this.m_cu0 = 4.09431e-7;
            this.m_cu1 = 8.997322763;
            this.m_cu2 = -37.20218544;
            this.m_cu3 = 93.11385476;
            this.m_cu4 = -156.2530937;
            this.m_cu5 = 183.7080141;
            this.m_cu6 = -153.2631681;
            this.m_cu7 = 89.59539726;
            this.m_cu8 = -35.12454591;
            this.m_cu9 = 8.338655623;
            this.m_cuA = -0.910251753;
            this.m_vowel = MFormant.VOWEL_A;
            this.m_power = false;
            this.reset();
        }
        MFormant.prototype.setVowel = function (vowel) {
            this.m_power = true;
            this.m_vowel = vowel;
        };
        MFormant.prototype.disable = function () {
            this.m_power = false;
            this.reset();
        };
        MFormant.prototype.reset = function () {
            this.m_m0 = this.m_m1 = this.m_m2 = this.m_m3 = this.m_m4 = this.m_m5 = this.m_m6 = this.m_m7 = this.m_m8 = this.m_m9 = 0;
        };
        MFormant.prototype.checkToSilence = function () {
            return this.m_power && (-0.000001 <= this.m_m0 && this.m_m0 <= 0.000001 &&
                -0.000001 <= this.m_m1 && this.m_m1 <= 0.000001 &&
                -0.000001 <= this.m_m2 && this.m_m2 <= 0.000001 &&
                -0.000001 <= this.m_m3 && this.m_m3 <= 0.000001 &&
                -0.000001 <= this.m_m4 && this.m_m4 <= 0.000001 &&
                -0.000001 <= this.m_m5 && this.m_m5 <= 0.000001 &&
                -0.000001 <= this.m_m6 && this.m_m6 <= 0.000001 &&
                -0.000001 <= this.m_m7 && this.m_m7 <= 0.000001 &&
                -0.000001 <= this.m_m8 && this.m_m8 <= 0.000001 &&
                -0.000001 <= this.m_m9 && this.m_m9 <= 0.000001);
        };
        MFormant.prototype.run = function (samples, start, end) {
            if (!this.m_power)
                return;
            var i;
            switch (this.m_vowel) {
                case 0:
                    for (i = start; i < end; i++) {
                        samples[i] = this.m_ca0 * samples[i] +
                            this.m_ca1 * this.m_m0 + this.m_ca2 * this.m_m1 +
                            this.m_ca3 * this.m_m2 + this.m_ca4 * this.m_m3 +
                            this.m_ca5 * this.m_m4 + this.m_ca6 * this.m_m5 +
                            this.m_ca7 * this.m_m6 + this.m_ca8 * this.m_m7 +
                            this.m_ca9 * this.m_m8 + this.m_caA * this.m_m9;
                        this.m_m9 = this.m_m8;
                        this.m_m8 = this.m_m7;
                        this.m_m7 = this.m_m6;
                        this.m_m6 = this.m_m5;
                        this.m_m5 = this.m_m4;
                        this.m_m4 = this.m_m3;
                        this.m_m3 = this.m_m2;
                        this.m_m2 = this.m_m1;
                        this.m_m1 = this.m_m0;
                        this.m_m0 = samples[i];
                    }
                    return;
                case 1:
                    for (i = start; i < end; i++) {
                        samples[i] = this.m_ce0 * samples[i] +
                            this.m_ce1 * this.m_m0 + this.m_ce2 * this.m_m1 +
                            this.m_ce3 * this.m_m2 + this.m_ce4 * this.m_m3 +
                            this.m_ce5 * this.m_m4 + this.m_ce6 * this.m_m5 +
                            this.m_ce7 * this.m_m6 + this.m_ce8 * this.m_m7 +
                            this.m_ce9 * this.m_m8 + this.m_ceA * this.m_m9;
                        this.m_m9 = this.m_m8;
                        this.m_m8 = this.m_m7;
                        this.m_m7 = this.m_m6;
                        this.m_m6 = this.m_m5;
                        this.m_m5 = this.m_m4;
                        this.m_m4 = this.m_m3;
                        this.m_m3 = this.m_m2;
                        this.m_m2 = this.m_m1;
                        this.m_m1 = this.m_m0;
                        this.m_m0 = samples[i];
                    }
                    return;
                case 2:
                    for (i = start; i < end; i++) {
                        samples[i] = this.m_ci0 * samples[i] +
                            this.m_ci1 * this.m_m0 + this.m_ci2 * this.m_m1 +
                            this.m_ci3 * this.m_m2 + this.m_ci4 * this.m_m3 +
                            this.m_ci5 * this.m_m4 + this.m_ci6 * this.m_m5 +
                            this.m_ci7 * this.m_m6 + this.m_ci8 * this.m_m7 +
                            this.m_ci9 * this.m_m8 + this.m_ciA * this.m_m9;
                        this.m_m9 = this.m_m8;
                        this.m_m8 = this.m_m7;
                        this.m_m7 = this.m_m6;
                        this.m_m6 = this.m_m5;
                        this.m_m5 = this.m_m4;
                        this.m_m4 = this.m_m3;
                        this.m_m3 = this.m_m2;
                        this.m_m2 = this.m_m1;
                        this.m_m1 = this.m_m0;
                        this.m_m0 = samples[i];
                    }
                    return;
                case 3:
                    for (i = start; i < end; i++) {
                        samples[i] = this.m_co0 * samples[i] +
                            this.m_co1 * this.m_m0 + this.m_co2 * this.m_m1 +
                            this.m_co3 * this.m_m2 + this.m_co4 * this.m_m3 +
                            this.m_co5 * this.m_m4 + this.m_co6 * this.m_m5 +
                            this.m_co7 * this.m_m6 + this.m_co8 * this.m_m7 +
                            this.m_co9 * this.m_m8 + this.m_coA * this.m_m9;
                        this.m_m9 = this.m_m8;
                        this.m_m8 = this.m_m7;
                        this.m_m7 = this.m_m6;
                        this.m_m6 = this.m_m5;
                        this.m_m5 = this.m_m4;
                        this.m_m4 = this.m_m3;
                        this.m_m3 = this.m_m2;
                        this.m_m2 = this.m_m1;
                        this.m_m1 = this.m_m0;
                        this.m_m0 = samples[i];
                    }
                    return;
                case 4:
                    for (i = start; i < end; i++) {
                        samples[i] = this.m_cu0 * samples[i] +
                            this.m_cu1 * this.m_m0 + this.m_cu2 * this.m_m1 +
                            this.m_cu3 * this.m_m2 + this.m_cu4 * this.m_m3 +
                            this.m_cu5 * this.m_m4 + this.m_cu6 * this.m_m5 +
                            this.m_cu7 * this.m_m6 + this.m_cu8 * this.m_m7 +
                            this.m_cu9 * this.m_m8 + this.m_cuA * this.m_m9;
                        this.m_m9 = this.m_m8;
                        this.m_m8 = this.m_m7;
                        this.m_m7 = this.m_m6;
                        this.m_m6 = this.m_m5;
                        this.m_m5 = this.m_m4;
                        this.m_m4 = this.m_m3;
                        this.m_m3 = this.m_m2;
                        this.m_m2 = this.m_m1;
                        this.m_m1 = this.m_m0;
                        this.m_m0 = samples[i];
                    }
                    return;
            }
        };
        MFormant.VOWEL_A = 0;
        MFormant.VOWEL_E = 1;
        MFormant.VOWEL_I = 2;
        MFormant.VOWEL_O = 3;
        MFormant.VOWEL_U = 4;
        return MFormant;
    })();
    flmml.MFormant = MFormant;
})(flmml || (flmml = {}));


var flmml;
(function (flmml) {
    var MSequencer = (function () {
        function MSequencer(offlineFormat, bufferMultiple) {
            this.m_offlineFormat = offlineFormat;
            this.MULTIPLE = offlineFormat ? 1 : bufferMultiple || MSequencer.DEFAULT_MULTIPLE;
            this.SAMPLE_RATE = msgr.SAMPLE_RATE;
            this.BUFFER_SIZE = msgr.BUFFER_SIZE;
            msgr.emptyBuffer = this.emptyBuffer = new Float32Array(this.BUFFER_SIZE * this.MULTIPLE);
            var sLen = this.BUFFER_SIZE * this.MULTIPLE;
            flmml.MChannel.boot(sLen);
            flmml.MOscillator.boot();
            flmml.MEnvelope.boot();
            this.m_trackArr = new Array();
            this.m_playSide = 1;
            this.m_playSize = 0;
            this.m_step = 0;
            this.m_buffer = [
                [new Float32Array(sLen), new Float32Array(sLen)],
                [new Float32Array(sLen), new Float32Array(sLen)]
            ];
            this.m_maxProcTime = this.BUFFER_SIZE / this.SAMPLE_RATE * 1000.0 * 0.8;
            this.processAllBinded = this.processAll.bind(this);
            msgr.onrequestbuffer = this.onSampleData.bind(this);
            this.stop();
        }
        MSequencer.getTimer = function () {
            return self.performance ? self.performance.now() : new Date().getTime();
        };
        MSequencer.prototype.play = function () {
            console.log('[#W:4-3-1] MSequencer#play called');
            if (this.m_status === 1) {
                console.log('[#W:4-3-2] STATUS_PAUSE calling Messenger#playSound (will send COM_PLAYSOUND to MAIN THREAD)');
                var bufMSec = this.BUFFER_SIZE / this.SAMPLE_RATE * 1000.0;
                this.m_status = 3;
                msgr.playSound();
                this.startProcTimer();
            }
            else {
                console.log('[#W:4-3-2] not STATUS_PAUSE calling MSequencer#processStart');
                this.m_globalSample = 0;
                this.m_totalMSec = this.getTotalMSec();
                for (var i = 0; i < this.m_trackArr.length; i++) {
                    this.m_trackArr[i].seekTop();
                }
                this.m_status = 2;
                this.processStart();
            }
            this.m_lastTime = 0;
            this.m_waitPause = false;
            if (msgr.infoInterval > 0) {
                clearInterval(msgr.tIDInfo);
                msgr.tIDInfo = setInterval(msgr.onInfoTimerBinded, msgr.infoInterval);
            }
        };
        MSequencer.prototype.stop = function () {
            clearTimeout(this.m_procTimer);
            msgr.stopSound(true);
            this.m_status = 0;
            this.m_lastTime = 0;
            this.m_maxNowMSec = 0;
            this.m_waitPause = false;
        };
        MSequencer.prototype.pause = function () {
            switch (this.m_status) {
                case 2:
                    this.m_waitPause = true;
                    break;
                case 3:
                    msgr.stopSound();
                    this.m_status = 1;
                    if (this.m_waitPause) {
                        msgr.syncInfo();
                        this.m_waitPause = false;
                    }
            }
        };
        MSequencer.prototype.disconnectAll = function () {
            while (this.m_trackArr.pop()) { }
            this.m_status = 0;
        };
        MSequencer.prototype.connect = function (track) {
            this.m_trackArr.push(track);
        };
        MSequencer.prototype.reqBuffering = function () {
            if (!this.m_buffTimer) {
                this.m_buffTimer = setTimeout(this.onBufferingReq.bind(this), 0);
            }
        };
        MSequencer.prototype.onBufferingReq = function () {
            this.m_status = 2;
            this.startProcTimer();
            this.m_buffTimer = 0;
        };
        MSequencer.prototype.startProcTimer = function (interval) {
            if (interval === void 0) { interval = 0; }
            clearTimeout(this.m_procTimer);
            if (this.m_status === 0)
                return;
            this.m_procTimer = setTimeout(this.processAllBinded, interval);
        };
        MSequencer.prototype.processStart = function () {
            this.m_step = 1;
            this.startProcTimer();
        };
        MSequencer.prototype.processAll = function () {
            var buffer = this.m_buffer[1 - this.m_playSide], bufSize = this.BUFFER_SIZE, sLen = bufSize * this.MULTIPLE, bLen = bufSize * 2, nLen = this.m_trackArr.length, msgr_ = msgr;
            switch (this.m_step) {
                case 1:
                    buffer = this.m_buffer[1 - this.m_playSide];
                    buffer[0].set(this.emptyBuffer);
                    buffer[1].set(this.emptyBuffer);
                    if (nLen > 0) {
                        var track = this.m_trackArr[flmml.MTrack.TEMPO_TRACK];
                        track.onSampleData(null, 0, bufSize * this.MULTIPLE, true);
                    }
                    this.m_processTrack = flmml.MTrack.FIRST_TRACK;
                    this.m_processOffset = 0;
                    this.m_step++;
                    this.startProcTimer();
                    break;
                case 2:
                    var status = this.m_status, endTime = this.m_lastTime ? this.m_maxProcTime + this.m_lastTime : 0.0, infoInterval = msgr_.infoInterval, infoTime = msgr_.lastInfoTime + infoInterval;
                    do {
                        this.m_trackArr[this.m_processTrack].onSampleData(buffer, this.m_processOffset, this.m_processOffset + bLen);
                        this.m_processOffset += bLen;
                        if (this.m_processOffset >= sLen) {
                            this.m_processTrack++;
                            this.m_processOffset = 0;
                        }
                        if (status === 2) {
                            msgr_.buffering((this.m_processTrack * sLen + this.m_processOffset) / (nLen * sLen) * 100.0 | 0);
                        }
                        if (this.m_processTrack >= nLen) {
                            this.m_step++;
                            break;
                        }
                        if (infoInterval > 0 && MSequencer.getTimer() > infoTime) {
                            msgr_.syncInfo();
                            infoTime = msgr_.lastInfoTime + infoInterval;
                        }
                    } while (status < 3 || MSequencer.getTimer() < endTime);
                    if (infoInterval > 0) {
                        msgr_.syncInfo();
                        clearInterval(msgr_.tIDInfo);
                        msgr_.tIDInfo = setInterval(msgr_.onInfoTimerBinded, msgr_.infoInterval);
                    }
                    this.startProcTimer();
                    break;
                case 3:
                    this.m_step = 4;
                    if (this.m_status === 2) {
                        this.m_status = 3;
                        this.m_playSide = 1 - this.m_playSide;
                        this.m_playSize = 0;
                        if (this.m_waitPause) {
                            this.pause();
                            this.m_step = 1;
                        }
                        else {
                            if (this.m_offlineFormat) {
                                msgr_.sendWav(buffer, this.m_offlineFormat);
                            }
                            else {
                                msgr_.playSound();
                                this.processStart();
                            }
                        }
                    }
                    break;
            }
        };
        MSequencer.prototype.onSampleData = function (e) {
            this.m_lastTime = MSequencer.getTimer();
            if (this.m_status < 3)
                return;
            if (this.m_globalSample / this.SAMPLE_RATE * 1000.0 >= this.m_totalMSec) {
                this.stop();
                msgr.complete();
                return;
            }
            if (this.m_playSize >= this.MULTIPLE) {
                if (this.m_step === 4) {
                    this.m_playSide = 1 - this.m_playSide;
                    this.m_playSize = 0;
                    this.processStart();
                }
                else {
                    this.reqBuffering();
                    return;
                }
                if (this.m_status === 4) {
                    return;
                }
                else if (this.m_status === 3) {
                    if (this.m_trackArr[flmml.MTrack.TEMPO_TRACK].isEnd()) {
                        this.m_status = 4;
                    }
                }
            }
            var bufSize = this.BUFFER_SIZE;
            var sendBuf = e.retBuf || [new Float32Array(bufSize), new Float32Array(bufSize)];
            var base = bufSize * this.m_playSize;
            sendBuf[0].set(this.m_buffer[this.m_playSide][0].subarray(base, base + bufSize));
            sendBuf[1].set(this.m_buffer[this.m_playSide][1].subarray(base, base + bufSize));
            msgr.sendBuffer(sendBuf);
            this.m_playSize++;
            this.m_globalSample += bufSize;
        };
        MSequencer.prototype.createPipes = function (num) {
            flmml.MChannel.createPipes(num);
        };
        MSequencer.prototype.createSyncSources = function (num) {
            flmml.MChannel.createSyncSources(num);
        };
        MSequencer.prototype.isPlaying = function () {
            return (this.m_status > 1);
        };
        MSequencer.prototype.isPaused = function () {
            return (this.m_status === 1);
        };
        MSequencer.prototype.getTotalMSec = function () {
            if (this.m_trackArr[flmml.MTrack.TEMPO_TRACK]) {
                return this.m_trackArr[flmml.MTrack.TEMPO_TRACK].getTotalMSec();
            }
            else {
                return 0.0;
            }
        };
        MSequencer.prototype.getNowMSec = function () {
            if (this.m_status === 0) {
                return 0.0;
            }
            else {
                var globalMSec = this.m_globalSample / this.SAMPLE_RATE * 1000.0, elapsed = this.m_lastTime ? MSequencer.getTimer() - this.m_lastTime : 0.0, bufMSec = this.BUFFER_SIZE / this.SAMPLE_RATE * 1000.0;
                this.m_maxNowMSec = Math.max(this.m_maxNowMSec, globalMSec + Math.min(elapsed, bufMSec));
                return this.m_maxNowMSec;
            }
        };
        MSequencer.prototype.getNowTimeStr = function () {
            var sec = this.getNowMSec() / 1000.0;
            var smin = "0" + (sec / 60 | 0);
            var ssec = "0" + (sec % 60 | 0);
            return smin.substr(smin.length - 2, 2) + ":" + ssec.substr(ssec.length - 2, 2);
        };
        MSequencer.DEFAULT_MULTIPLE = 32;
        return MSequencer;
    })();
    flmml.MSequencer = MSequencer;
})(flmml || (flmml = {}));


var flmml;
(function (flmml) {
    var MOscMod = (function () {
        function MOscMod() {
            this.resetPhase();
            this.setFrequency(440.0);
            if (!MOscMod.SAMPLE_RATE)
                MOscMod.SAMPLE_RATE = msgr.SAMPLE_RATE;
        }
        MOscMod.prototype.resetPhase = function () {
            this.m_phase = 0;
        };
        MOscMod.prototype.addPhase = function (time) {
            this.m_phase = (this.m_phase + this.m_freqShift * time) & MOscMod.PHASE_MSK;
        };
        MOscMod.prototype.getNextSample = function () {
            return 0;
        };
        MOscMod.prototype.getNextSampleOfs = function (ofs) {
            return 0;
        };
        MOscMod.prototype.getSamples = function (samples, start, end) {
        };
        MOscMod.prototype.getSamplesWithSyncIn = function (samples, syncin, start, end) {
            this.getSamples(samples, start, end);
        };
        MOscMod.prototype.getSamplesWithSyncOut = function (samples, syncout, start, end) {
            this.getSamples(samples, start, end);
        };
        MOscMod.prototype.getFrequency = function () {
            return this.m_frequency;
        };
        MOscMod.prototype.setFrequency = function (frequency) {
            this.m_frequency = frequency;
            this.m_freqShift = frequency * (MOscMod.PHASE_LEN / MOscMod.SAMPLE_RATE) | 0;
        };
        MOscMod.prototype.setWaveNo = function (waveNo) {
        };
        MOscMod.prototype.setNoteNo = function (noteNo) {
        };
        MOscMod.TABLE_LEN = 1 << 16;
        MOscMod.PHASE_SFT = 14;
        MOscMod.PHASE_LEN = MOscMod.TABLE_LEN << MOscMod.PHASE_SFT;
        MOscMod.PHASE_HLF = MOscMod.TABLE_LEN << (MOscMod.PHASE_SFT - 1);
        MOscMod.PHASE_MSK = MOscMod.PHASE_LEN - 1;
        return MOscMod;
    })();
    flmml.MOscMod = MOscMod;
})(flmml || (flmml = {}));


var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var flmml;
(function (flmml) {
    var MOscFcDpcm = (function (_super) {
        __extends(MOscFcDpcm, _super);
        function MOscFcDpcm() {
            MOscFcDpcm.boot();
            this.m_readCount = 0;
            this.m_address = 0;
            this.m_bit = 0;
            this.m_wav = 0;
            this.m_length = 0;
            this.m_ofs = 0;
            _super.call(this);
            this.setWaveNo(0);
        }
        MOscFcDpcm.boot = function () {
            if (this.s_init)
                return;
            this.FC_DPCM_NEXT = msgr.SAMPLE_RATE << this.FC_DPCM_PHASE_SFT;
            this.s_table = new Array(this.MAX_WAVE);
            this.s_intVol = new Array(this.MAX_WAVE);
            this.s_loopFg = new Array(this.MAX_WAVE);
            this.s_length = new Array(this.MAX_WAVE);
            this.setWave(0, 127, 0, "");
            this.s_init = 1;
        };
        MOscFcDpcm.setWave = function (waveNo, intVol, loopFg, wave) {
            this.s_intVol[waveNo] = intVol;
            this.s_loopFg[waveNo] = loopFg;
            this.s_length[waveNo] = 0;
            this.s_table[waveNo] = new Array(this.FC_DPCM_TABLE_MAX_LEN);
            var strCnt = 0;
            var intCnt = 0;
            var intCn2 = 0;
            var intPos = 0;
            for (var i = 0; i < this.FC_DPCM_TABLE_MAX_LEN; i++) {
                this.s_table[waveNo][i] = 0;
            }
            for (strCnt = 0; strCnt < wave.length; strCnt++) {
                var code = wave.charCodeAt(strCnt);
                if (0x41 <= code && code <= 0x5a) {
                    code -= 0x41;
                }
                else if (0x61 <= code && code <= 0x7a) {
                    code -= 0x61 - 26;
                }
                else if (0x30 <= code && code <= 0x39) {
                    code -= 0x30 - 26 - 26;
                }
                else if (0x2b === code) {
                    code = 26 + 26 + 10;
                }
                else if (0x2f === code) {
                    code = 26 + 26 + 10 + 1;
                }
                else if (0x3d === code) {
                    code = 0;
                }
                else {
                    code = 0;
                }
                for (i = 5; i >= 0; i--) {
                    this.s_table[waveNo][intPos] += ((code >> i) & 1) << (intCnt * 8 + 7 - intCn2);
                    intCn2++;
                    if (intCn2 >= 8) {
                        intCn2 = 0;
                        intCnt++;
                    }
                    this.s_length[waveNo]++;
                    if (intCnt >= 4) {
                        intCnt = 0;
                        intPos++;
                        if (intPos >= this.FC_DPCM_TABLE_MAX_LEN) {
                            intPos = this.FC_DPCM_TABLE_MAX_LEN - 1;
                        }
                    }
                }
            }
            this.s_length[waveNo] -= ((this.s_length[waveNo] - 8) % 0x80);
            if (this.s_length[waveNo] > this.FC_DPCM_MAX_LEN * 8) {
                this.s_length[waveNo] = this.FC_DPCM_MAX_LEN * 8;
            }
            if (this.s_length[waveNo] === 0) {
                this.s_length[waveNo] = 8;
            }
        };
        MOscFcDpcm.prototype.setWaveNo = function (waveNo) {
            if (waveNo >= MOscFcDpcm.MAX_WAVE)
                waveNo = MOscFcDpcm.MAX_WAVE - 1;
            if (!MOscFcDpcm.s_table[waveNo])
                waveNo = 0;
            this.m_waveNo = waveNo;
        };
        MOscFcDpcm.prototype.getValue = function () {
            if (this.m_length > 0) {
                if ((MOscFcDpcm.s_table[this.m_waveNo][this.m_address] >> this.m_bit) & 1) {
                    if (this.m_wav < 126)
                        this.m_wav += 2;
                }
                else {
                    if (this.m_wav > 1)
                        this.m_wav -= 2;
                }
                this.m_bit++;
                if (this.m_bit >= 32) {
                    this.m_bit = 0;
                    this.m_address++;
                }
                this.m_length--;
                if (this.m_length === 0) {
                    if (MOscFcDpcm.s_loopFg[this.m_waveNo]) {
                        this.m_address = 0;
                        this.m_bit = 0;
                        this.m_length = MOscFcDpcm.s_length[this.m_waveNo];
                    }
                }
                return (this.m_wav - 64) / 64.0;
            }
            else {
                return (this.m_wav - 64) / 64.0;
            }
        };
        MOscFcDpcm.prototype.resetPhase = function () {
            this.m_phase = 0;
            this.m_address = 0;
            this.m_bit = 0;
            this.m_ofs = 0;
            this.m_wav = MOscFcDpcm.s_intVol[this.m_waveNo];
            this.m_length = MOscFcDpcm.s_length[this.m_waveNo];
        };
        MOscFcDpcm.prototype.getNextSample = function () {
            var val = (this.m_wav - 64) / 64.0;
            this.m_phase = (this.m_phase + this.m_freqShift) & MOscFcDpcm.PHASE_MSK;
            while (MOscFcDpcm.FC_DPCM_NEXT <= this.m_phase) {
                this.m_phase -= MOscFcDpcm.FC_DPCM_NEXT;
                {
                    if (this.m_length > 0) {
                        if ((MOscFcDpcm.s_table[this.m_waveNo][this.m_address] >> this.m_bit) & 1) {
                            if (this.m_wav < 126)
                                this.m_wav += 2;
                        }
                        else {
                            if (this.m_wav > 1)
                                this.m_wav -= 2;
                        }
                        this.m_bit++;
                        if (this.m_bit >= 32) {
                            this.m_bit = 0;
                            this.m_address++;
                        }
                        this.m_length--;
                        if (this.m_length === 0) {
                            if (MOscFcDpcm.s_loopFg[this.m_waveNo]) {
                                this.m_address = 0;
                                this.m_bit = 0;
                                this.m_length = MOscFcDpcm.s_length[this.m_waveNo];
                            }
                        }
                        val = (this.m_wav - 64) / 64.0;
                    }
                    else {
                        val = (this.m_wav - 64) / 64.0;
                    }
                }
            }
            return val;
        };
        MOscFcDpcm.prototype.getNextSampleOfs = function (ofs) {
            var val = (this.m_wav - 64) / 64.0;
            this.m_phase = (this.m_phase + this.m_freqShift + ((ofs - this.m_ofs) >> (MOscFcDpcm.PHASE_SFT - 7))) & MOscFcDpcm.PHASE_MSK;
            while (MOscFcDpcm.FC_DPCM_NEXT <= this.m_phase) {
                this.m_phase -= MOscFcDpcm.FC_DPCM_NEXT;
                {
                    if (this.m_length > 0) {
                        if ((MOscFcDpcm.s_table[this.m_waveNo][this.m_address] >> this.m_bit) & 1) {
                            if (this.m_wav < 126)
                                this.m_wav += 2;
                        }
                        else {
                            if (this.m_wav > 1)
                                this.m_wav -= 2;
                        }
                        this.m_bit++;
                        if (this.m_bit >= 32) {
                            this.m_bit = 0;
                            this.m_address++;
                        }
                        this.m_length--;
                        if (this.m_length === 0) {
                            if (MOscFcDpcm.s_loopFg[this.m_waveNo]) {
                                this.m_address = 0;
                                this.m_bit = 0;
                                this.m_length = MOscFcDpcm.s_length[this.m_waveNo];
                            }
                        }
                        val = (this.m_wav - 64) / 64.0;
                    }
                    else {
                        val = (this.m_wav - 64) / 64.0;
                    }
                }
            }
            this.m_ofs = ofs;
            return val;
        };
        MOscFcDpcm.prototype.getSamples = function (samples, start, end) {
            var i;
            var val = (this.m_wav - 64) / 64.0;
            for (i = start; i < end; i++) {
                this.m_phase = (this.m_phase + this.m_freqShift) & MOscFcDpcm.PHASE_MSK;
                while (MOscFcDpcm.FC_DPCM_NEXT <= this.m_phase) {
                    this.m_phase -= MOscFcDpcm.FC_DPCM_NEXT;
                    {
                        if (this.m_length > 0) {
                            if ((MOscFcDpcm.s_table[this.m_waveNo][this.m_address] >> this.m_bit) & 1) {
                                if (this.m_wav < 126)
                                    this.m_wav += 2;
                            }
                            else {
                                if (this.m_wav > 1)
                                    this.m_wav -= 2;
                            }
                            this.m_bit++;
                            if (this.m_bit >= 32) {
                                this.m_bit = 0;
                                this.m_address++;
                            }
                            this.m_length--;
                            if (this.m_length === 0) {
                                if (MOscFcDpcm.s_loopFg[this.m_waveNo]) {
                                    this.m_address = 0;
                                    this.m_bit = 0;
                                    this.m_length = MOscFcDpcm.s_length[this.m_waveNo];
                                }
                            }
                            val = (this.m_wav - 64) / 64.0;
                        }
                        else {
                            val = (this.m_wav - 64) / 64.0;
                        }
                    }
                }
                samples[i] = val;
            }
        };
        MOscFcDpcm.prototype.setFrequency = function (frequency) {
            this.m_freqShift = frequency * (1 << (MOscFcDpcm.FC_DPCM_PHASE_SFT + 4)) | 0;
        };
        MOscFcDpcm.prototype.setDpcmFreq = function (no) {
            if (no < 0)
                no = 0;
            if (no > 15)
                no = 15;
            this.m_freqShift = (MOscFcDpcm.FC_CPU_CYCLE << MOscFcDpcm.FC_DPCM_PHASE_SFT) / MOscFcDpcm.s_interval[no] | 0;
        };
        MOscFcDpcm.prototype.setNoteNo = function (noteNo) {
            this.setDpcmFreq(noteNo);
        };
        MOscFcDpcm.MAX_WAVE = 16;
        MOscFcDpcm.FC_CPU_CYCLE = 1789773;
        MOscFcDpcm.FC_DPCM_PHASE_SFT = 2;
        MOscFcDpcm.FC_DPCM_MAX_LEN = 0xff1;
        MOscFcDpcm.FC_DPCM_TABLE_MAX_LEN = (MOscFcDpcm.FC_DPCM_MAX_LEN >> 2) + 2;
        MOscFcDpcm.s_interval = [
            428, 380, 340, 320, 286, 254, 226, 214, 190, 160, 142, 128, 106, 85, 72, 54,
        ];
        return MOscFcDpcm;
    })(flmml.MOscMod);
    flmml.MOscFcDpcm = MOscFcDpcm;
})(flmml || (flmml = {}));


var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var flmml;
(function (flmml) {
    var MOscFcNoise = (function (_super) {
        __extends(MOscFcNoise, _super);
        function MOscFcNoise() {
            MOscFcNoise.boot();
            _super.call(this);
            this.setLongMode();
            this.m_fcr = 0x8000;
            this.m_val = this.getValue();
            this.setNoiseFreq(0);
        }
        MOscFcNoise.prototype.getValue = function () {
            this.m_fcr >>= 1;
            this.m_fcr |= ((this.m_fcr ^ (this.m_fcr >> this.m_snz)) & 1) << 15;
            return (this.m_fcr & 1) ? 1.0 : -1.0;
        };
        MOscFcNoise.prototype.setShortMode = function () {
            this.m_snz = 6;
        };
        MOscFcNoise.prototype.setLongMode = function () {
            this.m_snz = 1;
        };
        MOscFcNoise.prototype.resetPhase = function () {
        };
        MOscFcNoise.prototype.addPhase = function (time) {
            this.m_phase = this.m_phase + MOscFcNoise.FC_NOISE_PHASE_DLT * time | 0;
            while (this.m_phase >= this.m_freqShift) {
                this.m_phase -= this.m_freqShift;
                this.m_val = this.getValue();
            }
        };
        MOscFcNoise.boot = function () {
            MOscFcNoise.FC_NOISE_PHASE_DLT = MOscFcNoise.FC_NOISE_PHASE_SEC / msgr.SAMPLE_RATE | 0;
        };
        MOscFcNoise.prototype.getNextSample = function () {
            var val = this.m_val;
            var sum = 0;
            var cnt = 0;
            var delta = MOscFcNoise.FC_NOISE_PHASE_DLT;
            while (delta >= this.m_freqShift) {
                delta -= this.m_freqShift;
                this.m_phase = 0;
                sum += this.getValue();
                cnt += 1.0;
            }
            if (cnt > 0) {
                this.m_val = sum / cnt;
            }
            this.m_phase = this.m_phase + delta | 0;
            if (this.m_phase >= this.m_freqShift) {
                this.m_phase -= this.m_freqShift;
                this.m_val = this.getValue();
            }
            return val;
        };
        MOscFcNoise.prototype.getNextSampleOfs = function (ofs) {
            var fcr = this.m_fcr;
            var phase = this.m_phase;
            var val = this.m_val;
            var sum = 0;
            var cnt = 0;
            var delta = MOscFcNoise.FC_NOISE_PHASE_DLT + ofs;
            while (delta >= this.m_freqShift) {
                delta -= this.m_freqShift;
                this.m_phase = 0;
                sum += this.getValue();
                cnt += 1.0;
            }
            if (cnt > 0) {
                this.m_val = sum / cnt;
            }
            this.m_phase = this.m_phase + delta | 0;
            if (this.m_phase >= this.m_freqShift) {
                this.m_phase = this.m_freqShift;
                this.m_val = this.getValue();
            }
            this.m_fcr = fcr;
            this.m_phase = phase;
            this.getNextSample();
            return val;
        };
        MOscFcNoise.prototype.getSamples = function (samples, start, end) {
            for (var i = start; i < end; i++) {
                samples[i] = this.getNextSample();
            }
        };
        MOscFcNoise.prototype.setFrequency = function (frequency) {
            this.m_freqShift = MOscFcNoise.FC_NOISE_PHASE_SEC / frequency | 0;
        };
        MOscFcNoise.prototype.setNoiseFreq = function (no) {
            if (no < 0)
                no = 0;
            if (no > 15)
                no = 15;
            this.m_freqShift = MOscFcNoise.s_interval[no] << MOscFcNoise.FC_NOISE_PHASE_SFT | 0;
        };
        MOscFcNoise.prototype.setNoteNo = function (noteNo) {
            this.setNoiseFreq(noteNo);
        };
        MOscFcNoise.FC_NOISE_PHASE_SFT = 10;
        MOscFcNoise.FC_NOISE_PHASE_SEC = (1789773 << MOscFcNoise.FC_NOISE_PHASE_SFT) | 0;
        MOscFcNoise.s_interval = [
            0x004, 0x008, 0x010, 0x020, 0x040, 0x060, 0x080, 0x0a0, 0x0ca, 0x0fe, 0x17c, 0x1fc, 0x2fa, 0x3f8, 0x7f2, 0xfe4
        ];
        return MOscFcNoise;
    })(flmml.MOscMod);
    flmml.MOscFcNoise = MOscFcNoise;
})(flmml || (flmml = {}));


var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var flmml;
(function (flmml) {
    var MOscFcTri = (function (_super) {
        __extends(MOscFcTri, _super);
        function MOscFcTri() {
            MOscFcTri.boot();
            _super.call(this);
            this.setWaveNo(0);
        }
        MOscFcTri.boot = function () {
            if (this.s_init)
                return;
            this.s_table = new Array(this.MAX_WAVE);
            this.s_table[0] = new Array(this.FC_TRI_TABLE_LEN);
            this.s_table[1] = new Array(this.FC_TRI_TABLE_LEN);
            var i;
            for (i = 0; i < 16; i++) {
                this.s_table[0][i] = this.s_table[0][31 - i] = i * 2.0 / 15.0 - 1.0;
            }
            for (i = 0; i < 32; i++) {
                this.s_table[1][i] = (i < 8) ? i * 2.0 / 14.0 : ((i < 24) ? (8 - i) * 2.0 / 15.0 + 1.0 : (i - 24) * 2.0 / 15.0 - 1.0);
            }
            this.s_init = 1;
        };
        MOscFcTri.prototype.getNextSample = function () {
            var val = MOscFcTri.s_table[this.m_waveNo][this.m_phase >> (MOscFcTri.PHASE_SFT + 11)];
            this.m_phase = (this.m_phase + this.m_freqShift) & MOscFcTri.PHASE_MSK;
            return val;
        };
        MOscFcTri.prototype.getNextSampleOfs = function (ofs) {
            var val = MOscFcTri.s_table[this.m_waveNo][((this.m_phase + ofs) & MOscFcTri.PHASE_MSK) >> (MOscFcTri.PHASE_SFT + 11)];
            this.m_phase = (this.m_phase + this.m_freqShift) & MOscFcTri.PHASE_MSK;
            return val;
        };
        MOscFcTri.prototype.getSamples = function (samples, start, end) {
            var i;
            for (i = start; i < end; i++) {
                samples[i] = MOscFcTri.s_table[this.m_waveNo][this.m_phase >> (MOscFcTri.PHASE_SFT + 11)];
                this.m_phase = (this.m_phase + this.m_freqShift) & MOscFcTri.PHASE_MSK;
            }
        };
        MOscFcTri.prototype.getSamplesWithSyncIn = function (samples, syncin, start, end) {
            var i;
            for (i = start; i < end; i++) {
                if (syncin[i]) {
                    this.resetPhase();
                }
                samples[i] = MOscFcTri.s_table[this.m_waveNo][this.m_phase >> (MOscFcTri.PHASE_SFT + 11)];
                this.m_phase = (this.m_phase + this.m_freqShift) & MOscFcTri.PHASE_MSK;
            }
        };
        MOscFcTri.prototype.getSamplesWithSyncOut = function (samples, syncout, start, end) {
            var i;
            for (i = start; i < end; i++) {
                samples[i] = MOscFcTri.s_table[this.m_waveNo][this.m_phase >> (MOscFcTri.PHASE_SFT + 11)];
                this.m_phase += this.m_freqShift;
                syncout[i] = (this.m_phase > MOscFcTri.PHASE_MSK);
                this.m_phase &= MOscFcTri.PHASE_MSK;
            }
        };
        MOscFcTri.prototype.setWaveNo = function (waveNo) {
            this.m_waveNo = Math.min(waveNo, MOscFcTri.MAX_WAVE - 1);
        };
        MOscFcTri.FC_TRI_TABLE_LEN = (1 << 5);
        MOscFcTri.MAX_WAVE = 2;
        MOscFcTri.s_init = 0;
        return MOscFcTri;
    })(flmml.MOscMod);
    flmml.MOscFcTri = MOscFcTri;
})(flmml || (flmml = {}));


var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var flmml;
(function (flmml) {
    var MOscGbLNoise = (function (_super) {
        __extends(MOscGbLNoise, _super);
        function MOscGbLNoise() {
            MOscGbLNoise.boot();
            _super.call(this);
            this.m_sum = 0;
            this.m_skip = 0;
        }
        MOscGbLNoise.boot = function () {
            if (this.s_init)
                return;
            var gbr = 0xffff;
            var output = 1;
            for (var i = 0; i < this.GB_NOISE_TABLE_LEN; i++) {
                if (gbr === 0)
                    gbr = 1;
                gbr += gbr + (((gbr >> 14) ^ (gbr >> 13)) & 1) | 0;
                output ^= gbr & 1;
                this.s_table[i] = output * 2 - 1;
            }
            this.s_init = 1;
        };
        MOscGbLNoise.prototype.getNextSample = function () {
            var val = MOscGbLNoise.s_table[this.m_phase >> MOscGbLNoise.GB_NOISE_PHASE_SFT];
            if (this.m_skip > 0) {
                val = (val + this.m_sum) / (this.m_skip + 1);
            }
            this.m_sum = 0;
            this.m_skip = 0;
            var freqShift = this.m_freqShift;
            while (freqShift > MOscGbLNoise.GB_NOISE_PHASE_DLT) {
                this.m_phase = (this.m_phase + MOscGbLNoise.GB_NOISE_PHASE_DLT) % MOscGbLNoise.GB_NOISE_TABLE_MOD;
                freqShift -= MOscGbLNoise.GB_NOISE_PHASE_DLT;
                this.m_sum += MOscGbLNoise.s_table[this.m_phase >> MOscGbLNoise.GB_NOISE_PHASE_SFT];
                this.m_skip++;
            }
            this.m_phase = (this.m_phase + freqShift) % MOscGbLNoise.GB_NOISE_TABLE_MOD;
            return val;
        };
        MOscGbLNoise.prototype.getNextSampleOfs = function (ofs) {
            var phase = (this.m_phase + ofs) % MOscGbLNoise.GB_NOISE_TABLE_MOD;
            var val = MOscGbLNoise.s_table[(phase + ((phase >> 31) & MOscGbLNoise.GB_NOISE_TABLE_MOD)) >> MOscGbLNoise.GB_NOISE_PHASE_SFT];
            this.m_phase = (this.m_phase + this.m_freqShift) % MOscGbLNoise.GB_NOISE_TABLE_MOD;
            return val;
        };
        MOscGbLNoise.prototype.getSamples = function (samples, start, end) {
            var i;
            var val;
            for (i = start; i < end; i++) {
                val = MOscGbLNoise.s_table[this.m_phase >> MOscGbLNoise.GB_NOISE_PHASE_SFT];
                if (this.m_skip > 0) {
                    val = (val + this.m_sum) / (this.m_skip + 1);
                }
                samples[i] = val;
                this.m_sum = 0;
                this.m_skip = 0;
                var freqShift = this.m_freqShift;
                while (freqShift > MOscGbLNoise.GB_NOISE_PHASE_DLT) {
                    this.m_phase = (this.m_phase + MOscGbLNoise.GB_NOISE_PHASE_DLT) % MOscGbLNoise.GB_NOISE_TABLE_MOD;
                    freqShift -= MOscGbLNoise.GB_NOISE_PHASE_DLT;
                    this.m_sum += MOscGbLNoise.s_table[this.m_phase >> MOscGbLNoise.GB_NOISE_PHASE_SFT];
                    this.m_skip++;
                }
                this.m_phase = (this.m_phase + freqShift) % MOscGbLNoise.GB_NOISE_TABLE_MOD;
            }
        };
        MOscGbLNoise.prototype.setFrequency = function (frequency) {
            this.m_frequency = frequency;
        };
        MOscGbLNoise.prototype.setNoiseFreq = function (no) {
            if (no < 0)
                no = 0;
            if (no > 63)
                no = 63;
            this.m_freqShift = (1048576 << (MOscGbLNoise.GB_NOISE_PHASE_SFT - 2)) / (MOscGbLNoise.s_interval[no] * 11025) | 0;
        };
        MOscGbLNoise.prototype.setNoteNo = function (noteNo) {
            this.setNoiseFreq(noteNo);
        };
        MOscGbLNoise.GB_NOISE_PHASE_SFT = 12;
        MOscGbLNoise.GB_NOISE_PHASE_DLT = 1 << MOscGbLNoise.GB_NOISE_PHASE_SFT;
        MOscGbLNoise.GB_NOISE_TABLE_LEN = 32767;
        MOscGbLNoise.GB_NOISE_TABLE_MOD = (MOscGbLNoise.GB_NOISE_TABLE_LEN << MOscGbLNoise.GB_NOISE_PHASE_SFT) - 1;
        MOscGbLNoise.s_init = 0;
        MOscGbLNoise.s_table = new Array(MOscGbLNoise.GB_NOISE_TABLE_LEN);
        MOscGbLNoise.s_interval = [
            0x000002, 0x000004, 0x000008, 0x00000c, 0x000010, 0x000014, 0x000018, 0x00001c,
            0x000020, 0x000028, 0x000030, 0x000038, 0x000040, 0x000050, 0x000060, 0x000070,
            0x000080, 0x0000a0, 0x0000c0, 0x0000e0, 0x000100, 0x000140, 0x000180, 0x0001c0,
            0x000200, 0x000280, 0x000300, 0x000380, 0x000400, 0x000500, 0x000600, 0x000700,
            0x000800, 0x000a00, 0x000c00, 0x000e00, 0x001000, 0x001400, 0x001800, 0x001c00,
            0x002000, 0x002800, 0x003000, 0x003800, 0x004000, 0x005000, 0x006000, 0x007000,
            0x008000, 0x00a000, 0x00c000, 0x00e000, 0x010000, 0x014000, 0x018000, 0x01c000,
            0x020000, 0x028000, 0x030000, 0x038000, 0x040000, 0x050000, 0x060000, 0x070000
        ];
        return MOscGbLNoise;
    })(flmml.MOscMod);
    flmml.MOscGbLNoise = MOscGbLNoise;
})(flmml || (flmml = {}));


var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var flmml;
(function (flmml) {
    var MOscGbSNoise = (function (_super) {
        __extends(MOscGbSNoise, _super);
        function MOscGbSNoise() {
            MOscGbSNoise.boot();
            _super.call(this);
            this.m_sum = 0;
            this.m_skip = 0;
        }
        MOscGbSNoise.boot = function () {
            if (this.s_init)
                return;
            var gbr = 0xffff;
            var output = 1;
            for (var i = 0; i < this.GB_NOISE_TABLE_LEN; i++) {
                if (gbr === 0)
                    gbr = 1;
                gbr += gbr + (((gbr >> 6) ^ (gbr >> 5)) & 1) | 0;
                output ^= gbr & 1;
                this.s_table[i] = output * 2 - 1;
            }
            this.s_init = 1;
        };
        MOscGbSNoise.prototype.getNextSample = function () {
            var val = MOscGbSNoise.s_table[this.m_phase >> MOscGbSNoise.GB_NOISE_PHASE_SFT];
            if (this.m_skip > 0) {
                val = (val + this.m_sum) / Number(this.m_skip + 1);
            }
            this.m_sum = 0;
            this.m_skip = 0;
            var freqShift = this.m_freqShift;
            while (freqShift > MOscGbSNoise.GB_NOISE_PHASE_DLT) {
                this.m_phase = (this.m_phase + MOscGbSNoise.GB_NOISE_PHASE_DLT) % MOscGbSNoise.GB_NOISE_TABLE_MOD;
                freqShift -= MOscGbSNoise.GB_NOISE_PHASE_DLT;
                this.m_sum += MOscGbSNoise.s_table[this.m_phase >> MOscGbSNoise.GB_NOISE_PHASE_SFT];
                this.m_skip++;
            }
            this.m_phase = (this.m_phase + freqShift) % MOscGbSNoise.GB_NOISE_TABLE_MOD;
            return val;
        };
        MOscGbSNoise.prototype.getNextSampleOfs = function (ofs) {
            var phase = (this.m_phase + ofs) % MOscGbSNoise.GB_NOISE_TABLE_MOD;
            var val = MOscGbSNoise.s_table[(phase + ((phase >> 31) & MOscGbSNoise.GB_NOISE_TABLE_MOD)) >> MOscGbSNoise.GB_NOISE_PHASE_SFT];
            this.m_phase = (this.m_phase + this.m_freqShift) % MOscGbSNoise.GB_NOISE_TABLE_MOD;
            return val;
        };
        MOscGbSNoise.prototype.getSamples = function (samples, start, end) {
            var i;
            var val;
            for (i = start; i < end; i++) {
                val = MOscGbSNoise.s_table[this.m_phase >> MOscGbSNoise.GB_NOISE_PHASE_SFT];
                if (this.m_skip > 0) {
                    val = (val + this.m_sum) / Number(this.m_skip + 1);
                }
                samples[i] = val;
                this.m_sum = 0;
                this.m_skip = 0;
                var freqShift = this.m_freqShift;
                while (freqShift > MOscGbSNoise.GB_NOISE_PHASE_DLT) {
                    this.m_phase = (this.m_phase + MOscGbSNoise.GB_NOISE_PHASE_DLT) % MOscGbSNoise.GB_NOISE_TABLE_MOD;
                    freqShift -= MOscGbSNoise.GB_NOISE_PHASE_DLT;
                    this.m_sum += MOscGbSNoise.s_table[this.m_phase >> MOscGbSNoise.GB_NOISE_PHASE_SFT];
                    this.m_skip++;
                }
                this.m_phase = (this.m_phase + freqShift) % MOscGbSNoise.GB_NOISE_TABLE_MOD;
            }
        };
        MOscGbSNoise.prototype.setFrequency = function (frequency) {
            this.m_frequency = frequency;
        };
        MOscGbSNoise.prototype.setNoiseFreq = function (no) {
            if (no < 0)
                no = 0;
            if (no > 63)
                no = 63;
            this.m_freqShift = (1048576 << (MOscGbSNoise.GB_NOISE_PHASE_SFT - 2)) / (MOscGbSNoise.s_interval[no] * 11025);
        };
        MOscGbSNoise.prototype.setNoteNo = function (noteNo) {
            this.setNoiseFreq(noteNo);
        };
        MOscGbSNoise.GB_NOISE_PHASE_SFT = 12;
        MOscGbSNoise.GB_NOISE_PHASE_DLT = 1 << MOscGbSNoise.GB_NOISE_PHASE_SFT;
        MOscGbSNoise.GB_NOISE_TABLE_LEN = 127;
        MOscGbSNoise.GB_NOISE_TABLE_MOD = (MOscGbSNoise.GB_NOISE_TABLE_LEN << MOscGbSNoise.GB_NOISE_PHASE_SFT) - 1;
        MOscGbSNoise.s_init = 0;
        MOscGbSNoise.s_table = new Array(MOscGbSNoise.GB_NOISE_TABLE_LEN);
        MOscGbSNoise.s_interval = [
            0x000002, 0x000004, 0x000008, 0x00000c, 0x000010, 0x000014, 0x000018, 0x00001c,
            0x000020, 0x000028, 0x000030, 0x000038, 0x000040, 0x000050, 0x000060, 0x000070,
            0x000080, 0x0000a0, 0x0000c0, 0x0000e0, 0x000100, 0x000140, 0x000180, 0x0001c0,
            0x000200, 0x000280, 0x000300, 0x000380, 0x000400, 0x000500, 0x000600, 0x000700,
            0x000800, 0x000a00, 0x000c00, 0x000e00, 0x001000, 0x001400, 0x001800, 0x001c00,
            0x002000, 0x002800, 0x003000, 0x003800, 0x004000, 0x005000, 0x006000, 0x007000,
            0x008000, 0x00a000, 0x00c000, 0x00e000, 0x010000, 0x014000, 0x018000, 0x01c000,
            0x020000, 0x028000, 0x030000, 0x038000, 0x040000, 0x050000, 0x060000, 0x070000
        ];
        return MOscGbSNoise;
    })(flmml.MOscMod);
    flmml.MOscGbSNoise = MOscGbSNoise;
})(flmml || (flmml = {}));


var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var flmml;
(function (flmml) {
    var MOscGbWave = (function (_super) {
        __extends(MOscGbWave, _super);
        function MOscGbWave() {
            MOscGbWave.boot();
            _super.call(this);
            this.setWaveNo(0);
        }
        MOscGbWave.boot = function () {
            if (this.s_init)
                return;
            this.s_table = new Array(this.MAX_WAVE);
            this.setWave(0, "0123456789abcdeffedcba9876543210");
            this.s_init = 1;
        };
        MOscGbWave.setWave = function (waveNo, wave) {
            this.s_table[waveNo] = new Array(this.GB_WAVE_TABLE_LEN);
            for (var i = 0; i < 32; i++) {
                var code = wave.charCodeAt(i);
                if (48 <= code && code < 58) {
                    code -= 48;
                }
                else if (97 <= code && code < 103) {
                    code -= 97 - 10;
                }
                else {
                    code = 0;
                }
                this.s_table[waveNo][i] = (code - 7.5) / 7.5;
            }
        };
        MOscGbWave.prototype.setWaveNo = function (waveNo) {
            if (waveNo >= MOscGbWave.MAX_WAVE)
                waveNo = MOscGbWave.MAX_WAVE - 1;
            if (!MOscGbWave.s_table[waveNo])
                waveNo = 0;
            this.m_waveNo = waveNo;
        };
        MOscGbWave.prototype.getNextSample = function () {
            var val = MOscGbWave.s_table[this.m_waveNo][this.m_phase >> (MOscGbWave.PHASE_SFT + 11)];
            this.m_phase = (this.m_phase + this.m_freqShift) & MOscGbWave.PHASE_MSK;
            return val;
        };
        MOscGbWave.prototype.getNextSampleOfs = function (ofs) {
            var val = MOscGbWave.s_table[this.m_waveNo][((this.m_phase + ofs) & MOscGbWave.PHASE_MSK) >> (MOscGbWave.PHASE_SFT + 11)];
            this.m_phase = (this.m_phase + this.m_freqShift) & MOscGbWave.PHASE_MSK;
            return val;
        };
        MOscGbWave.prototype.getSamples = function (samples, start, end) {
            var i;
            for (i = start; i < end; i++) {
                samples[i] = MOscGbWave.s_table[this.m_waveNo][this.m_phase >> (MOscGbWave.PHASE_SFT + 11)];
                this.m_phase = (this.m_phase + this.m_freqShift) & MOscGbWave.PHASE_MSK;
            }
        };
        MOscGbWave.prototype.getSamplesWithSyncIn = function (samples, syncin, start, end) {
            var i;
            for (i = start; i < end; i++) {
                if (syncin[i]) {
                    this.resetPhase();
                }
                samples[i] = MOscGbWave.s_table[this.m_waveNo][this.m_phase >> (MOscGbWave.PHASE_SFT + 11)];
                this.m_phase = (this.m_phase + this.m_freqShift) & MOscGbWave.PHASE_MSK;
            }
        };
        MOscGbWave.prototype.getSamplesWithSyncOut = function (samples, syncout, start, end) {
            var i;
            for (i = start; i < end; i++) {
                samples[i] = MOscGbWave.s_table[this.m_waveNo][this.m_phase >> (MOscGbWave.PHASE_SFT + 11)];
                this.m_phase += this.m_freqShift;
                syncout[i] = (this.m_phase > MOscGbWave.PHASE_MSK);
                this.m_phase &= MOscGbWave.PHASE_MSK;
            }
        };
        MOscGbWave.MAX_WAVE = 32;
        MOscGbWave.GB_WAVE_TABLE_LEN = (1 << 5);
        MOscGbWave.s_init = 0;
        return MOscGbWave;
    })(flmml.MOscMod);
    flmml.MOscGbWave = MOscGbWave;
})(flmml || (flmml = {}));


var flmml;
(function (flmml) {
    var MOscillator = (function () {
        function MOscillator() {
            MOscillator.boot();
            this.m_osc = new Array(MOscillator.MAX);
            this.m_osc[MOscillator.SINE] = new flmml.MOscSine();
            this.m_osc[MOscillator.SAW] = new flmml.MOscSaw();
            this.m_osc[MOscillator.TRIANGLE] = new flmml.MOscTriangle();
            this.m_osc[MOscillator.PULSE] = new flmml.MOscPulse();
            this.m_osc[MOscillator.NOISE] = new flmml.MOscNoise();
            this.m_osc[MOscillator.FC_PULSE] = new flmml.MOscPulse();
            this.m_osc[MOscillator.FC_TRI] = new flmml.MOscFcTri();
            this.m_osc[MOscillator.FC_NOISE] = new flmml.MOscFcNoise();
            this.m_osc[MOscillator.FC_S_NOISE] = null;
            this.m_osc[MOscillator.FC_DPCM] = new flmml.MOscFcDpcm();
            this.m_osc[MOscillator.GB_WAVE] = new flmml.MOscGbWave();
            this.m_osc[MOscillator.GB_NOISE] = new flmml.MOscGbLNoise();
            this.m_osc[MOscillator.GB_S_NOISE] = new flmml.MOscGbSNoise();
            this.m_osc[MOscillator.WAVE] = new flmml.MOscWave();
            this.m_osc[MOscillator.OPM] = new flmml.MOscOPM();
            this.setForm(MOscillator.PULSE);
            this.setNoiseToPulse();
        }
        MOscillator.prototype.asLFO = function () {
            if (this.m_osc[MOscillator.NOISE])
                this.m_osc[MOscillator.NOISE].disableResetPhase();
        };
        MOscillator.boot = function () {
            if (this.s_init)
                return;
            flmml.MOscSine.boot();
            flmml.MOscSaw.boot();
            flmml.MOscTriangle.boot();
            flmml.MOscPulse.boot();
            flmml.MOscNoise.boot();
            flmml.MOscFcTri.boot();
            flmml.MOscFcNoise.boot();
            flmml.MOscFcDpcm.boot();
            flmml.MOscGbWave.boot();
            flmml.MOscGbLNoise.boot();
            flmml.MOscGbSNoise.boot();
            flmml.MOscWave.boot();
            flmml.MOscOPM.boot();
            this.s_init = 1;
        };
        MOscillator.prototype.setForm = function (form) {
            var modNoise;
            var modFcNoise;
            if (form >= MOscillator.MAX)
                form = MOscillator.MAX - 1;
            this.m_form = form;
            switch (form) {
                case MOscillator.NOISE:
                    modNoise = this.m_osc[MOscillator.NOISE];
                    modNoise.restoreFreq();
                    break;
                case MOscillator.FC_NOISE:
                    modFcNoise = this.getMod(MOscillator.FC_NOISE);
                    modFcNoise.setLongMode();
                    break;
                case MOscillator.FC_S_NOISE:
                    modFcNoise = this.getMod(MOscillator.FC_S_NOISE);
                    modFcNoise.setShortMode();
                    break;
            }
            return this.getMod(form);
        };
        MOscillator.prototype.getForm = function () {
            return this.m_form;
        };
        MOscillator.prototype.getCurrent = function () {
            return this.getMod(this.m_form);
        };
        MOscillator.prototype.getMod = function (form) {
            return (form !== MOscillator.FC_S_NOISE) ? this.m_osc[form] : this.m_osc[MOscillator.FC_NOISE];
        };
        MOscillator.prototype.setNoiseToPulse = function () {
            var modPulse = this.getMod(MOscillator.PULSE);
            var modNoise = this.getMod(MOscillator.NOISE);
            modPulse.setNoise(modNoise);
        };
        MOscillator.SINE = 0;
        MOscillator.SAW = 1;
        MOscillator.TRIANGLE = 2;
        MOscillator.PULSE = 3;
        MOscillator.NOISE = 4;
        MOscillator.FC_PULSE = 5;
        MOscillator.FC_TRI = 6;
        MOscillator.FC_NOISE = 7;
        MOscillator.FC_S_NOISE = 8;
        MOscillator.FC_DPCM = 9;
        MOscillator.GB_WAVE = 10;
        MOscillator.GB_NOISE = 11;
        MOscillator.GB_S_NOISE = 12;
        MOscillator.WAVE = 13;
        MOscillator.OPM = 14;
        MOscillator.MAX = 15;
        MOscillator.s_init = 0;
        return MOscillator;
    })();
    flmml.MOscillator = MOscillator;
})(flmml || (flmml = {}));


var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var flmml;
(function (flmml) {
    var MOscNoise = (function (_super) {
        __extends(MOscNoise, _super);
        function MOscNoise() {
            MOscNoise.boot();
            _super.call(this);
            this.setNoiseFreq(1.0);
            this.m_phase = 0;
            this.m_counter = 0;
            this.m_resetPhase = true;
        }
        MOscNoise.prototype.disableResetPhase = function () {
            this.m_resetPhase = false;
        };
        MOscNoise.boot = function () {
            if (this.s_init)
                return;
            for (var i = 0; i < this.TABLE_LEN; i++) {
                this.s_table[i] = Math.random() * 2.0 - 1.0;
            }
            this.s_init = 1;
        };
        MOscNoise.prototype.resetPhase = function () {
            if (this.m_resetPhase)
                this.m_phase = 0;
        };
        MOscNoise.prototype.addPhase = function (time) {
            this.m_counter = (this.m_counter + this.m_freqShift * time);
            this.m_phase = (this.m_phase + (this.m_counter >> MOscNoise.NOISE_PHASE_SFT)) & MOscNoise.TABLE_MSK;
            this.m_counter &= MOscNoise.NOISE_PHASE_MSK;
        };
        MOscNoise.prototype.getNextSample = function () {
            var val = MOscNoise.s_table[this.m_phase];
            this.m_counter = (this.m_counter + this.m_freqShift);
            this.m_phase = (this.m_phase + (this.m_counter >> MOscNoise.NOISE_PHASE_SFT)) & MOscNoise.TABLE_MSK;
            this.m_counter &= MOscNoise.NOISE_PHASE_MSK;
            return val;
        };
        MOscNoise.prototype.getNextSampleOfs = function (ofs) {
            var val = MOscNoise.s_table[(this.m_phase + (ofs << MOscNoise.PHASE_SFT)) & MOscNoise.TABLE_MSK];
            this.m_counter = (this.m_counter + this.m_freqShift);
            this.m_phase = (this.m_phase + (this.m_counter >> MOscNoise.NOISE_PHASE_SFT)) & MOscNoise.TABLE_MSK;
            this.m_counter &= MOscNoise.NOISE_PHASE_MSK;
            return val;
        };
        MOscNoise.prototype.getSamples = function (samples, start, end) {
            var i;
            for (i = start; i < end; i++) {
                samples[i] = MOscNoise.s_table[this.m_phase];
                this.m_counter = (this.m_counter + this.m_freqShift);
                this.m_phase = (this.m_phase + (this.m_counter >> MOscNoise.NOISE_PHASE_SFT)) & MOscNoise.TABLE_MSK;
                this.m_counter &= MOscNoise.NOISE_PHASE_MSK;
            }
        };
        MOscNoise.prototype.setFrequency = function (frequency) {
            this.m_frequency = frequency;
        };
        MOscNoise.prototype.setNoiseFreq = function (frequency) {
            this.m_noiseFreq = frequency * (1 << MOscNoise.NOISE_PHASE_SFT);
            this.m_freqShift = this.m_noiseFreq;
        };
        MOscNoise.prototype.restoreFreq = function () {
            this.m_freqShift = this.m_noiseFreq;
        };
        MOscNoise.TABLE_MSK = MOscNoise.TABLE_LEN - 1;
        MOscNoise.NOISE_PHASE_SFT = 30;
        MOscNoise.NOISE_PHASE_MSK = (1 << MOscNoise.NOISE_PHASE_SFT) - 1;
        MOscNoise.s_init = 0;
        MOscNoise.s_table = new Array(MOscNoise.TABLE_LEN);
        return MOscNoise;
    })(flmml.MOscMod);
    flmml.MOscNoise = MOscNoise;
})(flmml || (flmml = {}));


var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var flmml;
(function (flmml) {
    var OPM = fmgenAs.OPM;
    var MOscOPM = (function (_super) {
        __extends(MOscOPM, _super);
        function MOscOPM() {
            this.m_fm = new OPM();
            this.m_oneSample = new Float32Array(1);
            this.m_velocity = 127;
            this.m_al = 0;
            this.m_tl = new Array(4);
            _super.call(this);
            MOscOPM.boot();
            this.m_fm.Init(MOscOPM.OPM_CLOCK, msgr.SAMPLE_RATE);
            this.m_fm.Reset();
            this.m_fm.SetVolume(MOscOPM.s_comGain);
            this.setOpMask(15);
            this.setWaveNo(0);
        }
        MOscOPM.boot = function () {
            if (this.s_init !== 0)
                return;
            this.s_table[0] = this.defTimbre;
            this.s_init = 1;
        };
        MOscOPM.clearTimber = function () {
            for (var i = 0; i < this.s_table.length; i++) {
                if (i === 0)
                    this.s_table[i] = this.defTimbre;
                else
                    this.s_table[i] = null;
            }
        };
        MOscOPM.trim = function (str) {
            var regexHead = /^[,]*/m;
            var regexFoot = /[,]*$/m;
            return str.replace(regexHead, '').replace(regexFoot, '');
        };
        MOscOPM.setTimber = function (no, type, s) {
            if (no < 0 || this.MAX_WAVE <= no)
                return;
            s = s.replace(/[,;\s\t\r\n]+/gm, ",");
            s = this.trim(s);
            var a = s.split(",");
            var b = new Array(this.TIMB_SZ_M);
            switch (type) {
                case this.TYPE_OPM:
                    if (a.length < 2 + 11 * 4)
                        return;
                    break;
                case this.TYPE_OPN:
                    if (a.length < 2 + 10 * 4)
                        return;
                    break;
                default: return;
            }
            var i, j, l;
            switch (type) {
                case this.TYPE_OPM:
                    l = Math.min(this.TIMB_SZ_M, a.length);
                    for (i = 0; i < l; i++) {
                        b[i] = a[i] | 0;
                    }
                    for (; i < this.TIMB_SZ_M; i++) {
                        b[i] = this.zeroTimbre[i];
                    }
                    break;
                case this.TYPE_OPN:
                    for (i = 0, j = 0; i < 2; i++, j++) {
                        b[i] = a[j] | 0;
                    }
                    for (; i < 46; i++) {
                        if ((i - 2) % 11 === 9)
                            b[i] = 0;
                        else
                            b[i] = a[j++] | 0;
                    }
                    l = Math.min(this.TIMB_SZ_N, a.length);
                    for (; j < l; i++, j++) {
                        b[i] = a[j] | 0;
                    }
                    for (; i < this.TIMB_SZ_M; i++) {
                        b[i] = this.zeroTimbre[i];
                    }
                    break;
            }
            this.s_table[no] = b;
        };
        MOscOPM.prototype.loadTimbre = function (p) {
            this.SetFBAL(p[1], p[0]);
            var i, s;
            var slottable = MOscOPM.slottable;
            for (i = 2, s = 0; s < 4; s++, i += 11) {
                this.SetDT1ML(slottable[s], p[i + 8], p[i + 7]);
                this.m_tl[s] = p[i + 5];
                this.SetTL(slottable[s], p[i + 5]);
                this.SetKSAR(slottable[s], p[i + 6], p[i + 0]);
                this.SetDRAMS(slottable[s], p[i + 1], p[i + 10]);
                this.SetDT2SR(slottable[s], p[i + 9], p[i + 2]);
                this.SetSLRR(slottable[s], p[i + 4], p[i + 3]);
            }
            this.setVelocity(this.m_velocity);
            this.setOpMask(p[i + 0]);
            this.setWF(p[i + 1]);
            this.setLFRQ(p[i + 2]);
            this.setPMD(p[i + 3]);
            this.setAMD(p[i + 4]);
            this.setPMSAMS(p[i + 5], p[i + 6]);
            this.setNENFRQ(p[i + 7], p[i + 8]);
        };
        MOscOPM.setCommonGain = function (gain) {
            this.s_comGain = gain;
        };
        MOscOPM.prototype.SetFBAL = function (fb, al) {
            var pan = 3;
            this.m_al = al & 7;
            this.m_fm.SetReg(0x20, ((pan & 3) << 6) | ((fb & 7) << 3) | (al & 7));
        };
        MOscOPM.prototype.SetDT1ML = function (slot, DT1, MUL) {
            this.m_fm.SetReg((2 << 5) | ((slot & 3) << 3), ((DT1 & 7) << 4) | (MUL & 15));
        };
        MOscOPM.prototype.SetTL = function (slot, TL) {
            if (TL < 0)
                TL = 0;
            if (TL > 127)
                TL = 127;
            this.m_fm.SetReg((3 << 5) | ((slot & 3) << 3), TL & 0x7F);
        };
        MOscOPM.prototype.SetKSAR = function (slot, KS, AR) {
            this.m_fm.SetReg((4 << 5) | ((slot & 3) << 3), ((KS & 3) << 6) | (AR & 0x1f));
        };
        MOscOPM.prototype.SetDRAMS = function (slot, DR, AMS) {
            this.m_fm.SetReg((5 << 5) | ((slot & 3) << 3), ((AMS & 1) << 7) | (DR & 0x1f));
        };
        MOscOPM.prototype.SetDT2SR = function (slot, DT2, SR) {
            this.m_fm.SetReg((6 << 5) | ((slot & 3) << 3), ((DT2 & 3) << 6) | (SR & 0x1f));
        };
        MOscOPM.prototype.SetSLRR = function (slot, SL, RR) {
            this.m_fm.SetReg((7 << 5) | ((slot & 3) << 3), ((SL & 15) << 4) | (RR & 0x0f));
        };
        MOscOPM.prototype.setPMSAMS = function (PMS, AMS) {
            this.m_fm.SetReg(0x38, ((PMS & 7) << 4) | ((AMS & 3)));
        };
        MOscOPM.prototype.setPMD = function (PMD) {
            this.m_fm.SetReg(0x19, 0x80 | (PMD & 0x7f));
        };
        MOscOPM.prototype.setAMD = function (AMD) {
            this.m_fm.SetReg(0x19, 0x00 | (AMD & 0x7f));
        };
        MOscOPM.prototype.setNENFRQ = function (NE, NFQR) {
            this.m_fm.SetReg(0x0f, ((NE & 1) << 7) | (NFQR & 0x1F));
        };
        MOscOPM.prototype.setLFRQ = function (f) {
            this.m_fm.SetReg(0x18, f & 0xff);
        };
        MOscOPM.prototype.setWF = function (wf) {
            this.m_fm.SetReg(0x1b, wf & 3);
        };
        MOscOPM.prototype.noteOn = function () {
            this.m_fm.SetReg(0x01, 0x02);
            this.m_fm.SetReg(0x01, 0x00);
            this.m_fm.SetReg(0x08, this.m_opMask << 3);
        };
        MOscOPM.prototype.noteOff = function () {
            this.m_fm.SetReg(0x08, 0x00);
        };
        MOscOPM.prototype.setWaveNo = function (waveNo) {
            if (waveNo >= MOscOPM.MAX_WAVE)
                waveNo = MOscOPM.MAX_WAVE - 1;
            if (MOscOPM.s_table[waveNo] == null)
                waveNo = 0;
            this.m_fm.SetVolume(MOscOPM.s_comGain);
            this.loadTimbre(MOscOPM.s_table[waveNo]);
        };
        MOscOPM.prototype.setNoteNo = function (noteNo) {
            this.noteOn();
        };
        MOscOPM.prototype.setOpMask = function (mask) {
            this.m_opMask = mask & 0xF;
        };
        MOscOPM.prototype.setVelocity = function (vel) {
            this.m_velocity = vel;
            var al = this.m_al;
            var tl = this.m_tl;
            var carrierop = MOscOPM.carrierop[al];
            var slottable = MOscOPM.slottable;
            this.SetTL(slottable[0], tl[0] + (carrierop & 0x08 ? 127 - vel : 0));
            this.SetTL(slottable[1], tl[1] + (carrierop & 0x10 ? 127 - vel : 0));
            this.SetTL(slottable[2], tl[2] + (carrierop & 0x20 ? 127 - vel : 0));
            this.SetTL(slottable[3], tl[3] + (carrierop & 0x40 ? 127 - vel : 0));
        };
        MOscOPM.prototype.setExpression = function (ex) {
            this.m_fm.SetExpression(ex);
        };
        MOscOPM.prototype.setFrequency = function (frequency) {
            if (this.m_frequency === frequency) {
                return;
            }
            _super.prototype.setFrequency.call(this, frequency);
            var n = 1200.0 * Math.log(frequency / 440.0) * Math.LOG2E + 5700.0 + MOscOPM.OPM_RATIO + 0.5 | 0;
            var note = n / 100 | 0;
            var cent = n % 100;
            var kf = 64.0 * cent / 100.0 + 0.5 | 0;
            var kc = (((note - 1) / 12) << 4) | MOscOPM.kctable[(note + 1200) % 12];
            this.m_fm.SetReg(0x30, kf << 2);
            this.m_fm.SetReg(0x28, kc);
        };
        MOscOPM.prototype.getNextSample = function () {
            this.m_fm.Mix(this.m_oneSample, 0, 1);
            return this.m_oneSample[0];
        };
        MOscOPM.prototype.getNextSampleOfs = function (ofs) {
            this.m_fm.Mix(this.m_oneSample, 0, 1);
            return this.m_oneSample[0];
        };
        MOscOPM.prototype.getSamples = function (samples, start, end) {
            this.m_fm.Mix(samples, start, end - start);
        };
        MOscOPM.prototype.IsPlaying = function () {
            return this.m_fm.IsOn(0);
        };
        MOscOPM.MAX_WAVE = 128;
        MOscOPM.OPM_CLOCK = 3580000;
        MOscOPM.OPM_RATIO = 0;
        MOscOPM.TIMB_SZ_M = 55;
        MOscOPM.TIMB_SZ_N = 51;
        MOscOPM.TYPE_OPM = 0;
        MOscOPM.TYPE_OPN = 1;
        MOscOPM.s_init = 0;
        MOscOPM.s_table = new Array(MOscOPM.MAX_WAVE);
        MOscOPM.s_comGain = 14.25;
        MOscOPM.kctable = [
            0xE, 0x0, 0x1, 0x2, 0x4, 0x5, 0x6, 0x8, 0x9, 0xA, 0xC, 0xD,
        ];
        MOscOPM.slottable = [
            0, 2, 1, 3
        ];
        MOscOPM.carrierop = [
            0x40,
            0x40,
            0x40,
            0x40,
            0x40 | 0x10,
            0x40 | 0x20 | 0x10,
            0x40 | 0x20 | 0x10,
            0x40 | 0x20 | 0x10 | 0x08
        ];
        MOscOPM.defTimbre = [
            4, 5,
            31, 5, 0, 0, 0, 23, 1, 1, 3, 0, 0,
            20, 10, 3, 7, 8, 0, 1, 1, 3, 0, 0,
            31, 3, 0, 0, 0, 25, 1, 1, 7, 0, 0,
            31, 12, 3, 7, 10, 2, 1, 1, 7, 0, 0,
            15,
            0, 0, 0, 0,
            0, 0,
            0, 0
        ];
        MOscOPM.zeroTimbre = [
            0, 0,
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
            15,
            0, 0, 0, 0,
            0, 0,
            0, 0
        ];
        return MOscOPM;
    })(flmml.MOscMod);
    flmml.MOscOPM = MOscOPM;
})(flmml || (flmml = {}));


var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var flmml;
(function (flmml) {
    var MOscPulse = (function (_super) {
        __extends(MOscPulse, _super);
        function MOscPulse() {
            MOscPulse.boot();
            _super.call(this);
            this.setPWM(0.5);
            this.setMIX(0);
        }
        MOscPulse.boot = function () {
        };
        MOscPulse.prototype.getNextSample = function () {
            var val = (this.m_phase < this.m_pwm) ? 1.0 : (this.m_mix ? this.m_modNoise.getNextSample() : -1.0);
            this.m_phase = (this.m_phase + this.m_freqShift) & MOscPulse.PHASE_MSK;
            return val;
        };
        MOscPulse.prototype.getNextSampleOfs = function (ofs) {
            var val = (((this.m_phase + ofs) & MOscPulse.PHASE_MSK) < this.m_pwm) ? 1.0 : (this.m_mix ? this.m_modNoise.getNextSampleOfs(ofs) : -1.0);
            this.m_phase = (this.m_phase + this.m_freqShift) & MOscPulse.PHASE_MSK;
            return val;
        };
        MOscPulse.prototype.getSamples = function (samples, start, end) {
            var i;
            if (this.m_mix) {
                for (i = start; i < end; i++) {
                    samples[i] = (this.m_phase < this.m_pwm) ? 1.0 : this.m_modNoise.getNextSample();
                    this.m_phase = (this.m_phase + this.m_freqShift) & MOscPulse.PHASE_MSK;
                }
            }
            else {
                for (i = start; i < end; i++) {
                    samples[i] = (this.m_phase < this.m_pwm) ? 1.0 : -1.0;
                    this.m_phase = (this.m_phase + this.m_freqShift) & MOscPulse.PHASE_MSK;
                }
            }
        };
        MOscPulse.prototype.getSamplesWithSyncIn = function (samples, syncin, start, end) {
            var i;
            if (this.m_mix) {
                for (i = start; i < end; i++) {
                    if (syncin[i])
                        this.resetPhase();
                    samples[i] = (this.m_phase < this.m_pwm) ? 1.0 : this.m_modNoise.getNextSample();
                    this.m_phase = (this.m_phase + this.m_freqShift) & MOscPulse.PHASE_MSK;
                }
            }
            else {
                for (i = start; i < end; i++) {
                    if (syncin[i])
                        this.resetPhase();
                    samples[i] = (this.m_phase < this.m_pwm) ? 1.0 : -1.0;
                    this.m_phase = (this.m_phase + this.m_freqShift) & MOscPulse.PHASE_MSK;
                }
            }
        };
        MOscPulse.prototype.getSamplesWithSyncOut = function (samples, syncout, start, end) {
            var i;
            if (this.m_mix) {
                for (i = start; i < end; i++) {
                    samples[i] = (this.m_phase < this.m_pwm) ? 1.0 : this.m_modNoise.getNextSample();
                    this.m_phase += this.m_freqShift;
                    syncout[i] = (this.m_phase > MOscPulse.PHASE_MSK);
                    this.m_phase &= MOscPulse.PHASE_MSK;
                }
            }
            else {
                for (i = start; i < end; i++) {
                    samples[i] = (this.m_phase < this.m_pwm) ? 1.0 : -1.0;
                    this.m_phase += this.m_freqShift;
                    syncout[i] = (this.m_phase > MOscPulse.PHASE_MSK);
                    this.m_phase &= MOscPulse.PHASE_MSK;
                }
            }
        };
        MOscPulse.prototype.setPWM = function (pwm) {
            this.m_pwm = pwm * MOscPulse.PHASE_LEN;
        };
        MOscPulse.prototype.setMIX = function (mix) {
            this.m_mix = mix;
        };
        MOscPulse.prototype.setNoise = function (noise) {
            this.m_modNoise = noise;
        };
        return MOscPulse;
    })(flmml.MOscMod);
    flmml.MOscPulse = MOscPulse;
})(flmml || (flmml = {}));


var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var flmml;
(function (flmml) {
    var MOscSaw = (function (_super) {
        __extends(MOscSaw, _super);
        function MOscSaw() {
            MOscSaw.boot();
            _super.call(this);
            this.setWaveNo(0);
        }
        MOscSaw.boot = function () {
            if (this.s_init)
                return;
            var d0 = 1.0 / this.TABLE_LEN;
            var p0;
            var i;
            this.s_table = new Array(this.MAX_WAVE);
            for (i = 0; i < this.MAX_WAVE; i++) {
                this.s_table[i] = new Array(this.TABLE_LEN);
            }
            for (i = 0, p0 = 0.0; i < this.TABLE_LEN; i++) {
                this.s_table[0][i] = p0 * 2.0 - 1.0;
                this.s_table[1][i] = (p0 < 0.5) ? 2.0 * p0 : 2.0 * p0 - 2.0;
                p0 += d0;
            }
            this.s_init = 1;
        };
        MOscSaw.prototype.getNextSample = function () {
            var val = MOscSaw.s_table[this.m_waveNo][this.m_phase >> MOscSaw.PHASE_SFT];
            this.m_phase = (this.m_phase + this.m_freqShift) & MOscSaw.PHASE_MSK;
            return val;
        };
        MOscSaw.prototype.getNextSampleOfs = function (ofs) {
            var val = MOscSaw.s_table[this.m_waveNo][((this.m_phase + ofs) & MOscSaw.PHASE_MSK) >> MOscSaw.PHASE_SFT];
            this.m_phase = (this.m_phase + this.m_freqShift) & MOscSaw.PHASE_MSK;
            return val;
        };
        MOscSaw.prototype.getSamples = function (samples, start, end) {
            var i;
            for (i = start; i < end; i++) {
                samples[i] = MOscSaw.s_table[this.m_waveNo][this.m_phase >> MOscSaw.PHASE_SFT];
                this.m_phase = (this.m_phase + this.m_freqShift) & MOscSaw.PHASE_MSK;
            }
        };
        MOscSaw.prototype.getSamplesWithSyncIn = function (samples, syncin, start, end) {
            var i;
            for (i = start; i < end; i++) {
                if (syncin[i]) {
                    this.resetPhase();
                }
                samples[i] = MOscSaw.s_table[this.m_waveNo][this.m_phase >> MOscSaw.PHASE_SFT];
                this.m_phase = (this.m_phase + this.m_freqShift) & MOscSaw.PHASE_MSK;
            }
        };
        MOscSaw.prototype.getSamplesWithSyncOut = function (samples, syncout, start, end) {
            var i;
            for (i = start; i < end; i++) {
                samples[i] = MOscSaw.s_table[this.m_waveNo][this.m_phase >> MOscSaw.PHASE_SFT];
                this.m_phase += this.m_freqShift;
                syncout[i] = (this.m_phase > MOscSaw.PHASE_MSK);
                this.m_phase &= MOscSaw.PHASE_MSK;
            }
        };
        MOscSaw.prototype.setWaveNo = function (waveNo) {
            this.m_waveNo = Math.min(waveNo, MOscSaw.MAX_WAVE - 1);
        };
        MOscSaw.MAX_WAVE = 2;
        MOscSaw.s_init = 0;
        return MOscSaw;
    })(flmml.MOscMod);
    flmml.MOscSaw = MOscSaw;
})(flmml || (flmml = {}));


var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var flmml;
(function (flmml) {
    var MOscSine = (function (_super) {
        __extends(MOscSine, _super);
        function MOscSine() {
            MOscSine.boot();
            _super.call(this);
            this.setWaveNo(0);
        }
        ;
        MOscSine.boot = function () {
            if (this.s_init)
                return;
            var d0 = 2.0 * Math.PI / this.TABLE_LEN;
            var p0;
            var i;
            for (i = 0; i < this.MAX_WAVE; i++) {
                this.s_table[i] = new Array(this.TABLE_LEN);
            }
            for (i = 0, p0 = 0.0; i < this.TABLE_LEN; i++) {
                this.s_table[0][i] = Math.sin(p0);
                this.s_table[1][i] = Math.max(0.0, this.s_table[0][i]);
                this.s_table[2][i] = (this.s_table[0][i] >= 0.0) ? this.s_table[0][i] : this.s_table[0][i] * -1.0;
                p0 += d0;
            }
            this.s_init = 1;
        };
        MOscSine.prototype.getNextSample = function () {
            var val = MOscSine.s_table[this.m_waveNo][this.m_phase >> MOscSine.PHASE_SFT];
            this.m_phase = (this.m_phase + this.m_freqShift) & MOscSine.PHASE_MSK;
            return val;
        };
        MOscSine.prototype.getNextSampleOfs = function (ofs) {
            var val = MOscSine.s_table[this.m_waveNo][((this.m_phase + ofs) & MOscSine.PHASE_MSK) >> MOscSine.PHASE_SFT];
            this.m_phase = (this.m_phase + this.m_freqShift) & MOscSine.PHASE_MSK;
            return val;
        };
        MOscSine.prototype.getSamples = function (samples, start, end) {
            var i;
            var tbl = MOscSine.s_table[this.m_waveNo];
            for (i = start; i < end; i++) {
                samples[i] = tbl[this.m_phase >> MOscSine.PHASE_SFT];
                this.m_phase = (this.m_phase + this.m_freqShift) & MOscSine.PHASE_MSK;
            }
        };
        MOscSine.prototype.getSamplesWithSyncIn = function (samples, syncin, start, end) {
            var i;
            var tbl = MOscSine.s_table[this.m_waveNo];
            for (i = start; i < end; i++) {
                if (syncin[i]) {
                    this.resetPhase();
                }
                samples[i] = tbl[this.m_phase >> MOscSine.PHASE_SFT];
                this.m_phase = (this.m_phase + this.m_freqShift) & MOscSine.PHASE_MSK;
            }
        };
        MOscSine.prototype.getSamplesWithSyncOut = function (samples, syncout, start, end) {
            var i;
            var tbl = MOscSine.s_table[this.m_waveNo];
            for (i = start; i < end; i++) {
                samples[i] = tbl[this.m_phase >> MOscSine.PHASE_SFT];
                this.m_phase += this.m_freqShift;
                syncout[i] = (this.m_phase > MOscSine.PHASE_MSK);
                this.m_phase &= MOscSine.PHASE_MSK;
            }
        };
        MOscSine.prototype.setWaveNo = function (waveNo) {
            if (waveNo >= MOscSine.MAX_WAVE)
                waveNo = MOscSine.MAX_WAVE - 1;
            if (!MOscSine.s_table[waveNo])
                waveNo = 0;
            this.m_waveNo = waveNo;
        };
        MOscSine.MAX_WAVE = 3;
        MOscSine.s_init = 0;
        MOscSine.s_table = new Array(MOscSine.MAX_WAVE);
        return MOscSine;
    })(flmml.MOscMod);
    flmml.MOscSine = MOscSine;
})(flmml || (flmml = {}));


var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var flmml;
(function (flmml) {
    var MOscTriangle = (function (_super) {
        __extends(MOscTriangle, _super);
        function MOscTriangle() {
            MOscTriangle.boot();
            _super.call(this);
            this.setWaveNo(0);
        }
        MOscTriangle.boot = function () {
            if (this.s_init)
                return;
            var d0 = 1.0 / this.TABLE_LEN;
            var p0;
            var i;
            this.s_table = new Array(this.MAX_WAVE);
            for (i = 0; i < this.MAX_WAVE; i++) {
                this.s_table[i] = new Array(this.TABLE_LEN);
            }
            for (i = 0, p0 = 0.0; i < this.TABLE_LEN; i++) {
                this.s_table[0][i] = (p0 < 0.50) ? (1.0 - 4.0 * p0) : (1.0 - 4.0 * (1.0 - p0));
                this.s_table[1][i] = (p0 < 0.25) ? (0.0 - 4.0 * p0) : ((p0 < 0.75) ? (-2.0 + 4.0 * p0) : (4.0 - 4.0 * p0));
                p0 += d0;
            }
            this.s_init = 1;
        };
        MOscTriangle.prototype.getNextSample = function () {
            var val = MOscTriangle.s_table[this.m_waveNo][this.m_phase >> MOscTriangle.PHASE_SFT];
            this.m_phase = (this.m_phase + this.m_freqShift) & MOscTriangle.PHASE_MSK;
            return val;
        };
        MOscTriangle.prototype.getNextSampleOfs = function (ofs) {
            var val = MOscTriangle.s_table[this.m_waveNo][((this.m_phase + ofs) & MOscTriangle.PHASE_MSK) >> MOscTriangle.PHASE_SFT];
            this.m_phase = (this.m_phase + this.m_freqShift) & MOscTriangle.PHASE_MSK;
            return val;
        };
        MOscTriangle.prototype.getSamples = function (samples, start, end) {
            var i;
            for (i = start; i < end; i++) {
                samples[i] = MOscTriangle.s_table[this.m_waveNo][this.m_phase >> MOscTriangle.PHASE_SFT];
                this.m_phase = (this.m_phase + this.m_freqShift) & MOscTriangle.PHASE_MSK;
            }
        };
        MOscTriangle.prototype.getSamplesWithSyncIn = function (samples, syncin, start, end) {
            var i;
            for (i = start; i < end; i++) {
                if (syncin[i]) {
                    this.resetPhase();
                }
                samples[i] = MOscTriangle.s_table[this.m_waveNo][this.m_phase >> MOscTriangle.PHASE_SFT];
                this.m_phase = (this.m_phase + this.m_freqShift) & MOscTriangle.PHASE_MSK;
            }
        };
        MOscTriangle.prototype.getSamplesWithSyncOut = function (samples, syncout, start, end) {
            var i;
            for (i = start; i < end; i++) {
                samples[i] = MOscTriangle.s_table[this.m_waveNo][this.m_phase >> MOscTriangle.PHASE_SFT];
                this.m_phase += this.m_freqShift;
                syncout[i] = (this.m_phase > MOscTriangle.PHASE_MSK);
                this.m_phase &= MOscTriangle.PHASE_MSK;
            }
        };
        MOscTriangle.prototype.setWaveNo = function (waveNo) {
            this.m_waveNo = Math.min(waveNo, MOscTriangle.MAX_WAVE - 1);
        };
        MOscTriangle.MAX_WAVE = 2;
        MOscTriangle.s_init = 0;
        return MOscTriangle;
    })(flmml.MOscMod);
    flmml.MOscTriangle = MOscTriangle;
})(flmml || (flmml = {}));


var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var flmml;
(function (flmml) {
    var MOscWave = (function (_super) {
        __extends(MOscWave, _super);
        function MOscWave() {
            MOscWave.boot();
            _super.call(this);
            this.setWaveNo(0);
        }
        MOscWave.boot = function () {
            if (this.s_init)
                return;
            this.s_table = new Array(this.MAX_WAVE);
            this.s_length = new Array(this.MAX_WAVE);
            this.setWave(0, "00112233445566778899AABBCCDDEEFFFFEEDDCCBBAA99887766554433221100");
            this.s_init = 1;
        };
        MOscWave.setWave = function (waveNo, wave) {
            this.s_length[waveNo] = 0;
            this.s_table[waveNo] = new Array(wave.length / 2 | 0);
            this.s_table[waveNo][0] = 0;
            for (var i = 0, j = 0, val = 0; i < this.MAX_LENGTH && i < wave.length; i++, j++) {
                var code = wave.charCodeAt(i);
                if (48 <= code && code < 58) {
                    code -= 48;
                }
                else if (97 <= code && code < 103) {
                    code -= 97 - 10;
                }
                else {
                    code = 0;
                }
                if (j & 1) {
                    val += code;
                    this.s_table[waveNo][this.s_length[waveNo]] = (Number(val) - 127.5) / 127.5;
                    this.s_length[waveNo]++;
                }
                else {
                    val = code << 4;
                }
            }
            if (this.s_length[waveNo] === 0)
                this.s_length[waveNo] = 1;
            this.s_length[waveNo] = (this.PHASE_MSK + 1) / this.s_length[waveNo];
        };
        MOscWave.prototype.setWaveNo = function (waveNo) {
            if (waveNo >= MOscWave.MAX_WAVE)
                waveNo = MOscWave.MAX_WAVE - 1;
            if (!MOscWave.s_table[waveNo])
                waveNo = 0;
            this.m_waveNo = waveNo;
        };
        MOscWave.prototype.getNextSample = function () {
            var val = MOscWave.s_table[this.m_waveNo][Math.floor(this.m_phase / MOscWave.s_length[this.m_waveNo])];
            this.m_phase = (this.m_phase + this.m_freqShift) & MOscWave.PHASE_MSK;
            return val;
        };
        MOscWave.prototype.getNextSampleOfs = function (ofs) {
            var val = MOscWave.s_table[this.m_waveNo][Math.floor(((this.m_phase + ofs) & MOscWave.PHASE_MSK) / MOscWave.s_length[this.m_waveNo])];
            this.m_phase = (this.m_phase + this.m_freqShift) & MOscWave.PHASE_MSK;
            return val;
        };
        MOscWave.prototype.getSamples = function (samples, start, end) {
            var i;
            for (i = start; i < end; i++) {
                samples[i] = MOscWave.s_table[this.m_waveNo][Math.floor(this.m_phase / MOscWave.s_length[this.m_waveNo])];
                this.m_phase = (this.m_phase + this.m_freqShift) & MOscWave.PHASE_MSK;
            }
        };
        MOscWave.prototype.getSamplesWithSyncIn = function (samples, syncin, start, end) {
            var i;
            for (i = start; i < end; i++) {
                if (syncin[i]) {
                    this.resetPhase();
                }
                samples[i] = MOscWave.s_table[this.m_waveNo][Math.floor(this.m_phase / MOscWave.s_length[this.m_waveNo])];
                this.m_phase = (this.m_phase + this.m_freqShift) & MOscWave.PHASE_MSK;
            }
        };
        MOscWave.prototype.getSamplesWithSyncOut = function (samples, syncout, start, end) {
            var i;
            for (i = start; i < end; i++) {
                samples[i] = MOscWave.s_table[this.m_waveNo][Math.floor(this.m_phase / MOscWave.s_length[this.m_waveNo])];
                this.m_phase += this.m_freqShift;
                syncout[i] = (this.m_phase > MOscWave.PHASE_MSK);
                this.m_phase &= MOscWave.PHASE_MSK;
            }
        };
        MOscWave.MAX_WAVE = 32;
        MOscWave.MAX_LENGTH = 2048;
        MOscWave.s_init = 0;
        return MOscWave;
    })(flmml.MOscMod);
    flmml.MOscWave = MOscWave;
})(flmml || (flmml = {}));





var flmml;
(function (flmml) {
    var MEnvelopePoint = (function () {
        function MEnvelopePoint() {
            this.next = null;
        }
        return MEnvelopePoint;
    })();
    flmml.MEnvelopePoint = MEnvelopePoint;
})(flmml || (flmml = {}));


var flmml;
(function (flmml) {
    var MEnvelope = (function () {
        function MEnvelope(attack, decay, sustain, release) {
            this.setAttack(attack);
            this.addPoint(decay, sustain);
            this.setRelease(release);
            this.m_playing = false;
            this.m_currentVal = 0;
            this.m_releasing = true;
            this.m_releaseStep = 0;
        }
        MEnvelope.boot = function () {
            if (!this.s_init) {
                var i;
                this.SAMPLE_RATE = msgr.SAMPLE_RATE;
                this.s_volumeLen = 256;
                for (i = 0; i < 3; i++) {
                    this.s_volumeMap[i] = new Array(this.s_volumeLen);
                    this.s_volumeMap[i][0] = 0.0;
                }
                for (i = 1; i < this.s_volumeLen; i++) {
                    this.s_volumeMap[0][i] = i / 255.0;
                    this.s_volumeMap[1][i] = Math.pow(10.0, (i - 255.0) * (48.0 / (255.0 * 20.0)));
                    this.s_volumeMap[2][i] = Math.pow(10.0, (i - 255.0) * (96.0 / (255.0 * 20.0)));
                }
                this.s_init = 1;
            }
        };
        MEnvelope.prototype.setAttack = function (attack) {
            this.m_envelopePoint = this.m_envelopeLastPoint = new flmml.MEnvelopePoint();
            this.m_envelopePoint.time = 0;
            this.m_envelopePoint.level = 0;
            this.addPoint(attack, 1.0);
        };
        MEnvelope.prototype.setRelease = function (release) {
            this.m_releaseTime = ((release > 0) ? release : (1.0 / 127.0)) * MEnvelope.SAMPLE_RATE;
            if (this.m_playing && !this.m_releasing) {
                this.m_counter = this.m_timeInSamples;
                this.m_currentPoint = this.m_envelopePoint;
                while (this.m_currentPoint.next !== null && this.m_counter >= this.m_currentPoint.next.time) {
                    this.m_currentPoint = this.m_currentPoint.next;
                    this.m_counter -= this.m_currentPoint.time;
                }
                if (this.m_currentPoint.next == null) {
                    this.m_currentVal = this.m_currentPoint.level;
                }
                else {
                    this.m_step = (this.m_currentPoint.next.level - this.m_currentPoint.level) / this.m_currentPoint.next.time;
                    this.m_currentVal = this.m_currentPoint.level + (this.m_step * this.m_counter);
                }
            }
        };
        MEnvelope.prototype.addPoint = function (time, level) {
            var point = new flmml.MEnvelopePoint();
            point.time = time * MEnvelope.SAMPLE_RATE;
            point.level = level;
            this.m_envelopeLastPoint.next = point;
            this.m_envelopeLastPoint = point;
        };
        MEnvelope.prototype.triggerEnvelope = function (zeroStart) {
            this.m_playing = true;
            this.m_releasing = false;
            this.m_currentPoint = this.m_envelopePoint;
            this.m_currentVal = this.m_currentPoint.level = (zeroStart) ? 0 : this.m_currentVal;
            this.m_step = (1.0 - this.m_currentVal) / this.m_currentPoint.next.time;
            this.m_timeInSamples = this.m_counter = 0;
        };
        MEnvelope.prototype.releaseEnvelope = function () {
            this.m_releasing = true;
            this.m_releaseStep = (this.m_currentVal / this.m_releaseTime);
        };
        MEnvelope.prototype.soundOff = function () {
            this.releaseEnvelope();
            this.m_playing = false;
        };
        MEnvelope.prototype.getNextAmplitudeLinear = function () {
            if (!this.m_playing)
                return 0;
            if (!this.m_releasing) {
                if (this.m_currentPoint.next == null) {
                    this.m_currentVal = this.m_currentPoint.level;
                }
                else {
                    var processed = false;
                    while (this.m_counter >= this.m_currentPoint.next.time) {
                        this.m_counter = 0;
                        this.m_currentPoint = this.m_currentPoint.next;
                        if (this.m_currentPoint.next == null) {
                            this.m_currentVal = this.m_currentPoint.level;
                            processed = true;
                            break;
                        }
                        else {
                            this.m_step = (this.m_currentPoint.next.level - this.m_currentPoint.level) / this.m_currentPoint.next.time;
                            this.m_currentVal = this.m_currentPoint.level;
                            processed = true;
                        }
                    }
                    if (!processed) {
                        this.m_currentVal += this.m_step;
                    }
                    this.m_counter++;
                }
            }
            else {
                this.m_currentVal -= this.m_releaseStep;
            }
            if (this.m_currentVal <= 0 && this.m_releasing) {
                this.m_playing = false;
                this.m_currentVal = 0;
            }
            this.m_timeInSamples++;
            return this.m_currentVal;
        };
        MEnvelope.prototype.ampSamplesLinear = function (samples, start, end, velocity) {
            var i, amplitude = this.m_currentVal * velocity;
            for (i = start; i < end; i++) {
                if (!this.m_playing) {
                    samples[i] = 0;
                    continue;
                }
                if (!this.m_releasing) {
                    if (this.m_currentPoint.next == null) {
                    }
                    else {
                        var processed = false;
                        while (this.m_counter >= this.m_currentPoint.next.time) {
                            this.m_counter = 0;
                            this.m_currentPoint = this.m_currentPoint.next;
                            if (this.m_currentPoint.next == null) {
                                this.m_currentVal = this.m_currentPoint.level;
                                processed = true;
                                break;
                            }
                            else {
                                this.m_step = (this.m_currentPoint.next.level - this.m_currentPoint.level) / this.m_currentPoint.next.time;
                                this.m_currentVal = this.m_currentPoint.level;
                                processed = true;
                            }
                        }
                        if (!processed) {
                            this.m_currentVal += this.m_step;
                        }
                        amplitude = this.m_currentVal * velocity;
                        this.m_counter++;
                    }
                }
                else {
                    this.m_currentVal -= this.m_releaseStep;
                    amplitude = this.m_currentVal * velocity;
                }
                if (this.m_currentVal <= 0 && this.m_releasing) {
                    this.m_playing = false;
                    amplitude = this.m_currentVal = 0;
                }
                this.m_timeInSamples++;
                samples[i] *= amplitude;
            }
        };
        MEnvelope.prototype.ampSamplesNonLinear = function (samples, start, end, velocity, volMode) {
            var i;
            for (i = start; i < end; i++) {
                if (!this.m_playing) {
                    samples[i] = 0;
                    continue;
                }
                if (!this.m_releasing) {
                    if (this.m_currentPoint.next == null) {
                        this.m_currentVal = this.m_currentPoint.level;
                    }
                    else {
                        var processed = false;
                        while (this.m_counter >= this.m_currentPoint.next.time) {
                            this.m_counter = 0;
                            this.m_currentPoint = this.m_currentPoint.next;
                            if (this.m_currentPoint.next == null) {
                                this.m_currentVal = this.m_currentPoint.level;
                                processed = true;
                                break;
                            }
                            else {
                                this.m_step = (this.m_currentPoint.next.level - this.m_currentPoint.level) / this.m_currentPoint.next.time;
                                this.m_currentVal = this.m_currentPoint.level;
                                processed = true;
                            }
                        }
                        if (!processed) {
                            this.m_currentVal += this.m_step;
                        }
                        this.m_counter++;
                    }
                }
                else {
                    this.m_currentVal -= this.m_releaseStep;
                }
                if (this.m_currentVal <= 0 && this.m_releasing) {
                    this.m_playing = false;
                    this.m_currentVal = 0;
                }
                this.m_timeInSamples++;
                var cv = (this.m_currentVal * 255) | 0;
                if (cv > 255) {
                    cv = 0;
                }
                samples[i] *= MEnvelope.s_volumeMap[volMode][cv] * velocity;
            }
        };
        MEnvelope.prototype.isPlaying = function () {
            return this.m_playing;
        };
        MEnvelope.prototype.isReleasing = function () {
            return this.m_releasing;
        };
        MEnvelope.s_init = 0;
        MEnvelope.s_volumeMap = new Array(3);
        return MEnvelope;
    })();
    flmml.MEnvelope = MEnvelope;
})(flmml || (flmml = {}));


var flmml;
(function (flmml) {
    var MFilter = (function () {
        function MFilter() {
            if (!MFilter.SAMPLE_RATE)
                MFilter.SAMPLE_RATE = msgr.SAMPLE_RATE;
            this.setSwitch(0);
        }
        MFilter.prototype.reset = function () {
            this.m_t1 = this.m_t2 = this.m_b0 = this.m_b1 = this.m_b2 = this.m_b3 = this.m_b4 = 0.0;
        };
        MFilter.prototype.setSwitch = function (s) {
            this.reset();
            this.sw = s;
        };
        MFilter.prototype.checkToSilence = function () {
            switch (this.sw) {
                case 0:
                    return false;
                case 1:
                case -1:
                    return (-0.000001 <= this.m_b0 && this.m_b0 <= 0.000001 && -0.000001 <= this.m_b1 && this.m_b1 <= 0.000001);
                case 2:
                case -2:
                    return (-0.000001 <= this.m_t1 && this.m_t1 <= 0.000001 &&
                        -0.000001 <= this.m_t2 && this.m_t2 <= 0.000001 &&
                        -0.000001 <= this.m_b0 && this.m_b0 <= 0.000001 &&
                        -0.000001 <= this.m_b1 && this.m_b1 <= 0.000001 &&
                        -0.000001 <= this.m_b2 && this.m_b2 <= 0.000001 &&
                        -0.000001 <= this.m_b3 && this.m_b3 <= 0.000001 &&
                        -0.000001 <= this.m_b4 && this.m_b4 <= 0.000001);
            }
            return false;
        };
        MFilter.prototype.run = function (samples, start, end, envelope, frq, amt, res, key) {
            switch (this.sw) {
                case -2:
                    this.hpf2(samples, start, end, envelope, frq, amt, res, key);
                    break;
                case -1:
                    this.hpf1(samples, start, end, envelope, frq, amt, res, key);
                    break;
                case 0: return;
                case 1:
                    this.lpf1(samples, start, end, envelope, frq, amt, res, key);
                    break;
                case 2:
                    this.lpf2(samples, start, end, envelope, frq, amt, res, key);
                    break;
            }
        };
        MFilter.prototype.lpf1 = function (samples, start, end, envelope, frq, amt, res, key) {
            var b0 = this.m_b0, b1 = this.m_b1;
            var i;
            var fb;
            var cut;
            var k = key * (2.0 * Math.PI / (MFilter.SAMPLE_RATE * 440.0));
            if (amt > 0.0001 || amt < -0.0001) {
                for (i = start; i < end; i++) {
                    cut = flmml.MChannel.getFrequency(frq + amt * envelope.getNextAmplitudeLinear()) * k;
                    if (cut < (1.0 / 127.0))
                        cut = 0.0;
                    if (cut > (1.0 - 0.0001))
                        cut = 1.0 - 0.0001;
                    fb = res + res / (1.0 - cut);
                    b0 = b0 + cut * (samples[i] - b0 + fb * (b0 - b1));
                    samples[i] = b1 = b1 + cut * (b0 - b1);
                }
            }
            else {
                cut = flmml.MChannel.getFrequency(frq) * k;
                if (cut < (1.0 / 127.0))
                    cut = 0.0;
                if (cut > (1.0 - 0.0001))
                    cut = 1.0 - 0.0001;
                fb = res + res / (1.0 - cut);
                for (i = start; i < end; i++) {
                    b0 = b0 + cut * (samples[i] - b0 + fb * (b0 - b1));
                    samples[i] = b1 = b1 + cut * (b0 - b1);
                }
            }
            this.m_b0 = b0;
            this.m_b1 = b1;
        };
        MFilter.prototype.lpf2 = function (samples, start, end, envelope, frq, amt, res, key) {
            var t1 = this.m_t1, t2 = this.m_t2, b0 = this.m_b0, b1 = this.m_b1, b2 = this.m_b2, b3 = this.m_b3, b4 = this.m_b4;
            var k = key * (2.0 * Math.PI / (MFilter.SAMPLE_RATE * 440.0));
            for (var i = start; i < end; i++) {
                var cut = flmml.MChannel.getFrequency(frq + amt * envelope.getNextAmplitudeLinear()) * k;
                if (cut < (1.0 / 127.0))
                    cut = 0.0;
                if (cut > 1.0)
                    cut = 1.0;
                var q = 1.0 - cut;
                var p = cut + 0.8 * cut * q;
                var f = p + p - 1.0;
                q = res * (1.0 + 0.5 * q * (1.0 - q + 5.6 * q * q));
                var input = samples[i];
                input -= q * b4;
                t1 = b1;
                b1 = (input + b0) * p - b1 * f;
                t2 = b2;
                b2 = (b1 + t1) * p - b2 * f;
                t1 = b3;
                b3 = (b2 + t2) * p - b3 * f;
                b4 = (b3 + t1) * p - b4 * f;
                b4 = b4 - b4 * b4 * b4 * 0.166667;
                b0 = input;
                samples[i] = b4;
            }
            this.m_t1 = t1;
            this.m_t2 = t2;
            this.m_b0 = b0;
            this.m_b1 = b1;
            this.m_b2 = b2;
            this.m_b3 = b3;
            this.m_b4 = b4;
        };
        MFilter.prototype.hpf1 = function (samples, start, end, envelope, frq, amt, res, key) {
            var b0 = this.m_b0, b1 = this.m_b1;
            var i;
            var fb;
            var cut;
            var k = key * (2.0 * Math.PI / (MFilter.SAMPLE_RATE * 440.0));
            var input;
            if (amt > 0.0001 || amt < -0.0001) {
                for (i = start; i < end; i++) {
                    cut = flmml.MChannel.getFrequency(frq + amt * envelope.getNextAmplitudeLinear()) * k;
                    if (cut < (1.0 / 127.0))
                        cut = 0.0;
                    if (cut > (1.0 - 0.0001))
                        cut = 1.0 - 0.0001;
                    fb = res + res / (1.0 - cut);
                    input = samples[i];
                    b0 = b0 + cut * (input - b0 + fb * (b0 - b1));
                    b1 = b1 + cut * (b0 - b1);
                    samples[i] = input - b0;
                }
            }
            else {
                cut = flmml.MChannel.getFrequency(frq) * k;
                if (cut < (1.0 / 127.0))
                    cut = 0.0;
                if (cut > (1.0 - 0.0001))
                    cut = 1.0 - 0.0001;
                fb = res + res / (1.0 - cut);
                for (i = start; i < end; i++) {
                    input = samples[i];
                    b0 = b0 + cut * (input - b0 + fb * (b0 - b1));
                    b1 = b1 + cut * (b0 - b1);
                    samples[i] = input - b0;
                }
            }
            this.m_b0 = b0;
            this.m_b1 = b1;
        };
        MFilter.prototype.hpf2 = function (samples, start, end, envelope, frq, amt, res, key) {
            var t1 = this.m_t1, t2 = this.m_t2, b0 = this.m_b0, b1 = this.m_b1, b2 = this.m_b2, b3 = this.m_b3, b4 = this.m_b4;
            var k = key * (2.0 * Math.PI / (MFilter.SAMPLE_RATE * 440.0));
            for (var i = start; i < end; i++) {
                var cut = flmml.MChannel.getFrequency(frq + amt * envelope.getNextAmplitudeLinear()) * k;
                if (cut < (1.0 / 127.0))
                    cut = 0.0;
                if (cut > 1.0)
                    cut = 1.0;
                var q = 1.0 - cut;
                var p = cut + 0.8 * cut * q;
                var f = p + p - 1.0;
                q = res * (1.0 + 0.5 * q * (1.0 - q + 5.6 * q * q));
                var input = samples[i];
                input -= q * b4;
                t1 = b1;
                b1 = (input + b0) * p - b1 * f;
                t2 = b2;
                b2 = (b1 + t1) * p - b2 * f;
                t1 = b3;
                b3 = (b2 + t2) * p - b3 * f;
                b4 = (b3 + t1) * p - b4 * f;
                b4 = b4 - b4 * b4 * b4 * 0.166667;
                b0 = input;
                samples[i] = input - b4;
            }
            this.m_t1 = t1;
            this.m_t2 = t2;
            this.m_b0 = b0;
            this.m_b1 = b1;
            this.m_b2 = b2;
            this.m_b3 = b3;
            this.m_b4 = b4;
        };
        MFilter.SAMPLE_RATE = null;
        return MFilter;
    })();
    flmml.MFilter = MFilter;
})(flmml || (flmml = {}));


var flmml;
(function (flmml) {
    var MChannel = (function () {
        function MChannel() {
            this.m_noteNo = 0;
            this.m_detune = 0;
            this.m_freqNo = 0;
            this.m_envelope1 = new flmml.MEnvelope(0.0, 60.0 / 127.0, 30.0 / 127.0, 1.0 / 127.0);
            this.m_envelope2 = new flmml.MEnvelope(0.0, 30.0 / 127.0, 0.0, 1.0);
            this.m_oscSet1 = new flmml.MOscillator();
            this.m_oscMod1 = this.m_oscSet1.getCurrent();
            this.m_oscSet2 = new flmml.MOscillator();
            this.m_oscSet2.asLFO();
            this.m_oscSet2.setForm(flmml.MOscillator.SINE);
            this.m_oscMod2 = this.m_oscSet2.getCurrent();
            this.m_osc2Connect = 0;
            this.m_filter = new flmml.MFilter();
            this.m_filterConnect = 0;
            this.m_formant = new flmml.MFormant();
            this.m_volMode = 0;
            this.setExpression(127);
            this.setVelocity(100);
            this.setPan(64);
            this.m_onCounter = 0;
            this.m_lfoDelay = 0;
            this.m_lfoDepth = 0.0;
            this.m_lfoEnd = 0;
            this.m_lpfAmt = 0;
            this.m_lpfFrq = 0;
            this.m_lpfRes = 0;
            this.m_pulseWidth = 0.5;
            this.m_isMuted = false;
            this.setInput(0, 0);
            this.setOutput(0, 0);
            this.setRing(0, 0);
            this.setSync(0, 0);
            this.m_portDepth = 0;
            this.m_portDepthAdd = 0;
            this.m_lastFreqNo = 4800;
            this.m_portamento = 0;
            this.m_portRate = 0;
            this.m_voiceid = 0;
            this.m_slaveVoice = false;
        }
        MChannel.boot = function (numSamples) {
            if (!this.s_init) {
                var i;
                this.SAMPLE_RATE = msgr.SAMPLE_RATE;
                this.emptyBuffer = msgr.emptyBuffer;
                this.s_frequencyLen = this.s_frequencyMap.length;
                for (i = 0; i < this.s_frequencyLen; i++) {
                    this.s_frequencyMap[i] = 440.0 * Math.pow(2.0, (i - 69 * this.PITCH_RESOLUTION) / (12.0 * this.PITCH_RESOLUTION));
                }
                this.s_volumeLen = 128;
                this.s_volumeMap = new Array(3);
                for (i = 0; i < 3; i++) {
                    this.s_volumeMap[i] = new Array(this.s_volumeLen);
                    this.s_volumeMap[i][0] = 0.0;
                }
                for (i = 1; i < this.s_volumeLen; i++) {
                    this.s_volumeMap[0][i] = i / 127.0;
                    this.s_volumeMap[1][i] = Math.pow(10.0, (i - 127.0) * (48.0 / (127.0 * 20.0)));
                    this.s_volumeMap[2][i] = Math.pow(10.0, (i - 127.0) * (96.0 / (127.0 * 20.0)));
                }
                this.s_init = 1;
            }
            this.s_samples = new Float32Array(numSamples);
        };
        MChannel.createPipes = function (num) {
            this.s_pipeArr = new Array(num);
            for (var i = 0; i < num; i++) {
                this.s_pipeArr[i] = new Float32Array(this.s_samples.length);
            }
        };
        MChannel.createSyncSources = function (num) {
            this.s_syncSources = new Array(num);
            for (var i = 0; i < num; i++) {
                this.s_syncSources[i] = new Array(this.s_samples.length);
                for (var j = 0; j < this.s_samples.length; j++) {
                    this.s_syncSources[i][j] = false;
                }
            }
        };
        MChannel.getFrequency = function (freqNo) {
            freqNo |= 0;
            freqNo = (freqNo < 0) ? 0 : (freqNo >= MChannel.s_frequencyLen) ? MChannel.s_frequencyLen - 1 : freqNo;
            return MChannel.s_frequencyMap[freqNo];
        };
        MChannel.prototype.setExpression = function (ex) {
            this.m_expression = MChannel.s_volumeMap[this.m_volMode][ex];
            this.m_ampLevel = this.m_velocity * this.m_expression;
            this.m_oscSet1.getMod(flmml.MOscillator.OPM).setExpression(this.m_expression);
        };
        MChannel.prototype.setVelocity = function (velocity) {
            this.m_velocity = MChannel.s_volumeMap[this.m_volMode][velocity];
            this.m_ampLevel = this.m_velocity * this.m_expression;
            this.m_oscSet1.getMod(flmml.MOscillator.OPM).setVelocity(velocity);
        };
        MChannel.prototype.setNoteNo = function (noteNo, tie) {
            if (tie === void 0) { tie = true; }
            this.m_noteNo = noteNo;
            this.m_freqNo = this.m_noteNo * MChannel.PITCH_RESOLUTION + this.m_detune;
            this.m_oscMod1.setFrequency(MChannel.getFrequency(this.m_freqNo));
            if (this.m_portamento === 1) {
                if (!tie) {
                    this.m_portDepth = this.m_lastFreqNo - this.m_freqNo;
                }
                else {
                    this.m_portDepth += (this.m_lastFreqNo - this.m_freqNo);
                }
                this.m_portDepthAdd = (this.m_portDepth < 0) ? this.m_portRate : this.m_portRate * -1;
            }
            this.m_lastFreqNo = this.m_freqNo;
        };
        MChannel.prototype.setDetune = function (detune) {
            this.m_detune = detune;
            this.m_freqNo = this.m_noteNo * MChannel.PITCH_RESOLUTION + this.m_detune;
            this.m_oscMod1.setFrequency(MChannel.getFrequency(this.m_freqNo));
        };
        MChannel.prototype.getNoteNo = function () {
            return this.m_noteNo;
        };
        MChannel.prototype.isPlaying = function () {
            if (this.m_oscSet1.getForm() === flmml.MOscillator.OPM) {
                return this.m_oscSet1.getCurrent().IsPlaying();
            }
            else {
                return this.m_envelope1.isPlaying();
            }
        };
        MChannel.prototype.mute = function (f) {
            this.m_isMuted = f;
        };
        MChannel.prototype.isMuted = function () {
            return this.m_isMuted;
        };
        MChannel.prototype.getId = function () {
            return this.m_voiceid;
        };
        MChannel.prototype.getVoiceCount = function () {
            return this.isPlaying() ? 1 : 0;
        };
        MChannel.prototype.setSlaveVoice = function (f) {
            this.m_slaveVoice = f;
        };
        MChannel.prototype.noteOnWidthId = function (noteNo, velocity, id) {
            this.m_voiceid = id;
            this.noteOn(noteNo, velocity);
        };
        MChannel.prototype.noteOn = function (noteNo, velocity) {
            this.setNoteNo(noteNo, false);
            this.m_envelope1.triggerEnvelope(0);
            this.m_envelope2.triggerEnvelope(1);
            this.m_oscMod1.resetPhase();
            this.m_oscMod2.resetPhase();
            this.m_filter.reset();
            this.setVelocity(velocity);
            this.m_onCounter = 0;
            var modPulse = this.m_oscSet1.getMod(flmml.MOscillator.PULSE);
            modPulse.setPWM(this.m_pulseWidth);
            var oscSet1 = this.m_oscSet1;
            oscSet1.getMod(flmml.MOscillator.FC_NOISE).setNoteNo(this.m_noteNo);
            oscSet1.getMod(flmml.MOscillator.GB_NOISE).setNoteNo(this.m_noteNo);
            oscSet1.getMod(flmml.MOscillator.GB_S_NOISE).setNoteNo(this.m_noteNo);
            oscSet1.getMod(flmml.MOscillator.FC_DPCM).setNoteNo(this.m_noteNo);
            oscSet1.getMod(flmml.MOscillator.OPM).setNoteNo(this.m_noteNo);
        };
        MChannel.prototype.noteOff = function (noteNo) {
            if (noteNo < 0 || noteNo === this.m_noteNo) {
                this.m_envelope1.releaseEnvelope();
                this.m_envelope2.releaseEnvelope();
                this.m_oscSet1.getMod(flmml.MOscillator.OPM).noteOff();
            }
        };
        MChannel.prototype.setSoundOff = function () {
            this.m_envelope1.soundOff();
            this.m_envelope2.soundOff();
        };
        MChannel.prototype.close = function () {
            this.noteOff(this.m_noteNo);
            this.m_filter.setSwitch(0);
        };
        MChannel.prototype.setNoiseFreq = function (frequency) {
            var modNoise = this.m_oscSet1.getMod(flmml.MOscillator.NOISE);
            modNoise.setNoiseFreq(1.0 - frequency * (1.0 / 128.0));
        };
        MChannel.prototype.setForm = function (form, subform) {
            this.m_oscMod1 = this.m_oscSet1.setForm(form);
            this.m_oscMod1.setWaveNo(subform);
        };
        MChannel.prototype.setEnvelope1Atk = function (attack) {
            this.m_envelope1.setAttack(attack * (1.0 / 127.0));
        };
        MChannel.prototype.setEnvelope1Point = function (time, level) {
            this.m_envelope1.addPoint(time * (1.0 / 127.0), level * (1.0 / 127.0));
        };
        MChannel.prototype.setEnvelope1Rel = function (release) {
            this.m_envelope1.setRelease(release * (1.0 / 127.0));
        };
        MChannel.prototype.setEnvelope2Atk = function (attack) {
            this.m_envelope2.setAttack(attack * (1.0 / 127.0));
        };
        MChannel.prototype.setEnvelope2Point = function (time, level) {
            this.m_envelope2.addPoint(time * (1.0 / 127.0), level * (1.0 / 127.0));
        };
        MChannel.prototype.setEnvelope2Rel = function (release) {
            this.m_envelope2.setRelease(release * (1.0 / 127.0));
        };
        MChannel.prototype.setPWM = function (pwm) {
            if (this.m_oscSet1.getForm() !== flmml.MOscillator.FC_PULSE) {
                var modPulse = this.m_oscSet1.getMod(flmml.MOscillator.PULSE);
                if (pwm < 0) {
                    modPulse.setMIX(1);
                    pwm *= -1;
                }
                else {
                    modPulse.setMIX(0);
                }
                this.m_pulseWidth = pwm * 0.01;
                modPulse.setPWM(this.m_pulseWidth);
            }
            else {
                var modFcPulse = this.m_oscSet1.getMod(flmml.MOscillator.FC_PULSE);
                if (pwm < 0)
                    pwm *= -1;
                modFcPulse.setPWM(0.125 * Math.floor(pwm));
            }
        };
        MChannel.prototype.setPan = function (pan) {
            this.m_pan = (pan - 1) * (0.5 / 63.0);
            if (this.m_pan < 0)
                this.m_pan = 0;
        };
        MChannel.prototype.setFormant = function (vowel) {
            if (vowel >= 0)
                this.m_formant.setVowel(vowel);
            else
                this.m_formant.disable();
        };
        MChannel.prototype.setLFOFMSF = function (form, subform) {
            this.m_oscMod2 = this.m_oscSet2.setForm((form >= 0) ? form - 1 : -form - 1);
            this.m_oscMod2.setWaveNo(subform);
            this.m_osc2Sign = (form >= 0) ? 1.0 : -1.0;
            if (form < 0)
                form = -form;
            form--;
            if (form >= flmml.MOscillator.MAX)
                this.m_osc2Connect = 0;
        };
        MChannel.prototype.setLFODPWD = function (depth, freq) {
            this.m_lfoDepth = depth;
            this.m_osc2Connect = (depth === 0) ? 0 : 1;
            this.m_oscMod2.setFrequency(freq);
            this.m_oscMod2.resetPhase();
            this.m_oscSet2.getMod(flmml.MOscillator.NOISE).setNoiseFreq(freq / MChannel.SAMPLE_RATE);
        };
        MChannel.prototype.setLFODLTM = function (delay, time) {
            this.m_lfoDelay = delay;
            this.m_lfoEnd = (time > 0) ? this.m_lfoDelay + time : 0;
        };
        MChannel.prototype.setLFOTarget = function (target) {
            this.m_lfoTarget = target;
        };
        MChannel.prototype.setLpfSwtAmt = function (swt, amt) {
            if (-3 < swt && swt < 3 && swt !== this.m_filterConnect) {
                this.m_filterConnect = swt;
                this.m_filter.setSwitch(swt);
            }
            this.m_lpfAmt = ((amt < -127) ? -127 : (amt < 127) ? amt : 127) * MChannel.PITCH_RESOLUTION;
        };
        MChannel.prototype.setLpfFrqRes = function (frq, res) {
            if (frq < 0)
                frq = 0;
            if (frq > 127)
                frq = 127;
            this.m_lpfFrq = frq * MChannel.PITCH_RESOLUTION;
            this.m_lpfRes = res * (1.0 / 127.0);
            if (this.m_lpfRes < 0.0)
                this.m_lpfRes = 0.0;
            if (this.m_lpfRes > 1.0)
                this.m_lpfRes = 1.0;
        };
        MChannel.prototype.setVolMode = function (m) {
            switch (m) {
                case 0:
                case 1:
                case 2:
                    this.m_volMode = m;
                    break;
            }
        };
        MChannel.prototype.setInput = function (i, p) {
            this.m_inSens = (1 << (i - 1)) * (1.0 / 8.0) * flmml.MOscMod.PHASE_LEN;
            this.m_inPipe = p;
        };
        MChannel.prototype.setOutput = function (o, p) {
            this.m_outMode = o;
            this.m_outPipe = p;
        };
        MChannel.prototype.setRing = function (s, p) {
            this.m_ringSens = (1 << (s - 1)) / 8.0;
            this.m_ringPipe = p;
        };
        MChannel.prototype.setSync = function (m, p) {
            this.m_syncMode = m;
            this.m_syncPipe = p;
        };
        MChannel.prototype.setPortamento = function (depth, len) {
            this.m_portamento = 0;
            this.m_portDepth = depth;
            this.m_portDepthAdd = (Math.floor(this.m_portDepth) / len) * -1;
        };
        MChannel.prototype.setMidiPort = function (mode) {
            this.m_portamento = mode;
            this.m_portDepth = 0;
        };
        MChannel.prototype.setMidiPortRate = function (rate) {
            this.m_portRate = rate;
        };
        MChannel.prototype.setPortBase = function (base) {
            this.m_lastFreqNo = base;
        };
        MChannel.prototype.setVoiceLimit = function (voiceLimit) {
        };
        MChannel.prototype.setHwLfo = function (data) {
            var w = (data >> 27) & 0x03;
            var f = (data >> 19) & 0xFF;
            var pmd = (data >> 12) & 0x7F;
            var amd = (data >> 5) & 0x7F;
            var pms = (data >> 2) & 0x07;
            var ams = (data >> 0) & 0x03;
            var fm = this.m_oscSet1.getMod(flmml.MOscillator.OPM);
            fm.setWF(w);
            fm.setLFRQ(f);
            fm.setPMD(pmd);
            fm.setAMD(amd);
            fm.setPMSAMS(pms, ams);
        };
        MChannel.prototype.reset = function () {
            this.setSoundOff();
            this.m_pulseWidth = 0.5;
            this.m_voiceid = 0;
            this.setForm(0, 0);
            this.setDetune(0);
            this.setExpression(127);
            this.setVelocity(100);
            this.setPan(64);
            this.setVolMode(0);
            this.setNoiseFreq(0.0);
            this.setLFOFMSF(0, 0);
            this.m_osc2Connect = 0;
            this.m_onCounter = 0;
            this.m_lfoTarget = 0;
            this.m_lfoDelay = 0;
            this.m_lfoDepth = 0.0;
            this.m_lfoEnd = 0;
            this.setLpfSwtAmt(0, 0);
            this.setLpfFrqRes(0, 0);
            this.setFormant(-1);
            this.setInput(0, 0);
            this.setOutput(0, 0);
            this.setRing(0, 0);
            this.setSync(0, 0);
            this.m_portDepth = 0;
            this.m_portDepthAdd = 0;
            this.m_lastFreqNo = 4800;
            this.m_portamento = 0;
            this.m_portRate = 0;
        };
        MChannel.prototype.clearOutPipe = function (max, start, delta) {
            if (this.m_outMode === 1) {
                MChannel.s_pipeArr[this.m_outPipe].set(MChannel.emptyBuffer.subarray(0, delta), start);
            }
        };
        MChannel.prototype.getNextCutoff = function () {
            var cut = this.m_lpfFrq + this.m_lpfAmt * this.m_envelope2.getNextAmplitudeLinear();
            cut = MChannel.getFrequency(cut) * this.m_oscMod1.getFrequency() * (2.0 * Math.PI / (MChannel.SAMPLE_RATE * 440.0));
            if (cut < (1.0 / 127.0))
                cut = 0.0;
            return cut;
        };
        MChannel.prototype.getSamples = function (samplesSt, max, start, delta) {
            var end = start + delta;
            var trackBuffer = MChannel.s_samples, sens, pipe;
            var amplitude, rightAmplitude;
            var playing = this.isPlaying(), tmpFlag;
            var vol, lpffrq, pan, depth;
            var i, j, s, e;
            if (end >= max)
                end = max;
            var key = MChannel.getFrequency(this.m_freqNo);
            if (this.m_outMode === 1 && this.m_slaveVoice === false) {
                trackBuffer = MChannel.s_pipeArr[this.m_outPipe];
            }
            if (playing) {
                if (this.m_portDepth === 0) {
                    if (this.m_inSens >= 0.000001) {
                        if (this.m_osc2Connect === 0) {
                            this.getSamplesF__(trackBuffer, start, end);
                        }
                        else if (this.m_lfoTarget === 0) {
                            this.getSamplesFP_(trackBuffer, start, end);
                        }
                        else if (this.m_lfoTarget === 3) {
                            this.getSamplesFW_(trackBuffer, start, end);
                        }
                        else if (this.m_lfoTarget === 4) {
                            this.getSamplesFF_(trackBuffer, start, end);
                        }
                        else {
                            this.getSamplesF__(trackBuffer, start, end);
                        }
                    }
                    else if (this.m_syncMode === 2) {
                        if (this.m_osc2Connect === 0) {
                            this.getSamplesI__(trackBuffer, start, end);
                        }
                        else if (this.m_lfoTarget === 0) {
                            this.getSamplesIP_(trackBuffer, start, end);
                        }
                        else if (this.m_lfoTarget === 3) {
                            this.getSamplesIW_(trackBuffer, start, end);
                        }
                        else {
                            this.getSamplesI__(trackBuffer, start, end);
                        }
                    }
                    else if (this.m_syncMode === 1) {
                        if (this.m_osc2Connect === 0) {
                            this.getSamplesO__(trackBuffer, start, end);
                        }
                        else if (this.m_lfoTarget === 0) {
                            this.getSamplesOP_(trackBuffer, start, end);
                        }
                        else if (this.m_lfoTarget === 3) {
                            this.getSamplesOW_(trackBuffer, start, end);
                        }
                        else {
                            this.getSamplesO__(trackBuffer, start, end);
                        }
                    }
                    else {
                        if (this.m_osc2Connect === 0) {
                            this.getSamples___(trackBuffer, start, end);
                        }
                        else if (this.m_lfoTarget === 0) {
                            this.getSamples_P_(trackBuffer, start, end);
                        }
                        else if (this.m_lfoTarget === 3) {
                            this.getSamples_W_(trackBuffer, start, end);
                        }
                        else {
                            this.getSamples___(trackBuffer, start, end);
                        }
                    }
                }
                else {
                    if (this.m_inSens >= 0.000001) {
                        if (this.m_osc2Connect === 0) {
                            this.getSamplesF_P(trackBuffer, start, end);
                        }
                        else if (this.m_lfoTarget === 0) {
                            this.getSamplesFPP(trackBuffer, start, end);
                        }
                        else if (this.m_lfoTarget === 3) {
                            this.getSamplesFWP(trackBuffer, start, end);
                        }
                        else if (this.m_lfoTarget === 4) {
                            this.getSamplesFFP(trackBuffer, start, end);
                        }
                        else {
                            this.getSamplesF_P(trackBuffer, start, end);
                        }
                    }
                    else if (this.m_syncMode === 2) {
                        if (this.m_osc2Connect === 0) {
                            this.getSamplesI_P(trackBuffer, start, end);
                        }
                        else if (this.m_lfoTarget === 0) {
                            this.getSamplesIPP(trackBuffer, start, end);
                        }
                        else if (this.m_lfoTarget === 3) {
                            this.getSamplesIWP(trackBuffer, start, end);
                        }
                        else {
                            this.getSamplesI_P(trackBuffer, start, end);
                        }
                    }
                    else if (this.m_syncMode === 1) {
                        if (this.m_osc2Connect === 0) {
                            this.getSamplesO_P(trackBuffer, start, end);
                        }
                        else if (this.m_lfoTarget === 0) {
                            this.getSamplesOPP(trackBuffer, start, end);
                        }
                        else if (this.m_lfoTarget === 3) {
                            this.getSamplesOWP(trackBuffer, start, end);
                        }
                        else {
                            this.getSamplesO_P(trackBuffer, start, end);
                        }
                    }
                    else {
                        if (this.m_osc2Connect === 0) {
                            this.getSamples__P(trackBuffer, start, end);
                        }
                        else if (this.m_lfoTarget === 0) {
                            this.getSamples_PP(trackBuffer, start, end);
                        }
                        else if (this.m_lfoTarget === 3) {
                            this.getSamples_WP(trackBuffer, start, end);
                        }
                        else {
                            this.getSamples__P(trackBuffer, start, end);
                        }
                    }
                }
            }
            if (this.m_oscSet1.getForm() !== flmml.MOscillator.OPM) {
                if (this.m_volMode === 0) {
                    this.m_envelope1.ampSamplesLinear(trackBuffer, start, end, this.m_ampLevel);
                }
                else {
                    this.m_envelope1.ampSamplesNonLinear(trackBuffer, start, end, this.m_ampLevel, this.m_volMode);
                }
            }
            if (this.m_lfoTarget === 1 && this.m_osc2Connect !== 0) {
                depth = this.m_osc2Sign * this.m_lfoDepth / 127.0;
                s = start;
                for (i = start; i < end; i++) {
                    vol = 1.0;
                    if (this.m_onCounter >= this.m_lfoDelay && (this.m_lfoEnd === 0 || this.m_onCounter < this.m_lfoEnd)) {
                        vol += this.m_oscMod2.getNextSample() * depth;
                    }
                    if (vol < 0) {
                        vol = 0;
                    }
                    trackBuffer[i] *= vol;
                    this.m_onCounter++;
                }
            }
            if (playing && (this.m_ringSens >= 0.000001)) {
                pipe = MChannel.s_pipeArr[this.m_ringPipe];
                sens = this.m_ringSens;
                for (i = start; i < end; i++) {
                    trackBuffer[i] *= pipe[i] * sens;
                }
            }
            tmpFlag = playing;
            playing = playing || this.m_formant.checkToSilence();
            if (playing !== tmpFlag) {
                trackBuffer.set(MChannel.emptyBuffer.subarray(0, delta), start);
            }
            if (playing) {
                this.m_formant.run(trackBuffer, start, end);
            }
            tmpFlag = playing;
            playing = playing || this.m_filter.checkToSilence();
            if (playing !== tmpFlag) {
                trackBuffer.set(MChannel.emptyBuffer.subarray(0, delta), start);
            }
            if (playing) {
                if (this.m_lfoTarget === 2 && this.m_osc2Connect !== 0) {
                    depth = this.m_osc2Sign * this.m_lfoDepth;
                    s = start;
                    do {
                        e = s + MChannel.s_lfoDelta;
                        if (e > end)
                            e = end;
                        lpffrq = this.m_lpfFrq;
                        if (this.m_onCounter >= this.m_lfoDelay && (this.m_lfoEnd === 0 || this.m_onCounter < this.m_lfoEnd)) {
                            lpffrq += this.m_oscMod2.getNextSample() * depth | 0;
                            this.m_oscMod2.addPhase(e - s - 1);
                        }
                        if (lpffrq < 0) {
                            lpffrq = 0;
                        }
                        else if (lpffrq > 127.0 * MChannel.PITCH_RESOLUTION) {
                            lpffrq = 127 * MChannel.PITCH_RESOLUTION;
                        }
                        this.m_filter.run(MChannel.s_samples, s, e, this.m_envelope2, lpffrq, this.m_lpfAmt, this.m_lpfRes, key);
                        this.m_onCounter += e - s;
                        s = e;
                    } while (s < end);
                }
                else {
                    this.m_filter.run(trackBuffer, start, end, this.m_envelope2, this.m_lpfFrq, this.m_lpfAmt, this.m_lpfRes, key);
                }
            }
            if (playing) {
                switch (this.m_outMode) {
                    case 0:
                        if (this.m_isMuted)
                            break;
                        var samples0 = samplesSt[0];
                        var samples1 = samplesSt[1];
                        if (this.m_lfoTarget === 5 && this.m_osc2Connect !== 0) {
                            depth = this.m_osc2Sign * this.m_lfoDepth * (1.0 / 127.0);
                            for (i = start; i < end; i++) {
                                pan = this.m_pan + this.m_oscMod2.getNextSample() * depth;
                                if (pan < 0) {
                                    pan = 0.0;
                                }
                                else if (pan > 1.0) {
                                    pan = 1.0;
                                }
                                amplitude = trackBuffer[i] * 0.5;
                                rightAmplitude = amplitude * pan;
                                samples0[i] += amplitude - rightAmplitude;
                                samples1[i] += rightAmplitude;
                            }
                        }
                        else {
                            for (i = start; i < end; i++) {
                                amplitude = trackBuffer[i] * 0.5;
                                rightAmplitude = amplitude * this.m_pan;
                                samples0[i] += amplitude - rightAmplitude;
                                samples1[i] += rightAmplitude;
                            }
                        }
                        break;
                    case 1:
                        pipe = MChannel.s_pipeArr[this.m_outPipe];
                        if (this.m_slaveVoice === false) {
                            if (this.m_isMuted) {
                                pipe.set(MChannel.emptyBuffer.subarray(0, delta), start);
                                break;
                            }
                            for (i = start; i < end; i++) {
                                pipe[i] = trackBuffer[i];
                            }
                        }
                        else {
                            if (this.m_isMuted)
                                break;
                            for (i = start; i < end; i++) {
                                pipe[i] += trackBuffer[i];
                            }
                        }
                        break;
                    case 2:
                        if (this.m_isMuted)
                            break;
                        pipe = MChannel.s_pipeArr[this.m_outPipe];
                        for (i = start; i < end; i++) {
                            pipe[i] += trackBuffer[i];
                        }
                        break;
                }
            }
            else if (this.m_outMode === 1) {
                pipe = MChannel.s_pipeArr[this.m_outPipe];
                if (this.m_slaveVoice === false) {
                    pipe.set(MChannel.emptyBuffer.subarray(0, delta), start);
                }
            }
        };
        MChannel.prototype.getSamples___ = function (samples, start, end) {
            this.m_oscMod1.getSamples(samples, start, end);
        };
        MChannel.prototype.getSamples_P_ = function (samples, start, end) {
            var s = start, e, freqNo, depth = this.m_osc2Sign * this.m_lfoDepth;
            var oscMod1 = this.m_oscMod1;
            var oscMod2 = this.m_oscMod2;
            do {
                e = s + MChannel.s_lfoDelta;
                if (e > end)
                    e = end;
                freqNo = this.m_freqNo;
                if (this.m_onCounter >= this.m_lfoDelay && (this.m_lfoEnd === 0 || this.m_onCounter < this.m_lfoEnd)) {
                    freqNo += (oscMod2.getNextSample() * depth) | 0;
                    oscMod2.addPhase(e - s - 1);
                }
                oscMod1.setFrequency(MChannel.getFrequency(freqNo));
                oscMod1.getSamples(samples, s, e);
                this.m_onCounter += e - s;
                s = e;
            } while (s < end);
        };
        MChannel.prototype.getSamples_W_ = function (samples, start, end) {
            var s = start, e, pwm, depth = this.m_osc2Sign * this.m_lfoDepth * 0.01, modPulse = this.m_oscSet1.getMod(flmml.MOscillator.PULSE);
            var oscMod1 = this.m_oscMod1;
            var oscMod2 = this.m_oscMod2;
            do {
                e = s + MChannel.s_lfoDelta;
                if (e > end)
                    e = end;
                pwm = this.m_pulseWidth;
                if (this.m_onCounter >= this.m_lfoDelay && (this.m_lfoEnd === 0 || this.m_onCounter < this.m_lfoEnd)) {
                    pwm += oscMod2.getNextSample() * depth;
                    oscMod2.addPhase(e - s - 1);
                }
                if (pwm < 0) {
                    pwm = 0;
                }
                else if (pwm > 100.0) {
                    pwm = 100.0;
                }
                modPulse.setPWM(pwm);
                oscMod1.getSamples(samples, s, e);
                this.m_onCounter += e - s;
                s = e;
            } while (s < end);
        };
        MChannel.prototype.getSamplesF__ = function (samples, start, end) {
            var i, sens = this.m_inSens, pipe = MChannel.s_pipeArr[this.m_inPipe];
            var oscMod1 = this.m_oscMod1;
            oscMod1.setFrequency(MChannel.getFrequency(this.m_freqNo));
            for (i = start; i < end; i++) {
                samples[i] = oscMod1.getNextSampleOfs(pipe[i] * sens);
            }
        };
        MChannel.prototype.getSamplesFP_ = function (samples, start, end) {
            var i, freqNo, sens = this.m_inSens, depth = this.m_osc2Sign * this.m_lfoDepth, pipe = MChannel.s_pipeArr[this.m_inPipe];
            var oscMod1 = this.m_oscMod1;
            var oscMod2 = this.m_oscMod2;
            for (i = start; i < end; i++) {
                freqNo = this.m_freqNo;
                if (this.m_onCounter >= this.m_lfoDelay && (this.m_lfoEnd === 0 || this.m_onCounter < this.m_lfoEnd)) {
                    freqNo += (oscMod2.getNextSample() * depth) | 0;
                }
                oscMod1.setFrequency(MChannel.getFrequency(freqNo));
                samples[i] = oscMod1.getNextSampleOfs(pipe[i] * sens);
                this.m_onCounter++;
            }
        };
        MChannel.prototype.getSamplesFW_ = function (samples, start, end) {
            var i, pwm, depth = this.m_osc2Sign * this.m_lfoDepth * 0.01, modPulse = this.m_oscSet1.getMod(flmml.MOscillator.PULSE), sens = this.m_inSens, pipe = MChannel.s_pipeArr[this.m_inPipe];
            var oscMod1 = this.m_oscMod1;
            var oscMod2 = this.m_oscMod2;
            oscMod1.setFrequency(MChannel.getFrequency(this.m_freqNo));
            for (i = start; i < end; i++) {
                pwm = this.m_pulseWidth;
                if (this.m_onCounter >= this.m_lfoDelay && (this.m_lfoEnd === 0 || this.m_onCounter < this.m_lfoEnd)) {
                    pwm += oscMod2.getNextSample() * depth;
                }
                if (pwm < 0) {
                    pwm = 0;
                }
                else if (pwm > 100.0) {
                    pwm = 100.0;
                }
                modPulse.setPWM(pwm);
                samples[i] = oscMod1.getNextSampleOfs(pipe[i] * sens);
                this.m_onCounter++;
            }
        };
        MChannel.prototype.getSamplesFF_ = function (samples, start, end) {
            var i, freqNo, sens, depth = this.m_osc2Sign * this.m_lfoDepth * (1.0 / 127.0), pipe = MChannel.s_pipeArr[this.m_inPipe];
            var oscMod1 = this.m_oscMod1;
            var oscMod2 = this.m_oscMod2;
            oscMod1.setFrequency(MChannel.getFrequency(this.m_freqNo));
            for (i = start; i < end; i++) {
                sens = this.m_inSens;
                if (this.m_onCounter >= this.m_lfoDelay && (this.m_lfoEnd === 0 || this.m_onCounter < this.m_lfoEnd)) {
                    sens *= oscMod2.getNextSample() * depth;
                }
                samples[i] = oscMod1.getNextSampleOfs(pipe[i] * sens);
                this.m_onCounter++;
            }
        };
        MChannel.prototype.getSamplesI__ = function (samples, start, end) {
            this.m_oscMod1.getSamplesWithSyncIn(samples, MChannel.s_syncSources[this.m_syncPipe], start, end);
        };
        MChannel.prototype.getSamplesIP_ = function (samples, start, end) {
            var s = start, e, freqNo, depth = this.m_osc2Sign * this.m_lfoDepth, syncLine = MChannel.s_syncSources[this.m_syncPipe];
            var oscMod1 = this.m_oscMod1;
            var oscMod2 = this.m_oscMod2;
            do {
                e = s + MChannel.s_lfoDelta;
                if (e > end)
                    e = end;
                freqNo = this.m_freqNo;
                if (this.m_onCounter >= this.m_lfoDelay && (this.m_lfoEnd === 0 || this.m_onCounter < this.m_lfoEnd)) {
                    freqNo += (oscMod2.getNextSample() * depth) | 0;
                    oscMod2.addPhase(e - s - 1);
                }
                oscMod1.setFrequency(MChannel.getFrequency(freqNo));
                oscMod1.getSamplesWithSyncIn(samples, syncLine, s, e);
                this.m_onCounter += e - s;
                s = e;
            } while (s < end);
        };
        MChannel.prototype.getSamplesIW_ = function (samples, start, end) {
            var s = start, e, pwm, depth = this.m_osc2Sign * this.m_lfoDepth * 0.01, modPulse = this.m_oscSet1.getMod(flmml.MOscillator.PULSE), syncLine = MChannel.s_syncSources[this.m_syncPipe];
            var oscMod1 = this.m_oscMod1;
            var oscMod2 = this.m_oscMod2;
            do {
                e = s + MChannel.s_lfoDelta;
                if (e > end)
                    e = end;
                pwm = this.m_pulseWidth;
                if (this.m_onCounter >= this.m_lfoDelay && (this.m_lfoEnd === 0 || this.m_onCounter < this.m_lfoEnd)) {
                    pwm += oscMod2.getNextSample() * depth;
                    oscMod2.addPhase(e - s - 1);
                }
                if (pwm < 0) {
                    pwm = 0;
                }
                else if (pwm > 100.0) {
                    pwm = 100.0;
                }
                modPulse.setPWM(pwm);
                oscMod1.getSamplesWithSyncIn(samples, syncLine, s, e);
                this.m_onCounter += e - s;
                s = e;
            } while (s < end);
        };
        MChannel.prototype.getSamplesO__ = function (samples, start, end) {
            this.m_oscMod1.getSamplesWithSyncOut(samples, MChannel.s_syncSources[this.m_syncPipe], start, end);
        };
        MChannel.prototype.getSamplesOP_ = function (samples, start, end) {
            var s = start, e, freqNo, depth = this.m_osc2Sign * this.m_lfoDepth, syncLine = MChannel.s_syncSources[this.m_syncPipe];
            var oscMod1 = this.m_oscMod1;
            var oscMod2 = this.m_oscMod2;
            do {
                e = s + MChannel.s_lfoDelta;
                if (e > end)
                    e = end;
                freqNo = this.m_freqNo;
                if (this.m_onCounter >= this.m_lfoDelay && (this.m_lfoEnd === 0 || this.m_onCounter < this.m_lfoEnd)) {
                    freqNo += (oscMod2.getNextSample() * depth) | 0;
                    oscMod2.addPhase(e - s - 1);
                }
                oscMod1.setFrequency(MChannel.getFrequency(freqNo));
                oscMod1.getSamplesWithSyncOut(samples, syncLine, s, e);
                this.m_onCounter += e - s;
                s = e;
            } while (s < end);
        };
        MChannel.prototype.getSamplesOW_ = function (samples, start, end) {
            var s = start, e, pwm, depth = this.m_osc2Sign * this.m_lfoDepth * 0.01, modPulse = this.m_oscSet1.getMod(flmml.MOscillator.PULSE), syncLine = MChannel.s_syncSources[this.m_syncPipe];
            var oscMod1 = this.m_oscMod1;
            var oscMod2 = this.m_oscMod2;
            do {
                e = s + MChannel.s_lfoDelta;
                if (e > end)
                    e = end;
                pwm = this.m_pulseWidth;
                if (this.m_onCounter >= this.m_lfoDelay && (this.m_lfoEnd === 0 || this.m_onCounter < this.m_lfoEnd)) {
                    pwm += oscMod2.getNextSample() * depth;
                    oscMod2.addPhase(e - s - 1);
                }
                if (pwm < 0) {
                    pwm = 0;
                }
                else if (pwm > 100.0) {
                    pwm = 100.0;
                }
                modPulse.setPWM(pwm);
                oscMod1.getSamplesWithSyncOut(samples, syncLine, s, e);
                this.m_onCounter += e - s;
                s = e;
            } while (s < end);
        };
        MChannel.prototype.getSamples__P = function (samples, start, end) {
            var s = start, e, freqNo;
            var oscMod1 = this.m_oscMod1;
            do {
                e = s + MChannel.s_lfoDelta;
                if (e > end)
                    e = end;
                freqNo = this.m_freqNo;
                if (this.m_portDepth !== 0) {
                    freqNo += this.m_portDepth | 0;
                    this.m_portDepth += (this.m_portDepthAdd * (e - s - 1));
                    if (this.m_portDepth * this.m_portDepthAdd > 0)
                        this.m_portDepth = 0;
                }
                oscMod1.setFrequency(MChannel.getFrequency(freqNo));
                oscMod1.getSamples(samples, s, e);
                s = e;
            } while (s < end);
            if (this.m_portDepth === 0) {
                oscMod1.setFrequency(MChannel.getFrequency(this.m_freqNo));
            }
        };
        MChannel.prototype.getSamples_PP = function (samples, start, end) {
            var s = start, e, freqNo, depth = this.m_osc2Sign * this.m_lfoDepth;
            var oscMod1 = this.m_oscMod1;
            var oscMod2 = this.m_oscMod2;
            do {
                e = s + MChannel.s_lfoDelta;
                if (e > end)
                    e = end;
                freqNo = this.m_freqNo;
                if (this.m_portDepth !== 0) {
                    freqNo += this.m_portDepth | 0;
                    this.m_portDepth += (this.m_portDepthAdd * (e - s - 1));
                    if (this.m_portDepth * this.m_portDepthAdd > 0)
                        this.m_portDepth = 0;
                }
                if (this.m_onCounter >= this.m_lfoDelay && (this.m_lfoEnd === 0 || this.m_onCounter < this.m_lfoEnd)) {
                    freqNo += oscMod2.getNextSample() * depth;
                    oscMod2.addPhase(e - s - 1);
                    if (this.m_portDepth * this.m_portDepthAdd > 0)
                        this.m_portDepth = 0;
                }
                oscMod1.setFrequency(MChannel.getFrequency(freqNo));
                oscMod1.getSamples(samples, s, e);
                this.m_onCounter += e - s;
                s = e;
            } while (s < end);
        };
        MChannel.prototype.getSamples_WP = function (samples, start, end) {
            var s = start, e, pwm, depth = this.m_osc2Sign * this.m_lfoDepth * 0.01, freqNo, modPulse = this.m_oscSet1.getMod(flmml.MOscillator.PULSE);
            var oscMod1 = this.m_oscMod1;
            var oscMod2 = this.m_oscMod2;
            do {
                e = s + MChannel.s_lfoDelta;
                if (e > end)
                    e = end;
                freqNo = this.m_freqNo;
                if (this.m_portDepth !== 0) {
                    freqNo += this.m_portDepth | 0;
                    this.m_portDepth += (this.m_portDepthAdd * (e - s - 1));
                    if (this.m_portDepth * this.m_portDepthAdd > 0)
                        this.m_portDepth = 0;
                }
                oscMod1.setFrequency(MChannel.getFrequency(freqNo));
                pwm = this.m_pulseWidth;
                if (this.m_onCounter >= this.m_lfoDelay && (this.m_lfoEnd === 0 || this.m_onCounter < this.m_lfoEnd)) {
                    pwm += oscMod2.getNextSample() * depth;
                    oscMod2.addPhase(e - s - 1);
                }
                if (pwm < 0) {
                    pwm = 0;
                }
                else if (pwm > 100.0) {
                    pwm = 100.0;
                }
                modPulse.setPWM(pwm);
                oscMod1.getSamples(samples, s, e);
                this.m_onCounter += e - s;
                s = e;
            } while (s < end);
            if (this.m_portDepth === 0) {
                oscMod1.setFrequency(MChannel.getFrequency(this.m_freqNo));
            }
        };
        MChannel.prototype.getSamplesF_P = function (samples, start, end) {
            var freqNo, i, sens = this.m_inSens, pipe = MChannel.s_pipeArr[this.m_inPipe];
            var oscMod1 = this.m_oscMod1;
            for (i = start; i < end; i++) {
                freqNo = this.m_freqNo;
                if (this.m_portDepth !== 0) {
                    freqNo += this.m_portDepth | 0;
                    this.m_portDepth += this.m_portDepthAdd;
                    if (this.m_portDepth * this.m_portDepthAdd > 0)
                        this.m_portDepth = 0;
                }
                oscMod1.setFrequency(MChannel.getFrequency(freqNo));
                samples[i] = oscMod1.getNextSampleOfs(pipe[i] * sens);
            }
        };
        MChannel.prototype.getSamplesFPP = function (samples, start, end) {
            var i, freqNo, sens = this.m_inSens, depth = this.m_osc2Sign * this.m_lfoDepth, pipe = MChannel.s_pipeArr[this.m_inPipe];
            var oscMod1 = this.m_oscMod1;
            var oscMod2 = this.m_oscMod2;
            for (i = start; i < end; i++) {
                freqNo = this.m_freqNo;
                if (this.m_portDepth !== 0) {
                    freqNo += this.m_portDepth | 0;
                    this.m_portDepth += this.m_portDepthAdd;
                    if (this.m_portDepth * this.m_portDepthAdd > 0)
                        this.m_portDepth = 0;
                }
                if (this.m_onCounter >= this.m_lfoDelay && (this.m_lfoEnd === 0 || this.m_onCounter < this.m_lfoEnd)) {
                    freqNo += oscMod2.getNextSample() * depth | 0;
                }
                oscMod1.setFrequency(MChannel.getFrequency(freqNo));
                samples[i] = oscMod1.getNextSampleOfs(pipe[i] * sens);
                this.m_onCounter++;
            }
        };
        MChannel.prototype.getSamplesFWP = function (samples, start, end) {
            var i, freqNo, pwm, depth = this.m_osc2Sign * this.m_lfoDepth * 0.01, modPulse = this.m_oscSet1.getMod(flmml.MOscillator.PULSE), sens = this.m_inSens, pipe = MChannel.s_pipeArr[this.m_inPipe];
            var oscMod1 = this.m_oscMod1;
            var oscMod2 = this.m_oscMod2;
            for (i = start; i < end; i++) {
                freqNo = this.m_freqNo;
                if (this.m_portDepth !== 0) {
                    freqNo += this.m_portDepth | 0;
                    this.m_portDepth += this.m_portDepthAdd;
                    if (this.m_portDepth * this.m_portDepthAdd > 0)
                        this.m_portDepth = 0;
                }
                oscMod1.setFrequency(MChannel.getFrequency(freqNo));
                pwm = this.m_pulseWidth;
                if (this.m_onCounter >= this.m_lfoDelay && (this.m_lfoEnd === 0 || this.m_onCounter < this.m_lfoEnd)) {
                    pwm += oscMod2.getNextSample() * depth;
                }
                if (pwm < 0) {
                    pwm = 0;
                }
                else if (pwm > 100.0) {
                    pwm = 100.0;
                }
                modPulse.setPWM(pwm);
                samples[i] = oscMod1.getNextSampleOfs(pipe[i] * sens);
                this.m_onCounter++;
            }
        };
        MChannel.prototype.getSamplesFFP = function (samples, start, end) {
            var i, freqNo, sens, depth = this.m_osc2Sign * this.m_lfoDepth * (1.0 / 127.0), pipe = MChannel.s_pipeArr[this.m_inPipe];
            var oscMod1 = this.m_oscMod1;
            var oscMod2 = this.m_oscMod2;
            for (i = start; i < end; i++) {
                freqNo = this.m_freqNo;
                if (this.m_portDepth !== 0) {
                    freqNo += this.m_portDepth | 0;
                    this.m_portDepth += this.m_portDepthAdd;
                    if (this.m_portDepth * this.m_portDepthAdd > 0)
                        this.m_portDepth = 0;
                }
                oscMod1.setFrequency(MChannel.getFrequency(freqNo));
                sens = this.m_inSens;
                if (this.m_onCounter >= this.m_lfoDelay && (this.m_lfoEnd === 0 || this.m_onCounter < this.m_lfoEnd)) {
                    sens *= oscMod2.getNextSample() * depth;
                }
                samples[i] = oscMod1.getNextSampleOfs(pipe[i] * sens);
                this.m_onCounter++;
            }
        };
        MChannel.prototype.getSamplesI_P = function (samples, start, end) {
            var s = start, e, freqNo, syncLine = MChannel.s_syncSources[this.m_syncPipe];
            var oscMod1 = this.m_oscMod1;
            do {
                e = s + MChannel.s_lfoDelta;
                if (e > end)
                    e = end;
                freqNo = this.m_freqNo;
                if (this.m_portDepth !== 0) {
                    freqNo += this.m_portDepth | 0;
                    this.m_portDepth += (this.m_portDepthAdd * (e - s - 1));
                    if (this.m_portDepth * this.m_portDepthAdd > 0)
                        this.m_portDepth = 0;
                }
                oscMod1.setFrequency(MChannel.getFrequency(freqNo));
                oscMod1.getSamplesWithSyncIn(samples, syncLine, s, e);
                this.m_onCounter += e - s;
                s = e;
            } while (s < end);
            if (this.m_portDepth === 0) {
                oscMod1.setFrequency(MChannel.getFrequency(this.m_freqNo));
            }
        };
        MChannel.prototype.getSamplesIPP = function (samples, start, end) {
            var s = start, e, freqNo, depth = this.m_osc2Sign * this.m_lfoDepth, syncLine = MChannel.s_syncSources[this.m_syncPipe];
            var oscMod1 = this.m_oscMod1;
            var oscMod2 = this.m_oscMod2;
            do {
                e = s + MChannel.s_lfoDelta;
                if (e > end)
                    e = end;
                freqNo = this.m_freqNo;
                if (this.m_portDepth !== 0) {
                    freqNo += this.m_portDepth | 0;
                    this.m_portDepth += (this.m_portDepthAdd * (e - s - 1));
                    if (this.m_portDepth * this.m_portDepthAdd > 0)
                        this.m_portDepth = 0;
                }
                if (this.m_onCounter >= this.m_lfoDelay && (this.m_lfoEnd === 0 || this.m_onCounter < this.m_lfoEnd)) {
                    freqNo += oscMod2.getNextSample() * depth | 0;
                    oscMod2.addPhase(e - s - 1);
                }
                oscMod1.setFrequency(MChannel.getFrequency(freqNo));
                oscMod1.getSamplesWithSyncIn(samples, syncLine, s, e);
                this.m_onCounter += e - s;
                s = e;
            } while (s < end);
        };
        MChannel.prototype.getSamplesIWP = function (samples, start, end) {
            var s = start, e, freqNo, pwm, depth = this.m_osc2Sign * this.m_lfoDepth * 0.01, modPulse = this.m_oscSet1.getMod(flmml.MOscillator.PULSE), syncLine = MChannel.s_syncSources[this.m_syncPipe];
            var oscMod1 = this.m_oscMod1;
            var oscMod2 = this.m_oscMod2;
            do {
                e = s + MChannel.s_lfoDelta;
                if (e > end)
                    e = end;
                freqNo = this.m_freqNo;
                if (this.m_portDepth !== 0) {
                    freqNo += this.m_portDepth | 0;
                    this.m_portDepth += (this.m_portDepthAdd * (e - s - 1));
                    if (this.m_portDepth * this.m_portDepthAdd > 0)
                        this.m_portDepth = 0;
                }
                oscMod1.setFrequency(MChannel.getFrequency(freqNo));
                pwm = this.m_pulseWidth;
                if (this.m_onCounter >= this.m_lfoDelay && (this.m_lfoEnd === 0 || this.m_onCounter < this.m_lfoEnd)) {
                    pwm += oscMod2.getNextSample() * depth;
                    oscMod2.addPhase(e - s - 1);
                }
                if (pwm < 0) {
                    pwm = 0;
                }
                else if (pwm > 100.0) {
                    pwm = 100.0;
                }
                modPulse.setPWM(pwm);
                oscMod1.getSamplesWithSyncIn(samples, syncLine, s, e);
                this.m_onCounter += e - s;
                s = e;
            } while (s < end);
            if (this.m_portDepth === 0) {
                oscMod1.setFrequency(MChannel.getFrequency(this.m_freqNo));
            }
        };
        MChannel.prototype.getSamplesO_P = function (samples, start, end) {
            var s = start, e, freqNo, syncLine = MChannel.s_syncSources[this.m_syncPipe];
            var oscMod1 = this.m_oscMod1;
            do {
                e = s + MChannel.s_lfoDelta;
                if (e > end)
                    e = end;
                freqNo = this.m_freqNo;
                if (this.m_portDepth !== 0) {
                    freqNo += this.m_portDepth | 0;
                    this.m_portDepth += (this.m_portDepthAdd * (e - s - 1));
                    if (this.m_portDepth * this.m_portDepthAdd > 0)
                        this.m_portDepth = 0;
                }
                oscMod1.setFrequency(MChannel.getFrequency(freqNo));
                oscMod1.getSamplesWithSyncOut(samples, syncLine, s, e);
                this.m_onCounter += e - s;
                s = e;
            } while (s < end);
            if (this.m_portDepth === 0) {
                oscMod1.setFrequency(MChannel.getFrequency(this.m_freqNo));
            }
        };
        MChannel.prototype.getSamplesOPP = function (samples, start, end) {
            var s = start, e, freqNo, depth = this.m_osc2Sign * this.m_lfoDepth, syncLine = MChannel.s_syncSources[this.m_syncPipe];
            var oscMod1 = this.m_oscMod1;
            var oscMod2 = this.m_oscMod2;
            do {
                e = s + MChannel.s_lfoDelta;
                if (e > end)
                    e = end;
                freqNo = this.m_freqNo;
                if (this.m_portDepth !== 0) {
                    freqNo += this.m_portDepth | 0;
                    this.m_portDepth += (this.m_portDepthAdd * (e - s - 1));
                    if (this.m_portDepth * this.m_portDepthAdd > 0)
                        this.m_portDepth = 0;
                }
                if (this.m_onCounter >= this.m_lfoDelay && (this.m_lfoEnd === 0 || this.m_onCounter < this.m_lfoEnd)) {
                    freqNo += oscMod2.getNextSample() * depth | 0;
                    oscMod2.addPhase(e - s - 1);
                }
                oscMod1.setFrequency(MChannel.getFrequency(freqNo));
                oscMod1.getSamplesWithSyncOut(samples, syncLine, s, e);
                this.m_onCounter += e - s;
                s = e;
            } while (s < end);
        };
        MChannel.prototype.getSamplesOWP = function (samples, start, end) {
            var s = start, e, freqNo, pwm, depth = this.m_osc2Sign * this.m_lfoDepth * 0.01, modPulse = this.m_oscSet1.getMod(flmml.MOscillator.PULSE), syncLine = MChannel.s_syncSources[this.m_syncPipe];
            var oscMod1 = this.m_oscMod1;
            var oscMod2 = this.m_oscMod2;
            do {
                e = s + MChannel.s_lfoDelta;
                if (e > end)
                    e = end;
                freqNo = this.m_freqNo;
                if (this.m_portDepth !== 0) {
                    freqNo += this.m_portDepth | 0;
                    this.m_portDepth += (this.m_portDepthAdd * (e - s - 1));
                    if (this.m_portDepth * this.m_portDepthAdd > 0)
                        this.m_portDepth = 0;
                }
                oscMod1.setFrequency(MChannel.getFrequency(freqNo));
                pwm = this.m_pulseWidth;
                if (this.m_onCounter >= this.m_lfoDelay && (this.m_lfoEnd === 0 || this.m_onCounter < this.m_lfoEnd)) {
                    pwm += oscMod2.getNextSample() * depth;
                    oscMod2.addPhase(e - s - 1);
                }
                if (pwm < 0) {
                    pwm = 0;
                }
                else if (pwm > 100.0) {
                    pwm = 100.0;
                }
                modPulse.setPWM(pwm);
                oscMod1.getSamplesWithSyncOut(samples, syncLine, s, e);
                this.m_onCounter += e - s;
                s = e;
            } while (s < end);
            if (this.m_portDepth === 0) {
                oscMod1.setFrequency(MChannel.getFrequency(this.m_freqNo));
            }
        };
        MChannel.PITCH_RESOLUTION = 100;
        MChannel.s_init = 0;
        MChannel.s_frequencyMap = new Array(128 * MChannel.PITCH_RESOLUTION);
        MChannel.s_lfoDelta = 245;
        return MChannel;
    })();
    flmml.MChannel = MChannel;
})(flmml || (flmml = {}));


var flmml;
(function (flmml) {
    var MPolyChannel = (function () {
        function MPolyChannel(voiceLimit) {
            this.m_voices = new Array(voiceLimit);
            for (var i = 0; i < this.m_voices.length; i++) {
                this.m_voices[i] = new flmml.MChannel();
            }
            this.m_form = flmml.MOscillator.FC_PULSE;
            this.m_subform = 0;
            this.m_voiceId = 0;
            this.m_volMode = 0;
            this.m_voiceLimit = voiceLimit;
            this.m_lastVoice = null;
            this.m_voiceLen = this.m_voices.length;
        }
        MPolyChannel.prototype.mute = function (f) {
            for (var i = 0; i < this.m_voiceLen; i++)
                this.m_voices[i].mute(f);
        };
        MPolyChannel.prototype.isMuted = function () {
            return this.m_voiceLen == 0 || this.m_voices[0].isMuted();
        };
        MPolyChannel.prototype.setExpression = function (ex) {
            for (var i = 0; i < this.m_voiceLen; i++)
                this.m_voices[i].setExpression(ex);
        };
        MPolyChannel.prototype.setVelocity = function (velocity) {
            for (var i = 0; i < this.m_voiceLen; i++)
                this.m_voices[i].setVelocity(velocity);
        };
        MPolyChannel.prototype.setNoteNo = function (noteNo, tie) {
            if (tie === void 0) { tie = true; }
            if (this.m_lastVoice !== null && this.m_lastVoice.isPlaying()) {
                this.m_lastVoice.setNoteNo(noteNo, tie);
            }
        };
        MPolyChannel.prototype.setDetune = function (detune) {
            for (var i = 0; i < this.m_voiceLen; i++)
                this.m_voices[i].setDetune(detune);
        };
        MPolyChannel.prototype.getVoiceCount = function () {
            var i;
            var c = 0;
            for (i = 0; i < this.m_voiceLen; i++) {
                c += this.m_voices[i].getVoiceCount();
            }
            return c;
        };
        MPolyChannel.prototype.noteOn = function (noteNo, velocity) {
            var i;
            var vo = null;
            if (this.getVoiceCount() <= this.m_voiceLimit) {
                for (i = 0; i < this.m_voiceLen; i++) {
                    if (this.m_voices[i].isPlaying() === false) {
                        vo = this.m_voices[i];
                        break;
                    }
                }
            }
            if (vo == null) {
                var minId = Number.MAX_VALUE;
                for (i = 0; i < this.m_voiceLen; i++) {
                    if (minId > this.m_voices[i].getId()) {
                        minId = this.m_voices[i].getId();
                        vo = this.m_voices[i];
                    }
                }
            }
            vo.setForm(this.m_form, this.m_subform);
            vo.setVolMode(this.m_volMode);
            vo.noteOnWidthId(noteNo, velocity, this.m_voiceId++);
            this.m_lastVoice = vo;
        };
        MPolyChannel.prototype.noteOff = function (noteNo) {
            for (var i = 0; i < this.m_voiceLen; i++) {
                if (this.m_voices[i].getNoteNo() === noteNo) {
                    this.m_voices[i].noteOff(noteNo);
                }
            }
        };
        MPolyChannel.prototype.setSoundOff = function () {
            for (var i = 0; i < this.m_voiceLen; i++)
                this.m_voices[i].setSoundOff();
        };
        MPolyChannel.prototype.close = function () {
            for (var i = 0; i < this.m_voiceLen; i++)
                this.m_voices[i].close();
        };
        MPolyChannel.prototype.setNoiseFreq = function (frequency) {
            for (var i = 0; i < this.m_voiceLen; i++)
                this.m_voices[i].setNoiseFreq(frequency);
        };
        MPolyChannel.prototype.setForm = function (form, subform) {
            this.m_form = form;
            this.m_subform = subform;
        };
        MPolyChannel.prototype.setEnvelope1Atk = function (attack) {
            for (var i = 0; i < this.m_voiceLen; i++)
                this.m_voices[i].setEnvelope1Atk(attack);
        };
        MPolyChannel.prototype.setEnvelope1Point = function (time, level) {
            for (var i = 0; i < this.m_voiceLen; i++)
                this.m_voices[i].setEnvelope1Point(time, level);
        };
        MPolyChannel.prototype.setEnvelope1Rel = function (release) {
            for (var i = 0; i < this.m_voiceLen; i++)
                this.m_voices[i].setEnvelope1Rel(release);
        };
        MPolyChannel.prototype.setEnvelope2Atk = function (attack) {
            for (var i = 0; i < this.m_voiceLen; i++)
                this.m_voices[i].setEnvelope2Atk(attack);
        };
        MPolyChannel.prototype.setEnvelope2Point = function (time, level) {
            for (var i = 0; i < this.m_voiceLen; i++)
                this.m_voices[i].setEnvelope2Point(time, level);
        };
        MPolyChannel.prototype.setEnvelope2Rel = function (release) {
            for (var i = 0; i < this.m_voiceLen; i++)
                this.m_voices[i].setEnvelope2Rel(release);
        };
        MPolyChannel.prototype.setPWM = function (pwm) {
            for (var i = 0; i < this.m_voiceLen; i++)
                this.m_voices[i].setPWM(pwm);
        };
        MPolyChannel.prototype.setPan = function (pan) {
            for (var i = 0; i < this.m_voiceLen; i++)
                this.m_voices[i].setPan(pan);
        };
        MPolyChannel.prototype.setFormant = function (vowel) {
            for (var i = 0; i < this.m_voiceLen; i++)
                this.m_voices[i].setFormant(vowel);
        };
        MPolyChannel.prototype.setLFOFMSF = function (form, subform) {
            for (var i = 0; i < this.m_voiceLen; i++)
                this.m_voices[i].setLFOFMSF(form, subform);
        };
        MPolyChannel.prototype.setLFODPWD = function (depth, freq) {
            for (var i = 0; i < this.m_voiceLen; i++)
                this.m_voices[i].setLFODPWD(depth, freq);
        };
        MPolyChannel.prototype.setLFODLTM = function (delay, time) {
            for (var i = 0; i < this.m_voiceLen; i++)
                this.m_voices[i].setLFODLTM(delay, time);
        };
        MPolyChannel.prototype.setLFOTarget = function (target) {
            for (var i = 0; i < this.m_voiceLen; i++)
                this.m_voices[i].setLFOTarget(target);
        };
        MPolyChannel.prototype.setLpfSwtAmt = function (swt, amt) {
            for (var i = 0; i < this.m_voiceLen; i++)
                this.m_voices[i].setLpfSwtAmt(swt, amt);
        };
        MPolyChannel.prototype.setLpfFrqRes = function (frq, res) {
            for (var i = 0; i < this.m_voiceLen; i++)
                this.m_voices[i].setLpfFrqRes(frq, res);
        };
        MPolyChannel.prototype.setVolMode = function (m) {
            this.m_volMode = m;
        };
        MPolyChannel.prototype.setInput = function (ii, p) {
            for (var i = 0; i < this.m_voiceLen; i++)
                this.m_voices[i].setInput(ii, p);
        };
        MPolyChannel.prototype.setOutput = function (oo, p) {
            for (var i = 0; i < this.m_voiceLen; i++)
                this.m_voices[i].setOutput(oo, p);
        };
        MPolyChannel.prototype.setRing = function (s, p) {
            for (var i = 0; i < this.m_voiceLen; i++)
                this.m_voices[i].setRing(s, p);
        };
        MPolyChannel.prototype.setSync = function (m, p) {
            for (var i = 0; i < this.m_voiceLen; i++)
                this.m_voices[i].setSync(m, p);
        };
        MPolyChannel.prototype.setPortamento = function (depth, len) {
            for (var i = 0; i < this.m_voiceLen; i++)
                this.m_voices[i].setPortamento(depth, len);
        };
        MPolyChannel.prototype.setMidiPort = function (mode) {
            for (var i = 0; i < this.m_voiceLen; i++)
                this.m_voices[i].setMidiPort(mode);
        };
        MPolyChannel.prototype.setMidiPortRate = function (rate) {
            for (var i = 0; i < this.m_voiceLen; i++)
                this.m_voices[i].setMidiPortRate(rate);
        };
        MPolyChannel.prototype.setPortBase = function (portBase) {
            for (var i = 0; i < this.m_voiceLen; i++)
                this.m_voices[i].setPortBase(portBase);
        };
        MPolyChannel.prototype.setVoiceLimit = function (voiceLimit) {
            this.m_voiceLimit = Math.max(1, Math.min(voiceLimit, this.m_voiceLen));
        };
        MPolyChannel.prototype.setHwLfo = function (data) {
            for (var i = 0; i < this.m_voiceLen; i++)
                this.m_voices[i].setHwLfo(data);
        };
        MPolyChannel.prototype.reset = function () {
            this.m_form = 0;
            this.m_subform = 0;
            this.m_voiceId = 0;
            this.m_volMode = 0;
            for (var i = 0; i < this.m_voiceLen; i++)
                this.m_voices[i].reset();
        };
        MPolyChannel.prototype.getSamples = function (samplesSt, max, start, delta) {
            var slave = false;
            for (var i = 0; i < this.m_voiceLen; i++) {
                if (this.m_voices[i].isPlaying()) {
                    this.m_voices[i].setSlaveVoice(slave);
                    this.m_voices[i].getSamples(samplesSt, max, start, delta);
                    slave = true;
                }
            }
            if (slave === false) {
                this.m_voices[0].clearOutPipe(max, start, delta);
            }
        };
        return MPolyChannel;
    })();
    flmml.MPolyChannel = MPolyChannel;
})(flmml || (flmml = {}));


var flmml;
(function (flmml) {
    var MEvent = (function () {
        function MEvent(tick, trace) {
            if (trace === void 0) { trace = null; }
            this.TEMPO_SCALE = 100;
            this.set(1, 0, 0);
            this.setTick(tick);
            this.m_trace = trace;
            this.m_id = ++MEvent.idCounter;
            MEvent.instances[this.m_id] = this;
        }
        MEvent.resetCounter = function () {
            MEvent.idCounter = 0;
            MEvent.instances = [null];
        };
        MEvent.getById = function (id) {
            return MEvent.instances[id];
        };
        MEvent.prototype.set = function (status, data0, data1) {
            this.m_status = status;
            this.m_data0 = data0;
            this.m_data1 = data1;
        };
        MEvent.prototype.setEOT = function () { this.set(0, 0, 0); };
        MEvent.prototype.setNoteOn = function (noteNo, vel) { this.set(2, noteNo, vel); };
        MEvent.prototype.setNoteOff = function (noteNo, vel) { this.set(3, noteNo, vel); };
        MEvent.prototype.setTempo = function (tempo) { this.set(4, tempo * this.TEMPO_SCALE, 0); };
        MEvent.prototype.setVolume = function (vol) { this.set(5, vol, 0); };
        MEvent.prototype.setNote = function (noteNo) { this.set(6, noteNo, 0); };
        MEvent.prototype.setForm = function (form, sub) { this.set(7, form, sub); };
        MEvent.prototype.setEnvelope1Atk = function (a) { this.set(8, a, 0); };
        MEvent.prototype.setEnvelope1Point = function (t, l) { this.set(9, t, l); };
        MEvent.prototype.setEnvelope1Rel = function (r) { this.set(10, r, 0); };
        MEvent.prototype.setEnvelope2Atk = function (a) { this.set(24, a, 0); };
        MEvent.prototype.setEnvelope2Point = function (t, l) { this.set(25, t, l); };
        MEvent.prototype.setEnvelope2Rel = function (r) { this.set(26, r, 0); };
        MEvent.prototype.setNoiseFreq = function (f) { this.set(11, f, 0); };
        MEvent.prototype.setPWM = function (w) { this.set(12, w, 0); };
        MEvent.prototype.setPan = function (p) { this.set(13, p, 0); };
        MEvent.prototype.setFormant = function (vowel) { this.set(14, vowel, 0); };
        MEvent.prototype.setDetune = function (d) { this.set(15, d, 0); };
        MEvent.prototype.setLFOFMSF = function (fm, sf) { this.set(16, fm, sf); };
        MEvent.prototype.setLFODPWD = function (dp, wd) { this.set(17, dp, wd); };
        MEvent.prototype.setLFODLTM = function (dl, tm) { this.set(18, dl, tm); };
        MEvent.prototype.setLFOTarget = function (target) { this.set(19, target, 0); };
        MEvent.prototype.setLPFSWTAMT = function (swt, amt) { this.set(20, swt, amt); };
        MEvent.prototype.setLPFFRQRES = function (frq, res) { this.set(21, frq, res); };
        MEvent.prototype.setClose = function () { this.set(22, 0, 0); };
        MEvent.prototype.setVolMode = function (m) { this.set(23, m, 0); };
        MEvent.prototype.setInput = function (sens, pipe) { this.set(27, sens, pipe); };
        MEvent.prototype.setOutput = function (mode, pipe) { this.set(28, mode, pipe); };
        MEvent.prototype.setExpression = function (ex) { this.set(29, ex, 0); };
        MEvent.prototype.setRing = function (sens, pipe) { this.set(30, sens, pipe); };
        MEvent.prototype.setSync = function (mode, pipe) { this.set(31, mode, pipe); };
        MEvent.prototype.setDelta = function (delta) { this.m_delta = delta; };
        MEvent.prototype.setTick = function (tick) { this.m_tick = tick; };
        MEvent.prototype.setPortamento = function (depth, len) { this.set(32, depth, len); };
        MEvent.prototype.setMidiPort = function (mode) { this.set(33, mode, 0); };
        ;
        MEvent.prototype.setMidiPortRate = function (rate) { this.set(34, rate, 0); };
        ;
        MEvent.prototype.setPortBase = function (base) { this.set(35, base, 0); };
        ;
        MEvent.prototype.setPoly = function (voiceCount) { this.set(36, voiceCount, 0); };
        ;
        MEvent.prototype.setResetAll = function () { this.set(38, 0, 0); };
        MEvent.prototype.setSoundOff = function () { this.set(37, 0, 0); };
        MEvent.prototype.setHwLfo = function (w, f, pmd, amd, pms, ams, s) {
            this.set(39, ((w & 3) << 27) | ((f & 0xff) << 19) | ((pmd & 0x7f) << 12) | ((amd & 0x7f) << 5) | ((pms & 7) << 2) | (ams & 3), 0);
        };
        MEvent.prototype.getId = function () { return this.m_id; };
        MEvent.prototype.getStatus = function () { return this.m_status; };
        MEvent.prototype.getDelta = function () { return this.m_delta; };
        MEvent.prototype.getTick = function () { return this.m_tick; };
        MEvent.prototype.getNoteNo = function () { return this.m_data0; };
        MEvent.prototype.getVelocity = function () { return this.m_data1; };
        MEvent.prototype.getTempo = function () { return Math.floor(this.m_data0) / this.TEMPO_SCALE; };
        MEvent.prototype.getVolume = function () { return this.m_data0; };
        MEvent.prototype.getForm = function () { return this.m_data0; };
        MEvent.prototype.getSubForm = function () { return this.m_data1; };
        MEvent.prototype.getEnvelopeA = function () { return this.m_data0; };
        MEvent.prototype.getEnvelopeT = function () { return this.m_data0; };
        MEvent.prototype.getEnvelopeL = function () { return this.m_data1; };
        MEvent.prototype.getEnvelopeR = function () { return this.m_data0; };
        MEvent.prototype.getNoiseFreq = function () { return this.m_data0; };
        MEvent.prototype.getPWM = function () { return this.m_data0; };
        MEvent.prototype.getPan = function () { return this.m_data0; };
        MEvent.prototype.getVowel = function () { return this.m_data0; };
        MEvent.prototype.getDetune = function () { return this.m_data0; };
        MEvent.prototype.getLFODepth = function () { return this.m_data0; };
        MEvent.prototype.getLFOWidth = function () { return this.m_data1; };
        MEvent.prototype.getLFOForm = function () { return this.m_data0; };
        MEvent.prototype.getLFOSubForm = function () { return this.m_data1; };
        MEvent.prototype.getLFODelay = function () { return this.m_data0; };
        MEvent.prototype.getLFOTime = function () { return this.m_data1; };
        MEvent.prototype.getLFOTarget = function () { return this.m_data0; };
        MEvent.prototype.getLPFSwt = function () { return this.m_data0; };
        MEvent.prototype.getLPFAmt = function () { return this.m_data1; };
        MEvent.prototype.getLPFFrq = function () { return this.m_data0; };
        MEvent.prototype.getLPFRes = function () { return this.m_data1; };
        MEvent.prototype.getVolMode = function () { return this.m_data0; };
        MEvent.prototype.getInputSens = function () { return this.m_data0; };
        MEvent.prototype.getInputPipe = function () { return this.m_data1; };
        MEvent.prototype.getOutputMode = function () { return this.m_data0; };
        MEvent.prototype.getOutputPipe = function () { return this.m_data1; };
        MEvent.prototype.getExpression = function () { return this.m_data0; };
        MEvent.prototype.getRingSens = function () { return this.m_data0; };
        MEvent.prototype.getRingInput = function () { return this.m_data1; };
        MEvent.prototype.getSyncMode = function () { return this.m_data0; };
        MEvent.prototype.getSyncPipe = function () { return this.m_data1; };
        MEvent.prototype.getPorDepth = function () { return this.m_data0; };
        MEvent.prototype.getPorLen = function () { return this.m_data1; };
        MEvent.prototype.getMidiPort = function () { return this.m_data0; };
        MEvent.prototype.getMidiPortRate = function () { return this.m_data0; };
        MEvent.prototype.getPortBase = function () { return this.m_data0; };
        MEvent.prototype.getVoiceCount = function () { return this.m_data0; };
        MEvent.prototype.getHwLfoData = function () { return this.m_data0; };
        MEvent.prototype.getTrace = function () { return this.m_trace; };
        MEvent.idCounter = 0;
        return MEvent;
    })();
    flmml.MEvent = MEvent;
})(flmml || (flmml = {}));


var flmml;
(function (flmml) {
    var MTrack = (function () {
        function MTrack() {
            this.m_isEnd = 0;
            this.m_ch = new flmml.MChannel();
            this.m_needle = 0.0;
            this.m_polyFound = false;
            this.playTempo(MTrack.DEFAULT_BPM);
            this.m_volume = 100;
            this.recGate(15.0 / 16.0);
            this.recGate2(0);
            this.m_events = new Array();
            this.m_pointer = 0;
            this.m_delta = 0;
            this.m_globalTick = 0;
            this.m_lfoWidth = 0.0;
            this.m_totalMSec = 0;
            this.m_chordBegin = 0;
            this.m_chordEnd = 0;
            this.m_chordMode = false;
            if (!MTrack.SAMPLE_RATE)
                MTrack.SAMPLE_RATE = msgr.SAMPLE_RATE;
        }
        MTrack.prototype.getNumEvents = function () {
            return this.m_events.length;
        };
        MTrack.prototype.onSampleData = function (samplesSt, start, end, isTempoTrack) {
            if (isTempoTrack === void 0) { isTempoTrack = false; }
            if (this.isEnd())
                return;
            for (var i = start; i < end;) {
                var exec = 0;
                var eLen = this.m_events.length;
                var e;
                var delta;
                do {
                    exec = 0;
                    if (this.m_pointer < eLen) {
                        e = this.m_events[this.m_pointer];
                        delta = e.getDelta() * this.m_spt;
                        if (this.m_needle >= delta) {
                            exec = 1;
                            switch (e.getStatus()) {
                                case 2:
                                    this.m_ch.noteOn(e.getNoteNo(), e.getVelocity());
                                    break;
                                case 3:
                                    this.m_ch.noteOff(e.getNoteNo());
                                    break;
                                case 6:
                                    this.m_ch.setNoteNo(e.getNoteNo());
                                    break;
                                case 5:
                                    break;
                                case 4:
                                    this.playTempo(e.getTempo());
                                    break;
                                case 7:
                                    this.m_ch.setForm(e.getForm(), e.getSubForm());
                                    break;
                                case 8:
                                    this.m_ch.setEnvelope1Atk(e.getEnvelopeA());
                                    break;
                                case 9:
                                    this.m_ch.setEnvelope1Point(e.getEnvelopeT(), e.getEnvelopeL());
                                    break;
                                case 10:
                                    this.m_ch.setEnvelope1Rel(e.getEnvelopeR());
                                    break;
                                case 24:
                                    this.m_ch.setEnvelope2Atk(e.getEnvelopeA());
                                    break;
                                case 25:
                                    this.m_ch.setEnvelope2Point(e.getEnvelopeT(), e.getEnvelopeL());
                                    break;
                                case 26:
                                    this.m_ch.setEnvelope2Rel(e.getEnvelopeR());
                                    break;
                                case 11:
                                    this.m_ch.setNoiseFreq(e.getNoiseFreq());
                                    break;
                                case 12:
                                    this.m_ch.setPWM(e.getPWM());
                                    break;
                                case 13:
                                    this.m_ch.setPan(e.getPan());
                                    break;
                                case 14:
                                    this.m_ch.setFormant(e.getVowel());
                                    break;
                                case 15:
                                    this.m_ch.setDetune(e.getDetune());
                                    break;
                                case 16:
                                    this.m_ch.setLFOFMSF(e.getLFOForm(), e.getLFOSubForm());
                                    break;
                                case 17:
                                    this.m_lfoWidth = e.getLFOWidth() * this.m_spt;
                                    this.m_ch.setLFODPWD(e.getLFODepth(), MTrack.SAMPLE_RATE / this.m_lfoWidth);
                                    break;
                                case 18:
                                    this.m_ch.setLFODLTM(e.getLFODelay() * this.m_spt, e.getLFOTime() * this.m_lfoWidth);
                                    break;
                                case 19:
                                    this.m_ch.setLFOTarget(e.getLFOTarget());
                                    break;
                                case 20:
                                    this.m_ch.setLpfSwtAmt(e.getLPFSwt(), e.getLPFAmt());
                                    break;
                                case 21:
                                    this.m_ch.setLpfFrqRes(e.getLPFFrq(), e.getLPFRes());
                                    break;
                                case 23:
                                    this.m_ch.setVolMode(e.getVolMode());
                                    break;
                                case 27:
                                    this.m_ch.setInput(e.getInputSens(), e.getInputPipe());
                                    break;
                                case 28:
                                    this.m_ch.setOutput(e.getOutputMode(), e.getOutputPipe());
                                    break;
                                case 29:
                                    this.m_ch.setExpression(e.getExpression());
                                    break;
                                case 30:
                                    this.m_ch.setRing(e.getRingSens(), e.getRingInput());
                                    break;
                                case 31:
                                    this.m_ch.setSync(e.getSyncMode(), e.getSyncPipe());
                                    break;
                                case 32:
                                    this.m_ch.setPortamento(e.getPorDepth() * 100, e.getPorLen() * this.m_spt);
                                    break;
                                case 33:
                                    this.m_ch.setMidiPort(e.getMidiPort());
                                    break;
                                case 34:
                                    var rate = e.getMidiPortRate();
                                    this.m_ch.setMidiPortRate((8 - (rate * 7.99 / 128)) / rate);
                                    break;
                                case 35:
                                    this.m_ch.setPortBase(e.getPortBase() * 100);
                                    break;
                                case 36:
                                    this.m_ch.setVoiceLimit(e.getVoiceCount());
                                    break;
                                case 39:
                                    this.m_ch.setHwLfo(e.getHwLfoData());
                                    break;
                                case 37:
                                    this.m_ch.setSoundOff();
                                    break;
                                case 38:
                                    this.m_ch.reset();
                                    break;
                                case 22:
                                    this.m_ch.close();
                                    break;
                                case 0:
                                    this.m_isEnd = 1;
                                    break;
                                case 1:
                                    break;
                                default:
                                    break;
                            }
                            this.m_needle -= delta;
                            this.m_pointer++;
                        }
                    }
                } while (exec);
                var di;
                if (this.m_pointer < eLen) {
                    e = this.m_events[this.m_pointer];
                    delta = e.getDelta() * this.m_spt;
                    di = Math.ceil(delta - this.m_needle);
                    if (i + di >= end)
                        di = end - i;
                    this.m_needle += di;
                    if (!isTempoTrack)
                        this.m_ch.getSamples(samplesSt, end, i, di);
                    i += di;
                }
                else {
                    break;
                }
            }
        };
        MTrack.prototype.seek = function (delta) {
            this.m_delta += delta;
            this.m_globalTick += delta;
            this.m_chordEnd = Math.max(this.m_chordEnd, this.m_globalTick);
        };
        MTrack.prototype.seekChordStart = function () {
            this.m_globalTick = this.m_chordBegin;
        };
        MTrack.prototype.mute = function (f) {
            this.m_ch.mute(f);
        };
        MTrack.prototype.isMuted = function () {
            return this.m_ch.isMuted();
        };
        MTrack.prototype.recDelta = function (e) {
            e.setDelta(this.m_delta);
            this.m_delta = 0;
        };
        MTrack.prototype.recNote = function (noteNo, len, vel, keyon, keyoff, trace) {
            if (keyon === void 0) { keyon = 1; }
            if (keyoff === void 0) { keyoff = 1; }
            if (trace === void 0) { trace = null; }
            var e0 = this.makeEvent(trace);
            if (keyon) {
                e0.setNoteOn(noteNo, vel);
            }
            else {
                e0.setNote(noteNo);
            }
            this.pushEvent(e0);
            if (keyoff) {
                var gate;
                gate = ((len * this.m_gate) | 0) - this.m_gate2;
                if (gate <= 0)
                    gate = 0;
                this.seek(gate);
                this.recNoteOff(noteNo, vel);
                this.seek(len - gate);
                if (this.m_chordMode) {
                    this.seekChordStart();
                }
            }
            else {
                this.seek(len);
            }
        };
        MTrack.prototype.recNoteOff = function (noteNo, vel) {
            var e = this.makeEvent();
            e.setNoteOff(noteNo, vel);
            this.pushEvent(e);
        };
        MTrack.prototype.recRest = function (len) {
            this.seek(len);
            if (this.m_chordMode) {
                this.m_chordBegin += len;
            }
        };
        MTrack.prototype.recChordStart = function () {
            if (this.m_chordMode === false) {
                this.m_chordMode = true;
                this.m_chordBegin = this.m_globalTick;
            }
        };
        MTrack.prototype.recChordEnd = function () {
            if (this.m_chordMode) {
                if (this.m_events.length > 0) {
                    this.m_delta = this.m_chordEnd - this.m_events[this.m_events.length - 1].getTick();
                }
                else {
                    this.m_delta = 0;
                }
                this.m_globalTick = this.m_chordEnd;
                this.m_chordMode = false;
            }
        };
        MTrack.prototype.recRestMSec = function (msec) {
            var len = (msec * MTrack.SAMPLE_RATE / (this.m_spt * 1000)) | 0;
            this.seek(len);
        };
        MTrack.prototype.recVolume = function (vol) {
            var e = this.makeEvent();
            e.setVolume(vol);
            this.pushEvent(e);
        };
        MTrack.prototype.recGlobal = function (globalTick, e) {
            var n = this.m_events.length;
            var preGlobalTick = 0;
            for (var i = 0; i < n; i++) {
                var en = this.m_events[i];
                var nextTick = preGlobalTick + en.getDelta();
                if (nextTick > globalTick || (nextTick === globalTick && en.getStatus() !== 4)) {
                    en.setDelta(nextTick - globalTick);
                    e.setDelta(globalTick - preGlobalTick);
                    this.m_events.splice(i, 0, e);
                    return;
                }
                preGlobalTick = nextTick;
            }
            e.setDelta(globalTick - preGlobalTick);
            this.m_events.push(e);
        };
        MTrack.prototype.insertEvent = function (e) {
            var n = this.m_events.length;
            var preGlobalTick = 0;
            var globalTick = e.getTick();
            for (var i = 0; i < n; i++) {
                var en = this.m_events[i];
                var nextTick = preGlobalTick + en.getDelta();
                if (nextTick > globalTick) {
                    en.setDelta(nextTick - globalTick);
                    e.setDelta(globalTick - preGlobalTick);
                    this.m_events.splice(i, 0, e);
                    return;
                }
                preGlobalTick = nextTick;
            }
            e.setDelta(globalTick - preGlobalTick);
            this.m_events.push(e);
        };
        MTrack.prototype.makeEvent = function (trace) {
            if (trace === void 0) { trace = null; }
            var e = new flmml.MEvent(this.m_globalTick, trace);
            e.setDelta(this.m_delta);
            this.m_delta = 0;
            return e;
        };
        MTrack.prototype.pushEvent = function (e) {
            if (this.m_chordMode === false) {
                this.m_events.push(e);
            }
            else {
                this.insertEvent(e);
            }
        };
        MTrack.prototype.recTempo = function (globalTick, tempo) {
            var e = new flmml.MEvent(globalTick);
            e.setTempo(tempo);
            this.recGlobal(globalTick, e);
        };
        MTrack.prototype.recEOT = function () {
            var e = this.makeEvent();
            e.setEOT();
            this.pushEvent(e);
        };
        MTrack.prototype.recGate = function (gate) {
            this.m_gate = gate;
        };
        MTrack.prototype.recGate2 = function (gate2) {
            if (gate2 < 0)
                gate2 = 0;
            this.m_gate2 = gate2;
        };
        MTrack.prototype.recForm = function (form, sub) {
            var e = this.makeEvent();
            e.setForm(form, sub);
            this.pushEvent(e);
        };
        MTrack.prototype.recEnvelope = function (env, attack, times, levels, release) {
            var e = this.makeEvent();
            if (env === 1)
                e.setEnvelope1Atk(attack);
            else
                e.setEnvelope2Atk(attack);
            this.pushEvent(e);
            for (var i = 0, pts = times.length; i < pts; i++) {
                e = this.makeEvent();
                if (env === 1)
                    e.setEnvelope1Point(times[i], levels[i]);
                else
                    e.setEnvelope2Point(times[i], levels[i]);
                this.pushEvent(e);
            }
            e = this.makeEvent();
            if (env === 1)
                e.setEnvelope1Rel(release);
            else
                e.setEnvelope2Rel(release);
            this.pushEvent(e);
        };
        MTrack.prototype.recNoiseFreq = function (freq) {
            var e = this.makeEvent();
            e.setNoiseFreq(freq);
            this.pushEvent(e);
        };
        MTrack.prototype.recPWM = function (pwm) {
            var e = this.makeEvent();
            e.setPWM(pwm);
            this.pushEvent(e);
        };
        MTrack.prototype.recPan = function (pan) {
            var e = this.makeEvent();
            e.setPan(pan);
            this.pushEvent(e);
        };
        MTrack.prototype.recFormant = function (vowel) {
            var e = this.makeEvent();
            e.setFormant(vowel);
            this.pushEvent(e);
        };
        MTrack.prototype.recDetune = function (d) {
            var e = this.makeEvent();
            e.setDetune(d);
            this.pushEvent(e);
        };
        MTrack.prototype.recLFO = function (depth, width, form, subform, delay, time, target) {
            var e = this.makeEvent();
            e.setLFOFMSF(form, subform);
            this.pushEvent(e);
            e = this.makeEvent();
            e.setLFODPWD(depth, width);
            this.pushEvent(e);
            e = this.makeEvent();
            e.setLFODLTM(delay, time);
            this.pushEvent(e);
            e = this.makeEvent();
            e.setLFOTarget(target);
            this.pushEvent(e);
        };
        MTrack.prototype.recLPF = function (swt, amt, frq, res) {
            var e = this.makeEvent();
            e.setLPFSWTAMT(swt, amt);
            this.pushEvent(e);
            e = this.makeEvent();
            e.setLPFFRQRES(frq, res);
            this.pushEvent(e);
        };
        MTrack.prototype.recVolMode = function (m) {
            var e = this.makeEvent();
            e.setVolMode(m);
            this.pushEvent(e);
        };
        MTrack.prototype.recInput = function (sens, pipe) {
            var e = this.makeEvent();
            e.setInput(sens, pipe);
            this.pushEvent(e);
        };
        MTrack.prototype.recOutput = function (mode, pipe) {
            var e = this.makeEvent();
            e.setOutput(mode, pipe);
            this.pushEvent(e);
        };
        MTrack.prototype.recExpression = function (ex) {
            var e = this.makeEvent();
            e.setExpression(ex);
            this.pushEvent(e);
        };
        MTrack.prototype.recRing = function (sens, pipe) {
            var e = this.makeEvent();
            e.setRing(sens, pipe);
            this.pushEvent(e);
        };
        MTrack.prototype.recSync = function (mode, pipe) {
            var e = this.makeEvent();
            e.setSync(mode, pipe);
            this.pushEvent(e);
        };
        MTrack.prototype.recClose = function () {
            var e = this.makeEvent();
            e.setClose();
            this.pushEvent(e);
        };
        MTrack.prototype.recPortamento = function (depth, len) {
            var e = this.makeEvent();
            e.setPortamento(depth, len);
            this.pushEvent(e);
        };
        MTrack.prototype.recMidiPort = function (mode) {
            var e = this.makeEvent();
            e.setMidiPort(mode);
            this.pushEvent(e);
        };
        MTrack.prototype.recMidiPortRate = function (rate) {
            var e = this.makeEvent();
            e.setMidiPortRate(rate);
            this.pushEvent(e);
        };
        MTrack.prototype.recPortBase = function (base) {
            var e = this.makeEvent();
            e.setPortBase(base);
            this.pushEvent(e);
        };
        MTrack.prototype.recPoly = function (voiceCount) {
            var e = this.makeEvent();
            e.setPoly(voiceCount);
            this.pushEvent(e);
            this.m_polyFound = true;
        };
        MTrack.prototype.recHwLfo = function (w, f, pmd, amd, pms, ams, syn) {
            var e = this.makeEvent();
            e.setHwLfo(w, f, pmd, amd, pms, ams, syn);
            this.pushEvent(e);
        };
        MTrack.prototype.isEnd = function () {
            return this.m_isEnd;
        };
        MTrack.prototype.getRecGlobalTick = function () {
            return this.m_globalTick;
        };
        MTrack.prototype.seekTop = function () {
            this.m_globalTick = 0;
        };
        MTrack.prototype.conduct = function (trackArr, trackEndMarginMsec) {
            var ni = this.m_events.length;
            var nj = trackArr.length;
            var globalTick = 0;
            var globalSample = 0;
            var spt = this.calcSpt(MTrack.DEFAULT_BPM);
            var i, j;
            var e;
            for (i = 0; i < ni; i++) {
                e = this.m_events[i];
                globalTick += e.getDelta();
                globalSample += e.getDelta() * spt;
                switch (e.getStatus()) {
                    case 4:
                        spt = this.calcSpt(e.getTempo());
                        for (j = MTrack.FIRST_TRACK; j < nj; j++) {
                            trackArr[j].recTempo(globalTick, e.getTempo());
                        }
                        break;
                    default:
                        break;
                }
            }
            var maxGlobalTick = 0;
            for (j = MTrack.FIRST_TRACK; j < nj; j++) {
                if (maxGlobalTick < trackArr[j].getRecGlobalTick())
                    maxGlobalTick = trackArr[j].getRecGlobalTick();
            }
            e = this.makeEvent();
            e.setClose();
            this.recGlobal(maxGlobalTick, e);
            globalSample += (maxGlobalTick - globalTick) * spt;
            this.recRestMSec(trackEndMarginMsec);
            this.recEOT();
            globalSample += 3 * MTrack.SAMPLE_RATE;
            this.m_totalMSec = globalSample * 1000.0 / MTrack.SAMPLE_RATE;
        };
        MTrack.prototype.calcSpt = function (bpm) {
            var tps = bpm * 96.0 / 60.0;
            return MTrack.SAMPLE_RATE / tps;
        };
        MTrack.prototype.playTempo = function (bpm) {
            this.m_bpm = bpm;
            this.m_spt = this.calcSpt(bpm);
        };
        MTrack.prototype.getTotalMSec = function () {
            return this.m_totalMSec;
        };
        MTrack.prototype.getTotalTimeStr = function () {
            var sec = Math.ceil(this.m_totalMSec / 1000);
            var smin = "0" + Math.floor(sec / 60);
            var ssec = "0" + (sec % 60);
            return smin.substr(smin.length - 2, 2) + ":" + ssec.substr(ssec.length - 2, 2);
        };
        MTrack.prototype.getVoiceCount = function () {
            return this.m_ch.getVoiceCount();
        };
        MTrack.prototype.usingMono = function () {
            this.m_ch = new flmml.MChannel();
        };
        MTrack.prototype.usingPoly = function (maxVoice) {
            this.m_ch = new flmml.MPolyChannel(maxVoice);
        };
        MTrack.prototype.findPoly = function () {
            return this.m_polyFound;
        };
        MTrack.TEMPO_TRACK = 0;
        MTrack.FIRST_TRACK = 1;
        MTrack.DEFAULT_BPM = 120;
        return MTrack;
    })();
    flmml.MTrack = MTrack;
})(flmml || (flmml = {}));


var flmml;
(function (flmml) {
    var MWarning = (function () {
        function MWarning() {
        }
        MWarning.getString = function (warnId, str) {
            return this.s_string[warnId].replace("%s", str);
        };
        MWarning.UNKNOWN_COMMAND = 0;
        MWarning.UNCLOSED_REPEAT = 1;
        MWarning.UNOPENED_COMMENT = 2;
        MWarning.UNCLOSED_COMMENT = 3;
        MWarning.RECURSIVE_MACRO = 4;
        MWarning.UNCLOSED_ARGQUOTE = 5;
        MWarning.UNCLOSED_GROUPNOTES = 6;
        MWarning.UNOPENED_GROUPNOTES = 7;
        MWarning.INVALID_MACRO_NAME = 8;
        MWarning.s_string = [
            "Unknown command '%s'",
            "Unclosed repeat",
            "Unopened comment",
            "Unclosed comment",
            "Recursive macro",
            "Unclosed argument quote",
            "Unclosed group notes",
            "Unopened group notes",
            "Invalid macro name '%s'"
        ];
        return MWarning;
    })();
    flmml.MWarning = MWarning;
})(flmml || (flmml = {}));


var flmml;
(function (flmml) {
    var SourceString = (function () {
        function SourceString(s) {
            this._source = s;
            this._lineTail = [];
            var ptrn = /\n/g;
            var m;
            while (m = ptrn.exec(s)) {
                this._lineTail.push(m.index + m[0].length);
            }
        }
        SourceString.prototype.toLineColumn = function (i) {
            var l = 0, i0 = 0;
            for (; l < this._lineTail.length; l++) {
                if (i < this._lineTail[l])
                    break;
                i0 = this._lineTail[l];
            }
            return { line: l, column: i - i0 };
        };
        Object.defineProperty(SourceString.prototype, "sourceText", {
            get: function () {
                return this._source;
            },
            enumerable: true,
            configurable: true
        });
        return SourceString;
    })();
    flmml.SourceString = SourceString;
    var MapReference = (function () {
        function MapReference(pos) {
            this.pos = pos;
            this.refs = [];
        }
        MapReference.prototype.clone = function () {
            var r = new MapReference(this.pos);
            r.refs = this.refs.concat([]);
            return r;
        };
        MapReference.prototype.pushRef = function (label, pos) {
            this.refs.push({ label: label, pos: pos });
            return this;
        };
        return MapReference;
    })();
    flmml.MapReference = MapReference;
    ;
    var MappedString = (function () {
        function MappedString(s) {
            if (s === void 0) { s = ''; }
            this._str = s;
            this._map = [];
            for (var i = 0; i < s.length; i++) {
                this._map.push(new MapReference(i));
            }
        }
        MappedString.prototype.clone = function () {
            var r = new MappedString();
            r._str = this._str;
            r._map = this._map.concat([]);
            return r;
        };
        MappedString.prototype.pushRef = function (label, pos) {
            for (var i = 0; i < this._map.length; i++) {
                this._map[i] = this._map[i].clone().pushRef(label, pos);
            }
            return this;
        };
        MappedString.prototype.concat = function (s) {
            var r = new MappedString();
            r._str = this._str + s._str;
            r._map = this._map.concat(s._map);
            return r;
        };
        Object.defineProperty(MappedString.prototype, "s", {
            get: function () {
                return this._str;
            },
            enumerable: true,
            configurable: true
        });
        MappedString.prototype.toString = function () {
            return this._str;
        };
        Object.defineProperty(MappedString.prototype, "position", {
            get: function () {
                if (this._map.length == 0)
                    return null;
                return this._map[0].pos;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(MappedString.prototype, "refs", {
            get: function () {
                if (this._map.length == 0)
                    return null;
                return this._map[0].refs;
            },
            enumerable: true,
            configurable: true
        });
        MappedString.prototype.toTrace = function (source, trackNo) {
            var stack = [];
            var pos = this.position;
            if (pos) {
                var lc = source.toLineColumn(pos);
                stack.push([null, lc.line + 1, lc.column + 1]);
            }
            var refs = this.refs;
            if (refs && 0 < refs.length) {
                for (var _i = 0; _i < refs.length; _i++) {
                    var r = refs[_i];
                    var s = [r.label];
                    if (r.pos) {
                        var lc = source.toLineColumn(r.pos);
                        s.push(lc.line + 1);
                        s.push(lc.column + 1);
                    }
                    stack.push(s);
                }
            }
            stack.push(trackNo);
            return stack;
        };
        MappedString.prototype.mapRemoveWhitespace = function () {
            this.mapReplace(new RegExp("[ 　\n\r\t\f]+", "g"));
        };
        MappedString.prototype.mapRemove = function (start, end) {
            this._str = this._str.substring(0, start) + this._str.substring(end + 1);
            this._map = this._map.slice(0, start).concat(this._map.slice(end + 1));
        };
        MappedString.prototype.matchedRanges = function (ptrn) {
            var ranges = [];
            var str = this._str;
            if (ptrn instanceof RegExp) {
                var m;
                while (m = ptrn.exec(str)) {
                    ranges.push([m.index, m.index + m[0].length]);
                    if (!ptrn.global)
                        break;
                }
            }
            else {
                var i = 0;
                var l = ptrn.length;
                while (0 <= (i = str.indexOf(ptrn, i))) {
                    ranges.push([i, i + l]);
                    i += l;
                }
            }
            return ranges;
        };
        MappedString.prototype.mapReplace = function (from, to) {
            var ranges = this.matchedRanges(from);
            var str = '';
            var map = [];
            var i = 0;
            for (var _i = 0; _i < ranges.length; _i++) {
                var r = ranges[_i];
                str += this._str.substring(i, r[0]);
                map = map.concat(this._map.slice(i, r[0]));
                if (to) {
                    str += to._str;
                    map = map.concat(to._map);
                }
                i = r[1];
            }
            str += this._str.substring(i);
            map = map.concat(this._map.slice(i));
            this._str = str;
            this._map = map;
        };
        MappedString.prototype.mapReplaceRange = function (begin, end, r) {
            this._str = this._str.substring(0, begin) + r._str + this._str.substring(end);
            this._map = this._map.slice(0, begin).concat(r._map).concat(this._map.slice(end));
        };
        MappedString.prototype.replace = function (from, to) {
            var r = this.clone();
            r.mapReplace(from, to);
            return r;
        };
        MappedString.prototype.split = function (delim) {
            var ranges = this.matchedRanges(delim);
            var strs = [];
            var i = 0;
            for (var _i = 0; _i < ranges.length; _i++) {
                var r = ranges[_i];
                var s = new MappedString();
                s._str = this._str.substring(i, r[0]);
                s._map = this._map.slice(i, r[0]);
                strs.push(s);
                i = r[1];
            }
            var s = new MappedString();
            s._str = this._str.substring(i);
            s._map = this._map.slice(i);
            strs.push(s);
            return strs;
        };
        MappedString.prototype.mapLowerCase = function () {
            this._str = this._str.toLowerCase();
        };
        MappedString.prototype.append = function (s) {
            this._str += s._str;
            this._map = this._map.concat(s._map);
        };
        MappedString.prototype.appendRaw = function (s) {
            this._str += s;
            for (var i = 0; i < s.length; i++)
                this._map.push(null);
        };
        Object.defineProperty(MappedString.prototype, "length", {
            get: function () {
                return this._str.length;
            },
            enumerable: true,
            configurable: true
        });
        MappedString.prototype.indexOf = function (s, p) {
            return this._str.indexOf(s, p);
        };
        MappedString.prototype.match = function (r) {
            return this._str.match(r);
        };
        MappedString.prototype.substr = function (f, l) {
            var str = new MappedString();
            str._str = this._str.substr(f, l);
            str._map = this._map.slice(f, l == null ? l : f + l);
            return str;
        };
        MappedString.prototype.substring = function (s, e) {
            var str = new MappedString();
            str._str = this._str.substring(s, e);
            str._map = this._map.slice(s, e);
            return str;
        };
        MappedString.prototype.charAt = function (i) {
            var r = new MappedString();
            r._str = this._str.charAt(i);
            r._map.push(this._map[i]);
            return r;
        };
        return MappedString;
    })();
    flmml.MappedString = MappedString;
    var reNonWhitespace = /\S/;
    var MML = (function () {
        function MML(offlineFormat, bufferMultiple) {
            this.m_offlineFormat = offlineFormat;
            this.m_compiledButNotPlayed = false;
            this.m_lastMML = null;
            this.trackEndMarginMSec = 3000;
            this.channelEndMarginMSec = 2000;
            this.m_sequencer = new flmml.MSequencer(offlineFormat, bufferMultiple);
        }
        MML.remove = function (str, start, end) {
            return str.substring(0, start) + str.substring(end + 1);
        };
        MML.prototype.getSourceString = function () {
            return this.m_source.sourceText;
        };
        MML.prototype.getWarnings = function () {
            return this.m_warning;
        };
        MML.prototype.warning = function (warnId, str) {
            var msg = flmml.MWarning.getString(warnId, str.toString());
            var trace = [];
            if (str instanceof MappedString) {
                trace = str.toTrace(this.m_source, this.m_trackNo);
            }
            else if (str != null && str != "") {
                trace.push([str, null, null]);
            }
            if (this.m_warning.indexOf(msg) < 0)
                this.m_warning.push({ message: msg, trace: trace });
        };
        MML.prototype.len2tick = function (len) {
            if (len === 0)
                return this.m_length;
            return 384 / len | 0;
        };
        MML.prototype.note = function (noteNo, trace) {
            noteNo += this.m_noteShift + this.getKeySig();
            if (this.getRawChar() === '*') {
                this.m_beforeNote = noteNo + this.m_octave * 12;
                this.m_portamento = 1;
                this.next();
            }
            else {
                var lenMode;
                var len;
                var tick = 0;
                var tickTemp;
                var tie = 0;
                var keyon = (this.m_keyoff === 0) ? 0 : 1;
                this.m_keyoff = 1;
                while (1) {
                    if (this.getRawChar() !== '%') {
                        lenMode = 0;
                    }
                    else {
                        lenMode = 1;
                        this.next();
                    }
                    len = this.getUInt(0);
                    if (tie === 1 && len === 0) {
                        this.m_keyoff = 0;
                        break;
                    }
                    tickTemp = (lenMode ? len : this.len2tick(len));
                    tick += this.getDot(tickTemp);
                    tie = 0;
                    if (this.getRawChar() === '&') {
                        tie = 1;
                        this.next();
                    }
                    else {
                        break;
                    }
                }
                if (this.m_portamento === 1) {
                    this.m_tracks[this.m_trackNo].recPortamento(this.m_beforeNote - (noteNo + this.m_octave * 12), tick);
                }
                this.m_tracks[this.m_trackNo].recNote(noteNo + this.m_octave * 12, tick, this.m_velocity, keyon, this.m_keyoff, trace);
                if (this.m_portamento === 1) {
                    this.m_tracks[this.m_trackNo].recPortamento(0, 0);
                    this.m_portamento = 0;
                }
            }
        };
        MML.prototype.rest = function () {
            var lenMode = 0;
            if (this.getRawChar() === '%') {
                lenMode = 1;
                this.next();
            }
            var len;
            len = this.getUInt(0);
            var tick = lenMode ? len : this.len2tick(len);
            tick = this.getDot(tick);
            this.m_tracks[this.m_trackNo].recRest(tick);
        };
        MML.prototype.atmark = function () {
            var _this = this;
            var c = this.getRawChar();
            var o = 1, a = 0, d = 64, s = 32, r = 0, sens = 0, mode = 0;
            var w = 0, f = 0;
            var pmd, amd, pms, ams;
            switch (c) {
                case 'v':
                    this.m_velDetail = true;
                    this.next();
                    this.m_velocity = this.getUInt(this.m_velocity);
                    if (this.m_velocity > 127)
                        this.m_velocity = 127;
                    break;
                case 'x':
                    this.next();
                    o = this.getUInt(127);
                    if (o > 127)
                        o = 127;
                    this.m_tracks[this.m_trackNo].recExpression(o);
                    break;
                case 'e':
                    (function () {
                        var releasePos;
                        var t = new Array(), l = new Array();
                        _this.next();
                        o = _this.getUInt(o);
                        if (_this.getRawChar() === ',')
                            _this.next();
                        a = _this.getUInt(a);
                        releasePos = _this.m_letter;
                        while (true) {
                            if (_this.getRawChar() === ',') {
                                _this.next();
                            }
                            else {
                                break;
                            }
                            releasePos = _this.m_letter - 1;
                            d = _this.getUInt(d);
                            if (_this.getRawChar() === ',') {
                                _this.next();
                            }
                            else {
                                _this.m_letter = releasePos;
                                break;
                            }
                            s = _this.getUInt(s);
                            t.push(d);
                            l.push(s);
                        }
                        if (t.length === 0) {
                            t.push(d);
                            l.push(s);
                        }
                        if (_this.getRawChar() === ',')
                            _this.next();
                        r = _this.getUInt(r);
                        _this.m_tracks[_this.m_trackNo].recEnvelope(o, a, t, l, r);
                    })();
                    break;
                case 'm':
                    this.next();
                    if (this.getRawChar() === 'h') {
                        this.next();
                        w = 0;
                        f = 0;
                        pmd = 0;
                        amd = 0;
                        pms = 0;
                        ams = 0;
                        s = 1;
                        do {
                            w = this.getUInt(w);
                            if (this.getRawChar() !== ',')
                                break;
                            this.next();
                            f = this.getUInt(f);
                            if (this.getRawChar() !== ',')
                                break;
                            this.next();
                            pmd = this.getUInt(pmd);
                            if (this.getRawChar() !== ',')
                                break;
                            this.next();
                            amd = this.getUInt(amd);
                            if (this.getRawChar() !== ',')
                                break;
                            this.next();
                            pms = this.getUInt(pms);
                            if (this.getRawChar() !== ',')
                                break;
                            this.next();
                            ams = this.getUInt(ams);
                            if (this.getRawChar() !== ',')
                                break;
                            this.next();
                            s = this.getUInt(s);
                        } while (false);
                        this.m_tracks[this.m_trackNo].recHwLfo(w, f, pmd, amd, pms, ams, s);
                    }
                    break;
                case 'n':
                    this.next();
                    if (this.getRawChar() === 's') {
                        this.next();
                        this.m_noteShift += this.getSInt(0);
                    }
                    else {
                        o = this.getUInt(0);
                        if (o < 0 || o > 127)
                            o = 0;
                        this.m_tracks[this.m_trackNo].recNoiseFreq(o);
                    }
                    break;
                case 'w':
                    this.next();
                    o = this.getSInt(50);
                    if (o < 0) {
                        if (o > -1)
                            o = -1;
                        if (o < -99)
                            o = -99;
                    }
                    else {
                        if (o < 1)
                            o = 1;
                        if (o > 99)
                            o = 99;
                    }
                    this.m_tracks[this.m_trackNo].recPWM(o);
                    break;
                case 'p':
                    this.next();
                    if (this.getRawChar() === 'l') {
                        this.next();
                        o = this.getUInt(this.m_polyVoice);
                        o = Math.max(0, Math.min(this.m_polyVoice, o));
                        this.m_tracks[this.m_trackNo].recPoly(o);
                    }
                    else {
                        o = this.getUInt(64);
                        if (o < 1)
                            o = 1;
                        if (o > 127)
                            o = 127;
                        this.m_tracks[this.m_trackNo].recPan(o);
                    }
                    break;
                case '\'':
                    this.next();
                    o = this.m_string.indexOf('\'', this.m_letter);
                    if (o >= 0) {
                        var vstr = this.m_string.substring(this.m_letter, o);
                        var vowel = 0;
                        switch (vstr.s) {
                            case 'a':
                                vowel = flmml.MFormant.VOWEL_A;
                                break;
                            case 'e':
                                vowel = flmml.MFormant.VOWEL_E;
                                break;
                            case 'i':
                                vowel = flmml.MFormant.VOWEL_I;
                                break;
                            case 'o':
                                vowel = flmml.MFormant.VOWEL_O;
                                break;
                            case 'u':
                                vowel = flmml.MFormant.VOWEL_U;
                                break;
                            default:
                                vowel = -1;
                                break;
                        }
                        this.m_tracks[this.m_trackNo].recFormant(vowel);
                        this.m_letter = o + 1;
                    }
                    break;
                case 'd':
                    this.next();
                    o = this.getSInt(0);
                    this.m_tracks[this.m_trackNo].recDetune(o);
                    break;
                case 'l':
                    (function () {
                        var dp = 0, wd = 0, fm = 1, sf = 0, rv = 1, dl = 0, tm = 0, cn = 0, sw = 0;
                        _this.next();
                        dp = _this.getUInt(dp);
                        if (_this.getRawChar() === ',')
                            _this.next();
                        wd = _this.getUInt(wd);
                        if (_this.getRawChar() === ',') {
                            _this.next();
                            if (_this.getRawChar() === '-') {
                                rv = -1;
                                _this.next();
                            }
                            fm = (_this.getUInt(fm) + 1) * rv;
                            if (_this.getRawChar() === '-') {
                                _this.next();
                                sf = _this.getUInt(0);
                            }
                            if (_this.getRawChar() === ',') {
                                _this.next();
                                dl = _this.getUInt(dl);
                                if (_this.getRawChar() === ',') {
                                    _this.next();
                                    tm = _this.getUInt(tm);
                                    if (_this.getRawChar() === ',') {
                                        _this.next();
                                        sw = _this.getUInt(sw);
                                    }
                                }
                            }
                        }
                        _this.m_tracks[_this.m_trackNo].recLFO(dp, wd, fm, sf, dl, tm, sw);
                    })();
                    break;
                case 'f':
                    (function () {
                        var swt = 0, amt = 0, frq = 0, res = 0;
                        _this.next();
                        swt = _this.getSInt(swt);
                        if (_this.getRawChar() === ',') {
                            _this.next();
                            amt = _this.getSInt(amt);
                            if (_this.getRawChar() === ',') {
                                _this.next();
                                frq = _this.getUInt(frq);
                                if (_this.getRawChar() === ',') {
                                    _this.next();
                                    res = _this.getUInt(res);
                                }
                            }
                        }
                        _this.m_tracks[_this.m_trackNo].recLPF(swt, amt, frq, res);
                    })();
                    break;
                case 'q':
                    this.next();
                    this.m_tracks[this.m_trackNo].recGate2(this.getUInt(2) * 2);
                    break;
                case 'i':
                    sens = 0;
                    this.next();
                    sens = this.getUInt(sens);
                    if (this.getRawChar() === ',') {
                        this.next();
                        a = this.getUInt(a);
                        if (a > this.m_maxPipe)
                            a = this.m_maxPipe;
                    }
                    this.m_tracks[this.m_trackNo].recInput(sens, a);
                    break;
                case 'o':
                    mode = 0;
                    this.next();
                    mode = this.getUInt(mode);
                    if (this.getRawChar() === ',') {
                        this.next();
                        a = this.getUInt(a);
                        if (a > this.m_maxPipe) {
                            this.m_maxPipe = a;
                            if (this.m_maxPipe >= MML.MAX_PIPE)
                                this.m_maxPipe = a = MML.MAX_PIPE;
                        }
                    }
                    this.m_tracks[this.m_trackNo].recOutput(mode, a);
                    break;
                case 'r':
                    (function () {
                        sens = 0;
                        _this.next();
                        sens = _this.getUInt(sens);
                        if (_this.getRawChar() === ',') {
                            _this.next();
                            a = _this.getUInt(a);
                            if (a > _this.m_maxPipe)
                                a = _this.m_maxPipe;
                        }
                        _this.m_tracks[_this.m_trackNo].recRing(sens, a);
                    })();
                    break;
                case 's':
                    {
                        mode = 0;
                        this.next();
                        mode = this.getUInt(mode);
                        if (this.getRawChar() === ',') {
                            this.next();
                            a = this.getUInt(a);
                            if (mode === 1) {
                                if (a > this.m_maxSyncSource) {
                                    this.m_maxSyncSource = a;
                                    if (this.m_maxSyncSource >= MML.MAX_SYNCSOURCE)
                                        this.m_maxSyncSource = a = MML.MAX_SYNCSOURCE;
                                }
                            }
                            else if (mode === 2) {
                                if (a > this.m_maxSyncSource)
                                    a = this.m_maxSyncSource;
                            }
                        }
                        this.m_tracks[this.m_trackNo].recSync(mode, a);
                    }
                    break;
                case 'u':
                    this.next();
                    var rate;
                    mode = this.getUInt(0);
                    switch (mode) {
                        case 0:
                        case 1:
                            this.m_tracks[this.m_trackNo].recMidiPort(mode);
                            break;
                        case 2:
                            rate = 0;
                            if (this.getRawChar() === ',') {
                                this.next();
                                rate = this.getUInt(0);
                                if (rate < 0)
                                    rate = 0;
                                if (rate > 127)
                                    rate = 127;
                            }
                            this.m_tracks[this.m_trackNo].recMidiPortRate(rate * 1);
                            break;
                        case 3:
                            if (this.getRawChar() === ',') {
                                this.next();
                                var oct;
                                var baseNote = -1;
                                if (this.getRawChar() !== 'o') {
                                    oct = this.m_octave;
                                }
                                else {
                                    this.next();
                                    oct = this.getUInt(0);
                                }
                                c = this.getRawChar();
                                switch (c) {
                                    case 'c':
                                        baseNote = 0;
                                        break;
                                    case 'd':
                                        baseNote = 2;
                                        break;
                                    case 'e':
                                        baseNote = 4;
                                        break;
                                    case 'f':
                                        baseNote = 5;
                                        break;
                                    case 'g':
                                        baseNote = 7;
                                        break;
                                    case 'a':
                                        baseNote = 9;
                                        break;
                                    case 'b':
                                        baseNote = 11;
                                        break;
                                }
                                if (baseNote >= 0) {
                                    this.next();
                                    baseNote += this.m_noteShift + this.getKeySig();
                                    baseNote += oct * 12;
                                }
                                else {
                                    baseNote = this.getUInt(60);
                                }
                                if (baseNote < 0)
                                    baseNote = 0;
                                if (baseNote > 127)
                                    baseNote = 127;
                                this.m_tracks[this.m_trackNo].recPortBase(baseNote);
                            }
                            break;
                    }
                    break;
                default:
                    this.m_form = this.getUInt(this.m_form);
                    a = 0;
                    if (this.getRawChar() === '-') {
                        this.next();
                        a = this.getUInt(0);
                    }
                    this.m_tracks[this.m_trackNo].recForm(this.m_form, a);
                    break;
            }
        };
        MML.prototype.firstLetter = function () {
            var c = this.getCharNext();
            var c0;
            var i;
            var trace = c.toTrace(this.m_source, this.m_trackNo);
            switch (c.s) {
                case "c":
                    this.note(0, trace);
                    break;
                case "d":
                    this.note(2, trace);
                    break;
                case "e":
                    this.note(4, trace);
                    break;
                case "f":
                    this.note(5, trace);
                    break;
                case "g":
                    this.note(7, trace);
                    break;
                case "a":
                    this.note(9, trace);
                    break;
                case "b":
                    this.note(11, trace);
                    break;
                case "r":
                    this.rest();
                    break;
                case "o":
                    this.m_octave = this.getUInt(this.m_octave);
                    if (this.m_octave < -2)
                        this.m_octave = -2;
                    if (this.m_octave > 8)
                        this.m_octave = 8;
                    break;
                case "v":
                    this.m_velDetail = false;
                    this.m_velocity = this.getUInt((this.m_velocity - 7) / 8) * 8 + 7;
                    if (this.m_velocity < 0)
                        this.m_velocity = 0;
                    if (this.m_velocity > 127)
                        this.m_velocity = 127;
                    break;
                case "(":
                case ")":
                    i = this.getUInt(1);
                    if (c.s === "(" && this.m_velDir ||
                        c.s === ")" && !this.m_velDir) {
                        this.m_velocity += (this.m_velDetail) ? (1 * i) : (8 * i);
                        if (this.m_velocity > 127)
                            this.m_velocity = 127;
                    }
                    else {
                        this.m_velocity -= (this.m_velDetail) ? (1 * i) : (8 * i);
                        if (this.m_velocity < 0)
                            this.m_velocity = 0;
                    }
                    break;
                case "l":
                    this.m_length = this.len2tick(this.getUInt(0));
                    this.m_length = this.getDot(this.m_length);
                    break;
                case "t":
                    this.m_tempo = this.getUNumber(this.m_tempo);
                    if (this.m_tempo < 1)
                        this.m_tempo = 1;
                    this.m_tracks[flmml.MTrack.TEMPO_TRACK].recTempo(this.m_tracks[this.m_trackNo].getRecGlobalTick(), this.m_tempo);
                    break;
                case "q":
                    this.m_gate = this.getUInt(this.m_gate);
                    this.m_tracks[this.m_trackNo].recGate(this.m_gate / this.m_maxGate);
                    break;
                case "<":
                    if (this.m_relativeDir)
                        this.m_octave++;
                    else
                        this.m_octave--;
                    break;
                case ">":
                    if (this.m_relativeDir)
                        this.m_octave--;
                    else
                        this.m_octave++;
                    break;
                case ";":
                    this.m_keyoff = 1;
                    if (this.m_tracks[this.m_trackNo].getNumEvents() > 0) {
                        this.m_trackNo++;
                    }
                    this.m_tracks[this.m_trackNo] = this.createTrack();
                    break;
                case "@":
                    this.atmark();
                    break;
                case "x":
                    this.m_tracks[this.m_trackNo].recVolMode(this.getUInt(1));
                    break;
                case "n":
                    c0 = this.getChar();
                    if (c0.s === "s") {
                        this.next();
                        this.m_noteShift = this.getSInt(this.m_noteShift);
                    }
                    else
                        this.warning(flmml.MWarning.UNKNOWN_COMMAND, this.getCharPrev().concat(c0));
                    break;
                case '[':
                    this.m_tracks[this.m_trackNo].recChordStart();
                    break;
                case ']':
                    this.m_tracks[this.m_trackNo].recChordEnd();
                    break;
                default:
                    {
                        var cc = c.s.charCodeAt(0);
                        if (cc < 128)
                            this.warning(flmml.MWarning.UNKNOWN_COMMAND, this.getCharPrev());
                    }
                    break;
            }
        };
        MML.prototype.getEventById = function (eventId) {
            return flmml.MEvent.getById(eventId);
        };
        MML.prototype.getCharPrev = function () {
            return (this.m_letter < this.m_string.length) ? this.m_string.charAt(this.m_letter - 1) : new MappedString();
        };
        MML.prototype.getRawCharNext = function () {
            return this.m_string.s.charAt(this.m_letter++);
        };
        MML.prototype.getRawChar = function () {
            return this.m_string.s.charAt(this.m_letter);
        };
        MML.prototype.getChar = function () {
            return (this.m_letter < this.m_string.length) ? this.m_string.charAt(this.m_letter) : new MappedString();
        };
        MML.prototype.getCharNext = function () {
            return (this.m_letter < this.m_string.length) ? this.m_string.charAt(this.m_letter++) : new MappedString();
        };
        MML.prototype.next = function (i) {
            if (i === void 0) { i = 1; }
            this.m_letter += 1;
        };
        MML.prototype.getKeySig = function () {
            var k = 0;
            var f = 1;
            while (f) {
                var c = this.getRawChar();
                switch (c) {
                    case "+":
                    case "#":
                        k++;
                        this.next();
                        break;
                    case "-":
                        k--;
                        this.next();
                        break;
                    default:
                        f = 0;
                        break;
                }
            }
            return k;
        };
        MML.prototype.getUInt = function (def) {
            var ret = 0;
            var l = this.m_letter;
            var f = 1;
            while (f) {
                var c = this.getRawChar();
                switch (c) {
                    case '0':
                        ret = ret * 10 + 0;
                        this.next();
                        break;
                    case '1':
                        ret = ret * 10 + 1;
                        this.next();
                        break;
                    case '2':
                        ret = ret * 10 + 2;
                        this.next();
                        break;
                    case '3':
                        ret = ret * 10 + 3;
                        this.next();
                        break;
                    case '4':
                        ret = ret * 10 + 4;
                        this.next();
                        break;
                    case '5':
                        ret = ret * 10 + 5;
                        this.next();
                        break;
                    case '6':
                        ret = ret * 10 + 6;
                        this.next();
                        break;
                    case '7':
                        ret = ret * 10 + 7;
                        this.next();
                        break;
                    case '8':
                        ret = ret * 10 + 8;
                        this.next();
                        break;
                    case '9':
                        ret = ret * 10 + 9;
                        this.next();
                        break;
                    default:
                        f = 0;
                        break;
                }
            }
            return (this.m_letter === l) ? def : ret;
        };
        MML.prototype.getUNumber = function (def) {
            var ret = this.getUInt(def | 0);
            var l = 1;
            if (this.getRawChar() === '.') {
                this.next();
                var f = true;
                while (f) {
                    var c = this.getRawChar();
                    l *= 0.1;
                    switch (c) {
                        case '0':
                            ret = ret + 0 * l;
                            this.next();
                            break;
                        case '1':
                            ret = ret + 1 * l;
                            this.next();
                            break;
                        case '2':
                            ret = ret + 2 * l;
                            this.next();
                            break;
                        case '3':
                            ret = ret + 3 * l;
                            this.next();
                            break;
                        case '4':
                            ret = ret + 4 * l;
                            this.next();
                            break;
                        case '5':
                            ret = ret + 5 * l;
                            this.next();
                            break;
                        case '6':
                            ret = ret + 6 * l;
                            this.next();
                            break;
                        case '7':
                            ret = ret + 7 * l;
                            this.next();
                            break;
                        case '8':
                            ret = ret + 8 * l;
                            this.next();
                            break;
                        case '9':
                            ret = ret + 9 * l;
                            this.next();
                            break;
                        default:
                            f = false;
                            break;
                    }
                }
            }
            return ret;
        };
        MML.prototype.getSInt = function (def) {
            var c = this.getRawChar();
            var s = 1;
            if (c === '-') {
                s = -1;
                this.next();
            }
            else if (c === '+')
                this.next();
            return this.getUInt(def) * s;
        };
        MML.prototype.getDot = function (tick) {
            var c = this.getRawChar();
            var intick = tick;
            while (c === '.') {
                this.next();
                intick /= 2;
                tick += intick;
                c = this.getRawChar();
            }
            return tick;
        };
        MML.prototype.createTrack = function () {
            this.m_octave = 4;
            this.m_velocity = 100;
            this.m_noteShift = 0;
            return new flmml.MTrack();
        };
        MML.prototype.begin = function () {
            this.m_letter = 0;
        };
        MML.prototype.process = function () {
            this.begin();
            while (this.m_letter < this.m_string.length) {
                this.firstLetter();
            }
        };
        MML.prototype.processRepeat = function () {
            this.m_string.mapLowerCase();
            this.begin();
            var repeat = new Array();
            var origin = new Array();
            var start = new Array();
            var last = new Array();
            var nest = -1;
            while (this.m_letter < this.m_string.length) {
                var c = this.getRawCharNext();
                switch (c) {
                    case '/':
                        if (this.getRawChar() === ':') {
                            this.next();
                            origin[++nest] = this.m_letter - 2;
                            repeat[nest] = this.getUInt(2);
                            start[nest] = this.m_letter;
                            last[nest] = -1;
                        }
                        else if (nest >= 0) {
                            last[nest] = this.m_letter - 1;
                            this.m_string.mapRemove(this.m_letter - 1, this.m_letter - 1);
                            this.m_letter--;
                        }
                        else {
                        }
                        break;
                    case ':':
                        if (this.getRawChar() === '/' && nest >= 0) {
                            this.next();
                            var contents1 = this.m_string.substring(start[nest], this.m_letter - 2);
                            var contents2 = this.m_string.substring(start[nest], last[nest]);
                            var begin = origin[nest];
                            var newstr = new MappedString();
                            for (var i = 0; i < repeat[nest]; i++) {
                                var contents = (i < repeat[nest] - 1 || last[nest] < 0 ? contents1 : contents2).clone();
                                contents.pushRef('Repeat ' + (i + 1).toString(10) + '/' + repeat[nest].toString(10));
                                newstr.append(contents);
                            }
                            this.m_string.mapReplaceRange(begin, this.m_letter, newstr);
                            this.m_letter = begin + newstr.length;
                            nest--;
                        }
                        break;
                    default:
                        break;
                }
            }
            if (nest >= 0)
                this.warning(flmml.MWarning.UNCLOSED_REPEAT, "");
        };
        MML.prototype.replaceMacro = function (macroTable) {
            for (var m in macroTable) {
                var macro = macroTable[m];
                if (this.m_string.s.substr(this.m_letter, macro.id.length) === macro.id) {
                    var refPos = this.getCharPrev().position;
                    var start = this.m_letter, last = this.m_letter + macro.id.length;
                    var code = macro.code;
                    this.m_letter += macro.id.length;
                    var c = this.getRawCharNext();
                    while (!reNonWhitespace.test(c)) {
                        c = this.getRawCharNext();
                    }
                    var args = new Array();
                    var q = 0;
                    if (macro.args.length > 0) {
                        if (c === "{") {
                            c = this.getRawCharNext();
                            while (q === 1 || (c !== "}" && c !== "")) {
                                if (c === '"')
                                    q = 1 - q;
                                if (c === "$") {
                                    this.replaceMacro(macroTable);
                                }
                                c = this.getRawCharNext();
                            }
                            last = this.m_letter;
                            var argstr = this.m_string.substring(start + macro.id.length + 1, last - 1);
                            var curarg = new MappedString(), quoted = false;
                            for (var pos = 0; pos < argstr.length; pos++) {
                                if (!quoted && argstr.charAt(pos).s === '"') {
                                    quoted = true;
                                }
                                else if (quoted && (pos + 1) < argstr.length && argstr.charAt(pos).s === '\\' && argstr.charAt(pos + 1).s === '"') {
                                    curarg.appendRaw('"');
                                    pos++;
                                }
                                else if (quoted && argstr.charAt(pos).s === '"') {
                                    quoted = false;
                                }
                                else if (!quoted && argstr.charAt(pos).s === ',') {
                                    args.push(curarg);
                                    curarg = new MappedString();
                                }
                                else {
                                    curarg.append(argstr.charAt(pos));
                                }
                            }
                            args.push(curarg);
                            if (quoted) {
                                this.warning(flmml.MWarning.UNCLOSED_ARGQUOTE, "");
                            }
                        }
                        for (var i = 0; i < code.length; i++) {
                            for (var j = 0; j < args.length; j++) {
                                if (j >= macro.args.length) {
                                    break;
                                }
                                var arg = macro.args[j];
                                if (code.substr(i, arg.id.length + 1).s === ("%" + arg.id)) {
                                    code = code.substring(0, i).concat(code.substring(i).replace("%" + arg.id, args[arg.index]));
                                    i += args[arg.index].length - 1;
                                    break;
                                }
                            }
                        }
                    }
                    var appearPos = this.m_string.charAt(start - 1);
                    code = code.clone().pushRef("$" + macro.id, refPos);
                    this.m_string.mapReplaceRange(start - 1, last, code);
                    this.m_letter = start - 1;
                    return true;
                }
            }
            return false;
        };
        MML.prototype.processMacro = function () {
            var i;
            var matched;
            var exp = /^#OCTAVE\s+REVERSE\s*$/m;
            if (this.m_string.match(exp)) {
                this.m_string.mapReplace(exp);
                this.m_relativeDir = false;
            }
            exp = /^#VELOCITY\s+REVERSE\s*$/m;
            if (this.m_string.match(exp)) {
                this.m_string.mapReplace(exp);
                this.m_velDir = false;
            }
            this.m_metaTitle = this.findMetaDescN("TITLE");
            this.m_metaArtist = this.findMetaDescN("ARTIST");
            this.m_metaComment = this.findMetaDescN("COMMENT");
            this.m_metaCoding = this.findMetaDescN("CODING");
            this.findMetaDescN("PRAGMA");
            exp = /^#OPM@(\d+)[ \t]*{([^}]*)}/gm;
            matched = this.m_string.match(exp);
            if (matched) {
                this.m_string.mapReplace(exp);
                var fmm;
                for (i = 0; i < matched.length; i++) {
                    fmm = matched[i].match(/^#OPM@(\d+)[ \t]*{([^}]*)}/m);
                    flmml.MOscOPM.setTimber(parseInt(fmm[1]), flmml.MOscOPM.TYPE_OPM, fmm[2]);
                }
            }
            exp = /^#OPN@(\d+)[ \t]*{([^}]*)}/gm;
            matched = this.m_string.match(exp);
            if (matched) {
                this.m_string.mapReplace(exp);
                var fmn;
                for (i = 0; i < matched.length; i++) {
                    fmn = matched[i].match(/^#OPN@(\d+)[ \t]*{([^}]*)}/m);
                    flmml.MOscOPM.setTimber(parseInt(fmn[1]), flmml.MOscOPM.TYPE_OPN, fmn[2]);
                }
            }
            var fmg = this.findMetaDescV("FMGAIN");
            for (i = 0; i < fmg.length; i++) {
                flmml.MOscOPM.setCommonGain(20.0 * parseInt(fmg[i]) / 127.0);
            }
            {
                var usePoly = this.findMetaDescN("USING\\s+POLY");
                usePoly = usePoly.replace("\r", "");
                usePoly = usePoly.replace("\n", " ");
                usePoly = usePoly.toLowerCase();
                if (usePoly.length > 0) {
                    var ss = usePoly.split(" ");
                    if (ss.length < 1) {
                        this.m_usingPoly = false;
                    }
                    else {
                        this.m_usingPoly = true;
                        this.m_polyVoice = Math.min(Math.max(1, parseInt(ss[0])), MML.MAX_POLYVOICE);
                    }
                    for (i = 1; i < ss.length; i++) {
                        if (ss[i] === "force") {
                            this.m_polyForce = true;
                        }
                    }
                    if (this.m_polyVoice <= 1) {
                        this.m_usingPoly = false;
                        this.m_polyForce = false;
                    }
                }
            }
            {
                exp = /^#WAV10\s.*$/gm;
                matched = this.m_string.match(exp);
                if (matched) {
                    for (i = 0; i < matched.length; i++) {
                        this.m_string.mapReplace(exp);
                        var wav = matched[i].split(" ");
                        var wavs = "";
                        for (var j = 1; j < wav.length; j++)
                            wavs += wav[j];
                        var arg = wavs.split(",");
                        var waveNo = parseInt(arg[0]);
                        if (waveNo < 0)
                            waveNo = 0;
                        if (waveNo >= flmml.MOscGbWave.MAX_WAVE)
                            waveNo = flmml.MOscGbWave.MAX_WAVE - 1;
                        flmml.MOscGbWave.setWave(waveNo, (arg[1].toLowerCase() + "00000000000000000000000000000000").substr(0, 32));
                    }
                }
                exp = /^#WAV13\s.*$/gm;
                matched = this.m_string.match(exp);
                if (matched) {
                    for (i = 0; i < matched.length; i++) {
                        this.m_string.mapReplace(exp);
                        wav = matched[i].split(" ");
                        wavs = "";
                        for (j = 1; j < wav.length; j++)
                            wavs += wav[j];
                        arg = wavs.split(",");
                        waveNo = parseInt(arg[0]);
                        if (waveNo < 0)
                            waveNo = 0;
                        if (waveNo >= flmml.MOscWave.MAX_WAVE)
                            waveNo = flmml.MOscWave.MAX_WAVE - 1;
                        flmml.MOscWave.setWave(waveNo, arg[1].toLowerCase());
                    }
                }
                exp = /^#WAV9\s.*$/gm;
                matched = this.m_string.match(exp);
                if (matched) {
                    for (i = 0; i < matched.length; i++) {
                        this.m_string.mapReplace(exp);
                        wav = matched[i].split(" ");
                        wavs = "";
                        for (j = 1; j < wav.length; j++)
                            wavs += wav[j];
                        arg = wavs.split(",");
                        waveNo = parseInt(arg[0]);
                        if (waveNo < 0)
                            waveNo = 0;
                        if (waveNo >= flmml.MOscFcDpcm.MAX_WAVE)
                            waveNo = flmml.MOscFcDpcm.MAX_WAVE - 1;
                        var intVol = parseInt(arg[1]);
                        if (intVol < 0)
                            intVol = 0;
                        if (intVol > 127)
                            intVol = 127;
                        var loopFg = parseInt(arg[2]);
                        if (loopFg < 0)
                            loopFg = 0;
                        if (loopFg > 1)
                            loopFg = 1;
                        flmml.MOscFcDpcm.setWave(waveNo, intVol, loopFg, arg[3]);
                    }
                }
            }
            this.begin();
            var top = true;
            var macroTable = new Array();
            var regTrimHead = /^\s*/m;
            var regTrimFoot = /\s*$/m;
            while (this.m_letter < this.m_string.length) {
                var c = this.getRawCharNext();
                switch (c) {
                    case '$':
                        if (top) {
                            var last = this.m_string.indexOf(";", this.m_letter);
                            if (last > this.m_letter) {
                                var nameEnd = this.m_string.indexOf("=", this.m_letter);
                                if (nameEnd > this.m_letter && nameEnd < last) {
                                    var start = this.m_letter;
                                    var argspos = this.m_string.indexOf("{");
                                    if (argspos < 0 || argspos >= nameEnd) {
                                        argspos = nameEnd;
                                    }
                                    var idPartMapped = this.m_string.substring(start, argspos);
                                    var idPart = idPartMapped.s;
                                    var regexResult = idPart.match("[a-zA-Z_][a-zA-Z_0-9#\+\(\)]*");
                                    if (regexResult !== null) {
                                        var id = regexResult[0];
                                        idPart = idPart.replace(regTrimHead, '').replace(regTrimFoot, '');
                                        if (idPart !== id) {
                                            this.warning(flmml.MWarning.INVALID_MACRO_NAME, idPartMapped);
                                        }
                                        if (id.length > 0) {
                                            var args = new Array();
                                            if (argspos < nameEnd) {
                                                var argstr = this.m_string.substring(argspos + 1, this.m_string.indexOf("}", argspos));
                                                args = argstr.split(",");
                                                for (i = 0; i < args.length; i++) {
                                                    var argid = args[i].match("[a-zA-Z_][a-zA-Z_0-9#\+\(\)]*");
                                                    args[i] = { id: (argid !== null ? argid[0] : ""), index: i };
                                                }
                                                args.sort(function (a, b) {
                                                    if (a.id.length > b.id.length)
                                                        return -1;
                                                    if (a.id.length === b.id.length)
                                                        return 0;
                                                    return 1;
                                                });
                                            }
                                            this.m_letter = nameEnd + 1;
                                            c = this.getRawCharNext();
                                            while (this.m_letter < last) {
                                                if (c === "$") {
                                                    if (!this.replaceMacro(macroTable)) {
                                                        if (this.m_string.substr(this.m_letter, id.length).s === id) {
                                                            this.m_letter--;
                                                            this.m_string.mapRemove(this.m_letter, this.m_letter + id.length);
                                                            this.warning(flmml.MWarning.RECURSIVE_MACRO, id);
                                                        }
                                                    }
                                                    last = this.m_string.indexOf(";", this.m_letter);
                                                }
                                                c = this.getRawCharNext();
                                            }
                                            var pos = 0;
                                            for (; pos < macroTable.length; pos++) {
                                                if (macroTable[pos].id === id) {
                                                    macroTable.splice(pos, 1);
                                                    pos--;
                                                    continue;
                                                }
                                                if (macroTable[pos].id.length < id.length) {
                                                    break;
                                                }
                                            }
                                            macroTable.splice(pos, 0, { id: id, code: this.m_string.substring(nameEnd + 1, last), args: args });
                                            this.m_string.mapRemove(start - 1, last);
                                            this.m_letter = start - 1;
                                        }
                                    }
                                }
                                else {
                                    this.replaceMacro(macroTable);
                                    top = false;
                                }
                            }
                            else {
                                this.replaceMacro(macroTable);
                                top = false;
                            }
                        }
                        else {
                            this.replaceMacro(macroTable);
                            top = false;
                        }
                        break;
                    case ';':
                        top = true;
                        break;
                    default:
                        if (reNonWhitespace.test(c)) {
                            top = false;
                        }
                        break;
                }
            }
        };
        MML.prototype.findMetaDescV = function (sectionName) {
            var i;
            var matched;
            var mm;
            var e1;
            var e2;
            var tt = new Array();
            e1 = new RegExp("^#" + sectionName + "(\\s*|\\s+(.*))$", "gm");
            e2 = new RegExp("^#" + sectionName + "(\\s*|\\s+(.*))$", "m");
            matched = this.m_string.match(e1);
            if (matched) {
                this.m_string.mapReplace(e1);
                for (i = 0; i < matched.length; i++) {
                    mm = matched[i].match(e2);
                    if (mm[2] !== undefined) {
                        tt.push(mm[2]);
                    }
                }
            }
            return tt;
        };
        MML.prototype.findMetaDescN = function (sectionName) {
            var i;
            var matched;
            var mm;
            var e1;
            var e2;
            var tt = "";
            e1 = new RegExp("^#" + sectionName + "(\\s*|\\s+(.*))$", "gm");
            e2 = new RegExp("^#" + sectionName + "(\\s*|\\s+(.*))$", "m");
            matched = this.m_string.match(e1);
            if (matched) {
                this.m_string.mapReplace(e1);
                for (i = 0; i < matched.length; i++) {
                    mm = matched[i].match(e2);
                    if (mm[2] !== undefined) {
                        tt += mm[2];
                        if (i + 1 < matched.length) {
                            tt += "\n";
                        }
                    }
                }
            }
            return tt;
        };
        MML.prototype.processComment = function (str) {
            str = str.replace(/\r\n?/g, "\n");
            this.m_source = new SourceString(str);
            this.m_string = new MappedString(str);
            this.begin();
            var commentStart = -1;
            while (this.m_letter < this.m_string.length) {
                var c = this.getRawCharNext();
                switch (c) {
                    case '/':
                        if (this.getRawChar() === '*') {
                            if (commentStart < 0)
                                commentStart = this.m_letter - 1;
                            this.next();
                        }
                        break;
                    case '*':
                        if (this.getRawChar() === '/') {
                            if (commentStart >= 0) {
                                this.m_string.mapRemove(commentStart, this.m_letter);
                                this.m_letter = commentStart;
                                commentStart = -1;
                            }
                            else {
                                this.warning(flmml.MWarning.UNOPENED_COMMENT, "");
                            }
                        }
                        break;
                    default:
                        break;
                }
            }
            if (commentStart >= 0)
                this.warning(flmml.MWarning.UNCLOSED_COMMENT, "");
            this.begin();
            commentStart = -1;
            while (this.m_letter < this.m_string.length) {
                if (this.getRawCharNext() === '`') {
                    if (commentStart < 0) {
                        commentStart = this.m_letter - 1;
                    }
                    else {
                        this.m_string.mapRemove(commentStart, this.m_letter - 1);
                        this.m_letter = commentStart;
                        commentStart = -1;
                    }
                }
            }
        };
        MML.prototype.processGroupNotes = function () {
            var GroupNotesStart = -1;
            var GroupNotesEnd;
            var noteCount = 0;
            var repend, len, tick, tick2, tickdiv, noteTick, noteOn;
            var lenMode;
            var defLen = 96;
            var newstr;
            this.begin();
            while (this.m_letter < this.m_string.length) {
                var c = this.getRawCharNext();
                switch (c) {
                    case 'l':
                        defLen = this.len2tick(this.getUInt(0));
                        defLen = this.getDot(defLen);
                        break;
                    case '{':
                        GroupNotesStart = this.m_letter - 1;
                        noteCount = 0;
                        break;
                    case '}':
                        repend = this.m_letter;
                        if (GroupNotesStart < 0) {
                            this.warning(flmml.MWarning.UNOPENED_GROUPNOTES, "");
                        }
                        tick = 0;
                        while (1) {
                            if (this.getRawChar() !== '%') {
                                lenMode = 0;
                            }
                            else {
                                lenMode = 1;
                                this.next();
                            }
                            len = this.getUInt(0);
                            if (len === 0) {
                                if (tick === 0)
                                    tick = defLen;
                                break;
                            }
                            tick2 = (lenMode ? len : this.len2tick(len));
                            tick2 = this.getDot(tick2);
                            tick += tick2;
                            if (this.getRawChar() !== '&') {
                                break;
                            }
                            this.next();
                        }
                        GroupNotesEnd = this.m_letter;
                        this.m_letter = GroupNotesStart + 1;
                        newstr = new MappedString();
                        tick2 = 0;
                        tickdiv = tick / noteCount;
                        noteCount = 1;
                        noteOn = 0;
                        while (this.m_letter < repend) {
                            c = this.getRawCharNext();
                            switch (c) {
                                case '+':
                                case '#':
                                case '-':
                                    break;
                                default:
                                    if ((c >= 'a' && c <= 'g') || c === 'r') {
                                        if (noteOn === 0) {
                                            noteOn = 1;
                                            break;
                                        }
                                    }
                                    if (noteOn === 1) {
                                        noteTick = Math.round(noteCount * tickdiv - tick2);
                                        noteCount++;
                                        tick2 += noteTick;
                                        if (tick2 > tick) {
                                            noteTick -= (tick2 - tick);
                                            tick2 = tick;
                                        }
                                        newstr.append(new MappedString("%"));
                                        newstr.append(new MappedString(noteTick.toString()));
                                    }
                                    noteOn = 0;
                                    if ((c >= 'a' && c <= 'g') || c === 'r') {
                                        noteOn = 1;
                                    }
                                    break;
                            }
                            if (c !== '}') {
                                newstr.append(this.getCharPrev());
                            }
                        }
                        newstr.pushRef('Group notes');
                        this.m_letter = GroupNotesStart + newstr.length;
                        this.m_string.mapReplaceRange(GroupNotesStart, GroupNotesEnd, newstr);
                        GroupNotesStart = -1;
                        break;
                    default:
                        if ((c >= 'a' && c <= 'g') || c === 'r') {
                            noteCount++;
                        }
                        break;
                }
            }
            if (GroupNotesStart >= 0)
                this.warning(flmml.MWarning.UNCLOSED_GROUPNOTES, "");
        };
        MML.prototype.play = function (str, compileOnly, mutedTracks) {
            if (compileOnly === void 0) { compileOnly = false; }
            console.log('[#W:1-1] MML#play called (compileOnly=%s)', compileOnly);
            if (this.m_offlineFormat) {
                this.play2(str, compileOnly);
                return;
            }
            if (compileOnly || this.m_lastMML !== str) {
                this.m_sequencer.stop();
                this.m_compiledButNotPlayed = false;
            }
            if (this.m_sequencer.isPaused() && !compileOnly || this.m_compiledButNotPlayed) {
                console.log('[#W:1-X] MML#play compileOnly calling MSequencer#play');
                if (!compileOnly) {
                    this.m_sequencer.play();
                    this.m_compiledButNotPlayed = false;
                }
                return;
            }
            console.log('[#W:1-2] MML#play binding Messenger#onstopsound');
            msgr.onstopsound = this.play2.bind(this, str, compileOnly, mutedTracks);
            msgr.stopSound(true);
        };
        MML.prototype.play2 = function (str, compileOnly, mutedTracks) {
            if (compileOnly === void 0) { compileOnly = false; }
            console.log('[#W:4-2] MML#play2 called, compiling MML (compileOnly=%s)', compileOnly);
            msgr.compileStart();
            this.m_lastMML = str;
            flmml.MEvent.resetCounter();
            this.m_sequencer.disconnectAll();
            this.m_tracks = new Array();
            this.m_tracks[0] = this.createTrack();
            this.m_tracks[1] = this.createTrack();
            this.m_warning = [];
            this.m_trackNo = flmml.MTrack.FIRST_TRACK;
            this.m_octave = 4;
            this.m_relativeDir = true;
            this.m_velocity = 100;
            this.m_velDetail = true;
            this.m_velDir = true;
            this.m_length = this.len2tick(4);
            this.m_tempo = flmml.MTrack.DEFAULT_BPM;
            this.m_keyoff = 1;
            this.m_gate = 15;
            this.m_maxGate = 16;
            this.m_form = flmml.MOscillator.PULSE;
            this.m_noteShift = 0;
            this.m_maxPipe = 0;
            this.m_maxSyncSource = 0;
            this.m_beforeNote = 0;
            this.m_portamento = 0;
            this.m_usingPoly = false;
            this.m_polyVoice = 1;
            this.m_polyForce = false;
            this.m_metaTitle = "";
            this.m_metaArtist = "";
            this.m_metaCoding = "";
            this.m_metaComment = "";
            this.processComment(str);
            this.processMacro();
            this.m_string.mapRemoveWhitespace();
            this.processRepeat();
            this.processGroupNotes();
            this.process();
            if (this.m_tracks[this.m_tracks.length - 1].getNumEvents() === 0)
                this.m_tracks.pop();
            this.m_tracks[flmml.MTrack.TEMPO_TRACK].conduct(this.m_tracks, this.trackEndMarginMSec);
            for (var i = flmml.MTrack.TEMPO_TRACK; i < this.m_tracks.length; i++) {
                if (i > flmml.MTrack.TEMPO_TRACK) {
                    if (this.m_usingPoly && (this.m_polyForce || this.m_tracks[i].findPoly())) {
                        this.m_tracks[i].usingPoly(this.m_polyVoice);
                    }
                    this.m_tracks[i].recRestMSec(this.channelEndMarginMSec);
                    this.m_tracks[i].recClose();
                }
                this.m_sequencer.connect(this.m_tracks[i]);
            }
            this.m_sequencer.createPipes(this.m_maxPipe + 1);
            this.m_sequencer.createSyncSources(this.m_maxSyncSource + 1);
            msgr.compileComplete();
            if (mutedTracks) {
                for (var _i = 0; _i < mutedTracks.length; _i++) {
                    var track = mutedTracks[_i];
                    this.mute(track, true);
                }
            }
            if (!compileOnly)
                this.m_sequencer.play();
            this.m_compiledButNotPlayed = compileOnly;
            console.log('[#W:4-4] MML#play2 unbinding Messenger#onstopsound');
            msgr.onstopsound = null;
        };
        MML.prototype.stop = function () {
            this.m_sequencer.stop();
        };
        MML.prototype.pause = function () {
            this.m_sequencer.pause();
        };
        MML.prototype.resume = function () {
            this.m_sequencer.play();
        };
        MML.prototype.isPlaying = function () {
            if (!this.m_sequencer)
                return false;
            return this.m_sequencer.isPlaying();
        };
        MML.prototype.isPaused = function () {
            if (!this.m_sequencer)
                return false;
            return this.m_sequencer.isPaused();
        };
        MML.prototype.mute = function (iTrack, f) {
            if (iTrack == flmml.MTrack.TEMPO_TRACK)
                return;
            this.m_tracks[iTrack].mute(f);
        };
        MML.prototype.isMuted = function (iTrack) {
            return this.m_tracks[iTrack].isMuted();
        };
        MML.prototype.muteAll = function (f) {
            for (var i = flmml.MTrack.FIRST_TRACK; i < this.m_tracks.length; i++) {
                this.m_tracks[i].mute(f);
            }
        };
        MML.prototype.getTotalMSec = function () {
            if (!this.m_tracks)
                return 0;
            return this.m_tracks[flmml.MTrack.TEMPO_TRACK].getTotalMSec();
        };
        MML.prototype.getTotalTimeStr = function () {
            if (!this.m_tracks)
                return '00:00';
            return this.m_tracks[flmml.MTrack.TEMPO_TRACK].getTotalTimeStr();
        };
        MML.prototype.getNowMSec = function () {
            if (!this.m_sequencer)
                return 0;
            return this.m_sequencer.getNowMSec();
        };
        MML.prototype.getNowTimeStr = function () {
            if (!this.m_sequencer)
                return '00:00';
            return this.m_sequencer.getNowTimeStr();
        };
        MML.prototype.getVoiceCount = function () {
            if (!this.m_tracks)
                return 0;
            var i;
            var c = 0;
            for (i = 0; i < this.m_tracks.length; i++) {
                c += this.m_tracks[i].getVoiceCount();
            }
            return c;
        };
        MML.prototype.getMetaTitle = function () {
            return this.m_metaTitle;
        };
        MML.prototype.getMetaComment = function () {
            return this.m_metaComment;
        };
        MML.prototype.getMetaArtist = function () {
            return this.m_metaArtist;
        };
        MML.prototype.getMetaCoding = function () {
            return this.m_metaCoding;
        };
        MML.MAX_PIPE = 3;
        MML.MAX_SYNCSOURCE = 3;
        MML.MAX_POLYVOICE = 64;
        return MML;
    })();
    flmml.MML = MML;
})(flmml || (flmml = {}));


var WavEncoder = require("wav-encoder");
var messenger;
(function (messenger) {
    var MML = flmml.MML;
    var COM_BOOT = 1, COM_PLAY = 2, COM_STOP = 3, COM_PAUSE = 4, COM_BUFFER = 5, COM_COMPCOMP = 6, COM_BUFRING = 7, COM_COMPLETE = 8, COM_SYNCINFO = 9, COM_PLAYSOUND = 10, COM_STOPSOUND = 11, COM_DEBUG = 12, COM_TRACE = 13, COM_MUTE = 14, COM_GENWAV = 15, COM_TERMINATE = 16, COM_LOG = 17, COM_COMPSTART = 18;
    var Messenger = (function () {
        function Messenger() {
            this.onstopsound = null;
            this.onrequestbuffer = null;
            this.onInfoTimerBinded = this.onInfoTimer.bind(this);
            addEventListener("message", this.onMessage.bind(this));
        }
        Messenger.prototype.onMessage = function (e) {
            var data = e.data, type = data.type, mml = this.mml;
            switch (type) {
                case COM_BOOT:
                    this.SAMPLE_RATE = data.sampleRate;
                    this.BUFFER_SIZE = data.bufferSize;
                    this.BUFFER_MULTIPLE = data.bufferMultiple;
                    mml = this.mml = new MML(data.offlineFormat, this.BUFFER_MULTIPLE);
                    if (data.offlineFormat && data.mml != null)
                        mml.play(data.mml);
                    break;
                case COM_PLAY:
                    mml.play(data.mml, data.compileOnly, data.mutedTracks);
                    break;
                case COM_STOP:
                    mml.stop();
                    this.syncInfo();
                    break;
                case COM_PAUSE:
                    mml.pause();
                    this.syncInfo();
                    break;
                case COM_MUTE:
                    mml.mute(data.track, data.mute);
                    break;
                case COM_BUFFER:
                    this.onrequestbuffer && this.onrequestbuffer(data);
                    break;
                case COM_SYNCINFO:
                    if (typeof data.interval === "number") {
                        this.infoInterval = data.interval;
                        clearInterval(this.tIDInfo);
                        if (this.infoInterval > 0 && this.mml.isPlaying()) {
                            this.tIDInfo = setInterval(this.onInfoTimerBinded, this.infoInterval);
                        }
                    }
                    else {
                        this.syncInfo();
                    }
                    break;
                case COM_STOPSOUND:
                    console.log('[#W:4-1] Messenger received COM_STOPSOUND');
                    this.onstopsound && this.onstopsound();
                    break;
                case COM_TRACE:
                    this.responseTrace(data.eventId);
                    break;
                case COM_GENWAV:
                    mml.play(data.mml);
                    break;
                case COM_TERMINATE:
                    self.close();
                    break;
            }
        };
        Messenger.prototype.buffering = function (progress) {
            postMessage({ type: COM_BUFRING, progress: progress });
        };
        Messenger.prototype.compileStart = function () {
            postMessage({ type: COM_COMPSTART });
        };
        Messenger.prototype.compileComplete = function () {
            console.log('[#W:4-2] Messenger#compileComplete called, sending COM_COMPCOMP to MAIN THREAD');
            var mml = this.mml;
            var msg = {
                type: COM_COMPCOMP,
                mml: mml.getSourceString(),
                info: {
                    totalMSec: mml.getTotalMSec(),
                    totalTimeStr: mml.getTotalTimeStr(),
                    warnings: mml.getWarnings(),
                    metaTitle: mml.getMetaTitle(),
                    metaComment: mml.getMetaComment(),
                    metaArtist: mml.getMetaArtist(),
                    metaCoding: mml.getMetaCoding()
                },
                events: mml['m_tracks'].map(function (track) {
                    return track['m_events'].map(function (event) {
                        return [
                            event.getId(),
                            event['m_tick'],
                            event['m_status'],
                            event['m_data0'],
                            event['m_data1']
                        ];
                    });
                })
            };
            postMessage(msg);
            this.syncInfo();
        };
        Messenger.prototype.sendWav = function (buffer, format) {
            switch (format) {
                case 'wav':
                    WavEncoder.encode({
                        sampleRate: this.SAMPLE_RATE,
                        channelData: buffer
                    }).then(function (wav) {
                        postMessage({
                            type: COM_GENWAV,
                            format: 'wav',
                            data: wav
                        });
                    });
                    break;
                default:
                    postMessage({
                        type: COM_GENWAV,
                        format: 'raw',
                        data: buffer
                    });
                    break;
            }
        };
        Messenger.prototype.playSound = function () {
            postMessage({ type: COM_PLAYSOUND });
            this.syncInfo();
        };
        Messenger.prototype.stopSound = function (isFlushBuf) {
            if (isFlushBuf === void 0) { isFlushBuf = false; }
            console.log('[#W:2] Messenger#stopSound called, sending COM_STOPSOUND to MAIN THREAD');
            postMessage({ type: COM_STOPSOUND, isFlushBuf: isFlushBuf });
        };
        Messenger.prototype.sendBuffer = function (buffer) {
            postMessage({ type: COM_BUFFER, buffer: buffer }, [buffer[0].buffer, buffer[1].buffer]);
        };
        Messenger.prototype.complete = function () {
            postMessage({ type: COM_COMPLETE });
            this.syncInfo();
        };
        Messenger.prototype.syncInfo = function () {
            var mml = this.mml;
            var msg;
            if (mml) {
                msg = {
                    type: COM_SYNCINFO,
                    info: {
                        _isPlaying: mml.isPlaying(),
                        _isPaused: mml.isPaused(),
                        nowMSec: mml.getNowMSec(),
                        nowTimeStr: mml.getNowTimeStr(),
                        voiceCount: mml.getVoiceCount()
                    }
                };
            }
            else {
                msg = {
                    type: COM_SYNCINFO,
                    info: {
                        _isPlaying: false,
                        _isPaused: false,
                        nowMSec: 0,
                        nowTimeStr: '00:00',
                        voiceCount: 0
                    }
                };
            }
            this.lastInfoTime = self.performance ? self.performance.now() : new Date().getTime();
            postMessage(msg);
        };
        Messenger.prototype.responseTrace = function (eventId) {
            postMessage({
                type: COM_TRACE,
                eventId: eventId,
                trace: this.mml.getEventById(eventId).getTrace()
            });
        };
        Messenger.prototype.onInfoTimer = function () {
            if (this.mml.isPlaying()) {
                this.syncInfo();
            }
            else {
                clearInterval(this.tIDInfo);
            }
        };
        Messenger.prototype.debug = function (str) {
            if (str === void 0) { str = ""; }
            postMessage({ type: COM_DEBUG, str: str });
        };
        return Messenger;
    })();
    messenger.Messenger = Messenger;
    console['log'] = function () {
        postMessage({ type: COM_LOG, args: Array.prototype.slice.call(arguments) });
    };
})(messenger || (messenger = {}));
var msgr = new messenger.Messenger();






}).call(this,require("TwOfRe"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/fake_1d9f046a.js","/")
},{"TwOfRe":12,"buffer":9,"wav-encoder":1}],9:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
 * @license  MIT
 */

var base64 = require('base64-js')
var ieee754 = require('ieee754')

exports.Buffer = Buffer
exports.SlowBuffer = Buffer
exports.INSPECT_MAX_BYTES = 50
Buffer.poolSize = 8192

/**
 * If `Buffer._useTypedArrays`:
 *   === true    Use Uint8Array implementation (fastest)
 *   === false   Use Object implementation (compatible down to IE6)
 */
Buffer._useTypedArrays = (function () {
  // Detect if browser supports Typed Arrays. Supported browsers are IE 10+, Firefox 4+,
  // Chrome 7+, Safari 5.1+, Opera 11.6+, iOS 4.2+. If the browser does not support adding
  // properties to `Uint8Array` instances, then that's the same as no `Uint8Array` support
  // because we need to be able to add all the node Buffer API methods. This is an issue
  // in Firefox 4-29. Now fixed: https://bugzilla.mozilla.org/show_bug.cgi?id=695438
  try {
    var buf = new ArrayBuffer(0)
    var arr = new Uint8Array(buf)
    arr.foo = function () { return 42 }
    return 42 === arr.foo() &&
        typeof arr.subarray === 'function' // Chrome 9-10 lack `subarray`
  } catch (e) {
    return false
  }
})()

/**
 * Class: Buffer
 * =============
 *
 * The Buffer constructor returns instances of `Uint8Array` that are augmented
 * with function properties for all the node `Buffer` API functions. We use
 * `Uint8Array` so that square bracket notation works as expected -- it returns
 * a single octet.
 *
 * By augmenting the instances, we can avoid modifying the `Uint8Array`
 * prototype.
 */
function Buffer (subject, encoding, noZero) {
  if (!(this instanceof Buffer))
    return new Buffer(subject, encoding, noZero)

  var type = typeof subject

  // Workaround: node's base64 implementation allows for non-padded strings
  // while base64-js does not.
  if (encoding === 'base64' && type === 'string') {
    subject = stringtrim(subject)
    while (subject.length % 4 !== 0) {
      subject = subject + '='
    }
  }

  // Find the length
  var length
  if (type === 'number')
    length = coerce(subject)
  else if (type === 'string')
    length = Buffer.byteLength(subject, encoding)
  else if (type === 'object')
    length = coerce(subject.length) // assume that object is array-like
  else
    throw new Error('First argument needs to be a number, array or string.')

  var buf
  if (Buffer._useTypedArrays) {
    // Preferred: Return an augmented `Uint8Array` instance for best performance
    buf = Buffer._augment(new Uint8Array(length))
  } else {
    // Fallback: Return THIS instance of Buffer (created by `new`)
    buf = this
    buf.length = length
    buf._isBuffer = true
  }

  var i
  if (Buffer._useTypedArrays && typeof subject.byteLength === 'number') {
    // Speed optimization -- use set if we're copying from a typed array
    buf._set(subject)
  } else if (isArrayish(subject)) {
    // Treat array-ish objects as a byte array
    for (i = 0; i < length; i++) {
      if (Buffer.isBuffer(subject))
        buf[i] = subject.readUInt8(i)
      else
        buf[i] = subject[i]
    }
  } else if (type === 'string') {
    buf.write(subject, 0, encoding)
  } else if (type === 'number' && !Buffer._useTypedArrays && !noZero) {
    for (i = 0; i < length; i++) {
      buf[i] = 0
    }
  }

  return buf
}

// STATIC METHODS
// ==============

Buffer.isEncoding = function (encoding) {
  switch (String(encoding).toLowerCase()) {
    case 'hex':
    case 'utf8':
    case 'utf-8':
    case 'ascii':
    case 'binary':
    case 'base64':
    case 'raw':
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return true
    default:
      return false
  }
}

Buffer.isBuffer = function (b) {
  return !!(b !== null && b !== undefined && b._isBuffer)
}

Buffer.byteLength = function (str, encoding) {
  var ret
  str = str + ''
  switch (encoding || 'utf8') {
    case 'hex':
      ret = str.length / 2
      break
    case 'utf8':
    case 'utf-8':
      ret = utf8ToBytes(str).length
      break
    case 'ascii':
    case 'binary':
    case 'raw':
      ret = str.length
      break
    case 'base64':
      ret = base64ToBytes(str).length
      break
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      ret = str.length * 2
      break
    default:
      throw new Error('Unknown encoding')
  }
  return ret
}

Buffer.concat = function (list, totalLength) {
  assert(isArray(list), 'Usage: Buffer.concat(list, [totalLength])\n' +
      'list should be an Array.')

  if (list.length === 0) {
    return new Buffer(0)
  } else if (list.length === 1) {
    return list[0]
  }

  var i
  if (typeof totalLength !== 'number') {
    totalLength = 0
    for (i = 0; i < list.length; i++) {
      totalLength += list[i].length
    }
  }

  var buf = new Buffer(totalLength)
  var pos = 0
  for (i = 0; i < list.length; i++) {
    var item = list[i]
    item.copy(buf, pos)
    pos += item.length
  }
  return buf
}

// BUFFER INSTANCE METHODS
// =======================

function _hexWrite (buf, string, offset, length) {
  offset = Number(offset) || 0
  var remaining = buf.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }

  // must be an even number of digits
  var strLen = string.length
  assert(strLen % 2 === 0, 'Invalid hex string')

  if (length > strLen / 2) {
    length = strLen / 2
  }
  for (var i = 0; i < length; i++) {
    var byte = parseInt(string.substr(i * 2, 2), 16)
    assert(!isNaN(byte), 'Invalid hex string')
    buf[offset + i] = byte
  }
  Buffer._charsWritten = i * 2
  return i
}

function _utf8Write (buf, string, offset, length) {
  var charsWritten = Buffer._charsWritten =
    blitBuffer(utf8ToBytes(string), buf, offset, length)
  return charsWritten
}

function _asciiWrite (buf, string, offset, length) {
  var charsWritten = Buffer._charsWritten =
    blitBuffer(asciiToBytes(string), buf, offset, length)
  return charsWritten
}

function _binaryWrite (buf, string, offset, length) {
  return _asciiWrite(buf, string, offset, length)
}

function _base64Write (buf, string, offset, length) {
  var charsWritten = Buffer._charsWritten =
    blitBuffer(base64ToBytes(string), buf, offset, length)
  return charsWritten
}

function _utf16leWrite (buf, string, offset, length) {
  var charsWritten = Buffer._charsWritten =
    blitBuffer(utf16leToBytes(string), buf, offset, length)
  return charsWritten
}

Buffer.prototype.write = function (string, offset, length, encoding) {
  // Support both (string, offset, length, encoding)
  // and the legacy (string, encoding, offset, length)
  if (isFinite(offset)) {
    if (!isFinite(length)) {
      encoding = length
      length = undefined
    }
  } else {  // legacy
    var swap = encoding
    encoding = offset
    offset = length
    length = swap
  }

  offset = Number(offset) || 0
  var remaining = this.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }
  encoding = String(encoding || 'utf8').toLowerCase()

  var ret
  switch (encoding) {
    case 'hex':
      ret = _hexWrite(this, string, offset, length)
      break
    case 'utf8':
    case 'utf-8':
      ret = _utf8Write(this, string, offset, length)
      break
    case 'ascii':
      ret = _asciiWrite(this, string, offset, length)
      break
    case 'binary':
      ret = _binaryWrite(this, string, offset, length)
      break
    case 'base64':
      ret = _base64Write(this, string, offset, length)
      break
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      ret = _utf16leWrite(this, string, offset, length)
      break
    default:
      throw new Error('Unknown encoding')
  }
  return ret
}

Buffer.prototype.toString = function (encoding, start, end) {
  var self = this

  encoding = String(encoding || 'utf8').toLowerCase()
  start = Number(start) || 0
  end = (end !== undefined)
    ? Number(end)
    : end = self.length

  // Fastpath empty strings
  if (end === start)
    return ''

  var ret
  switch (encoding) {
    case 'hex':
      ret = _hexSlice(self, start, end)
      break
    case 'utf8':
    case 'utf-8':
      ret = _utf8Slice(self, start, end)
      break
    case 'ascii':
      ret = _asciiSlice(self, start, end)
      break
    case 'binary':
      ret = _binarySlice(self, start, end)
      break
    case 'base64':
      ret = _base64Slice(self, start, end)
      break
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      ret = _utf16leSlice(self, start, end)
      break
    default:
      throw new Error('Unknown encoding')
  }
  return ret
}

Buffer.prototype.toJSON = function () {
  return {
    type: 'Buffer',
    data: Array.prototype.slice.call(this._arr || this, 0)
  }
}

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
Buffer.prototype.copy = function (target, target_start, start, end) {
  var source = this

  if (!start) start = 0
  if (!end && end !== 0) end = this.length
  if (!target_start) target_start = 0

  // Copy 0 bytes; we're done
  if (end === start) return
  if (target.length === 0 || source.length === 0) return

  // Fatal error conditions
  assert(end >= start, 'sourceEnd < sourceStart')
  assert(target_start >= 0 && target_start < target.length,
      'targetStart out of bounds')
  assert(start >= 0 && start < source.length, 'sourceStart out of bounds')
  assert(end >= 0 && end <= source.length, 'sourceEnd out of bounds')

  // Are we oob?
  if (end > this.length)
    end = this.length
  if (target.length - target_start < end - start)
    end = target.length - target_start + start

  var len = end - start

  if (len < 100 || !Buffer._useTypedArrays) {
    for (var i = 0; i < len; i++)
      target[i + target_start] = this[i + start]
  } else {
    target._set(this.subarray(start, start + len), target_start)
  }
}

function _base64Slice (buf, start, end) {
  if (start === 0 && end === buf.length) {
    return base64.fromByteArray(buf)
  } else {
    return base64.fromByteArray(buf.slice(start, end))
  }
}

function _utf8Slice (buf, start, end) {
  var res = ''
  var tmp = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; i++) {
    if (buf[i] <= 0x7F) {
      res += decodeUtf8Char(tmp) + String.fromCharCode(buf[i])
      tmp = ''
    } else {
      tmp += '%' + buf[i].toString(16)
    }
  }

  return res + decodeUtf8Char(tmp)
}

function _asciiSlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; i++)
    ret += String.fromCharCode(buf[i])
  return ret
}

function _binarySlice (buf, start, end) {
  return _asciiSlice(buf, start, end)
}

function _hexSlice (buf, start, end) {
  var len = buf.length

  if (!start || start < 0) start = 0
  if (!end || end < 0 || end > len) end = len

  var out = ''
  for (var i = start; i < end; i++) {
    out += toHex(buf[i])
  }
  return out
}

function _utf16leSlice (buf, start, end) {
  var bytes = buf.slice(start, end)
  var res = ''
  for (var i = 0; i < bytes.length; i += 2) {
    res += String.fromCharCode(bytes[i] + bytes[i+1] * 256)
  }
  return res
}

Buffer.prototype.slice = function (start, end) {
  var len = this.length
  start = clamp(start, len, 0)
  end = clamp(end, len, len)

  if (Buffer._useTypedArrays) {
    return Buffer._augment(this.subarray(start, end))
  } else {
    var sliceLen = end - start
    var newBuf = new Buffer(sliceLen, undefined, true)
    for (var i = 0; i < sliceLen; i++) {
      newBuf[i] = this[i + start]
    }
    return newBuf
  }
}

// `get` will be removed in Node 0.13+
Buffer.prototype.get = function (offset) {
  console.log('.get() is deprecated. Access using array indexes instead.')
  return this.readUInt8(offset)
}

// `set` will be removed in Node 0.13+
Buffer.prototype.set = function (v, offset) {
  console.log('.set() is deprecated. Access using array indexes instead.')
  return this.writeUInt8(v, offset)
}

Buffer.prototype.readUInt8 = function (offset, noAssert) {
  if (!noAssert) {
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset < this.length, 'Trying to read beyond buffer length')
  }

  if (offset >= this.length)
    return

  return this[offset]
}

function _readUInt16 (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 1 < buf.length, 'Trying to read beyond buffer length')
  }

  var len = buf.length
  if (offset >= len)
    return

  var val
  if (littleEndian) {
    val = buf[offset]
    if (offset + 1 < len)
      val |= buf[offset + 1] << 8
  } else {
    val = buf[offset] << 8
    if (offset + 1 < len)
      val |= buf[offset + 1]
  }
  return val
}

Buffer.prototype.readUInt16LE = function (offset, noAssert) {
  return _readUInt16(this, offset, true, noAssert)
}

Buffer.prototype.readUInt16BE = function (offset, noAssert) {
  return _readUInt16(this, offset, false, noAssert)
}

function _readUInt32 (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 3 < buf.length, 'Trying to read beyond buffer length')
  }

  var len = buf.length
  if (offset >= len)
    return

  var val
  if (littleEndian) {
    if (offset + 2 < len)
      val = buf[offset + 2] << 16
    if (offset + 1 < len)
      val |= buf[offset + 1] << 8
    val |= buf[offset]
    if (offset + 3 < len)
      val = val + (buf[offset + 3] << 24 >>> 0)
  } else {
    if (offset + 1 < len)
      val = buf[offset + 1] << 16
    if (offset + 2 < len)
      val |= buf[offset + 2] << 8
    if (offset + 3 < len)
      val |= buf[offset + 3]
    val = val + (buf[offset] << 24 >>> 0)
  }
  return val
}

Buffer.prototype.readUInt32LE = function (offset, noAssert) {
  return _readUInt32(this, offset, true, noAssert)
}

Buffer.prototype.readUInt32BE = function (offset, noAssert) {
  return _readUInt32(this, offset, false, noAssert)
}

Buffer.prototype.readInt8 = function (offset, noAssert) {
  if (!noAssert) {
    assert(offset !== undefined && offset !== null,
        'missing offset')
    assert(offset < this.length, 'Trying to read beyond buffer length')
  }

  if (offset >= this.length)
    return

  var neg = this[offset] & 0x80
  if (neg)
    return (0xff - this[offset] + 1) * -1
  else
    return this[offset]
}

function _readInt16 (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 1 < buf.length, 'Trying to read beyond buffer length')
  }

  var len = buf.length
  if (offset >= len)
    return

  var val = _readUInt16(buf, offset, littleEndian, true)
  var neg = val & 0x8000
  if (neg)
    return (0xffff - val + 1) * -1
  else
    return val
}

Buffer.prototype.readInt16LE = function (offset, noAssert) {
  return _readInt16(this, offset, true, noAssert)
}

Buffer.prototype.readInt16BE = function (offset, noAssert) {
  return _readInt16(this, offset, false, noAssert)
}

function _readInt32 (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 3 < buf.length, 'Trying to read beyond buffer length')
  }

  var len = buf.length
  if (offset >= len)
    return

  var val = _readUInt32(buf, offset, littleEndian, true)
  var neg = val & 0x80000000
  if (neg)
    return (0xffffffff - val + 1) * -1
  else
    return val
}

Buffer.prototype.readInt32LE = function (offset, noAssert) {
  return _readInt32(this, offset, true, noAssert)
}

Buffer.prototype.readInt32BE = function (offset, noAssert) {
  return _readInt32(this, offset, false, noAssert)
}

function _readFloat (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset + 3 < buf.length, 'Trying to read beyond buffer length')
  }

  return ieee754.read(buf, offset, littleEndian, 23, 4)
}

Buffer.prototype.readFloatLE = function (offset, noAssert) {
  return _readFloat(this, offset, true, noAssert)
}

Buffer.prototype.readFloatBE = function (offset, noAssert) {
  return _readFloat(this, offset, false, noAssert)
}

function _readDouble (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset + 7 < buf.length, 'Trying to read beyond buffer length')
  }

  return ieee754.read(buf, offset, littleEndian, 52, 8)
}

Buffer.prototype.readDoubleLE = function (offset, noAssert) {
  return _readDouble(this, offset, true, noAssert)
}

Buffer.prototype.readDoubleBE = function (offset, noAssert) {
  return _readDouble(this, offset, false, noAssert)
}

Buffer.prototype.writeUInt8 = function (value, offset, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset < this.length, 'trying to write beyond buffer length')
    verifuint(value, 0xff)
  }

  if (offset >= this.length) return

  this[offset] = value
}

function _writeUInt16 (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 1 < buf.length, 'trying to write beyond buffer length')
    verifuint(value, 0xffff)
  }

  var len = buf.length
  if (offset >= len)
    return

  for (var i = 0, j = Math.min(len - offset, 2); i < j; i++) {
    buf[offset + i] =
        (value & (0xff << (8 * (littleEndian ? i : 1 - i)))) >>>
            (littleEndian ? i : 1 - i) * 8
  }
}

Buffer.prototype.writeUInt16LE = function (value, offset, noAssert) {
  _writeUInt16(this, value, offset, true, noAssert)
}

Buffer.prototype.writeUInt16BE = function (value, offset, noAssert) {
  _writeUInt16(this, value, offset, false, noAssert)
}

function _writeUInt32 (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 3 < buf.length, 'trying to write beyond buffer length')
    verifuint(value, 0xffffffff)
  }

  var len = buf.length
  if (offset >= len)
    return

  for (var i = 0, j = Math.min(len - offset, 4); i < j; i++) {
    buf[offset + i] =
        (value >>> (littleEndian ? i : 3 - i) * 8) & 0xff
  }
}

Buffer.prototype.writeUInt32LE = function (value, offset, noAssert) {
  _writeUInt32(this, value, offset, true, noAssert)
}

Buffer.prototype.writeUInt32BE = function (value, offset, noAssert) {
  _writeUInt32(this, value, offset, false, noAssert)
}

Buffer.prototype.writeInt8 = function (value, offset, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset < this.length, 'Trying to write beyond buffer length')
    verifsint(value, 0x7f, -0x80)
  }

  if (offset >= this.length)
    return

  if (value >= 0)
    this.writeUInt8(value, offset, noAssert)
  else
    this.writeUInt8(0xff + value + 1, offset, noAssert)
}

function _writeInt16 (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 1 < buf.length, 'Trying to write beyond buffer length')
    verifsint(value, 0x7fff, -0x8000)
  }

  var len = buf.length
  if (offset >= len)
    return

  if (value >= 0)
    _writeUInt16(buf, value, offset, littleEndian, noAssert)
  else
    _writeUInt16(buf, 0xffff + value + 1, offset, littleEndian, noAssert)
}

Buffer.prototype.writeInt16LE = function (value, offset, noAssert) {
  _writeInt16(this, value, offset, true, noAssert)
}

Buffer.prototype.writeInt16BE = function (value, offset, noAssert) {
  _writeInt16(this, value, offset, false, noAssert)
}

function _writeInt32 (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 3 < buf.length, 'Trying to write beyond buffer length')
    verifsint(value, 0x7fffffff, -0x80000000)
  }

  var len = buf.length
  if (offset >= len)
    return

  if (value >= 0)
    _writeUInt32(buf, value, offset, littleEndian, noAssert)
  else
    _writeUInt32(buf, 0xffffffff + value + 1, offset, littleEndian, noAssert)
}

Buffer.prototype.writeInt32LE = function (value, offset, noAssert) {
  _writeInt32(this, value, offset, true, noAssert)
}

Buffer.prototype.writeInt32BE = function (value, offset, noAssert) {
  _writeInt32(this, value, offset, false, noAssert)
}

function _writeFloat (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 3 < buf.length, 'Trying to write beyond buffer length')
    verifIEEE754(value, 3.4028234663852886e+38, -3.4028234663852886e+38)
  }

  var len = buf.length
  if (offset >= len)
    return

  ieee754.write(buf, value, offset, littleEndian, 23, 4)
}

Buffer.prototype.writeFloatLE = function (value, offset, noAssert) {
  _writeFloat(this, value, offset, true, noAssert)
}

Buffer.prototype.writeFloatBE = function (value, offset, noAssert) {
  _writeFloat(this, value, offset, false, noAssert)
}

function _writeDouble (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 7 < buf.length,
        'Trying to write beyond buffer length')
    verifIEEE754(value, 1.7976931348623157E+308, -1.7976931348623157E+308)
  }

  var len = buf.length
  if (offset >= len)
    return

  ieee754.write(buf, value, offset, littleEndian, 52, 8)
}

Buffer.prototype.writeDoubleLE = function (value, offset, noAssert) {
  _writeDouble(this, value, offset, true, noAssert)
}

Buffer.prototype.writeDoubleBE = function (value, offset, noAssert) {
  _writeDouble(this, value, offset, false, noAssert)
}

// fill(value, start=0, end=buffer.length)
Buffer.prototype.fill = function (value, start, end) {
  if (!value) value = 0
  if (!start) start = 0
  if (!end) end = this.length

  if (typeof value === 'string') {
    value = value.charCodeAt(0)
  }

  assert(typeof value === 'number' && !isNaN(value), 'value is not a number')
  assert(end >= start, 'end < start')

  // Fill 0 bytes; we're done
  if (end === start) return
  if (this.length === 0) return

  assert(start >= 0 && start < this.length, 'start out of bounds')
  assert(end >= 0 && end <= this.length, 'end out of bounds')

  for (var i = start; i < end; i++) {
    this[i] = value
  }
}

Buffer.prototype.inspect = function () {
  var out = []
  var len = this.length
  for (var i = 0; i < len; i++) {
    out[i] = toHex(this[i])
    if (i === exports.INSPECT_MAX_BYTES) {
      out[i + 1] = '...'
      break
    }
  }
  return '<Buffer ' + out.join(' ') + '>'
}

/**
 * Creates a new `ArrayBuffer` with the *copied* memory of the buffer instance.
 * Added in Node 0.12. Only available in browsers that support ArrayBuffer.
 */
Buffer.prototype.toArrayBuffer = function () {
  if (typeof Uint8Array !== 'undefined') {
    if (Buffer._useTypedArrays) {
      return (new Buffer(this)).buffer
    } else {
      var buf = new Uint8Array(this.length)
      for (var i = 0, len = buf.length; i < len; i += 1)
        buf[i] = this[i]
      return buf.buffer
    }
  } else {
    throw new Error('Buffer.toArrayBuffer not supported in this browser')
  }
}

// HELPER FUNCTIONS
// ================

function stringtrim (str) {
  if (str.trim) return str.trim()
  return str.replace(/^\s+|\s+$/g, '')
}

var BP = Buffer.prototype

/**
 * Augment a Uint8Array *instance* (not the Uint8Array class!) with Buffer methods
 */
Buffer._augment = function (arr) {
  arr._isBuffer = true

  // save reference to original Uint8Array get/set methods before overwriting
  arr._get = arr.get
  arr._set = arr.set

  // deprecated, will be removed in node 0.13+
  arr.get = BP.get
  arr.set = BP.set

  arr.write = BP.write
  arr.toString = BP.toString
  arr.toLocaleString = BP.toString
  arr.toJSON = BP.toJSON
  arr.copy = BP.copy
  arr.slice = BP.slice
  arr.readUInt8 = BP.readUInt8
  arr.readUInt16LE = BP.readUInt16LE
  arr.readUInt16BE = BP.readUInt16BE
  arr.readUInt32LE = BP.readUInt32LE
  arr.readUInt32BE = BP.readUInt32BE
  arr.readInt8 = BP.readInt8
  arr.readInt16LE = BP.readInt16LE
  arr.readInt16BE = BP.readInt16BE
  arr.readInt32LE = BP.readInt32LE
  arr.readInt32BE = BP.readInt32BE
  arr.readFloatLE = BP.readFloatLE
  arr.readFloatBE = BP.readFloatBE
  arr.readDoubleLE = BP.readDoubleLE
  arr.readDoubleBE = BP.readDoubleBE
  arr.writeUInt8 = BP.writeUInt8
  arr.writeUInt16LE = BP.writeUInt16LE
  arr.writeUInt16BE = BP.writeUInt16BE
  arr.writeUInt32LE = BP.writeUInt32LE
  arr.writeUInt32BE = BP.writeUInt32BE
  arr.writeInt8 = BP.writeInt8
  arr.writeInt16LE = BP.writeInt16LE
  arr.writeInt16BE = BP.writeInt16BE
  arr.writeInt32LE = BP.writeInt32LE
  arr.writeInt32BE = BP.writeInt32BE
  arr.writeFloatLE = BP.writeFloatLE
  arr.writeFloatBE = BP.writeFloatBE
  arr.writeDoubleLE = BP.writeDoubleLE
  arr.writeDoubleBE = BP.writeDoubleBE
  arr.fill = BP.fill
  arr.inspect = BP.inspect
  arr.toArrayBuffer = BP.toArrayBuffer

  return arr
}

// slice(start, end)
function clamp (index, len, defaultValue) {
  if (typeof index !== 'number') return defaultValue
  index = ~~index;  // Coerce to integer.
  if (index >= len) return len
  if (index >= 0) return index
  index += len
  if (index >= 0) return index
  return 0
}

function coerce (length) {
  // Coerce length to a number (possibly NaN), round up
  // in case it's fractional (e.g. 123.456) then do a
  // double negate to coerce a NaN to 0. Easy, right?
  length = ~~Math.ceil(+length)
  return length < 0 ? 0 : length
}

function isArray (subject) {
  return (Array.isArray || function (subject) {
    return Object.prototype.toString.call(subject) === '[object Array]'
  })(subject)
}

function isArrayish (subject) {
  return isArray(subject) || Buffer.isBuffer(subject) ||
      subject && typeof subject === 'object' &&
      typeof subject.length === 'number'
}

function toHex (n) {
  if (n < 16) return '0' + n.toString(16)
  return n.toString(16)
}

function utf8ToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    var b = str.charCodeAt(i)
    if (b <= 0x7F)
      byteArray.push(str.charCodeAt(i))
    else {
      var start = i
      if (b >= 0xD800 && b <= 0xDFFF) i++
      var h = encodeURIComponent(str.slice(start, i+1)).substr(1).split('%')
      for (var j = 0; j < h.length; j++)
        byteArray.push(parseInt(h[j], 16))
    }
  }
  return byteArray
}

function asciiToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    // Node's code seems to be doing this and not & 0x7F..
    byteArray.push(str.charCodeAt(i) & 0xFF)
  }
  return byteArray
}

function utf16leToBytes (str) {
  var c, hi, lo
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    c = str.charCodeAt(i)
    hi = c >> 8
    lo = c % 256
    byteArray.push(lo)
    byteArray.push(hi)
  }

  return byteArray
}

function base64ToBytes (str) {
  return base64.toByteArray(str)
}

function blitBuffer (src, dst, offset, length) {
  var pos
  for (var i = 0; i < length; i++) {
    if ((i + offset >= dst.length) || (i >= src.length))
      break
    dst[i + offset] = src[i]
  }
  return i
}

function decodeUtf8Char (str) {
  try {
    return decodeURIComponent(str)
  } catch (err) {
    return String.fromCharCode(0xFFFD) // UTF 8 invalid char
  }
}

/*
 * We have to make sure that the value is a valid integer. This means that it
 * is non-negative. It has no fractional component and that it does not
 * exceed the maximum allowed value.
 */
function verifuint (value, max) {
  assert(typeof value === 'number', 'cannot write a non-number as a number')
  assert(value >= 0, 'specified a negative value for writing an unsigned value')
  assert(value <= max, 'value is larger than maximum value for type')
  assert(Math.floor(value) === value, 'value has a fractional component')
}

function verifsint (value, max, min) {
  assert(typeof value === 'number', 'cannot write a non-number as a number')
  assert(value <= max, 'value larger than maximum allowed value')
  assert(value >= min, 'value smaller than minimum allowed value')
  assert(Math.floor(value) === value, 'value has a fractional component')
}

function verifIEEE754 (value, max, min) {
  assert(typeof value === 'number', 'cannot write a non-number as a number')
  assert(value <= max, 'value larger than maximum allowed value')
  assert(value >= min, 'value smaller than minimum allowed value')
}

function assert (test, message) {
  if (!test) throw new Error(message || 'Failed assertion')
}

}).call(this,require("TwOfRe"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/M:\\mydocs\\workspace\\mmlixir\\FlMMLonHTML5\\node_modules\\gulp-browserify\\node_modules\\browserify\\node_modules\\buffer\\index.js","/M:\\mydocs\\workspace\\mmlixir\\FlMMLonHTML5\\node_modules\\gulp-browserify\\node_modules\\browserify\\node_modules\\buffer")
},{"TwOfRe":12,"base64-js":10,"buffer":9,"ieee754":11}],10:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
var lookup = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

;(function (exports) {
	'use strict';

  var Arr = (typeof Uint8Array !== 'undefined')
    ? Uint8Array
    : Array

	var PLUS   = '+'.charCodeAt(0)
	var SLASH  = '/'.charCodeAt(0)
	var NUMBER = '0'.charCodeAt(0)
	var LOWER  = 'a'.charCodeAt(0)
	var UPPER  = 'A'.charCodeAt(0)
	var PLUS_URL_SAFE = '-'.charCodeAt(0)
	var SLASH_URL_SAFE = '_'.charCodeAt(0)

	function decode (elt) {
		var code = elt.charCodeAt(0)
		if (code === PLUS ||
		    code === PLUS_URL_SAFE)
			return 62 // '+'
		if (code === SLASH ||
		    code === SLASH_URL_SAFE)
			return 63 // '/'
		if (code < NUMBER)
			return -1 //no match
		if (code < NUMBER + 10)
			return code - NUMBER + 26 + 26
		if (code < UPPER + 26)
			return code - UPPER
		if (code < LOWER + 26)
			return code - LOWER + 26
	}

	function b64ToByteArray (b64) {
		var i, j, l, tmp, placeHolders, arr

		if (b64.length % 4 > 0) {
			throw new Error('Invalid string. Length must be a multiple of 4')
		}

		// the number of equal signs (place holders)
		// if there are two placeholders, than the two characters before it
		// represent one byte
		// if there is only one, then the three characters before it represent 2 bytes
		// this is just a cheap hack to not do indexOf twice
		var len = b64.length
		placeHolders = '=' === b64.charAt(len - 2) ? 2 : '=' === b64.charAt(len - 1) ? 1 : 0

		// base64 is 4/3 + up to two characters of the original data
		arr = new Arr(b64.length * 3 / 4 - placeHolders)

		// if there are placeholders, only get up to the last complete 4 chars
		l = placeHolders > 0 ? b64.length - 4 : b64.length

		var L = 0

		function push (v) {
			arr[L++] = v
		}

		for (i = 0, j = 0; i < l; i += 4, j += 3) {
			tmp = (decode(b64.charAt(i)) << 18) | (decode(b64.charAt(i + 1)) << 12) | (decode(b64.charAt(i + 2)) << 6) | decode(b64.charAt(i + 3))
			push((tmp & 0xFF0000) >> 16)
			push((tmp & 0xFF00) >> 8)
			push(tmp & 0xFF)
		}

		if (placeHolders === 2) {
			tmp = (decode(b64.charAt(i)) << 2) | (decode(b64.charAt(i + 1)) >> 4)
			push(tmp & 0xFF)
		} else if (placeHolders === 1) {
			tmp = (decode(b64.charAt(i)) << 10) | (decode(b64.charAt(i + 1)) << 4) | (decode(b64.charAt(i + 2)) >> 2)
			push((tmp >> 8) & 0xFF)
			push(tmp & 0xFF)
		}

		return arr
	}

	function uint8ToBase64 (uint8) {
		var i,
			extraBytes = uint8.length % 3, // if we have 1 byte left, pad 2 bytes
			output = "",
			temp, length

		function encode (num) {
			return lookup.charAt(num)
		}

		function tripletToBase64 (num) {
			return encode(num >> 18 & 0x3F) + encode(num >> 12 & 0x3F) + encode(num >> 6 & 0x3F) + encode(num & 0x3F)
		}

		// go through the array every three bytes, we'll deal with trailing stuff later
		for (i = 0, length = uint8.length - extraBytes; i < length; i += 3) {
			temp = (uint8[i] << 16) + (uint8[i + 1] << 8) + (uint8[i + 2])
			output += tripletToBase64(temp)
		}

		// pad the end with zeros, but make sure to not forget the extra bytes
		switch (extraBytes) {
			case 1:
				temp = uint8[uint8.length - 1]
				output += encode(temp >> 2)
				output += encode((temp << 4) & 0x3F)
				output += '=='
				break
			case 2:
				temp = (uint8[uint8.length - 2] << 8) + (uint8[uint8.length - 1])
				output += encode(temp >> 10)
				output += encode((temp >> 4) & 0x3F)
				output += encode((temp << 2) & 0x3F)
				output += '='
				break
		}

		return output
	}

	exports.toByteArray = b64ToByteArray
	exports.fromByteArray = uint8ToBase64
}(typeof exports === 'undefined' ? (this.base64js = {}) : exports))

}).call(this,require("TwOfRe"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/M:\\mydocs\\workspace\\mmlixir\\FlMMLonHTML5\\node_modules\\gulp-browserify\\node_modules\\browserify\\node_modules\\buffer\\node_modules\\base64-js\\lib\\b64.js","/M:\\mydocs\\workspace\\mmlixir\\FlMMLonHTML5\\node_modules\\gulp-browserify\\node_modules\\browserify\\node_modules\\buffer\\node_modules\\base64-js\\lib")
},{"TwOfRe":12,"buffer":9}],11:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
exports.read = function (buffer, offset, isLE, mLen, nBytes) {
  var e, m
  var eLen = nBytes * 8 - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var nBits = -7
  var i = isLE ? (nBytes - 1) : 0
  var d = isLE ? -1 : 1
  var s = buffer[offset + i]

  i += d

  e = s & ((1 << (-nBits)) - 1)
  s >>= (-nBits)
  nBits += eLen
  for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  m = e & ((1 << (-nBits)) - 1)
  e >>= (-nBits)
  nBits += mLen
  for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  if (e === 0) {
    e = 1 - eBias
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity)
  } else {
    m = m + Math.pow(2, mLen)
    e = e - eBias
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
}

exports.write = function (buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c
  var eLen = nBytes * 8 - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0)
  var i = isLE ? 0 : (nBytes - 1)
  var d = isLE ? 1 : -1
  var s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0

  value = Math.abs(value)

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0
    e = eMax
  } else {
    e = Math.floor(Math.log(value) / Math.LN2)
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--
      c *= 2
    }
    if (e + eBias >= 1) {
      value += rt / c
    } else {
      value += rt * Math.pow(2, 1 - eBias)
    }
    if (value * c >= 2) {
      e++
      c /= 2
    }

    if (e + eBias >= eMax) {
      m = 0
      e = eMax
    } else if (e + eBias >= 1) {
      m = (value * c - 1) * Math.pow(2, mLen)
      e = e + eBias
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen)
      e = 0
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}

  e = (e << mLen) | m
  eLen += mLen
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}

  buffer[offset + i - d] |= s * 128
}

}).call(this,require("TwOfRe"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/M:\\mydocs\\workspace\\mmlixir\\FlMMLonHTML5\\node_modules\\gulp-browserify\\node_modules\\browserify\\node_modules\\buffer\\node_modules\\ieee754\\index.js","/M:\\mydocs\\workspace\\mmlixir\\FlMMLonHTML5\\node_modules\\gulp-browserify\\node_modules\\browserify\\node_modules\\buffer\\node_modules\\ieee754")
},{"TwOfRe":12,"buffer":9}],12:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
// shim for using process in browser

var process = module.exports = {};

process.nextTick = (function () {
    var canSetImmediate = typeof window !== 'undefined'
    && window.setImmediate;
    var canPost = typeof window !== 'undefined'
    && window.postMessage && window.addEventListener
    ;

    if (canSetImmediate) {
        return function (f) { return window.setImmediate(f) };
    }

    if (canPost) {
        var queue = [];
        window.addEventListener('message', function (ev) {
            var source = ev.source;
            if ((source === window || source === null) && ev.data === 'process-tick') {
                ev.stopPropagation();
                if (queue.length > 0) {
                    var fn = queue.shift();
                    fn();
                }
            }
        }, true);

        return function nextTick(fn) {
            queue.push(fn);
            window.postMessage('process-tick', '*');
        };
    }

    return function nextTick(fn) {
        setTimeout(fn, 0);
    };
})();

process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
}

// TODO(shtylman)
process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};

}).call(this,require("TwOfRe"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/M:\\mydocs\\workspace\\mmlixir\\FlMMLonHTML5\\node_modules\\gulp-browserify\\node_modules\\browserify\\node_modules\\process\\browser.js","/M:\\mydocs\\workspace\\mmlixir\\FlMMLonHTML5\\node_modules\\gulp-browserify\\node_modules\\browserify\\node_modules\\process")
},{"TwOfRe":12,"buffer":9}]},{},[8])
//# sourceMappingURL=flmmlworker.js.map
