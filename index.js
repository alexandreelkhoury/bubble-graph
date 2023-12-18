"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Bubble = Bubble;
var _react = _interopRequireWildcard(require("react"));
function _getRequireWildcardCache(e) { if ("function" != typeof WeakMap) return null; var r = new WeakMap(), t = new WeakMap(); return (_getRequireWildcardCache = function (e) { return e ? t : r; })(e); }
function _interopRequireWildcard(e, r) { if (!r && e && e.__esModule) return e; if (null === e || "object" != typeof e && "function" != typeof e) return { default: e }; var t = _getRequireWildcardCache(r); if (t && t.has(e)) return t.get(e); var n = { __proto__: null }, a = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var u in e) if ("default" !== u && Object.prototype.hasOwnProperty.call(e, u)) { var i = a ? Object.getOwnPropertyDescriptor(e, u) : null; i && (i.get || i.set) ? Object.defineProperty(n, u, i) : n[u] = e[u]; } return n.default = e, t && t.set(e, n), n; }
function Bubble(_ref) {
  let {
    primaryColor,
    secondaryColor,
    position,
    collectionName,
    data,
    width
  } = _ref;
  const [hoveredBubble, setHoveredBubble] = (0, _react.useState)(null);
  function removeNullValues(obj) {
    for (const key in obj) {
      if (obj.hasOwnProperty(key) && (obj[key] === 0 || obj[key] === undefined)) {
        delete obj[key];
      }
    }
    return obj;
  }
  const cleanedData = removeNullValues(data);
  function sumAllValues(obj) {
    let sum = 0;
    for (const key in obj) {
      sum += obj[key];
    }
    return sum;
  }
  const total = sumAllValues(data);
  function getHighestValue(obj) {
    const entries = Object.entries(obj);
    if (entries.length === 0) {
      return null;
    }
    let [maxKey, maxValue] = entries[0];
    for (const [key, value] of entries) {
      if (value > maxValue) {
        maxKey = key;
        maxValue = value;
      }
    }
    return {
      key: maxKey,
      value: maxValue
    };
  }
  const highestValue = getHighestValue(cleanedData);
  function regroupKeys(data) {
    // delete data[highestValue.key]
    const newData = {
      ...data
    };
    let sum6To10 = 0;
    let sum10Plus = 0;

    // Regroup keys 6 to 10
    for (let i = 6; i <= 10; i++) {
      if (newData.hasOwnProperty(i.toString())) {
        sum6To10 += newData[i];
        delete newData[i];
      }
    }
    newData['6-10'] = sum6To10;

    // Regroup keys 10 and above
    for (const key in newData) {
      if (newData.hasOwnProperty(key) && parseInt(key) >= 10) {
        sum10Plus += newData[key];
        delete newData[key];
      }
    }
    newData['10+'] = sum10Plus;
    return newData;
  }
  const updatedData = regroupKeys(cleanedData);
  function calculateDiametre(aire) {
    return Math.sqrt(aire / Math.PI * 2) * width;
  }
  const aire = highestValue.value;
  function calculatePosition(i) {
    const angle = i / (Object.keys(updatedData).length - 1) * 2 * Math.PI;
    const x = position.x + calculateDiametre(aire) / 2 * Math.cos(angle);
    const y = position.y + calculateDiametre(aire) / 2 * Math.sin(angle);
    return {
      x: x,
      y: y
    };
  }
  const tooltipContent = "Holder has ".concat(highestValue.key, " token").concat(highestValue.key === '1' ? '' : 's');
  const percentage = Math.round(highestValue.value / total * 100);
  const diameter = calculateDiametre(aire);
  const bigBubbleStyle = {
    backgroundColor: primaryColor,
    width: diameter,
    height: diameter,
    borderRadius: '50%',
    position: 'absolute',
    top: position.y - diameter / 2,
    left: position.x - diameter / 2,
    display: 'flex',
    fontSize: Math.sqrt(diameter) * 3,
    border: '1px solid #72A1FD',
    justifyContent: 'center',
    alignItems: 'center',
    cursor: 'pointer',
    color: 'black'
  };
  const createBiggerBubbleStyle = diameter => ({
    backgroundColor: 'transparent',
    width: diameter + 10,
    height: diameter + 10,
    borderRadius: '50%',
    position: 'absolute',
    border: "1px solid ".concat(secondaryColor),
    pointerEvents: 'none',
    zIndex: 0
  });
  const tooltipStyle = {
    position: 'absolute',
    backgroundColor: 'white',
    padding: '10px',
    width: '220px',
    height: 'autp',
    border: '1px solid #E0E0E0',
    color: 'black',
    top: "50%",
    left: "50%",
    zIndex: 1,
    fontSize: '12px'
  };
  const squareStyle = {
    backgroundColor: "#BFD4FE",
    border: '1px solid #72A1FD',
    paddingRight: '17px'
  };
  const createSmallBubble = (aire, diameter, position, key) => {
    const biggerBubble = createBiggerBubbleStyle(diameter);
    return /*#__PURE__*/_react.default.createElement("div", {
      style: {
        backgroundColor: primaryColor,
        width: diameter,
        height: diameter,
        borderRadius: '50%',
        position: 'absolute',
        top: position.y - diameter / 2,
        left: position.x - diameter / 2,
        display: 'flex',
        fontSize: Math.sqrt(diameter) * 3,
        border: '1px solid #72A1FD',
        justifyContent: 'center',
        alignItems: 'center',
        cursor: 'pointer',
        color: 'black'
      },
      onMouseEnter: () => {
        setHoveredBubble(key);
      },
      onMouseLeave: () => {
        setHoveredBubble(null);
      }
    }, key, hoveredBubble === key && /*#__PURE__*/_react.default.createElement("div", {
      style: biggerBubble
    }), hoveredBubble === key && /*#__PURE__*/_react.default.createElement("p", {
      style: tooltipStyle
    }, /*#__PURE__*/_react.default.createElement("b", null, "Holder has ".concat(key, " tokens")), /*#__PURE__*/_react.default.createElement("br", null), /*#__PURE__*/_react.default.createElement("hr", {
      style: {
        borderTop: '1px solid #E0E0E0',
        margin: '10px 0'
      }
    }), /*#__PURE__*/_react.default.createElement("span", {
      style: squareStyle
    }, "\xA0"), "\xA0 ", collectionName, " : ", aire, " holders (", Math.round(aire / total * 100), "%)"));
  };
  return /*#__PURE__*/_react.default.createElement("div", null, /*#__PURE__*/_react.default.createElement("div", {
    style: bigBubbleStyle,
    onMouseEnter: () => {
      setHoveredBubble(highestValue.key);
    },
    onMouseLeave: () => {
      setHoveredBubble(null);
    }
  }, highestValue.key, hoveredBubble === highestValue.key && /*#__PURE__*/_react.default.createElement("div", {
    style: createBiggerBubbleStyle(diameter)
  }), hoveredBubble === highestValue.key && /*#__PURE__*/_react.default.createElement("p", {
    style: tooltipStyle
  }, /*#__PURE__*/_react.default.createElement("b", null, tooltipContent), /*#__PURE__*/_react.default.createElement("br", null), /*#__PURE__*/_react.default.createElement("hr", {
    style: {
      borderTop: '1px solid #E0E0E0',
      margin: '10px 0'
    }
  }), /*#__PURE__*/_react.default.createElement("span", {
    style: squareStyle
  }, "\xA0"), "\xA0 ", collectionName, " : ", highestValue.value, " holders (", percentage, "%)")), Object.entries(updatedData).map((_ref2, index) => {
    let [key, aire] = _ref2;
    return key !== highestValue.key ? createSmallBubble(aire, calculateDiametre(aire), calculatePosition(index), key) : null;
  }));
}
;
