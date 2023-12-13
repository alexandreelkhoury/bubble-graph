import React, { useState } from 'react';
import PropTypes from 'prop-types';

const Bubble = ({ content, color, diameter, position, value, collectionName, total }) => {

  const [isTooltipVisible, setTooltipVisible] = useState(false);
  const [isBiggerBubbleVisible, setBiggerBubbleVisible] = useState(false);

  const tooltipContent = `Holder has ${content} token${content === '1' ? '' : 's'}`;
  const percentage = Math.round((value / total) * 100);

  const bubbleStyle = {
    backgroundColor: color,
    width: diameter,
    height: diameter,
    borderRadius: '50%',
    position: 'absolute',
    top: position.y - diameter / 2,
    left: position.x - diameter / 2,
    display: 'flex',
    fontSize: Math.sqrt(diameter)*3,
    border : '1px solid #72A1FD',
    justifyContent: 'center',
    alignItems: 'center',
    cursor: 'pointer',
    color: 'black',
  };

  const tooltipStyle = {
    position: 'absolute',
    backgroundColor: 'white',
    padding: '10px',
    width: '200px',
    height: 'autp',
    border: '1px solid #E0E0E0',
    color: 'black',
    top: `50%`,
    left: `50%`,
    display: isTooltipVisible ? 'block' : 'none',
    zIndex: 1,
    fontSize: '12px',
  };

  const squareStyle = {
    backgroundColor: "#BFD4FE",
    border : '1px solid #72A1FD',
    paddingRight: '17px',
  };

  const biggerBubbleStyle = {
    backgroundColor: 'transparent',
    width: diameter + 10,
    height: diameter + 10,
    borderRadius: '50%',
    position: 'absolute',
    border: '1px solid #72A1FD',
    pointerEvents: 'none',
    zIndex: 0,
    display: isBiggerBubbleVisible ? 'block' : 'none',
  };

  return (
    <div style={bubbleStyle}
      onMouseEnter={() => {
        setBiggerBubbleVisible(true);
        setTooltipVisible(true);
      }}
      onMouseLeave={() => {
        setBiggerBubbleVisible(false);
        setTooltipVisible(false);
      }}
    >
      {content}
      <div style={biggerBubbleStyle}></div>
      <p style={tooltipStyle}>
      <b>{tooltipContent}</b>
        <br />
        <hr style={{ borderTop: '1px solid #E0E0E0', margin: '10px 0' }} />
        <span style={squareStyle}>&nbsp;</span>
        &nbsp; {collectionName} : {value} holders ({percentage}%)
      </p>
    </div>
  );
};

Bubble.propTypes = {
  content: PropTypes.string.isRequired,
  color: PropTypes.string.isRequired,
  collectionName: PropTypes.string.isRequired,
  diameter: PropTypes.number.isRequired,
  position: PropTypes.shape({
    x: PropTypes.number.isRequired,
    y: PropTypes.number.isRequired,
  }).isRequired,
};

export default Bubble;