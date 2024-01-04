# Bubble Chart React Component

Integrate an interactive Bubble Chart into your React application with this versatile React component. The Bubble Chart visually represents data points as bubbles in a two-dimensional space, providing a dynamic and engaging user experience.

## Installation

To utilize this Bubble Chart component in your project, simply install it as a dependency using npm:

### `npm install react-bubble-chart`

## Usage
Import the Bubble component into your React application and incorporate it as follows:

```Javascript
import React from 'react';
import Bubble from 'react-bubble-chart';

const MyBubbleChart = () => {
  // Sample data for the chart
  const data = {
    '1': 20,
    '2': 35,
    '3': 50,
    // Add more data points as needed
  };

  return (
    <div>
      <h2>Bubble Chart Example</h2>
      <Bubble
        primaryColor="#008080"
        secondaryColor="#72A1FD"
        data={data}
        width={600}
      />
    </div>
  );
};

export default MyBubbleChart;
```
## Props

The Bubble component supports the following props:

primaryColor: The primary color of the bubbles.
secondaryColor: The color of the border around the bubbles.
data: An object representing data points for the chart. Each key is a label, and the corresponding value is the size of the bubble.
width (optional): The width of the chart (default is 600 pixels).

## Features

Interactive: Hover over bubbles to display additional information.
Dynamic Sizing: Bubbles are dynamically sized based on the provided data.
Color Customization: Easily customize the colors of the bubbles and borders.

## Advanced Configuration

The Bubble component offers various customization options. Refer to the source code for advanced configurations and fine-tuning.

## Learn More

Explore the underlying logic and calculations in the component by reviewing the code. For additional information on React, check out the React documentation.

## Troubleshooting

If you encounter any issues or have questions, please refer to the troubleshooting guide or create an issue on the GitHub repository.
