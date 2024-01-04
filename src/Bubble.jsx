import React, { useState, useEffect } from 'react';

export function Bubble ({ primaryColor, secondaryColor, data, width }) {

  const [hoveredBubble, setHoveredBubble] = useState(null);
  const [positionBigBubble, setPositionBigBubble] = useState({});

  useEffect(() => {
    const element = document.getElementById('bigBubble');
    if (element) {
      const rect = element.getBoundingClientRect();
      setPositionBigBubble(rect);
    }
  }, []);

  function removeNullValues(obj) {
    for (const key in obj) {
      if (obj.hasOwnProperty(key) && (obj[key] === 0 || obj[key] === undefined || obj[key] <= 0)) {
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

    return { key: maxKey, value: maxValue };
  }

  const highestValue = getHighestValue(cleanedData);

  function regroupKeys(data) {
    const newData = { ...data };
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

    // Regroup keys 10 and above if value is not null
    if (newData.hasOwnProperty('10') && newData['10'] !== null) {
      sum10Plus += newData['10'];
      delete newData['10'];
    }
    for (const key in newData) {
      if (newData.hasOwnProperty(key) && parseInt(key) > 10) {
        sum10Plus += newData[key];
        delete newData[key];
      }
    }
    if (sum10Plus !== 0) {
      newData['10+'] = sum10Plus;
    }

    return newData;
  }

  const updatedData = regroupKeys(cleanedData);

  function calculateDiametre(aire) {
    if(Math.sqrt(aire/Math.PI*2) < 1) {
      return Math.sqrt(aire/Math.PI*2)*width*4;
    } else if ((Math.sqrt(aire/Math.PI*2) < 2) && (Math.sqrt(aire/Math.PI*2) > 1)) {
      return Math.sqrt(aire/Math.PI*2)*width*2;
    } else if (isNaN(aire)){
      return 10;
    } else if (aire == 0) {
      return 0;
    } else {
      return Math.sqrt(aire/Math.PI*2)*width;
    }
  }

  const aire = highestValue.value;

  function calculatePosition(i) {
    const length = (Object.keys(updatedData).length-1 <= 6) ? Object.keys(updatedData).length-1 : 6;
    const angle = (i / length) * 2 * Math.PI;
    const x = (positionBigBubble.bottom - positionBigBubble.top)/2 + calculateDiametre(aire)/2 * Math.cos(angle);
    const y = (positionBigBubble.right - positionBigBubble.left)/2 + calculateDiametre(aire)/2 * Math.sin(angle);
    return {x: x, y: y};
  }

  const tooltipContent = `Holder has ${highestValue.key} token${highestValue.key === '1' ? '' : 's'}`;
  const percentage = ((highestValue.value / total) * 100).toFixed(1);
  const diameter = calculateDiametre(aire);

  const bigBubbleStyle = {
    backgroundColor: primaryColor,
    width: diameter,
    height: diameter,
    position: 'absolute',
    borderRadius: '50%',
    top: 0,
    display: 'flex',
    fontSize: Math.sqrt(diameter)*3,
    left: 0,
    border : '1px solid #72A1FD',
    justifyContent: 'center',
    alignItems: 'center',
    cursor: 'pointer',
    color: 'black',
  };

  const createBiggerBubbleStyle = (diameter) => ({
    backgroundColor: 'transparent',
    width: diameter + 10,
    height: diameter + 10,
    borderRadius: '50%',
    position: 'absolute',
    border: `1px solid ${secondaryColor}`,
    pointerEvents: 'none',
  });

  const tooltipStyle = (top, left) =>  ({
    position: 'absolute',
    backgroundColor: 'white',
    paddingTop: '10px',
    paddingLeft: '10px',
    paddingRight: '10px',
    width: '165px',
    border: '1px solid #E0E0E0',
    color: 'black',
    top: top,
    left: left,
    zIndex: 2,
    fontSize: '12px',
  });

  const squareStyle = {
    backgroundColor: "#BFD4FE",
    border : '1px solid #72A1FD',
    paddingRight: '17px',
  };

  const divParent = {
    position: "relative",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  };

  const createSmallBubble = (aire, diameter, position, key) => {
    const biggerBubble = createBiggerBubbleStyle(diameter);
    const tooltip = tooltipStyle("75%", "50%");

    if ((position.y + 2) < positionBigBubble.width/2) {
     tooltip.left = '-160px';
    }
    if ((position.x + 2) < positionBigBubble.width/2) {
     tooltip.top = '-70px';
    }

    return (
      <div
      key={key}
        style= {{ backgroundColor: primaryColor,
                  width: diameter,
                  height: diameter,
                  position: 'absolute',
                  borderRadius: '50%',
                  top: isNaN(position.x - diameter / 2) ? '0' : position.x - diameter / 2,
                  left: isNaN(position.y - diameter / 2) ? '0' : position.y - diameter / 2,
                  display: isNaN(position.x - diameter / 2) ? 'none' : 'flex',
                  fontSize: key == '6-10' ? Math.sqrt(diameter)*2.4 : Math.sqrt(diameter)*3,
                  border : '1px solid #72A1FD',
                  justifyContent: 'center',
                  alignItems: 'center',
                  cursor: 'pointer',
                  color: 'black'}}
        onMouseEnter={() => {
          setHoveredBubble(key);
        }}
        onMouseLeave={() => {
          setHoveredBubble(null);
        }}
        >
        {key}
        {hoveredBubble === key && <div style={biggerBubble}></div>}
      {hoveredBubble === key &&
      <div style={tooltip}>
        <b>{`Holder has ${key} tokens`}</b>
        <br />
        <hr style={{ borderTop: '1px solid #E0E0E0', margin: '10px 0' }} />
        <p>
          <span style={squareStyle}>&nbsp;</span>
          &nbsp;  {aire} holder{aire === 1 ? '' : 's'} ({((aire / total) * 100).toFixed(1)}%)
          </p>
      </div>}
      </div>
    )
  };

  const tooltipBigBubble =  tooltipStyle("60%", "50%")

  return (
    <div id='divParent' style={divParent}>
      <div style={bigBubbleStyle} id='bigBubble'
        onMouseEnter={() => {
          setHoveredBubble(highestValue.key);
        }}
        onMouseLeave={() => {
          setHoveredBubble(null);
        }}
      >
        {highestValue.key}
        {hoveredBubble === highestValue.key && <div style={createBiggerBubbleStyle(diameter)}></div>}
        {hoveredBubble === highestValue.key &&
        <div style={tooltipBigBubble}>
          <b>{tooltipContent}</b>
          <br />
          <hr style={{ borderTop: '1px solid #E0E0E0', margin: '10px 0' }} />
          <p>
          <span style={squareStyle}>&nbsp;</span>
          &nbsp; {highestValue.value} holders ({percentage}%)
          </p>
        </div>}
      </div>
      {Object.entries(updatedData).map(([key, aire], index) => (
        key !== highestValue.key ? createSmallBubble(aire, calculateDiametre(aire), calculatePosition(index), key) : null
      ))}
    </div>
  );
};

export default Bubble;