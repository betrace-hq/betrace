define(["@grafana/data","react","@grafana/ui"], (__WEBPACK_EXTERNAL_MODULE__781__, __WEBPACK_EXTERNAL_MODULE__959__, __WEBPACK_EXTERNAL_MODULE__7__) => { return /******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ 7:
/***/ ((module) => {

module.exports = __WEBPACK_EXTERNAL_MODULE__7__;

/***/ }),

/***/ 20:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

var __webpack_unused_export__;
/**
 * @license React
 * react-jsx-runtime.production.min.js
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var f=__webpack_require__(959),k=Symbol.for("react.element"),l=Symbol.for("react.fragment"),m=Object.prototype.hasOwnProperty,n=f.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentOwner,p={key:!0,ref:!0,__self:!0,__source:!0};
function q(c,a,g){var b,d={},e=null,h=null;void 0!==g&&(e=""+g);void 0!==a.key&&(e=""+a.key);void 0!==a.ref&&(h=a.ref);for(b in a)m.call(a,b)&&!p.hasOwnProperty(b)&&(d[b]=a[b]);if(c&&c.defaultProps)for(b in a=c.defaultProps,a)void 0===d[b]&&(d[b]=a[b]);return{$$typeof:k,type:c,key:e,ref:h,props:d,_owner:n.current}}__webpack_unused_export__=l;exports.jsx=q;exports.jsxs=q;


/***/ }),

/***/ 781:
/***/ ((module) => {

module.exports = __WEBPACK_EXTERNAL_MODULE__781__;

/***/ }),

/***/ 848:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {



if (true) {
  module.exports = __webpack_require__(20);
} else // removed by dead control flow
{}


/***/ }),

/***/ 959:
/***/ ((module) => {

module.exports = __WEBPACK_EXTERNAL_MODULE__959__;

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			for(var key in definition) {
/******/ 				if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = (exports) => {
/******/ 			if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// ESM COMPAT FLAG
__webpack_require__.r(__webpack_exports__);

// EXPORTS
__webpack_require__.d(__webpack_exports__, {
  plugin: () => (/* binding */ module_plugin)
});

// EXTERNAL MODULE: external "@grafana/data"
var data_ = __webpack_require__(781);
// EXTERNAL MODULE: ./node_modules/react/jsx-runtime.js
var jsx_runtime = __webpack_require__(848);
// EXTERNAL MODULE: external "react"
var external_react_ = __webpack_require__(959);
// EXTERNAL MODULE: external "@grafana/ui"
var ui_ = __webpack_require__(7);
;// ./src/components/RuleList.tsx
function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) {
    try {
        var info = gen[key](arg);
        var value = info.value;
    } catch (error) {
        reject(error);
        return;
    }
    if (info.done) {
        resolve(value);
    } else {
        Promise.resolve(value).then(_next, _throw);
    }
}
function _async_to_generator(fn) {
    return function() {
        var self = this, args = arguments;
        return new Promise(function(resolve, reject) {
            var gen = fn.apply(self, args);
            function _next(value) {
                asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value);
            }
            function _throw(err) {
                asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err);
            }
            _next(undefined);
        });
    };
}
function _define_property(obj, key, value) {
    if (key in obj) {
        Object.defineProperty(obj, key, {
            value: value,
            enumerable: true,
            configurable: true,
            writable: true
        });
    } else {
        obj[key] = value;
    }
    return obj;
}
function _object_spread(target) {
    for(var i = 1; i < arguments.length; i++){
        var source = arguments[i] != null ? arguments[i] : {};
        var ownKeys = Object.keys(source);
        if (typeof Object.getOwnPropertySymbols === "function") {
            ownKeys = ownKeys.concat(Object.getOwnPropertySymbols(source).filter(function(sym) {
                return Object.getOwnPropertyDescriptor(source, sym).enumerable;
            }));
        }
        ownKeys.forEach(function(key) {
            _define_property(target, key, source[key]);
        });
    }
    return target;
}
function ownKeys(object, enumerableOnly) {
    var keys = Object.keys(object);
    if (Object.getOwnPropertySymbols) {
        var symbols = Object.getOwnPropertySymbols(object);
        if (enumerableOnly) {
            symbols = symbols.filter(function(sym) {
                return Object.getOwnPropertyDescriptor(object, sym).enumerable;
            });
        }
        keys.push.apply(keys, symbols);
    }
    return keys;
}
function _object_spread_props(target, source) {
    source = source != null ? source : {};
    if (Object.getOwnPropertyDescriptors) {
        Object.defineProperties(target, Object.getOwnPropertyDescriptors(source));
    } else {
        ownKeys(Object(source)).forEach(function(key) {
            Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key));
        });
    }
    return target;
}



/**
 * RuleList - Display all BeTrace rules with CRUD operations
 *
 * Features:
 * - Fetch rules from backend API
 * - Display in interactive table
 * - Create/Edit/Delete actions
 * - Enable/disable toggle
 */ const RuleList = ({ onCreateRule, onEditRule, backendUrl = 'http://localhost:12011' })=>{
    const [rules, setRules] = (0,external_react_.useState)([]);
    const [loading, setLoading] = (0,external_react_.useState)(true);
    const [error, setError] = (0,external_react_.useState)(null);
    // Fetch rules from backend
    const fetchRules = ()=>_async_to_generator(function*() {
            setLoading(true);
            setError(null);
            try {
                const response = yield fetch(`${backendUrl}/api/rules`);
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                const data = yield response.json();
                setRules(data);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to fetch rules');
            } finally{
                setLoading(false);
            }
        })();
    // Delete rule
    const deleteRule = (id)=>_async_to_generator(function*() {
            if (!confirm('Are you sure you want to delete this rule?')) {
                return;
            }
            try {
                const response = yield fetch(`${backendUrl}/api/rules/${id}`, {
                    method: 'DELETE'
                });
                if (!response.ok) {
                    throw new Error(`Failed to delete rule: ${response.statusText}`);
                }
                // Refresh list
                yield fetchRules();
            } catch (err) {
                alert(err instanceof Error ? err.message : 'Failed to delete rule');
            }
        })();
    // Toggle rule enabled status
    const toggleRule = (rule)=>_async_to_generator(function*() {
            try {
                const response = yield fetch(`${backendUrl}/api/rules/${rule.id}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(_object_spread_props(_object_spread({}, rule), {
                        enabled: !rule.enabled
                    }))
                });
                if (!response.ok) {
                    throw new Error(`Failed to update rule: ${response.statusText}`);
                }
                // Refresh list
                yield fetchRules();
            } catch (err) {
                alert(err instanceof Error ? err.message : 'Failed to toggle rule');
            }
        })();
    (0,external_react_.useEffect)(()=>{
        fetchRules();
    }, [
        backendUrl
    ]);
    // Table columns
    const columns = [
        {
            id: 'status',
            header: 'Status',
            cell: ({ row })=>/*#__PURE__*/ (0,jsx_runtime.jsx)(ui_.Badge, {
                    text: row.original.enabled ? 'Enabled' : 'Disabled',
                    color: row.original.enabled ? 'green' : 'orange'
                })
        },
        {
            id: 'name',
            header: 'Rule Name',
            cell: ({ row })=>/*#__PURE__*/ (0,jsx_runtime.jsx)("strong", {
                    children: row.original.name
                })
        },
        {
            id: 'description',
            header: 'Description',
            cell: ({ row })=>row.original.description || /*#__PURE__*/ (0,jsx_runtime.jsx)("em", {
                    children: "No description"
                })
        },
        {
            id: 'pattern',
            header: 'Pattern',
            cell: ({ row })=>/*#__PURE__*/ (0,jsx_runtime.jsx)("code", {
                    style: {
                        fontSize: '12px',
                        maxWidth: '300px',
                        display: 'block',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                    },
                    children: row.original.pattern
                })
        },
        {
            id: 'actions',
            header: 'Actions',
            cell: ({ row })=>/*#__PURE__*/ (0,jsx_runtime.jsxs)(ui_.HorizontalGroup, {
                    spacing: "xs",
                    children: [
                        /*#__PURE__*/ (0,jsx_runtime.jsx)(ui_.Button, {
                            size: "sm",
                            variant: "secondary",
                            icon: "edit",
                            onClick: ()=>onEditRule(row.original),
                            tooltip: "Edit rule"
                        }),
                        /*#__PURE__*/ (0,jsx_runtime.jsx)(ui_.Button, {
                            size: "sm",
                            variant: row.original.enabled ? 'secondary' : 'primary',
                            icon: row.original.enabled ? 'eye-slash' : 'eye',
                            onClick: ()=>toggleRule(row.original),
                            tooltip: row.original.enabled ? 'Disable rule' : 'Enable rule'
                        }),
                        /*#__PURE__*/ (0,jsx_runtime.jsx)(ui_.Button, {
                            size: "sm",
                            variant: "destructive",
                            icon: "trash-alt",
                            onClick: ()=>deleteRule(row.original.id),
                            tooltip: "Delete rule"
                        })
                    ]
                })
        }
    ];
    if (loading) {
        return /*#__PURE__*/ (0,jsx_runtime.jsxs)("div", {
            style: {
                padding: '40px',
                textAlign: 'center'
            },
            children: [
                /*#__PURE__*/ (0,jsx_runtime.jsx)(ui_.Spinner, {
                    inline: true
                }),
                " Loading rules..."
            ]
        });
    }
    if (error) {
        return /*#__PURE__*/ (0,jsx_runtime.jsxs)(ui_.Alert, {
            title: "Failed to load rules",
            severity: "error",
            children: [
                error,
                /*#__PURE__*/ (0,jsx_runtime.jsx)("br", {}),
                /*#__PURE__*/ (0,jsx_runtime.jsx)("br", {}),
                /*#__PURE__*/ (0,jsx_runtime.jsx)(ui_.Button, {
                    onClick: fetchRules,
                    children: "Retry"
                })
            ]
        });
    }
    return /*#__PURE__*/ (0,jsx_runtime.jsxs)(ui_.VerticalGroup, {
        spacing: "md",
        children: [
            /*#__PURE__*/ (0,jsx_runtime.jsxs)(ui_.HorizontalGroup, {
                justify: "space-between",
                children: [
                    /*#__PURE__*/ (0,jsx_runtime.jsxs)("h2", {
                        children: [
                            "BeTrace Rules (",
                            rules.length,
                            ")"
                        ]
                    }),
                    /*#__PURE__*/ (0,jsx_runtime.jsxs)(ui_.HorizontalGroup, {
                        spacing: "sm",
                        children: [
                            /*#__PURE__*/ (0,jsx_runtime.jsx)(ui_.Button, {
                                onClick: fetchRules,
                                variant: "secondary",
                                icon: "sync",
                                children: "Refresh"
                            }),
                            /*#__PURE__*/ (0,jsx_runtime.jsx)(ui_.Button, {
                                onClick: onCreateRule,
                                variant: "primary",
                                icon: "plus",
                                children: "Create Rule"
                            })
                        ]
                    })
                ]
            }),
            rules.length === 0 ? /*#__PURE__*/ (0,jsx_runtime.jsxs)(ui_.Alert, {
                title: "No rules defined",
                severity: "info",
                children: [
                    "Get started by creating your first BeTrace rule.",
                    /*#__PURE__*/ (0,jsx_runtime.jsx)("br", {}),
                    /*#__PURE__*/ (0,jsx_runtime.jsx)("br", {}),
                    /*#__PURE__*/ (0,jsx_runtime.jsx)(ui_.Button, {
                        onClick: onCreateRule,
                        variant: "primary",
                        icon: "plus",
                        children: "Create Your First Rule"
                    })
                ]
            }) : /*#__PURE__*/ (0,jsx_runtime.jsx)(ui_.InteractiveTable, {
                columns: columns,
                data: rules,
                getRowId: (row)=>row.id
            })
        ]
    });
};

;// ./node_modules/@monaco-editor/loader/lib/es/_virtual/_rollupPluginBabelHelpers.js
function _arrayLikeToArray(r, a) {
  (null == a || a > r.length) && (a = r.length);
  for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e];
  return n;
}
function _arrayWithHoles(r) {
  if (Array.isArray(r)) return r;
}
function _defineProperty(e, r, t) {
  return (r = _toPropertyKey(r)) in e ? Object.defineProperty(e, r, {
    value: t,
    enumerable: true,
    configurable: true,
    writable: true
  }) : e[r] = t, e;
}
function _iterableToArrayLimit(r, l) {
  var t = null == r ? null : "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"];
  if (null != t) {
    var e,
      n,
      i,
      u,
      a = [],
      f = true,
      o = false;
    try {
      if (i = (t = t.call(r)).next, 0 === l) ; else for (; !(f = (e = i.call(t)).done) && (a.push(e.value), a.length !== l); f = !0);
    } catch (r) {
      o = true, n = r;
    } finally {
      try {
        if (!f && null != t.return && (u = t.return(), Object(u) !== u)) return;
      } finally {
        if (o) throw n;
      }
    }
    return a;
  }
}
function _nonIterableRest() {
  throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function _rollupPluginBabelHelpers_ownKeys(e, r) {
  var t = Object.keys(e);
  if (Object.getOwnPropertySymbols) {
    var o = Object.getOwnPropertySymbols(e);
    r && (o = o.filter(function (r) {
      return Object.getOwnPropertyDescriptor(e, r).enumerable;
    })), t.push.apply(t, o);
  }
  return t;
}
function _objectSpread2(e) {
  for (var r = 1; r < arguments.length; r++) {
    var t = null != arguments[r] ? arguments[r] : {};
    r % 2 ? _rollupPluginBabelHelpers_ownKeys(Object(t), true).forEach(function (r) {
      _defineProperty(e, r, t[r]);
    }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : _rollupPluginBabelHelpers_ownKeys(Object(t)).forEach(function (r) {
      Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r));
    });
  }
  return e;
}
function _objectWithoutProperties(e, t) {
  if (null == e) return {};
  var o,
    r,
    i = _objectWithoutPropertiesLoose(e, t);
  if (Object.getOwnPropertySymbols) {
    var n = Object.getOwnPropertySymbols(e);
    for (r = 0; r < n.length; r++) o = n[r], -1 === t.indexOf(o) && {}.propertyIsEnumerable.call(e, o) && (i[o] = e[o]);
  }
  return i;
}
function _objectWithoutPropertiesLoose(r, e) {
  if (null == r) return {};
  var t = {};
  for (var n in r) if ({}.hasOwnProperty.call(r, n)) {
    if (-1 !== e.indexOf(n)) continue;
    t[n] = r[n];
  }
  return t;
}
function _slicedToArray(r, e) {
  return _arrayWithHoles(r) || _iterableToArrayLimit(r, e) || _unsupportedIterableToArray(r, e) || _nonIterableRest();
}
function _toPrimitive(t, r) {
  if ("object" != typeof t || !t) return t;
  var e = t[Symbol.toPrimitive];
  if (void 0 !== e) {
    var i = e.call(t, r);
    if ("object" != typeof i) return i;
    throw new TypeError("@@toPrimitive must return a primitive value.");
  }
  return ("string" === r ? String : Number)(t);
}
function _toPropertyKey(t) {
  var i = _toPrimitive(t, "string");
  return "symbol" == typeof i ? i : i + "";
}
function _unsupportedIterableToArray(r, a) {
  if (r) {
    if ("string" == typeof r) return _arrayLikeToArray(r, a);
    var t = {}.toString.call(r).slice(8, -1);
    return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? _arrayLikeToArray(r, a) : void 0;
  }
}



;// ./node_modules/state-local/lib/es/state-local.js
function state_local_defineProperty(obj, key, value) {
  if (key in obj) {
    Object.defineProperty(obj, key, {
      value: value,
      enumerable: true,
      configurable: true,
      writable: true
    });
  } else {
    obj[key] = value;
  }

  return obj;
}

function state_local_ownKeys(object, enumerableOnly) {
  var keys = Object.keys(object);

  if (Object.getOwnPropertySymbols) {
    var symbols = Object.getOwnPropertySymbols(object);
    if (enumerableOnly) symbols = symbols.filter(function (sym) {
      return Object.getOwnPropertyDescriptor(object, sym).enumerable;
    });
    keys.push.apply(keys, symbols);
  }

  return keys;
}

function state_local_objectSpread2(target) {
  for (var i = 1; i < arguments.length; i++) {
    var source = arguments[i] != null ? arguments[i] : {};

    if (i % 2) {
      state_local_ownKeys(Object(source), true).forEach(function (key) {
        state_local_defineProperty(target, key, source[key]);
      });
    } else if (Object.getOwnPropertyDescriptors) {
      Object.defineProperties(target, Object.getOwnPropertyDescriptors(source));
    } else {
      state_local_ownKeys(Object(source)).forEach(function (key) {
        Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key));
      });
    }
  }

  return target;
}

function compose() {
  for (var _len = arguments.length, fns = new Array(_len), _key = 0; _key < _len; _key++) {
    fns[_key] = arguments[_key];
  }

  return function (x) {
    return fns.reduceRight(function (y, f) {
      return f(y);
    }, x);
  };
}

function curry(fn) {
  return function curried() {
    var _this = this;

    for (var _len2 = arguments.length, args = new Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
      args[_key2] = arguments[_key2];
    }

    return args.length >= fn.length ? fn.apply(this, args) : function () {
      for (var _len3 = arguments.length, nextArgs = new Array(_len3), _key3 = 0; _key3 < _len3; _key3++) {
        nextArgs[_key3] = arguments[_key3];
      }

      return curried.apply(_this, [].concat(args, nextArgs));
    };
  };
}

function isObject(value) {
  return {}.toString.call(value).includes('Object');
}

function isEmpty(obj) {
  return !Object.keys(obj).length;
}

function isFunction(value) {
  return typeof value === 'function';
}

function state_local_hasOwnProperty(object, property) {
  return Object.prototype.hasOwnProperty.call(object, property);
}

function validateChanges(initial, changes) {
  if (!isObject(changes)) errorHandler('changeType');
  if (Object.keys(changes).some(function (field) {
    return !state_local_hasOwnProperty(initial, field);
  })) errorHandler('changeField');
  return changes;
}

function validateSelector(selector) {
  if (!isFunction(selector)) errorHandler('selectorType');
}

function validateHandler(handler) {
  if (!(isFunction(handler) || isObject(handler))) errorHandler('handlerType');
  if (isObject(handler) && Object.values(handler).some(function (_handler) {
    return !isFunction(_handler);
  })) errorHandler('handlersType');
}

function validateInitial(initial) {
  if (!initial) errorHandler('initialIsRequired');
  if (!isObject(initial)) errorHandler('initialType');
  if (isEmpty(initial)) errorHandler('initialContent');
}

function throwError(errorMessages, type) {
  throw new Error(errorMessages[type] || errorMessages["default"]);
}

var errorMessages = {
  initialIsRequired: 'initial state is required',
  initialType: 'initial state should be an object',
  initialContent: 'initial state shouldn\'t be an empty object',
  handlerType: 'handler should be an object or a function',
  handlersType: 'all handlers should be a functions',
  selectorType: 'selector should be a function',
  changeType: 'provided value of changes should be an object',
  changeField: 'it seams you want to change a field in the state which is not specified in the "initial" state',
  "default": 'an unknown error accured in `state-local` package'
};
var errorHandler = curry(throwError)(errorMessages);
var validators = {
  changes: validateChanges,
  selector: validateSelector,
  handler: validateHandler,
  initial: validateInitial
};

function create(initial) {
  var handler = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
  validators.initial(initial);
  validators.handler(handler);
  var state = {
    current: initial
  };
  var didUpdate = curry(didStateUpdate)(state, handler);
  var update = curry(updateState)(state);
  var validate = curry(validators.changes)(initial);
  var getChanges = curry(extractChanges)(state);

  function getState() {
    var selector = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : function (state) {
      return state;
    };
    validators.selector(selector);
    return selector(state.current);
  }

  function setState(causedChanges) {
    compose(didUpdate, update, validate, getChanges)(causedChanges);
  }

  return [getState, setState];
}

function extractChanges(state, causedChanges) {
  return isFunction(causedChanges) ? causedChanges(state.current) : causedChanges;
}

function updateState(state, changes) {
  state.current = state_local_objectSpread2(state_local_objectSpread2({}, state.current), changes);
  return changes;
}

function didStateUpdate(state, handler, changes) {
  isFunction(handler) ? handler(state.current) : Object.keys(changes).forEach(function (field) {
    var _handler$field;

    return (_handler$field = handler[field]) === null || _handler$field === void 0 ? void 0 : _handler$field.call(handler, state.current[field]);
  });
  return changes;
}

var index = {
  create: create
};

/* harmony default export */ const state_local = (index);

;// ./node_modules/@monaco-editor/loader/lib/es/config/index.js
var config = {
  paths: {
    vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.54.0/min/vs'
  }
};



;// ./node_modules/@monaco-editor/loader/lib/es/utils/curry.js
function curry_curry(fn) {
  return function curried() {
    var _this = this;
    for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
      args[_key] = arguments[_key];
    }
    return args.length >= fn.length ? fn.apply(this, args) : function () {
      for (var _len2 = arguments.length, nextArgs = new Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
        nextArgs[_key2] = arguments[_key2];
      }
      return curried.apply(_this, [].concat(args, nextArgs));
    };
  };
}



;// ./node_modules/@monaco-editor/loader/lib/es/utils/isObject.js
function isObject_isObject(value) {
  return {}.toString.call(value).includes('Object');
}



;// ./node_modules/@monaco-editor/loader/lib/es/validators/index.js



/**
 * validates the configuration object and informs about deprecation
 * @param {Object} config - the configuration object 
 * @return {Object} config - the validated configuration object
 */
function validateConfig(config) {
  if (!config) validators_errorHandler('configIsRequired');
  if (!isObject_isObject(config)) validators_errorHandler('configType');
  if (config.urls) {
    informAboutDeprecation();
    return {
      paths: {
        vs: config.urls.monacoBase
      }
    };
  }
  return config;
}

/**
 * logs deprecation message
 */
function informAboutDeprecation() {
  console.warn(validators_errorMessages.deprecation);
}
function validators_throwError(errorMessages, type) {
  throw new Error(errorMessages[type] || errorMessages["default"]);
}
var validators_errorMessages = {
  configIsRequired: 'the configuration object is required',
  configType: 'the configuration object should be an object',
  "default": 'an unknown error accured in `@monaco-editor/loader` package',
  deprecation: "Deprecation warning!\n    You are using deprecated way of configuration.\n\n    Instead of using\n      monaco.config({ urls: { monacoBase: '...' } })\n    use\n      monaco.config({ paths: { vs: '...' } })\n\n    For more please check the link https://github.com/suren-atoyan/monaco-loader#config\n  "
};
var validators_errorHandler = curry_curry(validators_throwError)(validators_errorMessages);
var validators_validators = {
  config: validateConfig
};



;// ./node_modules/@monaco-editor/loader/lib/es/utils/compose.js
var compose_compose = function compose() {
  for (var _len = arguments.length, fns = new Array(_len), _key = 0; _key < _len; _key++) {
    fns[_key] = arguments[_key];
  }
  return function (x) {
    return fns.reduceRight(function (y, f) {
      return f(y);
    }, x);
  };
};



;// ./node_modules/@monaco-editor/loader/lib/es/utils/deepMerge.js


function merge(target, source) {
  Object.keys(source).forEach(function (key) {
    if (source[key] instanceof Object) {
      if (target[key]) {
        Object.assign(source[key], merge(target[key], source[key]));
      }
    }
  });
  return _objectSpread2(_objectSpread2({}, target), source);
}



;// ./node_modules/@monaco-editor/loader/lib/es/utils/makeCancelable.js
// The source (has been changed) is https://github.com/facebook/react/issues/5465#issuecomment-157888325

var CANCELATION_MESSAGE = {
  type: 'cancelation',
  msg: 'operation is manually canceled'
};
function makeCancelable(promise) {
  var hasCanceled_ = false;
  var wrappedPromise = new Promise(function (resolve, reject) {
    promise.then(function (val) {
      return hasCanceled_ ? reject(CANCELATION_MESSAGE) : resolve(val);
    });
    promise["catch"](reject);
  });
  return wrappedPromise.cancel = function () {
    return hasCanceled_ = true;
  }, wrappedPromise;
}



;// ./node_modules/@monaco-editor/loader/lib/es/loader/index.js








var _excluded = ["monaco"];

/** the local state of the module */
var _state$create = state_local.create({
    config: config,
    isInitialized: false,
    resolve: null,
    reject: null,
    monaco: null
  }),
  _state$create2 = _slicedToArray(_state$create, 2),
  getState = _state$create2[0],
  setState = _state$create2[1];

/**
 * set the loader configuration
 * @param {Object} config - the configuration object
 */
function loader_config(globalConfig) {
  var _validators$config = validators_validators.config(globalConfig),
    monaco = _validators$config.monaco,
    config = _objectWithoutProperties(_validators$config, _excluded);
  setState(function (state) {
    return {
      config: merge(state.config, config),
      monaco: monaco
    };
  });
}

/**
 * handles the initialization of the monaco-editor
 * @return {Promise} - returns an instance of monaco (with a cancelable promise)
 */
function init() {
  var state = getState(function (_ref) {
    var monaco = _ref.monaco,
      isInitialized = _ref.isInitialized,
      resolve = _ref.resolve;
    return {
      monaco: monaco,
      isInitialized: isInitialized,
      resolve: resolve
    };
  });
  if (!state.isInitialized) {
    setState({
      isInitialized: true
    });
    if (state.monaco) {
      state.resolve(state.monaco);
      return makeCancelable(wrapperPromise);
    }
    if (window.monaco && window.monaco.editor) {
      storeMonacoInstance(window.monaco);
      state.resolve(window.monaco);
      return makeCancelable(wrapperPromise);
    }
    compose_compose(injectScripts, getMonacoLoaderScript)(configureLoader);
  }
  return makeCancelable(wrapperPromise);
}

/**
 * injects provided scripts into the document.body
 * @param {Object} script - an HTML script element
 * @return {Object} - the injected HTML script element
 */
function injectScripts(script) {
  return document.body.appendChild(script);
}

/**
 * creates an HTML script element with/without provided src
 * @param {string} [src] - the source path of the script
 * @return {Object} - the created HTML script element
 */
function createScript(src) {
  var script = document.createElement('script');
  return src && (script.src = src), script;
}

/**
 * creates an HTML script element with the monaco loader src
 * @return {Object} - the created HTML script element
 */
function getMonacoLoaderScript(configureLoader) {
  var state = getState(function (_ref2) {
    var config = _ref2.config,
      reject = _ref2.reject;
    return {
      config: config,
      reject: reject
    };
  });
  var loaderScript = createScript("".concat(state.config.paths.vs, "/loader.js"));
  loaderScript.onload = function () {
    return configureLoader();
  };
  loaderScript.onerror = state.reject;
  return loaderScript;
}

/**
 * configures the monaco loader
 */
function configureLoader() {
  var state = getState(function (_ref3) {
    var config = _ref3.config,
      resolve = _ref3.resolve,
      reject = _ref3.reject;
    return {
      config: config,
      resolve: resolve,
      reject: reject
    };
  });
  var require = window.require;
  require.config(state.config);
  require(['vs/editor/editor.main'], function (_ref4) {
    var monaco = _ref4.m;
    storeMonacoInstance(monaco);
    state.resolve(monaco);
  }, function (error) {
    state.reject(error);
  });
}

/**
 * store monaco instance in local state
 */
function storeMonacoInstance(monaco) {
  if (!getState().monaco) {
    setState({
      monaco: monaco
    });
  }
}

/**
 * internal helper function
 * extracts stored monaco instance
 * @return {Object|null} - the monaco instance
 */
function __getMonacoInstance() {
  return getState(function (_ref5) {
    var monaco = _ref5.monaco;
    return monaco;
  });
}
var wrapperPromise = new Promise(function (resolve, reject) {
  return setState({
    resolve: resolve,
    reject: reject
  });
});
var loader = {
  config: loader_config,
  init: init,
  __getMonacoInstance: __getMonacoInstance
};



;// ./node_modules/@monaco-editor/loader/lib/es/index.js






;// ./node_modules/@monaco-editor/react/dist/index.mjs
var le={wrapper:{display:"flex",position:"relative",textAlign:"initial"},fullWidth:{width:"100%"},hide:{display:"none"}},v=le;var ae={container:{display:"flex",height:"100%",width:"100%",justifyContent:"center",alignItems:"center"}},Y=ae;function Me({children:e}){return external_react_.createElement("div",{style:Y.container},e)}var Z=Me;var $=Z;function Ee({width:e,height:r,isEditorReady:n,loading:t,_ref:a,className:m,wrapperProps:E}){return external_react_.createElement("section",{style:{...v.wrapper,width:e,height:r},...E},!n&&external_react_.createElement($,null,t),external_react_.createElement("div",{ref:a,style:{...v.fullWidth,...!n&&v.hide},className:m}))}var ee=Ee;var H=(0,external_react_.memo)(ee);function Ce(e){(0,external_react_.useEffect)(e,[])}var k=Ce;function he(e,r,n=!0){let t=(0,external_react_.useRef)(!0);(0,external_react_.useEffect)(t.current||!n?()=>{t.current=!1}:e,r)}var l=he;function D(){}function h(e,r,n,t){return De(e,t)||be(e,r,n,t)}function De(e,r){return e.editor.getModel(te(e,r))}function be(e,r,n,t){return e.editor.createModel(r,n,t?te(e,t):void 0)}function te(e,r){return e.Uri.parse(r)}function Oe({original:e,modified:r,language:n,originalLanguage:t,modifiedLanguage:a,originalModelPath:m,modifiedModelPath:E,keepCurrentOriginalModel:g=!1,keepCurrentModifiedModel:N=!1,theme:x="light",loading:P="Loading...",options:y={},height:V="100%",width:z="100%",className:F,wrapperProps:j={},beforeMount:A=D,onMount:q=D}){let[M,O]=(0,external_react_.useState)(!1),[T,s]=(0,external_react_.useState)(!0),u=(0,external_react_.useRef)(null),c=(0,external_react_.useRef)(null),w=(0,external_react_.useRef)(null),d=(0,external_react_.useRef)(q),o=(0,external_react_.useRef)(A),b=(0,external_react_.useRef)(!1);k(()=>{let i=loader.init();return i.then(f=>(c.current=f)&&s(!1)).catch(f=>f?.type!=="cancelation"&&console.error("Monaco initialization: error:",f)),()=>u.current?I():i.cancel()}),l(()=>{if(u.current&&c.current){let i=u.current.getOriginalEditor(),f=h(c.current,e||"",t||n||"text",m||"");f!==i.getModel()&&i.setModel(f)}},[m],M),l(()=>{if(u.current&&c.current){let i=u.current.getModifiedEditor(),f=h(c.current,r||"",a||n||"text",E||"");f!==i.getModel()&&i.setModel(f)}},[E],M),l(()=>{let i=u.current.getModifiedEditor();i.getOption(c.current.editor.EditorOption.readOnly)?i.setValue(r||""):r!==i.getValue()&&(i.executeEdits("",[{range:i.getModel().getFullModelRange(),text:r||"",forceMoveMarkers:!0}]),i.pushUndoStop())},[r],M),l(()=>{u.current?.getModel()?.original.setValue(e||"")},[e],M),l(()=>{let{original:i,modified:f}=u.current.getModel();c.current.editor.setModelLanguage(i,t||n||"text"),c.current.editor.setModelLanguage(f,a||n||"text")},[n,t,a],M),l(()=>{c.current?.editor.setTheme(x)},[x],M),l(()=>{u.current?.updateOptions(y)},[y],M);let L=(0,external_react_.useCallback)(()=>{if(!c.current)return;o.current(c.current);let i=h(c.current,e||"",t||n||"text",m||""),f=h(c.current,r||"",a||n||"text",E||"");u.current?.setModel({original:i,modified:f})},[n,r,a,e,t,m,E]),U=(0,external_react_.useCallback)(()=>{!b.current&&w.current&&(u.current=c.current.editor.createDiffEditor(w.current,{automaticLayout:!0,...y}),L(),c.current?.editor.setTheme(x),O(!0),b.current=!0)},[y,x,L]);(0,external_react_.useEffect)(()=>{M&&d.current(u.current,c.current)},[M]),(0,external_react_.useEffect)(()=>{!T&&!M&&U()},[T,M,U]);function I(){let i=u.current?.getModel();g||i?.original?.dispose(),N||i?.modified?.dispose(),u.current?.dispose()}return external_react_.createElement(H,{width:z,height:V,isEditorReady:M,loading:P,_ref:w,className:F,wrapperProps:j})}var ie=Oe;var we=(0,external_react_.memo)(ie);function Pe(){let[e,r]=Ie(ce.__getMonacoInstance());return k(()=>{let n;return e||(n=ce.init(),n.then(t=>{r(t)})),()=>n?.cancel()}),e}var Le=(/* unused pure expression or super */ null && (Pe));function He(e){let r=(0,external_react_.useRef)();return (0,external_react_.useEffect)(()=>{r.current=e},[e]),r.current}var se=He;var _=new Map;function Ve({defaultValue:e,defaultLanguage:r,defaultPath:n,value:t,language:a,path:m,theme:E="light",line:g,loading:N="Loading...",options:x={},overrideServices:P={},saveViewState:y=!0,keepCurrentModel:V=!1,width:z="100%",height:F="100%",className:j,wrapperProps:A={},beforeMount:q=D,onMount:M=D,onChange:O,onValidate:T=D}){let[s,u]=(0,external_react_.useState)(!1),[c,w]=(0,external_react_.useState)(!0),d=(0,external_react_.useRef)(null),o=(0,external_react_.useRef)(null),b=(0,external_react_.useRef)(null),L=(0,external_react_.useRef)(M),U=(0,external_react_.useRef)(q),I=(0,external_react_.useRef)(),i=(0,external_react_.useRef)(t),f=se(m),Q=(0,external_react_.useRef)(!1),B=(0,external_react_.useRef)(!1);k(()=>{let p=loader.init();return p.then(R=>(d.current=R)&&w(!1)).catch(R=>R?.type!=="cancelation"&&console.error("Monaco initialization: error:",R)),()=>o.current?pe():p.cancel()}),l(()=>{let p=h(d.current,e||t||"",r||a||"",m||n||"");p!==o.current?.getModel()&&(y&&_.set(f,o.current?.saveViewState()),o.current?.setModel(p),y&&o.current?.restoreViewState(_.get(m)))},[m],s),l(()=>{o.current?.updateOptions(x)},[x],s),l(()=>{!o.current||t===void 0||(o.current.getOption(d.current.editor.EditorOption.readOnly)?o.current.setValue(t):t!==o.current.getValue()&&(B.current=!0,o.current.executeEdits("",[{range:o.current.getModel().getFullModelRange(),text:t,forceMoveMarkers:!0}]),o.current.pushUndoStop(),B.current=!1))},[t],s),l(()=>{let p=o.current?.getModel();p&&a&&d.current?.editor.setModelLanguage(p,a)},[a],s),l(()=>{g!==void 0&&o.current?.revealLine(g)},[g],s),l(()=>{d.current?.editor.setTheme(E)},[E],s);let X=(0,external_react_.useCallback)(()=>{if(!(!b.current||!d.current)&&!Q.current){U.current(d.current);let p=m||n,R=h(d.current,t||e||"",r||a||"",p||"");o.current=d.current?.editor.create(b.current,{model:R,automaticLayout:!0,...x},P),y&&o.current.restoreViewState(_.get(p)),d.current.editor.setTheme(E),g!==void 0&&o.current.revealLine(g),u(!0),Q.current=!0}},[e,r,n,t,a,m,x,P,y,E,g]);(0,external_react_.useEffect)(()=>{s&&L.current(o.current,d.current)},[s]),(0,external_react_.useEffect)(()=>{!c&&!s&&X()},[c,s,X]),i.current=t,(0,external_react_.useEffect)(()=>{s&&O&&(I.current?.dispose(),I.current=o.current?.onDidChangeModelContent(p=>{B.current||O(o.current.getValue(),p)}))},[s,O]),(0,external_react_.useEffect)(()=>{if(s){let p=d.current.editor.onDidChangeMarkers(R=>{let G=o.current.getModel()?.uri;if(G&&R.find(J=>J.path===G.path)){let J=d.current.editor.getModelMarkers({resource:G});T?.(J)}});return()=>{p?.dispose()}}return()=>{}},[s,T]);function pe(){I.current?.dispose(),V?y&&_.set(m,o.current.saveViewState()):o.current.getModel()?.dispose(),o.current.dispose()}return external_react_.createElement(H,{width:z,height:F,isEditorReady:s,loading:N,_ref:b,className:j,wrapperProps:A})}var fe=Ve;var de=(0,external_react_.memo)(fe);var Ft=de;
//# sourceMappingURL=index.mjs.map
;// ./src/components/MonacoRuleEditor.tsx
function MonacoRuleEditor_asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) {
    try {
        var info = gen[key](arg);
        var value = info.value;
    } catch (error) {
        reject(error);
        return;
    }
    if (info.done) {
        resolve(value);
    } else {
        Promise.resolve(value).then(_next, _throw);
    }
}
function MonacoRuleEditor_async_to_generator(fn) {
    return function() {
        var self = this, args = arguments;
        return new Promise(function(resolve, reject) {
            var gen = fn.apply(self, args);
            function _next(value) {
                MonacoRuleEditor_asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value);
            }
            function _throw(err) {
                MonacoRuleEditor_asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err);
            }
            _next(undefined);
        });
    };
}




/**
 * MonacoRuleEditor - Enhanced rule editor with Monaco
 *
 * Phase 3: Monaco editor integration
 * - Syntax highlighting for BeTraceDSL
 * - Multi-line editing
 * - Pattern validation (optional)
 */ const MonacoRuleEditor = ({ rule, onSave, onCancel, onTest, backendUrl = 'http://localhost:12011' })=>{
    const [name, setName] = (0,external_react_.useState)((rule === null || rule === void 0 ? void 0 : rule.name) || '');
    const [description, setDescription] = (0,external_react_.useState)((rule === null || rule === void 0 ? void 0 : rule.description) || '');
    const [pattern, setPattern] = (0,external_react_.useState)((rule === null || rule === void 0 ? void 0 : rule.pattern) || '');
    var _rule_enabled;
    const [enabled, setEnabled] = (0,external_react_.useState)((_rule_enabled = rule === null || rule === void 0 ? void 0 : rule.enabled) !== null && _rule_enabled !== void 0 ? _rule_enabled : true);
    const [saving, setSaving] = (0,external_react_.useState)(false);
    const [testing, setTesting] = (0,external_react_.useState)(false);
    const [error, setError] = (0,external_react_.useState)(null);
    const [testResult, setTestResult] = (0,external_react_.useState)(null);
    const isEdit = Boolean(rule === null || rule === void 0 ? void 0 : rule.id);
    // Form validation
    const isValid = name.trim().length > 0 && pattern.trim().length > 0;
    // Test pattern syntax
    const handleTest = ()=>MonacoRuleEditor_async_to_generator(function*() {
            if (!pattern.trim()) {
                setTestResult({
                    valid: false,
                    error: 'Pattern is empty'
                });
                return;
            }
            setTesting(true);
            setTestResult(null);
            try {
                if (onTest) {
                    const result = yield onTest(pattern);
                    setTestResult(result);
                } else {
                    // Basic validation - check for common DSL keywords
                    const hasKeywords = /trace\.|span\.|has\(|and|or|not/.test(pattern);
                    setTestResult({
                        valid: hasKeywords,
                        error: hasKeywords ? undefined : 'Pattern should contain BeTraceDSL keywords (trace., span., has(), etc.)'
                    });
                }
            } catch (err) {
                setTestResult({
                    valid: false,
                    error: err instanceof Error ? err.message : 'Test failed'
                });
            } finally{
                setTesting(false);
            }
        })();
    // Save rule
    const handleSave = ()=>MonacoRuleEditor_async_to_generator(function*() {
            if (!isValid) {
                setError('Rule name and pattern are required');
                return;
            }
            setSaving(true);
            setError(null);
            try {
                const ruleData = {
                    name: name.trim(),
                    description: description.trim(),
                    pattern: pattern.trim(),
                    enabled
                };
                const url = isEdit ? `${backendUrl}/api/rules/${rule.id}` : `${backendUrl}/api/rules`;
                const method = isEdit ? 'PUT' : 'POST';
                const response = yield fetch(url, {
                    method,
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(ruleData)
                });
                if (!response.ok) {
                    const errorText = yield response.text();
                    throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
                }
                // Success - call onSave to return to list
                onSave();
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to save rule');
            } finally{
                setSaving(false);
            }
        })();
    return /*#__PURE__*/ (0,jsx_runtime.jsxs)(ui_.VerticalGroup, {
        spacing: "lg",
        children: [
            /*#__PURE__*/ (0,jsx_runtime.jsxs)(ui_.HorizontalGroup, {
                justify: "space-between",
                children: [
                    /*#__PURE__*/ (0,jsx_runtime.jsxs)("div", {
                        children: [
                            /*#__PURE__*/ (0,jsx_runtime.jsx)("h2", {
                                children: isEdit ? 'Edit Rule' : 'Create New Rule'
                            }),
                            /*#__PURE__*/ (0,jsx_runtime.jsx)("p", {
                                style: {
                                    color: '#888',
                                    fontSize: '14px',
                                    margin: 0
                                },
                                children: "Phase 3: Monaco editor with BeTraceDSL support"
                            })
                        ]
                    }),
                    /*#__PURE__*/ (0,jsx_runtime.jsx)(ui_.Button, {
                        variant: "secondary",
                        icon: "arrow-left",
                        onClick: onCancel,
                        children: "Back to List"
                    })
                ]
            }),
            error && /*#__PURE__*/ (0,jsx_runtime.jsx)(ui_.Alert, {
                title: "Error",
                severity: "error",
                onRemove: ()=>setError(null),
                children: error
            }),
            /*#__PURE__*/ (0,jsx_runtime.jsx)(ui_.Field, {
                label: "Rule Name",
                required: true,
                description: "Unique identifier for this rule",
                children: /*#__PURE__*/ (0,jsx_runtime.jsx)(ui_.Input, {
                    value: name,
                    onChange: (e)=>setName(e.currentTarget.value),
                    placeholder: "e.g., auth-required-for-pii-access",
                    width: 50
                })
            }),
            /*#__PURE__*/ (0,jsx_runtime.jsx)(ui_.Field, {
                label: "Description",
                description: "Human-readable explanation of what this rule checks",
                children: /*#__PURE__*/ (0,jsx_runtime.jsx)(ui_.TextArea, {
                    value: description,
                    onChange: (e)=>setDescription(e.currentTarget.value),
                    placeholder: "e.g., Ensures all PII access has corresponding authentication span",
                    rows: 3
                })
            }),
            /*#__PURE__*/ (0,jsx_runtime.jsxs)("div", {
                children: [
                    /*#__PURE__*/ (0,jsx_runtime.jsx)(ui_.Field, {
                        label: "Pattern (BeTraceDSL)",
                        required: true,
                        description: "Trace pattern in BeTraceDSL syntax with Monaco editor",
                        children: /*#__PURE__*/ (0,jsx_runtime.jsx)("div", {
                            style: {
                                border: '1px solid #444',
                                borderRadius: '2px',
                                overflow: 'hidden'
                            },
                            children: /*#__PURE__*/ (0,jsx_runtime.jsx)(Ft, {
                                height: "300px",
                                defaultLanguage: "javascript",
                                theme: "vs-dark",
                                value: pattern,
                                onChange: (value)=>setPattern(value || ''),
                                options: {
                                    minimap: {
                                        enabled: false
                                    },
                                    fontSize: 13,
                                    lineNumbers: 'on',
                                    scrollBeyondLastLine: false,
                                    automaticLayout: true,
                                    tabSize: 2,
                                    wordWrap: 'on'
                                }
                            })
                        })
                    }),
                    /*#__PURE__*/ (0,jsx_runtime.jsxs)(ui_.HorizontalGroup, {
                        spacing: "sm",
                        style: {
                            marginTop: '8px'
                        },
                        children: [
                            /*#__PURE__*/ (0,jsx_runtime.jsx)(ui_.Button, {
                                size: "sm",
                                variant: "secondary",
                                onClick: handleTest,
                                disabled: testing || !pattern.trim(),
                                children: testing ? 'Testing...' : 'Test Pattern'
                            }),
                            testResult && /*#__PURE__*/ (0,jsx_runtime.jsx)(ui_.Badge, {
                                text: testResult.valid ? 'Valid' : 'Invalid',
                                color: testResult.valid ? 'green' : 'red',
                                icon: testResult.valid ? 'check' : 'exclamation-triangle'
                            })
                        ]
                    }),
                    testResult && !testResult.valid && testResult.error && /*#__PURE__*/ (0,jsx_runtime.jsx)(ui_.Alert, {
                        title: "Pattern Validation",
                        severity: "warning",
                        style: {
                            marginTop: '8px'
                        },
                        children: testResult.error
                    })
                ]
            }),
            /*#__PURE__*/ (0,jsx_runtime.jsx)(ui_.Field, {
                label: "Status",
                description: "Enable or disable this rule",
                children: /*#__PURE__*/ (0,jsx_runtime.jsxs)(ui_.HorizontalGroup, {
                    spacing: "sm",
                    children: [
                        /*#__PURE__*/ (0,jsx_runtime.jsx)(ui_.Switch, {
                            value: enabled,
                            onChange: (e)=>setEnabled(e.currentTarget.checked)
                        }),
                        /*#__PURE__*/ (0,jsx_runtime.jsx)("span", {
                            children: enabled ? 'Enabled' : 'Disabled'
                        })
                    ]
                })
            }),
            /*#__PURE__*/ (0,jsx_runtime.jsxs)(ui_.HorizontalGroup, {
                spacing: "sm",
                children: [
                    /*#__PURE__*/ (0,jsx_runtime.jsx)(ui_.Button, {
                        variant: "primary",
                        onClick: handleSave,
                        disabled: !isValid || saving,
                        children: saving ? 'Saving...' : isEdit ? 'Update Rule' : 'Create Rule'
                    }),
                    /*#__PURE__*/ (0,jsx_runtime.jsx)(ui_.Button, {
                        variant: "secondary",
                        onClick: onCancel,
                        disabled: saving,
                        children: "Cancel"
                    })
                ]
            }),
            /*#__PURE__*/ (0,jsx_runtime.jsxs)(ui_.Alert, {
                title: "BeTraceDSL Examples",
                severity: "info",
                children: [
                    /*#__PURE__*/ (0,jsx_runtime.jsx)("strong", {
                        children: "Common patterns:"
                    }),
                    /*#__PURE__*/ (0,jsx_runtime.jsx)("pre", {
                        style: {
                            fontSize: '12px',
                            marginTop: '8px'
                        },
                        children: `// PII access requires authentication
trace.has(span.name == "pii.access") and trace.has(span.name == "auth.check")

// Error rate threshold
trace.spans.filter(s => s.status == "error").length > 5

// Compliance: audit log required
trace.has(span.attributes["data.pii"] == true) and trace.has(span.name == "audit.log")`
                    })
                ]
            })
        ]
    });
};

;// ./src/pages/RootPage.tsx
function RootPage_asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) {
    try {
        var info = gen[key](arg);
        var value = info.value;
    } catch (error) {
        reject(error);
        return;
    }
    if (info.done) {
        resolve(value);
    } else {
        Promise.resolve(value).then(_next, _throw);
    }
}
function RootPage_async_to_generator(fn) {
    return function() {
        var self = this, args = arguments;
        return new Promise(function(resolve, reject) {
            var gen = fn.apply(self, args);
            function _next(value) {
                RootPage_asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value);
            }
            function _throw(err) {
                RootPage_asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err);
            }
            _next(undefined);
        });
    };
}





/**
 * RootPage - Main entry point for BeTrace plugin
 *
 * Phase 2: Full rule management with list/create/edit views
 */ const RootPage = ()=>{
    const [currentView, setCurrentView] = (0,external_react_.useState)('list');
    const [selectedRule, setSelectedRule] = (0,external_react_.useState)(null);
    // Backend URL - TODO: make configurable via plugin settings
    const backendUrl = 'http://localhost:12011';
    // Navigation handlers
    const handleCreateRule = ()=>{
        setSelectedRule(null);
        setCurrentView('create');
    };
    const handleEditRule = (rule)=>{
        setSelectedRule(rule);
        setCurrentView('edit');
    };
    const handleSave = ()=>{
        setSelectedRule(null);
        setCurrentView('list');
    };
    const handleCancel = ()=>{
        setSelectedRule(null);
        setCurrentView('list');
    };
    // Pattern testing (basic validation)
    const handleTestPattern = (pattern)=>RootPage_async_to_generator(function*() {
            // Basic syntax validation
            const hasKeywords = /trace\.|span\.|has\(|and|or|not/.test(pattern);
            if (!hasKeywords) {
                return {
                    valid: false,
                    error: 'Pattern should contain BeTraceDSL keywords (trace., span., has(), and, or, not)'
                };
            }
            // Check for balanced parentheses
            const openParens = (pattern.match(/\(/g) || []).length;
            const closeParens = (pattern.match(/\)/g) || []).length;
            if (openParens !== closeParens) {
                return {
                    valid: false,
                    error: `Unbalanced parentheses: ${openParens} opening, ${closeParens} closing`
                };
            }
            return {
                valid: true
            };
        })();
    return /*#__PURE__*/ (0,jsx_runtime.jsx)("div", {
        style: {
            padding: '20px'
        },
        children: /*#__PURE__*/ (0,jsx_runtime.jsxs)(ui_.VerticalGroup, {
            spacing: "lg",
            children: [
                /*#__PURE__*/ (0,jsx_runtime.jsxs)("div", {
                    children: [
                        /*#__PURE__*/ (0,jsx_runtime.jsx)("h1", {
                            children: "BeTrace - Behavioral Assurance for OpenTelemetry"
                        }),
                        /*#__PURE__*/ (0,jsx_runtime.jsx)("p", {
                            style: {
                                color: '#888',
                                fontSize: '14px'
                            },
                            children: "Create and manage trace pattern matching rules with BeTraceDSL"
                        })
                    ]
                }),
                currentView === 'list' && /*#__PURE__*/ (0,jsx_runtime.jsx)(RuleList, {
                    onCreateRule: handleCreateRule,
                    onEditRule: handleEditRule,
                    backendUrl: backendUrl
                }),
                (currentView === 'create' || currentView === 'edit') && /*#__PURE__*/ (0,jsx_runtime.jsx)(MonacoRuleEditor, {
                    rule: selectedRule,
                    onSave: handleSave,
                    onCancel: handleCancel,
                    onTest: handleTestPattern,
                    backendUrl: backendUrl
                }),
                /*#__PURE__*/ (0,jsx_runtime.jsx)("div", {
                    style: {
                        marginTop: '40px',
                        fontSize: '12px',
                        color: '#888',
                        borderTop: '1px solid #333',
                        paddingTop: '20px'
                    },
                    children: /*#__PURE__*/ (0,jsx_runtime.jsxs)("p", {
                        children: [
                            /*#__PURE__*/ (0,jsx_runtime.jsx)("strong", {
                                children: "ADR-027:"
                            }),
                            " BeTrace as Grafana App Plugin",
                            /*#__PURE__*/ (0,jsx_runtime.jsx)("br", {}),
                            /*#__PURE__*/ (0,jsx_runtime.jsx)("strong", {
                                children: "Status:"
                            }),
                            " Phase 3 - Monaco Editor (Production Ready)",
                            /*#__PURE__*/ (0,jsx_runtime.jsx)("br", {}),
                            /*#__PURE__*/ (0,jsx_runtime.jsx)("strong", {
                                children: "Backend:"
                            }),
                            " ",
                            backendUrl
                        ]
                    })
                })
            ]
        })
    });
};

;// ./src/pages/ConfigPage.tsx



/**
 * ConfigPage - Plugin configuration
 *
 * Allows admins to configure BeTrace backend URL and API settings
 */ const ConfigPage = ({ plugin })=>{
    var _plugin_meta_jsonData;
    const [backendUrl, setBackendUrl] = (0,external_react_.useState)(((_plugin_meta_jsonData = plugin.meta.jsonData) === null || _plugin_meta_jsonData === void 0 ? void 0 : _plugin_meta_jsonData.backendUrl) || 'http://localhost:12011');
    return /*#__PURE__*/ (0,jsx_runtime.jsx)("div", {
        style: {
            padding: '20px'
        },
        children: /*#__PURE__*/ (0,jsx_runtime.jsxs)(ui_.VerticalGroup, {
            spacing: "lg",
            children: [
                /*#__PURE__*/ (0,jsx_runtime.jsx)("h2", {
                    children: "BeTrace Plugin Configuration"
                }),
                /*#__PURE__*/ (0,jsx_runtime.jsx)(ui_.Field, {
                    label: "BeTrace Backend URL",
                    description: "URL of the BeTrace backend API (Go server)",
                    children: /*#__PURE__*/ (0,jsx_runtime.jsx)(ui_.Input, {
                        value: backendUrl,
                        onChange: (e)=>setBackendUrl(e.currentTarget.value),
                        placeholder: "http://localhost:12011",
                        width: 50
                    })
                }),
                /*#__PURE__*/ (0,jsx_runtime.jsx)("div", {
                    children: /*#__PURE__*/ (0,jsx_runtime.jsx)(ui_.Button, {
                        variant: "primary",
                        disabled: true,
                        children: "Save Configuration (Persistence Coming Soon)"
                    })
                }),
                /*#__PURE__*/ (0,jsx_runtime.jsxs)("div", {
                    style: {
                        marginTop: '40px'
                    },
                    children: [
                        /*#__PURE__*/ (0,jsx_runtime.jsx)("h3", {
                            children: "Backend API Endpoints"
                        }),
                        /*#__PURE__*/ (0,jsx_runtime.jsx)("p", {
                            children: "The BeTrace backend should expose the following REST API:"
                        }),
                        /*#__PURE__*/ (0,jsx_runtime.jsxs)("ul", {
                            children: [
                                /*#__PURE__*/ (0,jsx_runtime.jsxs)("li", {
                                    children: [
                                        /*#__PURE__*/ (0,jsx_runtime.jsx)("code", {
                                            children: "GET /api/rules"
                                        }),
                                        " - List all rules"
                                    ]
                                }),
                                /*#__PURE__*/ (0,jsx_runtime.jsxs)("li", {
                                    children: [
                                        /*#__PURE__*/ (0,jsx_runtime.jsx)("code", {
                                            children: "POST /api/rules"
                                        }),
                                        " - Create new rule"
                                    ]
                                }),
                                /*#__PURE__*/ (0,jsx_runtime.jsxs)("li", {
                                    children: [
                                        /*#__PURE__*/ (0,jsx_runtime.jsx)("code", {
                                            children: "PUT /api/rules/:id"
                                        }),
                                        " - Update rule"
                                    ]
                                }),
                                /*#__PURE__*/ (0,jsx_runtime.jsxs)("li", {
                                    children: [
                                        /*#__PURE__*/ (0,jsx_runtime.jsx)("code", {
                                            children: "DELETE /api/rules/:id"
                                        }),
                                        " - Delete rule"
                                    ]
                                }),
                                /*#__PURE__*/ (0,jsx_runtime.jsxs)("li", {
                                    children: [
                                        /*#__PURE__*/ (0,jsx_runtime.jsx)("code", {
                                            children: "POST /api/rules/test"
                                        }),
                                        " - Test rule with sample trace"
                                    ]
                                })
                            ]
                        })
                    ]
                })
            ]
        })
    });
};

;// ./src/module.ts



/**
 * BeTrace Grafana App Plugin
 *
 * ADR-027: BeTrace as Grafana App Plugin
 *
 * Provides rule management UI for BeTraceDSL trace pattern matching.
 * Users create, edit, test, and manage rules through native Grafana UI.
 */ const module_plugin = new data_.AppPlugin().setRootPage(RootPage).addConfigPage({
    title: 'Configuration',
    icon: 'cog',
    body: ConfigPage,
    id: 'configuration'
});

/******/ 	return __webpack_exports__;
/******/ })()
;
});;
//# sourceMappingURL=module.js.map