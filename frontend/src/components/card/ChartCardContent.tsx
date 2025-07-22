// src/components/card/ChartCardContent.tsx
import React, { useMemo, useCallback, useState } from "react";
import { scaleLinear } from "@visx/scale";
import { Group } from "@visx/group";
import { LinePath } from "@visx/shape";
import { AxisLeft, AxisBottom } from "@visx/axis";
import { curveMonotoneX } from "@visx/curve";

import { VisualizationContentProps } from './CardWrapper';

/**
 * @file ChartCardContent.tsx
 * @description This component renders a real-time line chart using `@visx` for various sensor data.
 * It features dynamic scaling, a sliding time window, and customizable units and colors.
 */

/**
 * Interface for a single data point in the chart.
 */
interface Point {
  x: number;     // Time in seconds.
  value: number; // The value (e.g., HR in bpm).
}

/**
 * Interface defining the props for the ChartCardContent component,
 * extending common visualization properties.
 */
interface ChartContentProps extends VisualizationContentProps {
  data: Point[];    // Array of data points to plot.
  color: string;    // Color of the line path.
  unit?: string;    // Optional unit of measurement for display.
  // cardWidth and cardHeight are inherited from VisualizationContentProps.
}

/**
 * ChartCardContent functional component.
 * Renders a dynamic line chart for time-series data.
 * @param {ChartContentProps} props - The properties passed to the component.
 * @returns {JSX.Element} The chart visualization JSX.
 */
const ChartCardContent: React.FC<ChartContentProps> = ({
  data,
  color,
  unit = "",
  cardWidth = 300,  // Default width if not provided.
  cardHeight = 100, // Default height if not provided.
}) => {
  // Generate a unique ID for the clipPath to prevent collisions when multiple charts are rendered.
  const [clipId] = useState(() => `chart-clip-${Math.random().toString(36).substr(2, 9)}`);

  // Define margins for the chart within the SVG area.
  const margin = { top: 15, right: 30, bottom: 40, left: 40 };

  /**
   * Memoized calculation of the time window duration based on the unit.
   * This allows different signal types to have different default display durations.
   */
  const windowDuration = useMemo(() => {
    switch (unit) {
      case 'bpm':
        return 50; // Heart Rate: 50 seconds window.
      case 'mV':
        return 10; // ECG: 10 seconds window.
      case 'µV':
        return 5;  // EEG: 5 seconds window.
      case 'deg':
        return 10; // Steering/Angle: 10 seconds window.
      case 'km/h':
        return 10; // Speed: 10 seconds window.
      default:
        return 5;  // Default to 5 seconds.
    }
  }, [unit]); // Recalculate if the unit changes.

  /**
   * Memoized calculation of `minTime` and `maxTime` for the sliding time window.
   * Ensures the chart displays the most recent data within the defined `windowDuration`.
   */
  const { minTime, maxTime } = useMemo(() => {
    let currentMaxTime: number = data[data.length - 1]?.x || 0; // Latest timestamp in data.
    let currentMinTime: number = currentMaxTime - windowDuration; // Calculate start of window.

    // Adjust minTime if the data is shorter than the window duration.
    if (data.length > 0 && currentMinTime < data[0].x) {
      currentMinTime = data[0].x;
    }

    // Ensure a minimum time span of 1 second if data is very sparse.
    if ((currentMaxTime - currentMinTime) < 1) {
        currentMinTime = currentMaxTime - 1;
        if (currentMinTime < 0) currentMinTime = 0; // Ensure minTime is not negative.
    }
    return { minTime: currentMinTime, maxTime: currentMaxTime };
  }, [data, windowDuration]); // Recalculate if data or windowDuration changes.

  /**
   * Memoized x-axis scale using `scaleLinear`.
   * Maps time values (seconds) to pixel positions on the chart.
   */
  const xScale = useMemo(() => scaleLinear({
    domain: [minTime, maxTime], // Time domain.
    range: [margin.left, cardWidth - margin.right], // Pixel range.
  }), [minTime, maxTime, cardWidth, margin.left, margin.right]); // Dependencies for xScale.

  /**
   * Memoized array of y-values from the data, used for calculating y-axis domain.
   */
  const yValues = useMemo(() => data.map((d) => d.value), [data]);
  const yMinData = yValues.length > 0 ? Math.min(...yValues) : 0;
  const yMaxData = yValues.length > 0 ? Math.max(...yValues) : 1;

  /**
   * Memoized calculation of the y-axis domain (`domainYMin`, `domainYMax`).
   * Dynamically adjusts padding and ensures appropriate scaling for different units.
   */
  const { domainYMin, domainYMax } = useMemo(() => {
    const dataAmplitude = yMaxData - yMinData;
    const dynamicYPadding = dataAmplitude * 0.1 || 1; // 10% padding or minimum 1 unit.

    let currentDomainYMin: number;
    let currentDomainYMax: number;

    // Specific scaling logic based on unit type.
    if (unit === "bpm" || unit === "deg" || unit === "km/h" || unit === "m/s²") {
      // For positive-only values, start y-axis at 0.
      currentDomainYMin = 0;
      currentDomainYMax = yMaxData + dynamicYPadding;
      if (currentDomainYMax - currentDomainYMin < 2) { // Ensure minimum amplitude.
        currentDomainYMax = currentDomainYMin + 2;
      }
    } else if (unit === "mV" || unit === "µV" || unit === "deg/s") {
      // For values that can be positive or negative, center around 0.
      const absMaxData = Math.max(Math.abs(yMinData), Math.abs(yMaxData));
      currentDomainYMin = -absMaxData - dynamicYPadding;
      currentDomainYMax = absMaxData + dynamicYPadding;
      if (absMaxData === 0) { // Handle case where all values are zero.
        currentDomainYMin = -1 - dynamicYPadding;
        currentDomainYMax = 1 + dynamicYPadding;
      }
    } else {
      // General case: symmetric padding around min/max data.
      currentDomainYMin = yMinData - dynamicYPadding;
      currentDomainYMax = yMaxData + dynamicYPadding;
      if (currentDomainYMax - currentDomainYMin < 2) { // Ensure minimum amplitude.
        const center = (yMinData + yMaxData) / 2;
        currentDomainYMin = center - 1;
        currentDomainYMax = center + 1;
      }
    }
    return { domainYMin: currentDomainYMin, domainYMax: currentDomainYMax };
  }, [unit, yMinData, yMaxData]); // Dependencies for y-axis domain.

  /**
   * Memoized y-axis scale using `scaleLinear`.
   * Maps data values to pixel positions on the chart.
   */
  const yScale = useMemo(() => scaleLinear({
    domain: [domainYMin, domainYMax], // Data domain.
    range: [cardHeight - margin.bottom, margin.top], // Pixel range (inverted for SVG).
    nice: true, // Extends domain to nice round numbers.
  }), [domainYMin, domainYMax, cardHeight, margin.bottom, margin.top]); // Dependencies for yScale.

  /**
   * Memoized function to format tick labels with appropriate precision based on unit.
   */
  const getDisplayPrecision = useCallback((value: number, currentUnit: string) => {
    if(currentUnit === "bpm" || currentUnit === "deg" || currentUnit === "km/h"){
      return value.toFixed(0); // No decimal places for these units.
    }
    return value.toFixed(2); // Two decimal places for others.
  }, []); // No dependencies, as it's a pure function.

  // Define the dimensions of the plotting area for the clipPath.
  const plotX = margin.left;
  const plotY = margin.top;
  const plotWidth = cardWidth - margin.left - margin.right;
  const plotHeight = cardHeight - margin.top - margin.bottom;

  return (
    <div className="w-full h-full flex flex-col justify-center items-center">
      <svg width={cardWidth} height={cardHeight}>
        {/* Define a unique clipPath to ensure the line does not extend beyond the plot area. */}
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
            tickFormat={(v) => getDisplayPrecision(Number(v), unit)} // Format y-axis ticks with precision based on unit.
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
              key = {`grid-line-y-${i}`}
              x1 = {margin.left}
              y1 = {yScale(tick)}
              x2 = {cardWidth - margin.right}
              y2 = {yScale(tick)}
              stroke = "#eee"
              strokeDasharray = "4,4"
              strokeWidth = {1}
            />
          ))}

          {/* Line path for the data */}
          <LinePath
            data={data}
            x={(d) => xScale(d.x)}
            y={(d) => yScale(d.value)}
            stroke={color}
            strokeWidth={2}
            curve={curveMonotoneX} // Smooth curve for the line.
            clipPath={`url(#${clipId})`} // Apply the clipPath to the line.
          />

          {/* Circle at the latest data point */}
          {data.length > 0 && (
            <circle
              cx={xScale(data[data.length - 1].x)}
              cy={yScale(data[data.length - 1].value)}
              r={4}
              fill={color}
              opacity={0.8}
              clipPath={`url(#${clipId})`} // Apply the clipPath to the circle for consistency.
            />
          )}
        </Group>
      </svg>
    </div>
  );
};

export default ChartCardContent;