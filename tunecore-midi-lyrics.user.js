// ==UserScript==
// @name         tunecore-midi-lyrics
// @version      0.0.1
// @author       Nanashi. <https://sevenc7c.com>
// @description  Tunecoreの歌詞登録をMIDIからできるようにするUserscript
// @homepage     https://github.com/sevenc-nanashi/tunecore-midi-lyrics#readme
// @homepageURL  https://github.com/sevenc-nanashi/tunecore-midi-lyrics#readme
// @match        https://www.tunecore.co.jp/member/release/*
// ==/UserScript==

(function () {
  'use strict';

  let protoOf = Object.getPrototypeOf;
  let changedStates, derivedStates, curDeps, curNewDerives, alwaysConnectedDom = { isConnected: 1 };
  let gcCycleInMs = 1e3, statesToGc, propSetterCache = {};
  let objProto = protoOf(alwaysConnectedDom), funcProto = protoOf(protoOf), _undefined;
  let addAndScheduleOnFirst = (set, s2, f2, waitMs) => (set ?? (waitMs ? setTimeout(f2, waitMs) : queueMicrotask(f2), new Set())).add(s2);
  let runAndCaptureDeps = (f2, deps, arg) => {
    let prevDeps = curDeps;
    curDeps = deps;
    try {
      return f2(arg);
    } catch (e2) {
      console.error(e2);
      return arg;
    } finally {
      curDeps = prevDeps;
    }
  };
  let keepConnected = (l2) => l2.filter((b2) => b2._dom?.isConnected);
  let addStatesToGc = (d2) => statesToGc = addAndScheduleOnFirst(statesToGc, d2, () => {
    for (let s2 of statesToGc)
      s2._bindings = keepConnected(s2._bindings), s2._listeners = keepConnected(s2._listeners);
    statesToGc = _undefined;
  }, gcCycleInMs);
  let stateProto = {
    get val() {
      curDeps?._getters?.add(this);
      return this.rawVal;
    },
    get oldVal() {
      curDeps?._getters?.add(this);
      return this._oldVal;
    },
    set val(v2) {
      curDeps?._setters?.add(this);
      if (v2 !== this.rawVal) {
        this.rawVal = v2;
        this._bindings.length + this._listeners.length ? (derivedStates?.add(this), changedStates = addAndScheduleOnFirst(changedStates, this, updateDoms)) : this._oldVal = v2;
      }
    }
  };
  let state = (initVal) => ({
    __proto__: stateProto,
    rawVal: initVal,
    _oldVal: initVal,
    _bindings: [],
    _listeners: []
  });
  let bind = (f2, dom) => {
    let deps = { _getters: new Set(), _setters: new Set() }, binding = { f: f2 }, prevNewDerives = curNewDerives;
    curNewDerives = [];
    let newDom = runAndCaptureDeps(f2, deps, dom);
    newDom = (newDom ?? document).nodeType ? newDom : new Text(newDom);
    for (let d2 of deps._getters)
      deps._setters.has(d2) || (addStatesToGc(d2), d2._bindings.push(binding));
    for (let l2 of curNewDerives) l2._dom = newDom;
    curNewDerives = prevNewDerives;
    return binding._dom = newDom;
  };
  let derive = (f2, s2 = state(), dom) => {
    let deps = { _getters: new Set(), _setters: new Set() }, listener = { f: f2, s: s2 };
    listener._dom = dom ?? curNewDerives?.push(listener) ?? alwaysConnectedDom;
    s2.val = runAndCaptureDeps(f2, deps, s2.rawVal);
    for (let d2 of deps._getters)
      deps._setters.has(d2) || (addStatesToGc(d2), d2._listeners.push(listener));
    return s2;
  };
  let add = (dom, ...children) => {
    for (let c2 of children.flat(Infinity)) {
      let protoOfC = protoOf(c2 ?? 0);
      let child = protoOfC === stateProto ? bind(() => c2.val) : protoOfC === funcProto ? bind(c2) : c2;
      child != _undefined && dom.append(child);
    }
    return dom;
  };
  let tag = (ns, name, ...args) => {
    let [{ is, ...props }, ...children] = protoOf(args[0] ?? 0) === objProto ? args : [{}, ...args];
    let dom = ns ? document.createElementNS(ns, name, { is }) : document.createElement(name, { is });
    for (let [k2, v2] of Object.entries(props)) {
      let getPropDescriptor = (proto) => proto ? Object.getOwnPropertyDescriptor(proto, k2) ?? getPropDescriptor(protoOf(proto)) : _undefined;
      let cacheKey = name + "," + k2;
      let propSetter = propSetterCache[cacheKey] ??= getPropDescriptor(protoOf(dom))?.set ?? 0;
      let setter = k2.startsWith("on") ? (v3, oldV) => {
        let event = k2.slice(2);
        dom.removeEventListener(event, oldV);
        dom.addEventListener(event, v3);
      } : propSetter ? propSetter.bind(dom) : dom.setAttribute.bind(dom, k2);
      let protoOfV = protoOf(v2 ?? 0);
      k2.startsWith("on") || protoOfV === funcProto && (v2 = derive(v2), protoOfV = stateProto);
      protoOfV === stateProto ? bind(() => (setter(v2.val, v2._oldVal), dom)) : setter(v2);
    }
    return add(dom, children);
  };
  let handler = (ns) => ({ get: (_2, name) => tag.bind(_undefined, ns, name) });
  let update = (dom, newDom) => newDom ? newDom !== dom && dom.replaceWith(newDom) : dom.remove();
  let updateDoms = () => {
    let iter = 0, derivedStatesArray = [...changedStates].filter((s2) => s2.rawVal !== s2._oldVal);
    do {
      derivedStates = new Set();
      for (let l2 of new Set(derivedStatesArray.flatMap((s2) => s2._listeners = keepConnected(s2._listeners))))
        derive(l2.f, l2.s, l2._dom), l2._dom = _undefined;
    } while (++iter < 100 && (derivedStatesArray = [...derivedStates]).length);
    let changedStatesArray = [...changedStates].filter((s2) => s2.rawVal !== s2._oldVal);
    changedStates = _undefined;
    for (let b2 of new Set(changedStatesArray.flatMap((s2) => s2._bindings = keepConnected(s2._bindings))))
      update(b2._dom, bind(b2.f, b2._dom)), b2._dom = _undefined;
    for (let s2 of changedStatesArray) s2._oldVal = s2.rawVal;
  };
  const vanjs = {
    tags: new Proxy((ns) => new Proxy(tag, handler(ns)), handler())
  };
  const isFailure = (result) => "Failure" === result.type;
  const isPromise = (value) => "object" == typeof value && null !== value && "then" in value && "function" == typeof value.then && "catch" in value && "function" == typeof value.catch;
  const succeed = (...args) => {
    if (args.length <= 0) return {
      type: "Success"
    };
    const value = args[0];
    if (isPromise(value)) return value.then((value2) => ({
      type: "Success",
      value: value2
    }));
    return {
      type: "Success",
      value
    };
  };
  const fail = (...args) => {
    if (args.length <= 0) return {
      type: "Failure"
    };
    const error = args[0];
    if (isPromise(error)) return error.then((error2) => ({
      type: "Failure",
      error: error2
    }));
    return {
      type: "Failure",
      error
    };
  };
  const try_ = (options) => {
    const fn = (...args) => {
      try {
        const output = options.try(...args);
        if (isPromise(output)) {
          const promise = succeed(output);
          if ("safe" in options && options.safe) return promise;
          return promise.catch((error) => fail(options.catch(error)));
        }
        return succeed(output);
      } catch (error) {
        if ("safe" in options && options.safe) throw error;
        return fail(options.catch(error));
      }
    };
    if ("immediate" in options && options.immediate) return fn();
    return fn;
  };
  const t = Symbol.for("@ts-pattern/matcher"), e = Symbol.for("@ts-pattern/isVariadic"), n = "@ts-pattern/anonymous-select-key", r = (t2) => Boolean(t2 && "object" == typeof t2), i = (e2) => e2 && !!e2[t], o = (n2, s2, c2) => {
    if (i(n2)) {
      const e2 = n2[t](), { matched: r2, selections: i2 } = e2.match(s2);
      return r2 && i2 && Object.keys(i2).forEach((t2) => c2(t2, i2[t2])), r2;
    }
    if (r(n2)) {
      if (!r(s2)) return false;
      if (Array.isArray(n2)) {
        if (!Array.isArray(s2)) return false;
        let t2 = [], r2 = [], u2 = [];
        for (const o2 of n2.keys()) {
          const s3 = n2[o2];
          i(s3) && s3[e] ? u2.push(s3) : u2.length ? r2.push(s3) : t2.push(s3);
        }
        if (u2.length) {
          if (u2.length > 1) throw new Error("Pattern error: Using `...P.array(...)` several times in a single pattern is not allowed.");
          if (s2.length < t2.length + r2.length) return false;
          const e2 = s2.slice(0, t2.length), n3 = 0 === r2.length ? [] : s2.slice(-r2.length), i2 = s2.slice(t2.length, 0 === r2.length ? Infinity : -r2.length);
          return t2.every((t3, n4) => o(t3, e2[n4], c2)) && r2.every((t3, e3) => o(t3, n3[e3], c2)) && (0 === u2.length || o(u2[0], i2, c2));
        }
        return n2.length === s2.length && n2.every((t3, e2) => o(t3, s2[e2], c2));
      }
      return Reflect.ownKeys(n2).every((e2) => {
        const r2 = n2[e2];
        return (e2 in s2 || i(u2 = r2) && "optional" === u2[t]().matcherType) && o(r2, s2[e2], c2);
        var u2;
      });
    }
    return Object.is(s2, n2);
  }, s = (e2) => {
    var n2, o2, u2;
    return r(e2) ? i(e2) ? null != (n2 = null == (o2 = (u2 = e2[t]()).getSelectionKeys) ? void 0 : o2.call(u2)) ? n2 : [] : Array.isArray(e2) ? c(e2, s) : c(Object.values(e2), s) : [];
  }, c = (t2, e2) => t2.reduce((t3, n2) => t3.concat(e2(n2)), []);
  function u(...t2) {
    if (1 === t2.length) {
      const [e2] = t2;
      return (t3) => o(e2, t3, () => {
      });
    }
    if (2 === t2.length) {
      const [e2, n2] = t2;
      return o(e2, n2, () => {
      });
    }
    throw new Error(`isMatching wasn't given the right number of arguments: expected 1 or 2, received ${t2.length}.`);
  }
  function a(t2) {
    return Object.assign(t2, { optional: () => h(t2), and: (e2) => d(t2, e2), or: (e2) => y(t2, e2), select: (e2) => void 0 === e2 ? v(t2) : v(e2, t2) });
  }
  function l(t2) {
    return Object.assign(((t3) => Object.assign(t3, { [Symbol.iterator]() {
      let n2 = 0;
      const r2 = [{ value: Object.assign(t3, { [e]: true }), done: false }, { done: true, value: void 0 }];
      return { next: () => {
        var t4;
        return null != (t4 = r2[n2++]) ? t4 : r2.at(-1);
      } };
    } }))(t2), { optional: () => l(h(t2)), select: (e2) => l(void 0 === e2 ? v(t2) : v(e2, t2)) });
  }
  function h(e2) {
    return a({ [t]: () => ({ match: (t2) => {
      let n2 = {};
      const r2 = (t3, e3) => {
        n2[t3] = e3;
      };
      return void 0 === t2 ? (s(e2).forEach((t3) => r2(t3, void 0)), { matched: true, selections: n2 }) : { matched: o(e2, t2, r2), selections: n2 };
    }, getSelectionKeys: () => s(e2), matcherType: "optional" }) });
  }
  const f = (t2, e2) => {
    for (const n2 of t2) if (!e2(n2)) return false;
    return true;
  }, g = (t2, e2) => {
    for (const [n2, r2] of t2.entries()) if (!e2(r2, n2)) return false;
    return true;
  }, m = (t2, e2) => {
    const n2 = Reflect.ownKeys(t2);
    for (const r2 of n2) if (!e2(r2, t2[r2])) return false;
    return true;
  };
  function d(...e2) {
    return a({ [t]: () => ({ match: (t2) => {
      let n2 = {};
      const r2 = (t3, e3) => {
        n2[t3] = e3;
      };
      return { matched: e2.every((e3) => o(e3, t2, r2)), selections: n2 };
    }, getSelectionKeys: () => c(e2, s), matcherType: "and" }) });
  }
  function y(...e2) {
    return a({ [t]: () => ({ match: (t2) => {
      let n2 = {};
      const r2 = (t3, e3) => {
        n2[t3] = e3;
      };
      return c(e2, s).forEach((t3) => r2(t3, void 0)), { matched: e2.some((e3) => o(e3, t2, r2)), selections: n2 };
    }, getSelectionKeys: () => c(e2, s), matcherType: "or" }) });
  }
  function p$1(e2) {
    return { [t]: () => ({ match: (t2) => ({ matched: Boolean(e2(t2)) }) }) };
  }
  function v(...e2) {
    const r2 = "string" == typeof e2[0] ? e2[0] : void 0, i2 = 2 === e2.length ? e2[1] : "string" == typeof e2[0] ? void 0 : e2[0];
    return a({ [t]: () => ({ match: (t2) => {
      let e3 = { [null != r2 ? r2 : n]: t2 };
      return { matched: void 0 === i2 || o(i2, t2, (t3, n2) => {
        e3[t3] = n2;
      }), selections: e3 };
    }, getSelectionKeys: () => [null != r2 ? r2 : n].concat(void 0 === i2 ? [] : s(i2)) }) });
  }
  function b(t2) {
    return true;
  }
  function w(t2) {
    return "number" == typeof t2;
  }
  function S(t2) {
    return "string" == typeof t2;
  }
  function j(t2) {
    return "bigint" == typeof t2;
  }
  const K = a(p$1(b)), O = a(p$1(b)), E = K, x = (t2) => Object.assign(a(t2), { startsWith: (e2) => {
    return x(d(t2, (n2 = e2, p$1((t3) => S(t3) && t3.startsWith(n2)))));
    var n2;
  }, endsWith: (e2) => {
    return x(d(t2, (n2 = e2, p$1((t3) => S(t3) && t3.endsWith(n2)))));
    var n2;
  }, minLength: (e2) => x(d(t2, ((t3) => p$1((e3) => S(e3) && e3.length >= t3))(e2))), length: (e2) => x(d(t2, ((t3) => p$1((e3) => S(e3) && e3.length === t3))(e2))), maxLength: (e2) => x(d(t2, ((t3) => p$1((e3) => S(e3) && e3.length <= t3))(e2))), includes: (e2) => {
    return x(d(t2, (n2 = e2, p$1((t3) => S(t3) && t3.includes(n2)))));
    var n2;
  }, regex: (e2) => {
    return x(d(t2, (n2 = e2, p$1((t3) => S(t3) && Boolean(t3.match(n2))))));
    var n2;
  } }), A = x(p$1(S)), N = (t2) => Object.assign(a(t2), { between: (e2, n2) => N(d(t2, ((t3, e3) => p$1((n3) => w(n3) && t3 <= n3 && e3 >= n3))(e2, n2))), lt: (e2) => N(d(t2, ((t3) => p$1((e3) => w(e3) && e3 < t3))(e2))), gt: (e2) => N(d(t2, ((t3) => p$1((e3) => w(e3) && e3 > t3))(e2))), lte: (e2) => N(d(t2, ((t3) => p$1((e3) => w(e3) && e3 <= t3))(e2))), gte: (e2) => N(d(t2, ((t3) => p$1((e3) => w(e3) && e3 >= t3))(e2))), int: () => N(d(t2, p$1((t3) => w(t3) && Number.isInteger(t3)))), finite: () => N(d(t2, p$1((t3) => w(t3) && Number.isFinite(t3)))), positive: () => N(d(t2, p$1((t3) => w(t3) && t3 > 0))), negative: () => N(d(t2, p$1((t3) => w(t3) && t3 < 0))) }), P = N(p$1(w)), k = (t2) => Object.assign(a(t2), { between: (e2, n2) => k(d(t2, ((t3, e3) => p$1((n3) => j(n3) && t3 <= n3 && e3 >= n3))(e2, n2))), lt: (e2) => k(d(t2, ((t3) => p$1((e3) => j(e3) && e3 < t3))(e2))), gt: (e2) => k(d(t2, ((t3) => p$1((e3) => j(e3) && e3 > t3))(e2))), lte: (e2) => k(d(t2, ((t3) => p$1((e3) => j(e3) && e3 <= t3))(e2))), gte: (e2) => k(d(t2, ((t3) => p$1((e3) => j(e3) && e3 >= t3))(e2))), positive: () => k(d(t2, p$1((t3) => j(t3) && t3 > 0))), negative: () => k(d(t2, p$1((t3) => j(t3) && t3 < 0))) }), T = k(p$1(j)), B = a(p$1(function(t2) {
    return "boolean" == typeof t2;
  })), _ = a(p$1(function(t2) {
    return "symbol" == typeof t2;
  })), W = a(p$1(function(t2) {
    return null == t2;
  })), $ = a(p$1(function(t2) {
    return null != t2;
  }));
  var z = { __proto__: null, matcher: t, optional: h, array: function(...e2) {
    return l({ [t]: () => ({ match: (t2) => {
      if (!Array.isArray(t2)) return { matched: false };
      if (0 === e2.length) return { matched: true };
      const n2 = e2[0];
      let r2 = {};
      if (0 === t2.length) return s(n2).forEach((t3) => {
        r2[t3] = [];
      }), { matched: true, selections: r2 };
      const i2 = (t3, e3) => {
        r2[t3] = (r2[t3] || []).concat([e3]);
      };
      return { matched: t2.every((t3) => o(n2, t3, i2)), selections: r2 };
    }, getSelectionKeys: () => 0 === e2.length ? [] : s(e2[0]) }) });
  }, set: function(...e2) {
    return a({ [t]: () => ({ match: (t2) => {
      if (!(t2 instanceof Set)) return { matched: false };
      let n2 = {};
      if (0 === t2.size) return { matched: true, selections: n2 };
      if (0 === e2.length) return { matched: true };
      const r2 = (t3, e3) => {
        n2[t3] = (n2[t3] || []).concat([e3]);
      }, i2 = e2[0];
      return { matched: f(t2, (t3) => o(i2, t3, r2)), selections: n2 };
    }, getSelectionKeys: () => 0 === e2.length ? [] : s(e2[0]) }) });
  }, map: function(...e2) {
    return a({ [t]: () => ({ match: (t2) => {
      if (!(t2 instanceof Map)) return { matched: false };
      let n2 = {};
      if (0 === t2.size) return { matched: true, selections: n2 };
      const r2 = (t3, e3) => {
        n2[t3] = (n2[t3] || []).concat([e3]);
      };
      if (0 === e2.length) return { matched: true };
      var i2;
      if (1 === e2.length) throw new Error(`\`P.map\` wasn't given enough arguments. Expected (key, value), received ${null == (i2 = e2[0]) ? void 0 : i2.toString()}`);
      const [s2, c2] = e2;
      return { matched: g(t2, (t3, e3) => {
        const n3 = o(s2, e3, r2), i3 = o(c2, t3, r2);
        return n3 && i3;
      }), selections: n2 };
    }, getSelectionKeys: () => 0 === e2.length ? [] : [...s(e2[0]), ...s(e2[1])] }) });
  }, record: function(...e2) {
    return a({ [t]: () => ({ match: (t2) => {
      if (null === t2 || "object" != typeof t2 || Array.isArray(t2)) return { matched: false };
      var n2;
      if (0 === e2.length) throw new Error(`\`P.record\` wasn't given enough arguments. Expected (value) or (key, value), received ${null == (n2 = e2[0]) ? void 0 : n2.toString()}`);
      let r2 = {};
      const i2 = (t3, e3) => {
        r2[t3] = (r2[t3] || []).concat([e3]);
      }, [s2, c2] = 1 === e2.length ? [A, e2[0]] : e2;
      return { matched: m(t2, (t3, e3) => {
        const n3 = "string" != typeof t3 || Number.isNaN(Number(t3)) ? null : Number(t3), r3 = null !== n3 && o(s2, n3, i2), u2 = o(s2, t3, i2), a2 = o(c2, e3, i2);
        return (u2 || r3) && a2;
      }), selections: r2 };
    }, getSelectionKeys: () => 0 === e2.length ? [] : [...s(e2[0]), ...s(e2[1])] }) });
  }, intersection: d, union: y, not: function(e2) {
    return a({ [t]: () => ({ match: (t2) => ({ matched: !o(e2, t2, () => {
    }) }), getSelectionKeys: () => [], matcherType: "not" }) });
  }, when: p$1, select: v, any: K, unknown: O, _: E, string: A, number: P, bigint: T, boolean: B, symbol: _, nullish: W, nonNullable: $, instanceOf: function(t2) {
    return a(p$1( (function(t3) {
      return (e2) => e2 instanceof t3;
    })(t2)));
  }, shape: function(t2) {
    return a(p$1(u(t2)));
  } };
  class I extends Error {
    constructor(t2) {
      let e2;
      try {
        e2 = JSON.stringify(t2);
      } catch (n2) {
        e2 = t2;
      }
      super(`Pattern matching error: no pattern matches value ${e2}`), this.input = void 0, this.input = t2;
    }
  }
  const L = { matched: false, value: void 0 };
  function M(t2) {
    return new R(t2, L);
  }
  class R {
    constructor(t2, e2) {
      this.input = void 0, this.state = void 0, this.input = t2, this.state = e2;
    }
    with(...t2) {
      if (this.state.matched) return this;
      const e2 = t2[t2.length - 1], r2 = [t2[0]];
      let i2;
      3 === t2.length && "function" == typeof t2[1] ? i2 = t2[1] : t2.length > 2 && r2.push(...t2.slice(1, t2.length - 1));
      let s2 = false, c2 = {};
      const u2 = (t3, e3) => {
        s2 = true, c2[t3] = e3;
      }, a2 = !r2.some((t3) => o(t3, this.input, u2)) || i2 && !Boolean(i2(this.input)) ? L : { matched: true, value: e2(s2 ? n in c2 ? c2[n] : c2 : this.input, this.input) };
      return new R(this.input, a2);
    }
    when(t2, e2) {
      if (this.state.matched) return this;
      const n2 = Boolean(t2(this.input));
      return new R(this.input, n2 ? { matched: true, value: e2(this.input, this.input) } : L);
    }
    otherwise(t2) {
      return this.state.matched ? this.state.value : t2(this.input);
    }
    exhaustive(t2 = F) {
      return this.state.matched ? this.state.value : t2(this.input);
    }
    run() {
      return this.exhaustive();
    }
    returnType() {
      return this;
    }
    narrow() {
      return this;
    }
  }
  function F(t2) {
    throw new I(t2);
  }
  const LogLevels = {
    fatal: 0,
    error: 0,
    warn: 1,
    log: 2,
    info: 3,
    success: 3,
    fail: 3,
    debug: 4,
    trace: 5,
    verbose: Number.POSITIVE_INFINITY
  };
  const LogTypes = {
silent: {
      level: -1
    },
fatal: {
      level: LogLevels.fatal
    },
    error: {
      level: LogLevels.error
    },
warn: {
      level: LogLevels.warn
    },
log: {
      level: LogLevels.log
    },
info: {
      level: LogLevels.info
    },
    success: {
      level: LogLevels.success
    },
    fail: {
      level: LogLevels.fail
    },
    ready: {
      level: LogLevels.info
    },
    start: {
      level: LogLevels.info
    },
    box: {
      level: LogLevels.info
    },
debug: {
      level: LogLevels.debug
    },
trace: {
      level: LogLevels.trace
    },
verbose: {
      level: LogLevels.verbose
    }
  };
  function isPlainObject$1(value) {
    if (value === null || typeof value !== "object") {
      return false;
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== null && prototype !== Object.prototype && Object.getPrototypeOf(prototype) !== null) {
      return false;
    }
    if (Symbol.iterator in value) {
      return false;
    }
    if (Symbol.toStringTag in value) {
      return Object.prototype.toString.call(value) === "[object Module]";
    }
    return true;
  }
  function _defu(baseObject, defaults, namespace2 = ".", merger) {
    if (!isPlainObject$1(defaults)) {
      return _defu(baseObject, {}, namespace2);
    }
    const object = Object.assign({}, defaults);
    for (const key in baseObject) {
      if (key === "__proto__" || key === "constructor") {
        continue;
      }
      const value = baseObject[key];
      if (value === null || value === void 0) {
        continue;
      }
      if (Array.isArray(value) && Array.isArray(object[key])) {
        object[key] = [...value, ...object[key]];
      } else if (isPlainObject$1(value) && isPlainObject$1(object[key])) {
        object[key] = _defu(
          value,
          object[key],
          (namespace2 ? `${namespace2}.` : "") + key.toString()
        );
      } else {
        object[key] = value;
      }
    }
    return object;
  }
  function createDefu(merger) {
    return (...arguments_) => (
arguments_.reduce((p2, c2) => _defu(p2, c2, ""), {})
    );
  }
  const defu = createDefu();
  function isPlainObject(obj) {
    return Object.prototype.toString.call(obj) === "[object Object]";
  }
  function isLogObj(arg) {
    if (!isPlainObject(arg)) {
      return false;
    }
    if (!arg.message && !arg.args) {
      return false;
    }
    if (arg.stack) {
      return false;
    }
    return true;
  }
  let paused = false;
  const queue = [];
  class Consola {
    options;
    _lastLog;
    _mockFn;
constructor(options = {}) {
      const types = options.types || LogTypes;
      this.options = defu(
        {
          ...options,
          defaults: { ...options.defaults },
          level: _normalizeLogLevel(options.level, types),
          reporters: [...options.reporters || []]
        },
        {
          types: LogTypes,
          throttle: 1e3,
          throttleMin: 5,
          formatOptions: {
            date: true,
            colors: false,
            compact: true
          }
        }
      );
      for (const type in types) {
        const defaults = {
          type,
          ...this.options.defaults,
          ...types[type]
        };
        this[type] = this._wrapLogFn(defaults);
        this[type].raw = this._wrapLogFn(
          defaults,
          true
        );
      }
      if (this.options.mockFn) {
        this.mockTypes();
      }
      this._lastLog = {};
    }
get level() {
      return this.options.level;
    }
set level(level) {
      this.options.level = _normalizeLogLevel(
        level,
        this.options.types,
        this.options.level
      );
    }
prompt(message, opts) {
      if (!this.options.prompt) {
        throw new Error("prompt is not supported!");
      }
      return this.options.prompt(message, opts);
    }
create(options) {
      const instance = new Consola({
        ...this.options,
        ...options
      });
      if (this._mockFn) {
        instance.mockTypes(this._mockFn);
      }
      return instance;
    }
withDefaults(defaults) {
      return this.create({
        ...this.options,
        defaults: {
          ...this.options.defaults,
          ...defaults
        }
      });
    }
withTag(tag2) {
      return this.withDefaults({
        tag: this.options.defaults.tag ? this.options.defaults.tag + ":" + tag2 : tag2
      });
    }
addReporter(reporter) {
      this.options.reporters.push(reporter);
      return this;
    }
removeReporter(reporter) {
      if (reporter) {
        const i2 = this.options.reporters.indexOf(reporter);
        if (i2 !== -1) {
          return this.options.reporters.splice(i2, 1);
        }
      } else {
        this.options.reporters.splice(0);
      }
      return this;
    }
setReporters(reporters) {
      this.options.reporters = Array.isArray(reporters) ? reporters : [reporters];
      return this;
    }
    wrapAll() {
      this.wrapConsole();
      this.wrapStd();
    }
    restoreAll() {
      this.restoreConsole();
      this.restoreStd();
    }
wrapConsole() {
      for (const type in this.options.types) {
        if (!console["__" + type]) {
          console["__" + type] = console[type];
        }
        console[type] = this[type].raw;
      }
    }
restoreConsole() {
      for (const type in this.options.types) {
        if (console["__" + type]) {
          console[type] = console["__" + type];
          delete console["__" + type];
        }
      }
    }
wrapStd() {
      this._wrapStream(this.options.stdout, "log");
      this._wrapStream(this.options.stderr, "log");
    }
    _wrapStream(stream, type) {
      if (!stream) {
        return;
      }
      if (!stream.__write) {
        stream.__write = stream.write;
      }
      stream.write = (data) => {
        this[type].raw(String(data).trim());
      };
    }
restoreStd() {
      this._restoreStream(this.options.stdout);
      this._restoreStream(this.options.stderr);
    }
    _restoreStream(stream) {
      if (!stream) {
        return;
      }
      if (stream.__write) {
        stream.write = stream.__write;
        delete stream.__write;
      }
    }
pauseLogs() {
      paused = true;
    }
resumeLogs() {
      paused = false;
      const _queue = queue.splice(0);
      for (const item of _queue) {
        item[0]._logFn(item[1], item[2]);
      }
    }
mockTypes(mockFn) {
      const _mockFn = mockFn || this.options.mockFn;
      this._mockFn = _mockFn;
      if (typeof _mockFn !== "function") {
        return;
      }
      for (const type in this.options.types) {
        this[type] = _mockFn(type, this.options.types[type]) || this[type];
        this[type].raw = this[type];
      }
    }
    _wrapLogFn(defaults, isRaw) {
      return (...args) => {
        if (paused) {
          queue.push([this, defaults, args, isRaw]);
          return;
        }
        return this._logFn(defaults, args, isRaw);
      };
    }
    _logFn(defaults, args, isRaw) {
      if ((defaults.level || 0) > this.level) {
        return false;
      }
      const logObj = {
        date: new Date(),
        args: [],
        ...defaults,
        level: _normalizeLogLevel(defaults.level, this.options.types)
      };
      if (!isRaw && args.length === 1 && isLogObj(args[0])) {
        Object.assign(logObj, args[0]);
      } else {
        logObj.args = [...args];
      }
      if (logObj.message) {
        logObj.args.unshift(logObj.message);
        delete logObj.message;
      }
      if (logObj.additional) {
        if (!Array.isArray(logObj.additional)) {
          logObj.additional = logObj.additional.split("\n");
        }
        logObj.args.push("\n" + logObj.additional.join("\n"));
        delete logObj.additional;
      }
      logObj.type = typeof logObj.type === "string" ? logObj.type.toLowerCase() : "log";
      logObj.tag = typeof logObj.tag === "string" ? logObj.tag : "";
      const resolveLog = (newLog = false) => {
        const repeated = (this._lastLog.count || 0) - this.options.throttleMin;
        if (this._lastLog.object && repeated > 0) {
          const args2 = [...this._lastLog.object.args];
          if (repeated > 1) {
            args2.push(`(repeated ${repeated} times)`);
          }
          this._log({ ...this._lastLog.object, args: args2 });
          this._lastLog.count = 1;
        }
        if (newLog) {
          this._lastLog.object = logObj;
          this._log(logObj);
        }
      };
      clearTimeout(this._lastLog.timeout);
      const diffTime = this._lastLog.time && logObj.date ? logObj.date.getTime() - this._lastLog.time.getTime() : 0;
      this._lastLog.time = logObj.date;
      if (diffTime < this.options.throttle) {
        try {
          const serializedLog = JSON.stringify([
            logObj.type,
            logObj.tag,
            logObj.args
          ]);
          const isSameLog = this._lastLog.serialized === serializedLog;
          this._lastLog.serialized = serializedLog;
          if (isSameLog) {
            this._lastLog.count = (this._lastLog.count || 0) + 1;
            if (this._lastLog.count > this.options.throttleMin) {
              this._lastLog.timeout = setTimeout(
                resolveLog,
                this.options.throttle
              );
              return;
            }
          }
        } catch {
        }
      }
      resolveLog(true);
    }
    _log(logObj) {
      for (const reporter of this.options.reporters) {
        reporter.log(logObj, {
          options: this.options
        });
      }
    }
  }
  function _normalizeLogLevel(input, types = {}, defaultLevel = 3) {
    if (input === void 0) {
      return defaultLevel;
    }
    if (typeof input === "number") {
      return input;
    }
    if (types[input] && types[input].level !== void 0) {
      return types[input].level;
    }
    return defaultLevel;
  }
  Consola.prototype.add = Consola.prototype.addReporter;
  Consola.prototype.remove = Consola.prototype.removeReporter;
  Consola.prototype.clear = Consola.prototype.removeReporter;
  Consola.prototype.withScope = Consola.prototype.withTag;
  Consola.prototype.mock = Consola.prototype.mockTypes;
  Consola.prototype.pause = Consola.prototype.pauseLogs;
  Consola.prototype.resume = Consola.prototype.resumeLogs;
  function createConsola$1(options = {}) {
    return new Consola(options);
  }
  class BrowserReporter {
    options;
    defaultColor;
    levelColorMap;
    typeColorMap;
    constructor(options) {
      this.options = { ...options };
      this.defaultColor = "#7f8c8d";
      this.levelColorMap = {
        0: "#c0392b",
1: "#f39c12",
3: "#00BCD4"
};
      this.typeColorMap = {
        success: "#2ecc71"
};
    }
    _getLogFn(level) {
      if (level < 1) {
        return console.__error || console.error;
      }
      if (level === 1) {
        return console.__warn || console.warn;
      }
      return console.__log || console.log;
    }
    log(logObj) {
      const consoleLogFn = this._getLogFn(logObj.level);
      const type = logObj.type === "log" ? "" : logObj.type;
      const tag2 = logObj.tag || "";
      const color = this.typeColorMap[logObj.type] || this.levelColorMap[logObj.level] || this.defaultColor;
      const style = `
      background: ${color};
      border-radius: 0.5em;
      color: white;
      font-weight: bold;
      padding: 2px 0.5em;
    `;
      const badge = `%c${[tag2, type].filter(Boolean).join(":")}`;
      if (typeof logObj.args[0] === "string") {
        consoleLogFn(
          `${badge}%c ${logObj.args[0]}`,
          style,
"",
          ...logObj.args.slice(1)
        );
      } else {
        consoleLogFn(badge, style, ...logObj.args);
      }
    }
  }
  function createConsola(options = {}) {
    const consola2 = createConsola$1({
      reporters: options.reporters || [new BrowserReporter({})],
      prompt(message, options2 = {}) {
        if (options2.type === "confirm") {
          return Promise.resolve(confirm(message));
        }
        return Promise.resolve(prompt(message));
      },
      ...options
    });
    return consola2;
  }
  const consola = createConsola();
  const namespace = "tcml";
  const root = consola.withTag("Tunecore MIDI Lyrics");
  const createLogger = (scope) => {
    return root.withTag(scope);
  };
  function maybeGetElementsBySelector(selector, from = document) {
    return Array.from(from.querySelectorAll(selector));
  }
  function getElementsBySelector(selector, from = document) {
    const elements = maybeGetElementsBySelector(selector, from);
    if (elements.length === 0) {
      throw new Error(`No elements found for selector: ${selector}`);
    }
    return elements;
  }
  function maybeGetElementBySelector(selector, from = document) {
    return from.querySelector(selector);
  }
  function getElementBySelector(selector, from = document) {
    const element = maybeGetElementBySelector(selector, from);
    if (!element) {
      throw new Error(`No element found for selector: ${selector}`);
    }
    return element;
  }
  function getAugmentedNamespace(n2) {
    if (Object.prototype.hasOwnProperty.call(n2, "__esModule")) return n2;
    var f2 = n2.default;
    if (typeof f2 == "function") {
      var a2 = function a3() {
        var isInstance = false;
        try {
          isInstance = this instanceof a3;
        } catch {
        }
        if (isInstance) {
          return Reflect.construct(f2, arguments, this.constructor);
        }
        return f2.apply(this, arguments);
      };
      a2.prototype = f2.prototype;
    } else a2 = {};
    Object.defineProperty(a2, "__esModule", { value: true });
    Object.keys(n2).forEach(function(k2) {
      var d2 = Object.getOwnPropertyDescriptor(n2, k2);
      Object.defineProperty(a2, k2, d2.get ? d2 : {
        enumerable: true,
        get: function() {
          return n2[k2];
        }
      });
    });
    return a2;
  }
  var Midi = {};
  var midiFile = {};
  var midiParser;
  var hasRequiredMidiParser;
  function requireMidiParser() {
    if (hasRequiredMidiParser) return midiParser;
    hasRequiredMidiParser = 1;
    function parseMidi(data) {
      var p2 = new Parser(data);
      var headerChunk = p2.readChunk();
      if (headerChunk.id != "MThd")
        throw "Bad MIDI file.  Expected 'MHdr', got: '" + headerChunk.id + "'";
      var header = parseHeader(headerChunk.data);
      var tracks = [];
      for (var i2 = 0; !p2.eof() && i2 < header.numTracks; i2++) {
        var trackChunk = p2.readChunk();
        if (trackChunk.id != "MTrk")
          throw "Bad MIDI file.  Expected 'MTrk', got: '" + trackChunk.id + "'";
        var track = parseTrack(trackChunk.data);
        tracks.push(track);
      }
      return {
        header,
        tracks
      };
    }
    function parseHeader(data) {
      var p2 = new Parser(data);
      var format = p2.readUInt16();
      var numTracks = p2.readUInt16();
      var result = {
        format,
        numTracks
      };
      var timeDivision = p2.readUInt16();
      if (timeDivision & 32768) {
        result.framesPerSecond = 256 - (timeDivision >> 8);
        result.ticksPerFrame = timeDivision & 255;
      } else {
        result.ticksPerBeat = timeDivision;
      }
      return result;
    }
    function parseTrack(data) {
      var p2 = new Parser(data);
      var events = [];
      while (!p2.eof()) {
        var event = readEvent();
        events.push(event);
      }
      return events;
      var lastEventTypeByte = null;
      function readEvent() {
        var event2 = {};
        event2.deltaTime = p2.readVarInt();
        var eventTypeByte = p2.readUInt8();
        if ((eventTypeByte & 240) === 240) {
          if (eventTypeByte === 255) {
            event2.meta = true;
            var metatypeByte = p2.readUInt8();
            var length = p2.readVarInt();
            switch (metatypeByte) {
              case 0:
                event2.type = "sequenceNumber";
                if (length !== 2) throw "Expected length for sequenceNumber event is 2, got " + length;
                event2.number = p2.readUInt16();
                return event2;
              case 1:
                event2.type = "text";
                event2.text = p2.readString(length);
                return event2;
              case 2:
                event2.type = "copyrightNotice";
                event2.text = p2.readString(length);
                return event2;
              case 3:
                event2.type = "trackName";
                event2.text = p2.readString(length);
                return event2;
              case 4:
                event2.type = "instrumentName";
                event2.text = p2.readString(length);
                return event2;
              case 5:
                event2.type = "lyrics";
                event2.text = p2.readString(length);
                return event2;
              case 6:
                event2.type = "marker";
                event2.text = p2.readString(length);
                return event2;
              case 7:
                event2.type = "cuePoint";
                event2.text = p2.readString(length);
                return event2;
              case 32:
                event2.type = "channelPrefix";
                if (length != 1) throw "Expected length for channelPrefix event is 1, got " + length;
                event2.channel = p2.readUInt8();
                return event2;
              case 33:
                event2.type = "portPrefix";
                if (length != 1) throw "Expected length for portPrefix event is 1, got " + length;
                event2.port = p2.readUInt8();
                return event2;
              case 47:
                event2.type = "endOfTrack";
                if (length != 0) throw "Expected length for endOfTrack event is 0, got " + length;
                return event2;
              case 81:
                event2.type = "setTempo";
                if (length != 3) throw "Expected length for setTempo event is 3, got " + length;
                event2.microsecondsPerBeat = p2.readUInt24();
                return event2;
              case 84:
                event2.type = "smpteOffset";
                if (length != 5) throw "Expected length for smpteOffset event is 5, got " + length;
                var hourByte = p2.readUInt8();
                var FRAME_RATES = { 0: 24, 32: 25, 64: 29, 96: 30 };
                event2.frameRate = FRAME_RATES[hourByte & 96];
                event2.hour = hourByte & 31;
                event2.min = p2.readUInt8();
                event2.sec = p2.readUInt8();
                event2.frame = p2.readUInt8();
                event2.subFrame = p2.readUInt8();
                return event2;
              case 88:
                event2.type = "timeSignature";
                if (length != 2 && length != 4) throw "Expected length for timeSignature event is 4 or 2, got " + length;
                event2.numerator = p2.readUInt8();
                event2.denominator = 1 << p2.readUInt8();
                if (length === 4) {
                  event2.metronome = p2.readUInt8();
                  event2.thirtyseconds = p2.readUInt8();
                } else {
                  event2.metronome = 36;
                  event2.thirtyseconds = 8;
                }
                return event2;
              case 89:
                event2.type = "keySignature";
                if (length != 2) throw "Expected length for keySignature event is 2, got " + length;
                event2.key = p2.readInt8();
                event2.scale = p2.readUInt8();
                return event2;
              case 127:
                event2.type = "sequencerSpecific";
                event2.data = p2.readBytes(length);
                return event2;
              default:
                event2.type = "unknownMeta";
                event2.data = p2.readBytes(length);
                event2.metatypeByte = metatypeByte;
                return event2;
            }
          } else if (eventTypeByte == 240) {
            event2.type = "sysEx";
            var length = p2.readVarInt();
            event2.data = p2.readBytes(length);
            return event2;
          } else if (eventTypeByte == 247) {
            event2.type = "endSysEx";
            var length = p2.readVarInt();
            event2.data = p2.readBytes(length);
            return event2;
          } else {
            throw "Unrecognised MIDI event type byte: " + eventTypeByte;
          }
        } else {
          var param1;
          if ((eventTypeByte & 128) === 0) {
            if (lastEventTypeByte === null)
              throw "Running status byte encountered before status byte";
            param1 = eventTypeByte;
            eventTypeByte = lastEventTypeByte;
            event2.running = true;
          } else {
            param1 = p2.readUInt8();
            lastEventTypeByte = eventTypeByte;
          }
          var eventType = eventTypeByte >> 4;
          event2.channel = eventTypeByte & 15;
          switch (eventType) {
            case 8:
              event2.type = "noteOff";
              event2.noteNumber = param1;
              event2.velocity = p2.readUInt8();
              return event2;
            case 9:
              var velocity = p2.readUInt8();
              event2.type = velocity === 0 ? "noteOff" : "noteOn";
              event2.noteNumber = param1;
              event2.velocity = velocity;
              if (velocity === 0) event2.byte9 = true;
              return event2;
            case 10:
              event2.type = "noteAftertouch";
              event2.noteNumber = param1;
              event2.amount = p2.readUInt8();
              return event2;
            case 11:
              event2.type = "controller";
              event2.controllerType = param1;
              event2.value = p2.readUInt8();
              return event2;
            case 12:
              event2.type = "programChange";
              event2.programNumber = param1;
              return event2;
            case 13:
              event2.type = "channelAftertouch";
              event2.amount = param1;
              return event2;
            case 14:
              event2.type = "pitchBend";
              event2.value = param1 + (p2.readUInt8() << 7) - 8192;
              return event2;
            default:
              throw "Unrecognised MIDI event type: " + eventType;
          }
        }
      }
    }
    function Parser(data) {
      this.buffer = data;
      this.bufferLen = this.buffer.length;
      this.pos = 0;
    }
    Parser.prototype.eof = function() {
      return this.pos >= this.bufferLen;
    };
    Parser.prototype.readUInt8 = function() {
      var result = this.buffer[this.pos];
      this.pos += 1;
      return result;
    };
    Parser.prototype.readInt8 = function() {
      var u2 = this.readUInt8();
      if (u2 & 128)
        return u2 - 256;
      else
        return u2;
    };
    Parser.prototype.readUInt16 = function() {
      var b0 = this.readUInt8(), b1 = this.readUInt8();
      return (b0 << 8) + b1;
    };
    Parser.prototype.readInt16 = function() {
      var u2 = this.readUInt16();
      if (u2 & 32768)
        return u2 - 65536;
      else
        return u2;
    };
    Parser.prototype.readUInt24 = function() {
      var b0 = this.readUInt8(), b1 = this.readUInt8(), b2 = this.readUInt8();
      return (b0 << 16) + (b1 << 8) + b2;
    };
    Parser.prototype.readInt24 = function() {
      var u2 = this.readUInt24();
      if (u2 & 8388608)
        return u2 - 16777216;
      else
        return u2;
    };
    Parser.prototype.readUInt32 = function() {
      var b0 = this.readUInt8(), b1 = this.readUInt8(), b2 = this.readUInt8(), b3 = this.readUInt8();
      return (b0 << 24) + (b1 << 16) + (b2 << 8) + b3;
    };
    Parser.prototype.readBytes = function(len) {
      var bytes = this.buffer.slice(this.pos, this.pos + len);
      this.pos += len;
      return bytes;
    };
    Parser.prototype.readString = function(len) {
      var bytes = this.readBytes(len);
      return String.fromCharCode.apply(null, bytes);
    };
    Parser.prototype.readVarInt = function() {
      var result = 0;
      while (!this.eof()) {
        var b2 = this.readUInt8();
        if (b2 & 128) {
          result += b2 & 127;
          result <<= 7;
        } else {
          return result + b2;
        }
      }
      return result;
    };
    Parser.prototype.readChunk = function() {
      var id = this.readString(4);
      var length = this.readUInt32();
      var data = this.readBytes(length);
      return {
        id,
        length,
        data
      };
    };
    midiParser = parseMidi;
    return midiParser;
  }
  var midiWriter;
  var hasRequiredMidiWriter;
  function requireMidiWriter() {
    if (hasRequiredMidiWriter) return midiWriter;
    hasRequiredMidiWriter = 1;
    function writeMidi(data, opts) {
      if (typeof data !== "object")
        throw "Invalid MIDI data";
      opts = opts || {};
      var header = data.header || {};
      var tracks = data.tracks || [];
      var i2, len = tracks.length;
      var w2 = new Writer();
      writeHeader(w2, header, len);
      for (i2 = 0; i2 < len; i2++) {
        writeTrack(w2, tracks[i2], opts);
      }
      return w2.buffer;
    }
    function writeHeader(w2, header, numTracks) {
      var format = header.format == null ? 1 : header.format;
      var timeDivision = 128;
      if (header.timeDivision) {
        timeDivision = header.timeDivision;
      } else if (header.ticksPerFrame && header.framesPerSecond) {
        timeDivision = -(header.framesPerSecond & 255) << 8 | header.ticksPerFrame & 255;
      } else if (header.ticksPerBeat) {
        timeDivision = header.ticksPerBeat & 32767;
      }
      var h2 = new Writer();
      h2.writeUInt16(format);
      h2.writeUInt16(numTracks);
      h2.writeUInt16(timeDivision);
      w2.writeChunk("MThd", h2.buffer);
    }
    function writeTrack(w2, track, opts) {
      var t2 = new Writer();
      var i2, len = track.length;
      var eventTypeByte = null;
      for (i2 = 0; i2 < len; i2++) {
        if (opts.running === false || !opts.running && !track[i2].running) eventTypeByte = null;
        eventTypeByte = writeEvent(t2, track[i2], eventTypeByte, opts.useByte9ForNoteOff);
      }
      w2.writeChunk("MTrk", t2.buffer);
    }
    function writeEvent(w2, event, lastEventTypeByte, useByte9ForNoteOff) {
      var type = event.type;
      var deltaTime = event.deltaTime;
      var text = event.text || "";
      var data = event.data || [];
      var eventTypeByte = null;
      w2.writeVarInt(deltaTime);
      switch (type) {
case "sequenceNumber":
          w2.writeUInt8(255);
          w2.writeUInt8(0);
          w2.writeVarInt(2);
          w2.writeUInt16(event.number);
          break;
        case "text":
          w2.writeUInt8(255);
          w2.writeUInt8(1);
          w2.writeVarInt(text.length);
          w2.writeString(text);
          break;
        case "copyrightNotice":
          w2.writeUInt8(255);
          w2.writeUInt8(2);
          w2.writeVarInt(text.length);
          w2.writeString(text);
          break;
        case "trackName":
          w2.writeUInt8(255);
          w2.writeUInt8(3);
          w2.writeVarInt(text.length);
          w2.writeString(text);
          break;
        case "instrumentName":
          w2.writeUInt8(255);
          w2.writeUInt8(4);
          w2.writeVarInt(text.length);
          w2.writeString(text);
          break;
        case "lyrics":
          w2.writeUInt8(255);
          w2.writeUInt8(5);
          w2.writeVarInt(text.length);
          w2.writeString(text);
          break;
        case "marker":
          w2.writeUInt8(255);
          w2.writeUInt8(6);
          w2.writeVarInt(text.length);
          w2.writeString(text);
          break;
        case "cuePoint":
          w2.writeUInt8(255);
          w2.writeUInt8(7);
          w2.writeVarInt(text.length);
          w2.writeString(text);
          break;
        case "channelPrefix":
          w2.writeUInt8(255);
          w2.writeUInt8(32);
          w2.writeVarInt(1);
          w2.writeUInt8(event.channel);
          break;
        case "portPrefix":
          w2.writeUInt8(255);
          w2.writeUInt8(33);
          w2.writeVarInt(1);
          w2.writeUInt8(event.port);
          break;
        case "endOfTrack":
          w2.writeUInt8(255);
          w2.writeUInt8(47);
          w2.writeVarInt(0);
          break;
        case "setTempo":
          w2.writeUInt8(255);
          w2.writeUInt8(81);
          w2.writeVarInt(3);
          w2.writeUInt24(event.microsecondsPerBeat);
          break;
        case "smpteOffset":
          w2.writeUInt8(255);
          w2.writeUInt8(84);
          w2.writeVarInt(5);
          var FRAME_RATES = { 24: 0, 25: 32, 29: 64, 30: 96 };
          var hourByte = event.hour & 31 | FRAME_RATES[event.frameRate];
          w2.writeUInt8(hourByte);
          w2.writeUInt8(event.min);
          w2.writeUInt8(event.sec);
          w2.writeUInt8(event.frame);
          w2.writeUInt8(event.subFrame);
          break;
        case "timeSignature":
          w2.writeUInt8(255);
          w2.writeUInt8(88);
          w2.writeVarInt(4);
          w2.writeUInt8(event.numerator);
          var denominator = Math.floor(Math.log(event.denominator) / Math.LN2) & 255;
          w2.writeUInt8(denominator);
          w2.writeUInt8(event.metronome);
          w2.writeUInt8(event.thirtyseconds || 8);
          break;
        case "keySignature":
          w2.writeUInt8(255);
          w2.writeUInt8(89);
          w2.writeVarInt(2);
          w2.writeInt8(event.key);
          w2.writeUInt8(event.scale);
          break;
        case "sequencerSpecific":
          w2.writeUInt8(255);
          w2.writeUInt8(127);
          w2.writeVarInt(data.length);
          w2.writeBytes(data);
          break;
        case "unknownMeta":
          if (event.metatypeByte != null) {
            w2.writeUInt8(255);
            w2.writeUInt8(event.metatypeByte);
            w2.writeVarInt(data.length);
            w2.writeBytes(data);
          }
          break;
case "sysEx":
          w2.writeUInt8(240);
          w2.writeVarInt(data.length);
          w2.writeBytes(data);
          break;
        case "endSysEx":
          w2.writeUInt8(247);
          w2.writeVarInt(data.length);
          w2.writeBytes(data);
          break;
case "noteOff":
          var noteByte = useByte9ForNoteOff !== false && event.byte9 || useByte9ForNoteOff && event.velocity == 0 ? 144 : 128;
          eventTypeByte = noteByte | event.channel;
          if (eventTypeByte !== lastEventTypeByte) w2.writeUInt8(eventTypeByte);
          w2.writeUInt8(event.noteNumber);
          w2.writeUInt8(event.velocity);
          break;
        case "noteOn":
          eventTypeByte = 144 | event.channel;
          if (eventTypeByte !== lastEventTypeByte) w2.writeUInt8(eventTypeByte);
          w2.writeUInt8(event.noteNumber);
          w2.writeUInt8(event.velocity);
          break;
        case "noteAftertouch":
          eventTypeByte = 160 | event.channel;
          if (eventTypeByte !== lastEventTypeByte) w2.writeUInt8(eventTypeByte);
          w2.writeUInt8(event.noteNumber);
          w2.writeUInt8(event.amount);
          break;
        case "controller":
          eventTypeByte = 176 | event.channel;
          if (eventTypeByte !== lastEventTypeByte) w2.writeUInt8(eventTypeByte);
          w2.writeUInt8(event.controllerType);
          w2.writeUInt8(event.value);
          break;
        case "programChange":
          eventTypeByte = 192 | event.channel;
          if (eventTypeByte !== lastEventTypeByte) w2.writeUInt8(eventTypeByte);
          w2.writeUInt8(event.programNumber);
          break;
        case "channelAftertouch":
          eventTypeByte = 208 | event.channel;
          if (eventTypeByte !== lastEventTypeByte) w2.writeUInt8(eventTypeByte);
          w2.writeUInt8(event.amount);
          break;
        case "pitchBend":
          eventTypeByte = 224 | event.channel;
          if (eventTypeByte !== lastEventTypeByte) w2.writeUInt8(eventTypeByte);
          var value14 = 8192 + event.value;
          var lsb14 = value14 & 127;
          var msb14 = value14 >> 7 & 127;
          w2.writeUInt8(lsb14);
          w2.writeUInt8(msb14);
          break;
        default:
          throw "Unrecognized event type: " + type;
      }
      return eventTypeByte;
    }
    function Writer() {
      this.buffer = [];
    }
    Writer.prototype.writeUInt8 = function(v2) {
      this.buffer.push(v2 & 255);
    };
    Writer.prototype.writeInt8 = Writer.prototype.writeUInt8;
    Writer.prototype.writeUInt16 = function(v2) {
      var b0 = v2 >> 8 & 255, b1 = v2 & 255;
      this.writeUInt8(b0);
      this.writeUInt8(b1);
    };
    Writer.prototype.writeInt16 = Writer.prototype.writeUInt16;
    Writer.prototype.writeUInt24 = function(v2) {
      var b0 = v2 >> 16 & 255, b1 = v2 >> 8 & 255, b2 = v2 & 255;
      this.writeUInt8(b0);
      this.writeUInt8(b1);
      this.writeUInt8(b2);
    };
    Writer.prototype.writeInt24 = Writer.prototype.writeUInt24;
    Writer.prototype.writeUInt32 = function(v2) {
      var b0 = v2 >> 24 & 255, b1 = v2 >> 16 & 255, b2 = v2 >> 8 & 255, b3 = v2 & 255;
      this.writeUInt8(b0);
      this.writeUInt8(b1);
      this.writeUInt8(b2);
      this.writeUInt8(b3);
    };
    Writer.prototype.writeInt32 = Writer.prototype.writeUInt32;
    Writer.prototype.writeBytes = function(arr) {
      this.buffer = this.buffer.concat(Array.prototype.slice.call(arr, 0));
    };
    Writer.prototype.writeString = function(str) {
      var i2, len = str.length, arr = [];
      for (i2 = 0; i2 < len; i2++) {
        arr.push(str.codePointAt(i2));
      }
      this.writeBytes(arr);
    };
    Writer.prototype.writeVarInt = function(v2) {
      if (v2 < 0) throw "Cannot write negative variable-length integer";
      if (v2 <= 127) {
        this.writeUInt8(v2);
      } else {
        var i2 = v2;
        var bytes = [];
        bytes.push(i2 & 127);
        i2 >>= 7;
        while (i2) {
          var b2 = i2 & 127 | 128;
          bytes.push(b2);
          i2 >>= 7;
        }
        this.writeBytes(bytes.reverse());
      }
    };
    Writer.prototype.writeChunk = function(id, data) {
      this.writeString(id);
      this.writeUInt32(data.length);
      this.writeBytes(data);
    };
    midiWriter = writeMidi;
    return midiWriter;
  }
  var hasRequiredMidiFile;
  function requireMidiFile() {
    if (hasRequiredMidiFile) return midiFile;
    hasRequiredMidiFile = 1;
    midiFile.parseMidi = requireMidiParser();
    midiFile.writeMidi = requireMidiWriter();
    return midiFile;
  }
  var Header = {};
  var BinarySearch = {};
  var hasRequiredBinarySearch;
  function requireBinarySearch() {
    if (hasRequiredBinarySearch) return BinarySearch;
    hasRequiredBinarySearch = 1;
    Object.defineProperty(BinarySearch, "__esModule", { value: true });
    BinarySearch.insert = BinarySearch.search = void 0;
    function search(array, value, prop) {
      if (prop === void 0) {
        prop = "ticks";
      }
      var beginning = 0;
      var len = array.length;
      var end = len;
      if (len > 0 && array[len - 1][prop] <= value) {
        return len - 1;
      }
      while (beginning < end) {
        var midPoint = Math.floor(beginning + (end - beginning) / 2);
        var event_1 = array[midPoint];
        var nextEvent = array[midPoint + 1];
        if (event_1[prop] === value) {
          for (var i2 = midPoint; i2 < array.length; i2++) {
            var testEvent = array[i2];
            if (testEvent[prop] === value) {
              midPoint = i2;
            }
          }
          return midPoint;
        } else if (event_1[prop] < value && nextEvent[prop] > value) {
          return midPoint;
        } else if (event_1[prop] > value) {
          end = midPoint;
        } else if (event_1[prop] < value) {
          beginning = midPoint + 1;
        }
      }
      return -1;
    }
    BinarySearch.search = search;
    function insert(array, event, prop) {
      if (prop === void 0) {
        prop = "ticks";
      }
      if (array.length) {
        var index = search(array, event[prop], prop);
        array.splice(index + 1, 0, event);
      } else {
        array.push(event);
      }
    }
    BinarySearch.insert = insert;
    return BinarySearch;
  }
  var hasRequiredHeader;
  function requireHeader() {
    if (hasRequiredHeader) return Header;
    hasRequiredHeader = 1;
    (function(exports$1) {
      Object.defineProperty(exports$1, "__esModule", { value: true });
      exports$1.Header = exports$1.keySignatureKeys = void 0;
      var BinarySearch_1 = requireBinarySearch();
      var privatePPQMap = new WeakMap();
      exports$1.keySignatureKeys = [
        "Cb",
        "Gb",
        "Db",
        "Ab",
        "Eb",
        "Bb",
        "F",
        "C",
        "G",
        "D",
        "A",
        "E",
        "B",
        "F#",
        "C#"
      ];
      var Header2 = (
(function() {
          function Header3(midiData) {
            var _this = this;
            this.tempos = [];
            this.timeSignatures = [];
            this.keySignatures = [];
            this.meta = [];
            this.name = "";
            privatePPQMap.set(this, 480);
            if (midiData) {
              privatePPQMap.set(this, midiData.header.ticksPerBeat);
              midiData.tracks.forEach(function(track) {
                track.forEach(function(event) {
                  if (event.meta) {
                    if (event.type === "timeSignature") {
                      _this.timeSignatures.push({
                        ticks: event.absoluteTime,
                        timeSignature: [
                          event.numerator,
                          event.denominator
                        ]
                      });
                    } else if (event.type === "setTempo") {
                      _this.tempos.push({
                        bpm: 6e7 / event.microsecondsPerBeat,
                        ticks: event.absoluteTime
                      });
                    } else if (event.type === "keySignature") {
                      _this.keySignatures.push({
                        key: exports$1.keySignatureKeys[event.key + 7],
                        scale: event.scale === 0 ? "major" : "minor",
                        ticks: event.absoluteTime
                      });
                    }
                  }
                });
              });
              var firstTrackCurrentTicks_1 = 0;
              midiData.tracks[0].forEach(function(event) {
                firstTrackCurrentTicks_1 += event.deltaTime;
                if (event.meta) {
                  if (event.type === "trackName") {
                    _this.name = event.text;
                  } else if (event.type === "text" || event.type === "cuePoint" || event.type === "marker" || event.type === "lyrics") {
                    _this.meta.push({
                      text: event.text,
                      ticks: firstTrackCurrentTicks_1,
                      type: event.type
                    });
                  }
                }
              });
              this.update();
            }
          }
          Header3.prototype.update = function() {
            var _this = this;
            var currentTime = 0;
            var lastEventBeats = 0;
            this.tempos.sort(function(a2, b2) {
              return a2.ticks - b2.ticks;
            });
            this.tempos.forEach(function(event, index) {
              var lastBPM = index > 0 ? _this.tempos[index - 1].bpm : _this.tempos[0].bpm;
              var beats = event.ticks / _this.ppq - lastEventBeats;
              var elapsedSeconds = 60 / lastBPM * beats;
              event.time = elapsedSeconds + currentTime;
              currentTime = event.time;
              lastEventBeats += beats;
            });
            this.timeSignatures.sort(function(a2, b2) {
              return a2.ticks - b2.ticks;
            });
            this.timeSignatures.forEach(function(event, index) {
              var lastEvent = index > 0 ? _this.timeSignatures[index - 1] : _this.timeSignatures[0];
              var elapsedBeats = (event.ticks - lastEvent.ticks) / _this.ppq;
              var elapsedMeasures = elapsedBeats / lastEvent.timeSignature[0] / (lastEvent.timeSignature[1] / 4);
              lastEvent.measures = lastEvent.measures || 0;
              event.measures = elapsedMeasures + lastEvent.measures;
            });
          };
          Header3.prototype.ticksToSeconds = function(ticks) {
            var index = (0, BinarySearch_1.search)(this.tempos, ticks);
            if (index !== -1) {
              var tempo = this.tempos[index];
              var tempoTime = tempo.time;
              var elapsedBeats = (ticks - tempo.ticks) / this.ppq;
              return tempoTime + 60 / tempo.bpm * elapsedBeats;
            } else {
              var beats = ticks / this.ppq;
              return 60 / 120 * beats;
            }
          };
          Header3.prototype.ticksToMeasures = function(ticks) {
            var index = (0, BinarySearch_1.search)(this.timeSignatures, ticks);
            if (index !== -1) {
              var timeSigEvent = this.timeSignatures[index];
              var elapsedBeats = (ticks - timeSigEvent.ticks) / this.ppq;
              return timeSigEvent.measures + elapsedBeats / (timeSigEvent.timeSignature[0] / timeSigEvent.timeSignature[1]) / 4;
            } else {
              return ticks / this.ppq / 4;
            }
          };
          Object.defineProperty(Header3.prototype, "ppq", {
get: function() {
              return privatePPQMap.get(this);
            },
            enumerable: false,
            configurable: true
          });
          Header3.prototype.secondsToTicks = function(seconds) {
            var index = (0, BinarySearch_1.search)(this.tempos, seconds, "time");
            if (index !== -1) {
              var tempo = this.tempos[index];
              var tempoTime = tempo.time;
              var elapsedTime = seconds - tempoTime;
              var elapsedBeats = elapsedTime / (60 / tempo.bpm);
              return Math.round(tempo.ticks + elapsedBeats * this.ppq);
            } else {
              var beats = seconds / (60 / 120);
              return Math.round(beats * this.ppq);
            }
          };
          Header3.prototype.toJSON = function() {
            return {
              keySignatures: this.keySignatures,
              meta: this.meta,
              name: this.name,
              ppq: this.ppq,
              tempos: this.tempos.map(function(t2) {
                return {
                  bpm: t2.bpm,
                  ticks: t2.ticks
                };
              }),
              timeSignatures: this.timeSignatures
            };
          };
          Header3.prototype.fromJSON = function(json) {
            this.name = json.name;
            this.tempos = json.tempos.map(function(t2) {
              return Object.assign({}, t2);
            });
            this.timeSignatures = json.timeSignatures.map(function(t2) {
              return Object.assign({}, t2);
            });
            this.keySignatures = json.keySignatures.map(function(t2) {
              return Object.assign({}, t2);
            });
            this.meta = json.meta.map(function(t2) {
              return Object.assign({}, t2);
            });
            privatePPQMap.set(this, json.ppq);
            this.update();
          };
          Header3.prototype.setTempo = function(bpm) {
            this.tempos = [
              {
                bpm,
                ticks: 0
              }
            ];
            this.update();
          };
          return Header3;
        })()
      );
      exports$1.Header = Header2;
    })(Header);
    return Header;
  }
  var Track = {};
  var ControlChange = {};
  var hasRequiredControlChange;
  function requireControlChange() {
    if (hasRequiredControlChange) return ControlChange;
    hasRequiredControlChange = 1;
    (function(exports$1) {
      Object.defineProperty(exports$1, "__esModule", { value: true });
      exports$1.ControlChange = exports$1.controlChangeIds = exports$1.controlChangeNames = void 0;
      exports$1.controlChangeNames = {
        1: "modulationWheel",
        2: "breath",
        4: "footController",
        5: "portamentoTime",
        7: "volume",
        8: "balance",
        10: "pan",
        64: "sustain",
        65: "portamentoTime",
        66: "sostenuto",
        67: "softPedal",
        68: "legatoFootswitch",
        84: "portamentoControl"
      };
      exports$1.controlChangeIds = Object.keys(exports$1.controlChangeNames).reduce(function(obj, key) {
        obj[exports$1.controlChangeNames[key]] = key;
        return obj;
      }, {});
      var privateHeaderMap = new WeakMap();
      var privateCCNumberMap = new WeakMap();
      var ControlChange2 = (
(function() {
          function ControlChange3(event, header) {
            privateHeaderMap.set(this, header);
            privateCCNumberMap.set(this, event.controllerType);
            this.ticks = event.absoluteTime;
            this.value = event.value;
          }
          Object.defineProperty(ControlChange3.prototype, "number", {
get: function() {
              return privateCCNumberMap.get(this);
            },
            enumerable: false,
            configurable: true
          });
          Object.defineProperty(ControlChange3.prototype, "name", {
get: function() {
              if (exports$1.controlChangeNames[this.number]) {
                return exports$1.controlChangeNames[this.number];
              } else {
                return null;
              }
            },
            enumerable: false,
            configurable: true
          });
          Object.defineProperty(ControlChange3.prototype, "time", {
get: function() {
              var header = privateHeaderMap.get(this);
              return header.ticksToSeconds(this.ticks);
            },
            set: function(t2) {
              var header = privateHeaderMap.get(this);
              this.ticks = header.secondsToTicks(t2);
            },
            enumerable: false,
            configurable: true
          });
          ControlChange3.prototype.toJSON = function() {
            return {
              number: this.number,
              ticks: this.ticks,
              time: this.time,
              value: this.value
            };
          };
          return ControlChange3;
        })()
      );
      exports$1.ControlChange = ControlChange2;
    })(ControlChange);
    return ControlChange;
  }
  var ControlChanges = {};
  var hasRequiredControlChanges;
  function requireControlChanges() {
    if (hasRequiredControlChanges) return ControlChanges;
    hasRequiredControlChanges = 1;
    Object.defineProperty(ControlChanges, "__esModule", { value: true });
    ControlChanges.createControlChanges = void 0;
    var ControlChange_1 = requireControlChange();
    function createControlChanges() {
      return new Proxy({}, {
get: function(target, handler2) {
          if (target[handler2]) {
            return target[handler2];
          } else if (ControlChange_1.controlChangeIds.hasOwnProperty(handler2)) {
            return target[ControlChange_1.controlChangeIds[handler2]];
          }
        },
set: function(target, handler2, value) {
          if (ControlChange_1.controlChangeIds.hasOwnProperty(handler2)) {
            target[ControlChange_1.controlChangeIds[handler2]] = value;
          } else {
            target[handler2] = value;
          }
          return true;
        }
      });
    }
    ControlChanges.createControlChanges = createControlChanges;
    return ControlChanges;
  }
  var PitchBend = {};
  var hasRequiredPitchBend;
  function requirePitchBend() {
    if (hasRequiredPitchBend) return PitchBend;
    hasRequiredPitchBend = 1;
    Object.defineProperty(PitchBend, "__esModule", { value: true });
    PitchBend.PitchBend = void 0;
    var privateHeaderMap = new WeakMap();
    var PitchBend$1 = (
(function() {
        function PitchBend2(event, header) {
          privateHeaderMap.set(this, header);
          this.ticks = event.absoluteTime;
          this.value = event.value;
        }
        Object.defineProperty(PitchBend2.prototype, "time", {
get: function() {
            var header = privateHeaderMap.get(this);
            return header.ticksToSeconds(this.ticks);
          },
          set: function(t2) {
            var header = privateHeaderMap.get(this);
            this.ticks = header.secondsToTicks(t2);
          },
          enumerable: false,
          configurable: true
        });
        PitchBend2.prototype.toJSON = function() {
          return {
            ticks: this.ticks,
            time: this.time,
            value: this.value
          };
        };
        return PitchBend2;
      })()
    );
    PitchBend.PitchBend = PitchBend$1;
    return PitchBend;
  }
  var Instrument = {};
  var InstrumentMaps = {};
  var hasRequiredInstrumentMaps;
  function requireInstrumentMaps() {
    if (hasRequiredInstrumentMaps) return InstrumentMaps;
    hasRequiredInstrumentMaps = 1;
    Object.defineProperty(InstrumentMaps, "__esModule", { value: true });
    InstrumentMaps.DrumKitByPatchID = InstrumentMaps.InstrumentFamilyByID = InstrumentMaps.instrumentByPatchID = void 0;
    InstrumentMaps.instrumentByPatchID = [
      "acoustic grand piano",
      "bright acoustic piano",
      "electric grand piano",
      "honky-tonk piano",
      "electric piano 1",
      "electric piano 2",
      "harpsichord",
      "clavi",
      "celesta",
      "glockenspiel",
      "music box",
      "vibraphone",
      "marimba",
      "xylophone",
      "tubular bells",
      "dulcimer",
      "drawbar organ",
      "percussive organ",
      "rock organ",
      "church organ",
      "reed organ",
      "accordion",
      "harmonica",
      "tango accordion",
      "acoustic guitar (nylon)",
      "acoustic guitar (steel)",
      "electric guitar (jazz)",
      "electric guitar (clean)",
      "electric guitar (muted)",
      "overdriven guitar",
      "distortion guitar",
      "guitar harmonics",
      "acoustic bass",
      "electric bass (finger)",
      "electric bass (pick)",
      "fretless bass",
      "slap bass 1",
      "slap bass 2",
      "synth bass 1",
      "synth bass 2",
      "violin",
      "viola",
      "cello",
      "contrabass",
      "tremolo strings",
      "pizzicato strings",
      "orchestral harp",
      "timpani",
      "string ensemble 1",
      "string ensemble 2",
      "synthstrings 1",
      "synthstrings 2",
      "choir aahs",
      "voice oohs",
      "synth voice",
      "orchestra hit",
      "trumpet",
      "trombone",
      "tuba",
      "muted trumpet",
      "french horn",
      "brass section",
      "synthbrass 1",
      "synthbrass 2",
      "soprano sax",
      "alto sax",
      "tenor sax",
      "baritone sax",
      "oboe",
      "english horn",
      "bassoon",
      "clarinet",
      "piccolo",
      "flute",
      "recorder",
      "pan flute",
      "blown bottle",
      "shakuhachi",
      "whistle",
      "ocarina",
      "lead 1 (square)",
      "lead 2 (sawtooth)",
      "lead 3 (calliope)",
      "lead 4 (chiff)",
      "lead 5 (charang)",
      "lead 6 (voice)",
      "lead 7 (fifths)",
      "lead 8 (bass + lead)",
      "pad 1 (new age)",
      "pad 2 (warm)",
      "pad 3 (polysynth)",
      "pad 4 (choir)",
      "pad 5 (bowed)",
      "pad 6 (metallic)",
      "pad 7 (halo)",
      "pad 8 (sweep)",
      "fx 1 (rain)",
      "fx 2 (soundtrack)",
      "fx 3 (crystal)",
      "fx 4 (atmosphere)",
      "fx 5 (brightness)",
      "fx 6 (goblins)",
      "fx 7 (echoes)",
      "fx 8 (sci-fi)",
      "sitar",
      "banjo",
      "shamisen",
      "koto",
      "kalimba",
      "bag pipe",
      "fiddle",
      "shanai",
      "tinkle bell",
      "agogo",
      "steel drums",
      "woodblock",
      "taiko drum",
      "melodic tom",
      "synth drum",
      "reverse cymbal",
      "guitar fret noise",
      "breath noise",
      "seashore",
      "bird tweet",
      "telephone ring",
      "helicopter",
      "applause",
      "gunshot"
    ];
    InstrumentMaps.InstrumentFamilyByID = [
      "piano",
      "chromatic percussion",
      "organ",
      "guitar",
      "bass",
      "strings",
      "ensemble",
      "brass",
      "reed",
      "pipe",
      "synth lead",
      "synth pad",
      "synth effects",
      "world",
      "percussive",
      "sound effects"
    ];
    InstrumentMaps.DrumKitByPatchID = {
      0: "standard kit",
      8: "room kit",
      16: "power kit",
      24: "electronic kit",
      25: "tr-808 kit",
      32: "jazz kit",
      40: "brush kit",
      48: "orchestra kit",
      56: "sound fx kit"
    };
    return InstrumentMaps;
  }
  var hasRequiredInstrument;
  function requireInstrument() {
    if (hasRequiredInstrument) return Instrument;
    hasRequiredInstrument = 1;
    Object.defineProperty(Instrument, "__esModule", { value: true });
    Instrument.Instrument = void 0;
    var InstrumentMaps_1 = requireInstrumentMaps();
    var privateTrackMap = new WeakMap();
    var Instrument$1 = (
(function() {
        function Instrument2(trackData, track) {
          this.number = 0;
          privateTrackMap.set(this, track);
          this.number = 0;
          if (trackData) {
            var programChange = trackData.find(function(e2) {
              return e2.type === "programChange";
            });
            if (programChange) {
              this.number = programChange.programNumber;
            }
          }
        }
        Object.defineProperty(Instrument2.prototype, "name", {
get: function() {
            if (this.percussion) {
              return InstrumentMaps_1.DrumKitByPatchID[this.number];
            } else {
              return InstrumentMaps_1.instrumentByPatchID[this.number];
            }
          },
          set: function(n2) {
            var patchNumber = InstrumentMaps_1.instrumentByPatchID.indexOf(n2);
            if (patchNumber !== -1) {
              this.number = patchNumber;
            }
          },
          enumerable: false,
          configurable: true
        });
        Object.defineProperty(Instrument2.prototype, "family", {
get: function() {
            if (this.percussion) {
              return "drums";
            } else {
              return InstrumentMaps_1.InstrumentFamilyByID[Math.floor(this.number / 8)];
            }
          },
          enumerable: false,
          configurable: true
        });
        Object.defineProperty(Instrument2.prototype, "percussion", {
get: function() {
            var track = privateTrackMap.get(this);
            return track.channel === 9;
          },
          enumerable: false,
          configurable: true
        });
        Instrument2.prototype.toJSON = function() {
          return {
            family: this.family,
            number: this.number,
            name: this.name
          };
        };
        Instrument2.prototype.fromJSON = function(json) {
          this.number = json.number;
        };
        return Instrument2;
      })()
    );
    Instrument.Instrument = Instrument$1;
    return Instrument;
  }
  var Note = {};
  var hasRequiredNote;
  function requireNote() {
    if (hasRequiredNote) return Note;
    hasRequiredNote = 1;
    Object.defineProperty(Note, "__esModule", { value: true });
    Note.Note = void 0;
    function midiToPitch(midi) {
      var octave = Math.floor(midi / 12) - 1;
      return midiToPitchClass(midi) + octave.toString();
    }
    function midiToPitchClass(midi) {
      var scaleIndexToNote = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
      var note = midi % 12;
      return scaleIndexToNote[note];
    }
    function pitchClassToMidi(pitch) {
      var scaleIndexToNote = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
      return scaleIndexToNote.indexOf(pitch);
    }
    var pitchToMidi = (function() {
      var regexp = /^([a-g]{1}(?:b|#|x|bb)?)(-?[0-9]+)/i;
      var noteToScaleIndex = {
cbb: -2,
        cb: -1,
        c: 0,
        "c#": 1,
        cx: 2,
        dbb: 0,
        db: 1,
        d: 2,
        "d#": 3,
        dx: 4,
        ebb: 2,
        eb: 3,
        e: 4,
        "e#": 5,
        ex: 6,
        fbb: 3,
        fb: 4,
        f: 5,
        "f#": 6,
        fx: 7,
        gbb: 5,
        gb: 6,
        g: 7,
        "g#": 8,
        gx: 9,
        abb: 7,
        ab: 8,
        a: 9,
        "a#": 10,
        ax: 11,
        bbb: 9,
        bb: 10,
        b: 11,
        "b#": 12,
        bx: 13
      };
      return function(note) {
        var split = regexp.exec(note);
        var pitch = split[1];
        var octave = split[2];
        var index = noteToScaleIndex[pitch.toLowerCase()];
        return index + (parseInt(octave, 10) + 1) * 12;
      };
    })();
    var privateHeaderMap = new WeakMap();
    var Note$1 = (
(function() {
        function Note2(noteOn, noteOff, header) {
          privateHeaderMap.set(this, header);
          this.midi = noteOn.midi;
          this.velocity = noteOn.velocity;
          this.noteOffVelocity = noteOff.velocity;
          this.ticks = noteOn.ticks;
          this.durationTicks = noteOff.ticks - noteOn.ticks;
        }
        Object.defineProperty(Note2.prototype, "name", {
get: function() {
            return midiToPitch(this.midi);
          },
          set: function(n2) {
            this.midi = pitchToMidi(n2);
          },
          enumerable: false,
          configurable: true
        });
        Object.defineProperty(Note2.prototype, "octave", {
get: function() {
            return Math.floor(this.midi / 12) - 1;
          },
          set: function(o2) {
            var diff = o2 - this.octave;
            this.midi += diff * 12;
          },
          enumerable: false,
          configurable: true
        });
        Object.defineProperty(Note2.prototype, "pitch", {
get: function() {
            return midiToPitchClass(this.midi);
          },
          set: function(p2) {
            this.midi = 12 * (this.octave + 1) + pitchClassToMidi(p2);
          },
          enumerable: false,
          configurable: true
        });
        Object.defineProperty(Note2.prototype, "duration", {
get: function() {
            var header = privateHeaderMap.get(this);
            return header.ticksToSeconds(this.ticks + this.durationTicks) - header.ticksToSeconds(this.ticks);
          },
          set: function(d2) {
            var header = privateHeaderMap.get(this);
            var noteEndTicks = header.secondsToTicks(this.time + d2);
            this.durationTicks = noteEndTicks - this.ticks;
          },
          enumerable: false,
          configurable: true
        });
        Object.defineProperty(Note2.prototype, "time", {
get: function() {
            var header = privateHeaderMap.get(this);
            return header.ticksToSeconds(this.ticks);
          },
          set: function(t2) {
            var header = privateHeaderMap.get(this);
            this.ticks = header.secondsToTicks(t2);
          },
          enumerable: false,
          configurable: true
        });
        Object.defineProperty(Note2.prototype, "bars", {
get: function() {
            var header = privateHeaderMap.get(this);
            return header.ticksToMeasures(this.ticks);
          },
          enumerable: false,
          configurable: true
        });
        Note2.prototype.toJSON = function() {
          return {
            duration: this.duration,
            durationTicks: this.durationTicks,
            midi: this.midi,
            name: this.name,
            ticks: this.ticks,
            time: this.time,
            velocity: this.velocity
          };
        };
        return Note2;
      })()
    );
    Note.Note = Note$1;
    return Note;
  }
  var hasRequiredTrack;
  function requireTrack() {
    if (hasRequiredTrack) return Track;
    hasRequiredTrack = 1;
    Object.defineProperty(Track, "__esModule", { value: true });
    Track.Track = void 0;
    var BinarySearch_1 = requireBinarySearch();
    var ControlChange_1 = requireControlChange();
    var ControlChanges_1 = requireControlChanges();
    var PitchBend_1 = requirePitchBend();
    var Instrument_1 = requireInstrument();
    var Note_1 = requireNote();
    var privateHeaderMap = new WeakMap();
    var Track$1 = (
(function() {
        function Track2(trackData, header) {
          var _this = this;
          this.name = "";
          this.notes = [];
          this.controlChanges = (0, ControlChanges_1.createControlChanges)();
          this.pitchBends = [];
          privateHeaderMap.set(this, header);
          if (trackData) {
            var nameEvent = trackData.find(function(e2) {
              return e2.type === "trackName";
            });
            this.name = nameEvent ? nameEvent.text : "";
          }
          this.instrument = new Instrument_1.Instrument(trackData, this);
          this.channel = 0;
          if (trackData) {
            var noteOns = trackData.filter(function(event) {
              return event.type === "noteOn";
            });
            var noteOffs = trackData.filter(function(event) {
              return event.type === "noteOff";
            });
            var _loop_1 = function() {
              var currentNote = noteOns.shift();
              this_1.channel = currentNote.channel;
              var offIndex = noteOffs.findIndex(function(note) {
                return note.noteNumber === currentNote.noteNumber && note.absoluteTime >= currentNote.absoluteTime;
              });
              if (offIndex !== -1) {
                var noteOff = noteOffs.splice(offIndex, 1)[0];
                this_1.addNote({
                  durationTicks: noteOff.absoluteTime - currentNote.absoluteTime,
                  midi: currentNote.noteNumber,
                  noteOffVelocity: noteOff.velocity / 127,
                  ticks: currentNote.absoluteTime,
                  velocity: currentNote.velocity / 127
                });
              }
            };
            var this_1 = this;
            while (noteOns.length) {
              _loop_1();
            }
            var controlChanges = trackData.filter(function(event) {
              return event.type === "controller";
            });
            controlChanges.forEach(function(event) {
              _this.addCC({
                number: event.controllerType,
                ticks: event.absoluteTime,
                value: event.value / 127
              });
            });
            var pitchBends = trackData.filter(function(event) {
              return event.type === "pitchBend";
            });
            pitchBends.forEach(function(event) {
              _this.addPitchBend({
                ticks: event.absoluteTime,
value: event.value / Math.pow(2, 13)
              });
            });
            var endOfTrackEvent = trackData.find(function(event) {
              return event.type === "endOfTrack";
            });
            this.endOfTrackTicks = endOfTrackEvent !== void 0 ? endOfTrackEvent.absoluteTime : void 0;
          }
        }
        Track2.prototype.addNote = function(props) {
          var header = privateHeaderMap.get(this);
          var note = new Note_1.Note({
            midi: 0,
            ticks: 0,
            velocity: 1
          }, {
            ticks: 0,
            velocity: 0
          }, header);
          Object.assign(note, props);
          (0, BinarySearch_1.insert)(this.notes, note, "ticks");
          return this;
        };
        Track2.prototype.addCC = function(props) {
          var header = privateHeaderMap.get(this);
          var cc = new ControlChange_1.ControlChange({
            controllerType: props.number
          }, header);
          delete props.number;
          Object.assign(cc, props);
          if (!Array.isArray(this.controlChanges[cc.number])) {
            this.controlChanges[cc.number] = [];
          }
          (0, BinarySearch_1.insert)(this.controlChanges[cc.number], cc, "ticks");
          return this;
        };
        Track2.prototype.addPitchBend = function(props) {
          var header = privateHeaderMap.get(this);
          var pb = new PitchBend_1.PitchBend({}, header);
          Object.assign(pb, props);
          (0, BinarySearch_1.insert)(this.pitchBends, pb, "ticks");
          return this;
        };
        Object.defineProperty(Track2.prototype, "duration", {
get: function() {
            if (!this.notes.length) {
              return 0;
            }
            var maxDuration = this.notes[this.notes.length - 1].time + this.notes[this.notes.length - 1].duration;
            for (var i2 = 0; i2 < this.notes.length - 1; i2++) {
              var duration = this.notes[i2].time + this.notes[i2].duration;
              if (maxDuration < duration) {
                maxDuration = duration;
              }
            }
            return maxDuration;
          },
          enumerable: false,
          configurable: true
        });
        Object.defineProperty(Track2.prototype, "durationTicks", {
get: function() {
            if (!this.notes.length) {
              return 0;
            }
            var maxDuration = this.notes[this.notes.length - 1].ticks + this.notes[this.notes.length - 1].durationTicks;
            for (var i2 = 0; i2 < this.notes.length - 1; i2++) {
              var duration = this.notes[i2].ticks + this.notes[i2].durationTicks;
              if (maxDuration < duration) {
                maxDuration = duration;
              }
            }
            return maxDuration;
          },
          enumerable: false,
          configurable: true
        });
        Track2.prototype.fromJSON = function(json) {
          var _this = this;
          this.name = json.name;
          this.channel = json.channel;
          this.instrument = new Instrument_1.Instrument(void 0, this);
          this.instrument.fromJSON(json.instrument);
          if (json.endOfTrackTicks !== void 0) {
            this.endOfTrackTicks = json.endOfTrackTicks;
          }
          for (var number in json.controlChanges) {
            if (json.controlChanges[number]) {
              json.controlChanges[number].forEach(function(cc) {
                _this.addCC({
                  number: cc.number,
                  ticks: cc.ticks,
                  value: cc.value
                });
              });
            }
          }
          json.notes.forEach(function(n2) {
            _this.addNote({
              durationTicks: n2.durationTicks,
              midi: n2.midi,
              ticks: n2.ticks,
              velocity: n2.velocity
            });
          });
        };
        Track2.prototype.toJSON = function() {
          var controlChanges = {};
          for (var i2 = 0; i2 < 127; i2++) {
            if (this.controlChanges.hasOwnProperty(i2)) {
              controlChanges[i2] = this.controlChanges[i2].map(function(c2) {
                return c2.toJSON();
              });
            }
          }
          var json = {
            channel: this.channel,
            controlChanges,
            pitchBends: this.pitchBends.map(function(pb) {
              return pb.toJSON();
            }),
            instrument: this.instrument.toJSON(),
            name: this.name,
            notes: this.notes.map(function(n2) {
              return n2.toJSON();
            })
          };
          if (this.endOfTrackTicks !== void 0) {
            json.endOfTrackTicks = this.endOfTrackTicks;
          }
          return json;
        };
        return Track2;
      })()
    );
    Track.Track = Track$1;
    return Track;
  }
  var Encode = {};
  function flatten(array) {
    var result = [];
    $flatten(array, result);
    return result;
  }
  function $flatten(array, result) {
    for (var i2 = 0; i2 < array.length; i2++) {
      var value = array[i2];
      if (Array.isArray(value)) {
        $flatten(value, result);
      } else {
        result.push(value);
      }
    }
  }
  const dist_es2015 = Object.freeze( Object.defineProperty({
    __proto__: null,
    flatten
  }, Symbol.toStringTag, { value: "Module" }));
  const require$$2 = getAugmentedNamespace(dist_es2015);
  var hasRequiredEncode;
  function requireEncode() {
    if (hasRequiredEncode) return Encode;
    hasRequiredEncode = 1;
    var __spreadArray = Encode && Encode.__spreadArray || function(to, from, pack) {
      if (pack || arguments.length === 2) for (var i2 = 0, l2 = from.length, ar; i2 < l2; i2++) {
        if (ar || !(i2 in from)) {
          if (!ar) ar = Array.prototype.slice.call(from, 0, i2);
          ar[i2] = from[i2];
        }
      }
      return to.concat(ar || Array.prototype.slice.call(from));
    };
    Object.defineProperty(Encode, "__esModule", { value: true });
    Encode.encode = void 0;
    var midi_file_1 = requireMidiFile();
    var Header_1 = requireHeader();
    var array_flatten_1 = require$$2;
    function encodeNote(note, channel) {
      return [
        {
          absoluteTime: note.ticks,
          channel,
          deltaTime: 0,
          noteNumber: note.midi,
          type: "noteOn",
          velocity: Math.floor(note.velocity * 127)
        },
        {
          absoluteTime: note.ticks + note.durationTicks,
          channel,
          deltaTime: 0,
          noteNumber: note.midi,
          type: "noteOff",
          velocity: Math.floor(note.noteOffVelocity * 127)
        }
      ];
    }
    function encodeNotes(track) {
      return (0, array_flatten_1.flatten)(track.notes.map(function(note) {
        return encodeNote(note, track.channel);
      }));
    }
    function encodeControlChange(cc, channel) {
      return {
        absoluteTime: cc.ticks,
        channel,
        controllerType: cc.number,
        deltaTime: 0,
        type: "controller",
        value: Math.floor(cc.value * 127)
      };
    }
    function encodeControlChanges(track) {
      var controlChanges = [];
      for (var i2 = 0; i2 < 127; i2++) {
        if (track.controlChanges.hasOwnProperty(i2)) {
          track.controlChanges[i2].forEach(function(cc) {
            controlChanges.push(encodeControlChange(cc, track.channel));
          });
        }
      }
      return controlChanges;
    }
    function encodePitchBend(pb, channel) {
      return {
        absoluteTime: pb.ticks,
        channel,
        deltaTime: 0,
        type: "pitchBend",
        value: pb.value
      };
    }
    function encodePitchBends(track) {
      var pitchBends = [];
      track.pitchBends.forEach(function(pb) {
        pitchBends.push(encodePitchBend(pb, track.channel));
      });
      return pitchBends;
    }
    function encodeInstrument(track) {
      return {
        absoluteTime: 0,
        channel: track.channel,
        deltaTime: 0,
        programNumber: track.instrument.number,
        type: "programChange"
      };
    }
    function encodeTrackName(name) {
      return {
        absoluteTime: 0,
        deltaTime: 0,
        meta: true,
        text: name,
        type: "trackName"
      };
    }
    function encodeTempo(tempo) {
      return {
        absoluteTime: tempo.ticks,
        deltaTime: 0,
        meta: true,
        microsecondsPerBeat: Math.floor(6e7 / tempo.bpm),
        type: "setTempo"
      };
    }
    function encodeTimeSignature(timeSig) {
      return {
        absoluteTime: timeSig.ticks,
        deltaTime: 0,
        denominator: timeSig.timeSignature[1],
        meta: true,
        metronome: 24,
        numerator: timeSig.timeSignature[0],
        thirtyseconds: 8,
        type: "timeSignature"
      };
    }
    function encodeKeySignature(keySig) {
      var keyIndex = Header_1.keySignatureKeys.indexOf(keySig.key);
      return {
        absoluteTime: keySig.ticks,
        deltaTime: 0,
        key: keyIndex + 7,
        meta: true,
        scale: keySig.scale === "major" ? 0 : 1,
        type: "keySignature"
      };
    }
    function encodeText(textEvent) {
      return {
        absoluteTime: textEvent.ticks,
        deltaTime: 0,
        meta: true,
        text: textEvent.text,
        type: textEvent.type
      };
    }
    function encode(midi) {
      var midiData = {
        header: {
          format: 1,
          numTracks: midi.tracks.length + 1,
          ticksPerBeat: midi.header.ppq
        },
        tracks: __spreadArray([
          __spreadArray(__spreadArray(__spreadArray(__spreadArray([
{
              absoluteTime: 0,
              deltaTime: 0,
              meta: true,
              text: midi.header.name,
              type: "trackName"
            }
          ], midi.header.keySignatures.map(function(keySig) {
            return encodeKeySignature(keySig);
          }), true), midi.header.meta.map(function(e2) {
            return encodeText(e2);
          }), true), midi.header.tempos.map(function(tempo) {
            return encodeTempo(tempo);
          }), true), midi.header.timeSignatures.map(function(timeSig) {
            return encodeTimeSignature(timeSig);
          }), true)
        ], midi.tracks.map(function(track) {
          return __spreadArray(__spreadArray(__spreadArray([
encodeTrackName(track.name),
encodeInstrument(track)
          ], encodeNotes(track), true), encodeControlChanges(track), true), encodePitchBends(track), true);
        }), true)
      };
      midiData.tracks = midiData.tracks.map(function(track) {
        track = track.sort(function(a2, b2) {
          return a2.absoluteTime - b2.absoluteTime;
        });
        var lastTime = 0;
        track.forEach(function(note) {
          note.deltaTime = note.absoluteTime - lastTime;
          lastTime = note.absoluteTime;
          delete note.absoluteTime;
        });
        track.push({
          deltaTime: 0,
          meta: true,
          type: "endOfTrack"
        });
        return track;
      });
      return new Uint8Array((0, midi_file_1.writeMidi)(midiData));
    }
    Encode.encode = encode;
    return Encode;
  }
  var hasRequiredMidi;
  function requireMidi() {
    if (hasRequiredMidi) return Midi;
    hasRequiredMidi = 1;
    (function(exports$1) {
      var __awaiter = Midi && Midi.__awaiter || function(thisArg, _arguments, P2, generator) {
        function adopt(value) {
          return value instanceof P2 ? value : new P2(function(resolve) {
            resolve(value);
          });
        }
        return new (P2 || (P2 = Promise))(function(resolve, reject) {
          function fulfilled(value) {
            try {
              step(generator.next(value));
            } catch (e2) {
              reject(e2);
            }
          }
          function rejected(value) {
            try {
              step(generator["throw"](value));
            } catch (e2) {
              reject(e2);
            }
          }
          function step(result) {
            result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
          }
          step((generator = generator.apply(thisArg, _arguments || [])).next());
        });
      };
      var __generator = Midi && Midi.__generator || function(thisArg, body) {
        var _2 = { label: 0, sent: function() {
          if (t2[0] & 1) throw t2[1];
          return t2[1];
        }, trys: [], ops: [] }, f2, y2, t2, g2;
        return g2 = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g2[Symbol.iterator] = function() {
          return this;
        }), g2;
        function verb(n2) {
          return function(v2) {
            return step([n2, v2]);
          };
        }
        function step(op) {
          if (f2) throw new TypeError("Generator is already executing.");
          while (_2) try {
            if (f2 = 1, y2 && (t2 = op[0] & 2 ? y2["return"] : op[0] ? y2["throw"] || ((t2 = y2["return"]) && t2.call(y2), 0) : y2.next) && !(t2 = t2.call(y2, op[1])).done) return t2;
            if (y2 = 0, t2) op = [op[0] & 2, t2.value];
            switch (op[0]) {
              case 0:
              case 1:
                t2 = op;
                break;
              case 4:
                _2.label++;
                return { value: op[1], done: false };
              case 5:
                _2.label++;
                y2 = op[1];
                op = [0];
                continue;
              case 7:
                op = _2.ops.pop();
                _2.trys.pop();
                continue;
              default:
                if (!(t2 = _2.trys, t2 = t2.length > 0 && t2[t2.length - 1]) && (op[0] === 6 || op[0] === 2)) {
                  _2 = 0;
                  continue;
                }
                if (op[0] === 3 && (!t2 || op[1] > t2[0] && op[1] < t2[3])) {
                  _2.label = op[1];
                  break;
                }
                if (op[0] === 6 && _2.label < t2[1]) {
                  _2.label = t2[1];
                  t2 = op;
                  break;
                }
                if (t2 && _2.label < t2[2]) {
                  _2.label = t2[2];
                  _2.ops.push(op);
                  break;
                }
                if (t2[2]) _2.ops.pop();
                _2.trys.pop();
                continue;
            }
            op = body.call(thisArg, _2);
          } catch (e2) {
            op = [6, e2];
            y2 = 0;
          } finally {
            f2 = t2 = 0;
          }
          if (op[0] & 5) throw op[1];
          return { value: op[0] ? op[1] : void 0, done: true };
        }
      };
      Object.defineProperty(exports$1, "__esModule", { value: true });
      exports$1.Header = exports$1.Track = exports$1.Midi = void 0;
      var midi_file_1 = requireMidiFile();
      var Header_1 = requireHeader();
      var Track_1 = requireTrack();
      var Encode_1 = requireEncode();
      var Midi$1 = (
(function() {
          function Midi2(midiArray) {
            var _this = this;
            var midiData = null;
            if (midiArray) {
              var midiArrayLike = midiArray instanceof ArrayBuffer ? new Uint8Array(midiArray) : midiArray;
              midiData = (0, midi_file_1.parseMidi)(midiArrayLike);
              midiData.tracks.forEach(function(track) {
                var currentTicks = 0;
                track.forEach(function(event) {
                  currentTicks += event.deltaTime;
                  event.absoluteTime = currentTicks;
                });
              });
              midiData.tracks = splitTracks(midiData.tracks);
            }
            this.header = new Header_1.Header(midiData);
            this.tracks = [];
            if (midiArray) {
              this.tracks = midiData.tracks.map(function(trackData) {
                return new Track_1.Track(trackData, _this.header);
              });
              if (midiData.header.format === 1 && this.tracks[0].duration === 0) {
                this.tracks.shift();
              }
            }
          }
          Midi2.fromUrl = function(url) {
            return __awaiter(this, void 0, void 0, function() {
              var response, arrayBuffer;
              return __generator(this, function(_a) {
                switch (_a.label) {
                  case 0:
                    return [4, fetch(url)];
                  case 1:
                    response = _a.sent();
                    if (!response.ok) return [3, 3];
                    return [4, response.arrayBuffer()];
                  case 2:
                    arrayBuffer = _a.sent();
                    return [2, new Midi2(arrayBuffer)];
                  case 3:
                    throw new Error("Could not load '".concat(url, "'"));
                }
              });
            });
          };
          Object.defineProperty(Midi2.prototype, "name", {
get: function() {
              return this.header.name;
            },
            set: function(n2) {
              this.header.name = n2;
            },
            enumerable: false,
            configurable: true
          });
          Object.defineProperty(Midi2.prototype, "duration", {
get: function() {
              var durations = this.tracks.map(function(t2) {
                return t2.duration;
              });
              return Math.max.apply(Math, durations);
            },
            enumerable: false,
            configurable: true
          });
          Object.defineProperty(Midi2.prototype, "durationTicks", {
get: function() {
              var durationTicks = this.tracks.map(function(t2) {
                return t2.durationTicks;
              });
              return Math.max.apply(Math, durationTicks);
            },
            enumerable: false,
            configurable: true
          });
          Midi2.prototype.addTrack = function() {
            var track = new Track_1.Track(void 0, this.header);
            this.tracks.push(track);
            return track;
          };
          Midi2.prototype.toArray = function() {
            return (0, Encode_1.encode)(this);
          };
          Midi2.prototype.toJSON = function() {
            return {
              header: this.header.toJSON(),
              tracks: this.tracks.map(function(track) {
                return track.toJSON();
              })
            };
          };
          Midi2.prototype.fromJSON = function(json) {
            var _this = this;
            this.header = new Header_1.Header();
            this.header.fromJSON(json.header);
            this.tracks = json.tracks.map(function(trackJSON) {
              var track = new Track_1.Track(void 0, _this.header);
              track.fromJSON(trackJSON);
              return track;
            });
          };
          Midi2.prototype.clone = function() {
            var midi = new Midi2();
            midi.fromJSON(this.toJSON());
            return midi;
          };
          return Midi2;
        })()
      );
      exports$1.Midi = Midi$1;
      var Track_2 = requireTrack();
      Object.defineProperty(exports$1, "Track", { enumerable: true, get: function() {
        return Track_2.Track;
      } });
      var Header_2 = requireHeader();
      Object.defineProperty(exports$1, "Header", { enumerable: true, get: function() {
        return Header_2.Header;
      } });
      function splitTracks(tracks) {
        var newTracks = [];
        for (var i2 = 0; i2 < tracks.length; i2++) {
          var defaultTrack = newTracks.length;
          var trackMap = new Map();
          var currentProgram = Array(16).fill(0);
          for (var _i = 0, _a = tracks[i2]; _i < _a.length; _i++) {
            var event_1 = _a[_i];
            var targetTrack = defaultTrack;
            var channel = event_1.channel;
            if (channel !== void 0) {
              if (event_1.type === "programChange") {
                currentProgram[channel] = event_1.programNumber;
              }
              var program = currentProgram[channel];
              var trackKey = "".concat(program, " ").concat(channel);
              if (trackMap.has(trackKey)) {
                targetTrack = trackMap.get(trackKey);
              } else {
                targetTrack = defaultTrack + trackMap.size;
                trackMap.set(trackKey, targetTrack);
              }
            }
            if (!newTracks[targetTrack]) {
              newTracks.push([]);
            }
            newTracks[targetTrack].push(event_1);
          }
        }
        return newTracks;
      }
    })(Midi);
    return Midi;
  }
  var MidiExports = requireMidi();
  var midiFileExports = requireMidiFile();
  const epsilon = 1e-6;
  const parseTonejsMidi = try_({
    try: (data) => new MidiExports.Midi(data),
    catch: (e2) => ({ type: "parseError", message: String(e2) })
  });
  const parseMidiFile = try_({
    try: (data) => midiFileExports.parseMidi(data),
    catch: (e2) => ({ type: "parseError", message: String(e2) })
  });
  const fixMidiFileTextEncoding = try_({
    try: (data) => {
      return new TextDecoder().decode(
        new Uint8Array(data.split("").map((c2) => c2.charCodeAt(0)))
      );
    },
    catch: (e2) => ({ type: "invalidTextEncoding", message: String(e2) })
  });
  function midiToLyrics(data) {
    const tonejsMidiResult = parseTonejsMidi(data);
    if (isFailure(tonejsMidiResult)) {
      return fail(tonejsMidiResult.error);
    }
    const tonejsMidi = tonejsMidiResult.value;
    const midiFileResult = parseMidiFile(data);
    if (isFailure(midiFileResult)) {
      return fail(midiFileResult.error);
    }
    const midiEvents = midiFileResult.value;
    const textEvents = [];
    const invalidEncodingPositions = [];
    for (const track of midiEvents.tracks) {
      let currentTick = 0;
      for (const event of track) {
        currentTick += event.deltaTime;
        if (event.type === "text") {
          const decodeResult = fixMidiFileTextEncoding(event.text);
          if (isFailure(decodeResult)) {
            invalidEncodingPositions.push(currentTick);
          } else {
            textEvents.push({ tick: currentTick, text: decodeResult.value });
          }
        }
      }
    }
    if (invalidEncodingPositions.length > 0) {
      return fail({
        type: "invalidTextEncoding",
        positions: invalidEncodingPositions.map(
          (tick) => ticksToPosition(tonejsMidi.header, tick)
        )
      });
    }
    const notes = tonejsMidi.tracks.flatMap((track) => track.notes);
    notes.sort((a2, b2) => a2.ticks - b2.ticks);
    const results = [];
    const overlapTicks = new Set();
    for (let i2 = 0; i2 < notes.length - 1; i2++) {
      if (notes[i2].ticks + notes[i2].durationTicks > notes[i2 + 1].ticks) {
        overlapTicks.add(notes[i2 + 1].ticks);
      }
    }
    if (overlapTicks.size > 0) {
      return fail({
        type: "overlappingNotes",
        positions: Array.from(overlapTicks).map(
          (tick) => ticksToPosition(tonejsMidi.header, tick)
        )
      });
    }
    const noNoteTicks = [];
    const noteTicks = new Set(notes.map((n2) => n2.ticks));
    for (const textEvent of textEvents) {
      const note = notes.find((n2) => n2.ticks === textEvent.tick);
      if (note) {
        results.push({ time: note.time, text: textEvent.text, midi: note.midi });
        results.push({
          time: note.time + note.duration,
          text: "",
          midi: note.midi
        });
        noteTicks.delete(textEvent.tick);
      } else {
        noNoteTicks.push(textEvent.tick);
      }
    }
    if (noNoteTicks.length > 0) {
      return fail({
        type: "noNote",
        positions: noNoteTicks.map(
          (tick) => ticksToPosition(tonejsMidi.header, tick)
        )
      });
    }
    if (noteTicks.size > textEvents.length) {
      return fail({
        type: "excessiveTextEvents",
        positions: Array.from(noteTicks).map(
          (tick) => ticksToPosition(tonejsMidi.header, tick)
        )
      });
    }
    results.sort((a2, b2) => {
      if (a2.time !== b2.time) {
        return a2.time - b2.time;
      }
      return a2.text.length - b2.text.length;
    });
    for (let i2 = results.length - 2; i2 >= 0; i2--) {
      if (results[i2].text !== "") {
        continue;
      }
      if (results[i2].time !== results[i2 + 1].time) {
        continue;
      }
      if (results[i2].midi === results[i2 + 1].midi) {
        results.splice(i2, 1);
      }
    }
    for (let i2 = 0; i2 < results.length - 1; i2++) {
      if (results[i2].time < results[i2 + 1].time) {
        continue;
      }
      results[i2 + 1].time = results[i2].time + epsilon;
    }
    results.splice(results.length - 1, 1);
    return succeed(
      results.map((r2) => ({
        time: r2.time,
        text: r2.text
      }))
    );
  }
  function ticksToPosition(header, ticks) {
    if (ticks < 0) {
      throw new Error("Ticks cannot be negative");
    }
    let measure = 0;
    const timeSignatures = header.timeSignatures;
    for (let i2 = 0; i2 < timeSignatures.length; i2++) {
      const ts = {
        ticks: timeSignatures[i2].ticks,
        numerator: timeSignatures[i2].timeSignature[0],
        denominator: timeSignatures[i2].timeSignature[1]
      };
      const nextTs = timeSignatures[i2 + 1];
      const ticksPerMeasure = header.ppq * 4 * ts.numerator / ts.denominator;
      for (let currentTick = ts.ticks; currentTick < (nextTs ? nextTs.ticks : Infinity); currentTick += ticksPerMeasure) {
        if (ticks < currentTick + ticksPerMeasure) {
          const remainingTicks = ticks - currentTick;
          const beat = Math.floor(remainingTicks / header.ppq % ts.numerator) + 1;
          const tick = remainingTicks % header.ppq;
          return { measure, beat, tick };
        }
        measure++;
      }
    }
    throw new Error("Could not convert ticks to position");
  }
  const logger = createLogger("index");
  const { div, h5, p, button, a: anchor, span } = vanjs.tags;
  function addLyricsForm() {
    const lyricsRoot = maybeGetElementBySelector(
      `#lyrics_line_sync:not([data-${namespace}-injected="true"])`
    );
    if (!lyricsRoot) {
      return;
    }
    logger.info("Injecting MIDI lyrics form");
    const caution = getElementBySelector(`.caution`, lyricsRoot);
    const form = div(
      { class: "tcml-container" },
      h5(
        { class: "tcml-title", style: "font-size: 110%;margin-bottom: 5px" },
        "MIDIから読み込む",
        span(
          { style: "font-size: 80%; margin-left: 1rem; color: #8e8e8e" },
          anchor(
            {
              target: "_blank",
              href: "https://github.com/sevenc-nanashi/tunecore-midi-lyrics"
            },
            "Tunecore MIDI Lyrics"
          ),
          " by ",
          anchor(
            {
              target: "_blank",
              href: "https://www.tunecore.co.jp/artists/sevenc-nanashi",
              style: "color: #48b0d5"
            },
            "Nanashi."
          )
        )
      ),
      p(
        { style: "margin-bottom: 5px; font-size: 80%" },
        "MIDIの歌詞情報から読み込みます。"
      ),
      div(
        {
          style: "display: flex; align-items: center"
        },
        button(
          { class: "btn btn-default", type: "button", onclick: loadMidiFile },
          "MIDIを開く"
        ),
        anchor(
          {
            target: "_blank",
            href: "https://github.com/sevenc-nanashi/tunecore-midi-lyrics#midi-spec",
            style: "margin-left: 10px; font-size: 80%"
          },
          "MIDIファイルの仕様について"
        )
      )
    );
    const parentElement = caution.parentElement;
    if (!parentElement) {
      throw new Error("Caution element has no parent");
    }
    parentElement.insertBefore(form, caution.nextElementSibling);
    lyricsRoot.dataset[namespace + "Injected"] = "true";
  }
  async function loadMidiFile() {
    logger.info("Loading MIDI file");
    const midiData = await openMidiFile();
    if (!midiData) {
      logger.warn("No MIDI file selected");
      return;
    }
    logger.info("MIDI file loaded", midiData);
    const lyricsResult = midiToLyrics(midiData);
    if (isFailure(lyricsResult)) {
      logger.error("Failed to parse MIDI file", lyricsResult.error);
      alert(
        `MIDIを読み込めませんでした。
${M(lyricsResult.error).with(
        { type: "parseError", message: z.string },
        ({ message }) => `MIDIファイルを解析できませんでした：${message}`
      ).with(
        { type: "invalidTextEncoding", positions: z.array() },
        ({ positions }) => `MIDIの歌詞を正しくデコードできませんでした。
位置：${positions.map((p2) => `${p2.measure}.${p2.beat}.${p2.tick}`).join("、")}`
      ).with(
        { type: "noNote", positions: z.array() },
        ({ positions }) => `MIDIの歌詞に対応するノートが見つかりませんでした。
位置：${positions.map((p2) => `${p2.measure}.${p2.beat}.${p2.tick}`).join("、")}`
      ).with(
        { type: "excessiveTextEvents", positions: z.array() },
        ({ positions }) => `MIDIの歌詞に対応していないノートが存在します。
位置：${positions.map((p2) => `${p2.measure}.${p2.beat}.${p2.tick}`).join("、")}`
      ).with(
        { type: "overlappingNotes", positions: z.array() },
        ({ positions }) => `ノートが重なっています。
位置：${positions.map((p2) => `${p2.measure}.${p2.beat}.${p2.tick}`).join("、")}`
      ).exhaustive()}`
      );
      return;
    }
    const lyrics = lyricsResult.value;
    const maxLyrics = 1500;
    if (lyrics.length > maxLyrics) {
      const confirmResult = confirm(
        `MIDIの歌詞数が多すぎます（${lyrics.length}個）。先頭の${maxLyrics}個のみを読み込みます。続行しますか？`
      );
      if (!confirmResult) {
        logger.info("User cancelled loading due to excessive lyrics");
        return;
      }
      lyrics.splice(maxLyrics);
    } else {
      logger.info(`Parsed ${lyrics.length} lyric events from MIDI`);
    }
    logger.info("Clearing existing lyrics");
    const lyricsRows = getElementsBySelector(".lyrics_row");
    for (const row of lyricsRows) {
      const removeButton = getElementBySelector(
        ".remove_row_button",
        row
      );
      const startTime = getElementBySelector(
        ".start-time",
        row
      );
      if (startTime.textContent.trim() !== "") {
        removeButton.click();
      }
    }
    const lyricsText = getElementBySelector(
      "textarea.lyrics-text"
    );
    const lines = lyricsResult.value.map((event2) => event2.text);
    lyricsText.value = lines.join("\n");
    const event = new Event("input", { bubbles: true });
    lyricsText.dispatchEvent(event);
    logger.info("Lyrics loaded into textarea");
    const internalAudio = getElementBySelector(
      ".operation-button-wrapper audio"
    );
    const setButton = getElementBySelector(
      ".audio_control_container .set-button"
    );
    setButton.removeAttribute("disabled");
    for (const [i2, event2] of lyrics.entries()) {
      internalAudio.currentTime = event2.time;
      const timestampButton = getElementBySelector(
        `.lyrics_row[data-row_num="${i2 + 1}"]`
      );
      timestampButton.click();
      setButton.click();
    }
    setButton.setAttribute("disabled", "true");
  }
  async function openMidiFile() {
    return new Promise((resolve) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".mid,.midi";
      input.style.display = "none";
      input.addEventListener("change", () => {
        const file = input.files?.[0];
        if (!file) {
          resolve(null);
          return;
        }
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result;
          if (result instanceof ArrayBuffer) {
            resolve(new Uint8Array(result));
          } else {
            resolve(null);
          }
        };
        reader.readAsArrayBuffer(file);
      });
      document.body.appendChild(input);
      input.click();
      document.body.removeChild(input);
    });
  }
  async function main() {
    logger.info("Script started");
    setInterval(() => {
      addLyricsForm();
    }, 1e3);
  }
  void main();

})();