// components/EegRawCardContent.tsx
import React, { useState } from "react";
import { scaleLinear } from "@visx/scale";
import { Group } from "@visx/group";
import { LinePath } from "@visx/shape";
import { AxisLeft, AxisBottom } from "@visx/axis";
import { curveMonotoneX } from "@visx/curve";

import { VisualizationContentProps } from '../CardWrapper';

/**
 * @file EegRawCardContent.tsx
 * @description This component renders the raw EEG signal data as a line chart.
 * It supports displaying all channels simultaneously or focusing on a single selected channel.
 * The chart features dynamic scaling and a sliding time window.
 */

/**
 * Interface for a single EEG channel data point.
 */
interface EegChannelPoint {
  x: number;     // Time in seconds.
  value: number; // Signal value.
}

/**
 * Interface defining the props for the EegRawCardContent component,
 * extending common visualization properties.
 */
interface EegRawContentProps extends VisualizationContentProps {
  data: { [key: string]: EegChannelPoint[] }; // Raw EEG data, organized by channel key.
  unit?: string;                             // Optional unit for EEG data (defaults to µV).
  selectedChannelKey?: string;               // Optional key of a specific channel to display.
  // cardWidth and cardHeight are inherited from VisualizationContentProps.
}

/**
 * EegRawCardContent functional component.
 * Displays raw EEG data as a line chart, with options to view all channels or a single one.
 * @param {EegRawContentProps} props - The properties passed to the component.
 * @returns {JSX.Element} The raw EEG chart visualization JSX.
 */
const EegRawCardContent: React.FC<EegRawContentProps> = ({
  data,
  unit = "µV",
  cardWidth = 300,  // Default width if not provided.
  cardHeight = 100, // Default height if not provided.
  selectedChannelKey, // Receives the selected channel key.
}) => {
  // Generate a unique ID for the clipPath to prevent collisions.
  const [clipId] = useState(() => `eeg-raw-clip-${Math.random().toString(36).substr(2, 9)}`);

  // Define margins for the chart within the SVG area.
  const margin = { top: 15, right: 30, bottom: 40, left: 40 };

  // Filter data based on the selected channel key.
  // If `selectedChannelKey` is undefined, display all channels; otherwise, display only the selected one.
  const channelsToDisplay = selectedChannelKey
    ? { [selectedChannelKey]: data[selectedChannelKey] || [] }
    : data;

  // Gather all Y-values from the channels to display to determine the Y-axis domain.
  const allYValues: number[] = [];
  Object.values(channelsToDisplay).forEach(channelData => {
    channelData.forEach(point => allYValues.push(point.value));
  });

  // Gather all X-values (timestamps) from the channels to display to determine the X-axis domain.
  const allXValues: number[] = [];
  Object.values(channelsToDisplay).forEach(channelData => {
    channelData.forEach(point => allXValues.push(point.x));
  });

  // --- X-axis (Time) Domain Logic ---
  let maxTime: number = 0;
  let minTime: number = 0;
  const windowDuration = 1; // 1-second fixed visualization window.

  if (allXValues.length > 0) {
    maxTime = Math.max(...allXValues);
    minTime = maxTime - windowDuration;

    // Ensure minTime is not less than the earliest data point's time.
    if (minTime < Math.min(...allXValues)) {
      minTime = Math.min(...allXValues);
    }
  } else {
    // Default values if no data is available.
    maxTime = 1;
    minTime = 0;
  }

  /**
   * X-axis scale using `scaleLinear`.
   * Maps time values (seconds) to pixel positions on the chart.
   */
  const xScale = scaleLinear({
    domain: [minTime, maxTime],
    range: [margin.left, cardWidth - margin.right],
  });

  // --- Y-axis (Signal Value) Domain Logic ---
  let yMinData = 0;
  let yMaxData = 0;

  if (allYValues.length > 0) {
    yMinData = Math.min(...allYValues);
    yMaxData = Math.max(...allYValues);
  } else {
    // Default values if no data is available.
    yMinData = -1;
    yMaxData = 1;
  }

  // EEG is typically bipolar, centered around zero.
  const absMaxData = Math.max(Math.abs(yMinData), Math.abs(yMaxData));
  // Add 10% padding based on the absolute maximum value, with a minimum of 1 to prevent
  // division by zero or very small ranges when data is flat.
  const dynamicYPadding = absMaxData * 0.1 || 1;

  let domainYMin: number;
  let domainYMax: number;

  // Ensure the domain is symmetric around zero and includes padding.
  domainYMin = -absMaxData - dynamicYPadding;
  domainYMax = absMaxData + dynamicYPadding;

  // If `absMaxData` is 0 (all values are 0), ensure a minimum symmetric domain.
  if (absMaxData === 0) {
    domainYMin = -1 - dynamicYPadding;
    domainYMax = 1 + dynamicYPadding;
  }

  /**
   * Y-axis scale using `scaleLinear`.
   * Maps signal values to pixel positions on the chart.
   */
  const yScale = scaleLinear({
    domain: [domainYMin, domainYMax],
    range: [cardHeight - margin.bottom, margin.top], // Inverted for SVG coordinates.
    nice: true, // Extends domain to nice round numbers.
  });

  /**
   * Formats a numeric value to two decimal places for display.
   * @param value The number to format.
   * @returns {string} The formatted string.
   */
  const getDisplayPrecision = (value: number) => value.toFixed(2);

  // Colors for different EEG channels.
  const channelColors = {
    ch0: "#e74c3c", // Red
    ch1: "#27ae60", // Green
    ch2: "#3498db", // Blue
    ch3: "#f39c12", // Orange
    // Add more colors for additional channels as needed.
  };

  // Define the dimensions of the plotting area for the clipPath.
  const plotX = margin.left;
  const plotY = margin.top;
  const plotWidth = cardWidth - margin.left - margin.right;
  const plotHeight = cardHeight - margin.top - margin.bottom;

  return (
    <div className="w-full h-full flex flex-col justify-center items-center">
      <svg width={cardWidth} height={cardHeight}>
        {/* Define a unique clipPath to ensure lines do not extend beyond the plot area. */}
        <defs>
          <clipPath id={clipId}>
            <rect
              x={plotX}
              y={plotY}
              width={plotWidth}
              height={plotHeight}
            />
          </clipPath>
        </defs>

        <Group>
          {/* X-axis (bottom) */}
          <AxisBottom
            scale={xScale}
            top={cardHeight - margin.bottom}
            tickFormat={(v) => `${Number(v).toFixed(0)}s`} // Format x-axis ticks as seconds.
            numTicks={5}
            stroke="#ccc"
            tickLabelProps={() => ({
              fill: "#666",
              fontSize: 10,
              textAnchor: "middle",
            })}
          />
          {/* Y-axis (left) */}
          <AxisLeft
            scale={yScale}
            left={margin.left}
            tickFormat={(v) => getDisplayPrecision(Number(v))} // Format y-axis ticks with precision.
            numTicks={4}
            stroke="#ccc"
            tickLabelProps={() => ({
              fill: "#666",
              fontSize: 10,
              textAnchor: "end",
            })}
          />

          {/* Horizontal grid lines */}
          {yScale.ticks(4).map((tick, i) => (
            <line
              key={`grid-line-y-${i}`}
              x1={margin.left}
              y1={yScale(tick)}
              x2={cardWidth - margin.right}
              y2={yScale(tick)}
              stroke="#eee"
              strokeDasharray="4,4"
              strokeWidth={1}
            />
          ))}

          {/* Render LinePaths for each channel to display */}
          {Object.entries(channelsToDisplay).map(([channelName, channelData]) => (
            <LinePath
              key={`eeg-line-${channelName}`}
              data={channelData}
              x={(d) => xScale(d.x)}
              y={(d) => yScale(d.value)}
              stroke={channelColors[channelName as keyof typeof channelColors] || "#95a5a6"} // Use specific channel color or default.
              strokeWidth={1.5}
              curve={curveMonotoneX} // Smooth curve for the line.
              clipPath={`url(#${clipId})`} // Apply the clipPath.
            />
          ))}

          {/* Optional: Add circles for the last point of each channel */}
          {Object.entries(channelsToDisplay).map(([channelName, channelData]) => {
            if (channelData.length > 0) {
              const lastPoint = channelData[channelData.length - 1];
              return (
                <circle
                  key={`eeg-last-point-${channelName}`}
                  cx={xScale(lastPoint.x)}
                  cy={yScale(lastPoint.value)}
                  r={3}
                  fill={channelColors[channelName as keyof typeof channelColors] || "#95a5a6"}
                  opacity={0.8}
                  clipPath={`url(#${clipId})`} // Apply the clipPath for consistency.
                />
              );
            }
            return null;
          })}
        </Group>
      </svg>
    </div>
  );
};

export default EegRawCardContent;