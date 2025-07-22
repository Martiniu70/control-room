// src/components/card/accelerometer/AccCardContent.tsx
import React, { useMemo } from 'react';
import { VisualizationContentProps } from '../CardWrapper';

/**
 * @file AccCardContent.tsx
 * @description This component renders the visualization content for Accelerometer data.
 * It displays a 2D representation of X and Z axis acceleration as a vector
 * on an SVG canvas with reference axes.
 */

/**
 * Interface for single Accelerometer data point (non-array values).
 */
interface AccelerometerData {
  x: number;       // X-axis acceleration value.
  y: number;       // Y-axis acceleration value.
  z: number;       // Z-axis acceleration value.
  timestamp: number; // Timestamp of the data point.
}

/**
 * Interface defining the props for the AccCardContent component,
 * extending common visualization properties.
 */
interface AccCardContentProps extends VisualizationContentProps {
  data: AccelerometerData | null; // Accelerometer data (x, y, z as numbers).
  unit?: string;                 // Unit of acceleration.
  color?: string;                // Color for the acceleration vector.
}

/**
 * AccCardContent functional component.
 * Renders an SVG visualization of accelerometer data, showing X and Z acceleration
 * as a vector with a directional arrow.
 * @param {AccCardContentProps} props - The properties passed to the component.
 * @returns {JSX.Element} The accelerometer content visualization JSX.
 */
const AccCardContent: React.FC<AccCardContentProps> = ({
  data,
  unit = "m/s²",
  color = "#e74c3c", // Default color for the vector (red).
  cardWidth = 300,   // Default width if not provided by CardWrapper.
  cardHeight = 100,  // Default height if not provided by CardWrapper.
}) => {
  // Calculate the center of the visualization area.
  const centerX = cardWidth / 2;
  const centerY = cardHeight / 2;

  // Get X, Y, and Z values from data, defaulting to 0 if null or undefined.
  const currentX = data?.x || 0;
  const currentZ = data?.z || 0;
  // currentY is obtained but not used in this 2D XZ visualization.
  const currentY = data?.y || 0;

  /**
   * Memoized scale factor to map accelerometer values to the SVG size.
   * Ensures the vector fits within the visualization area.
   */
  const scaleFactor = useMemo(() => Math.min(cardWidth, cardHeight) / 40, [cardWidth, cardHeight]);

  // Calculate the end point of the XZ acceleration vector.
  const endX = centerX + currentX * scaleFactor;
  // Subtract from centerY because positive Z should go upwards in SVG coordinates (Y-axis is inverted).
  const endY_vector = centerY - currentZ * scaleFactor;

  // Calculate the magnitude of the XZ vector for arrow tip visibility.
  const magnitudeXZ = Math.sqrt(currentX * currentX + currentZ * currentZ);
  // Calculate the angle of the vector for arrow tip orientation.
  const angleRad = Math.atan2(currentZ, currentX);

  return (
    <div className="w-full h-full flex flex-col items-center justify-center">
      <svg width={cardWidth} height={cardHeight} viewBox={`0 0 ${cardWidth} ${cardHeight}`} className="border rounded-md bg-gray-50 relative overflow-hidden">
        {/* Reference lines: X-axis (horizontal) and Z-axis (vertical) */}
        <line x1={0} y1={centerY} x2={cardWidth} y2={centerY} stroke="#ccc" strokeWidth="1" /> {/* X-axis */}
        <line x1={centerX} y1={0} x2={centerX} y2={cardHeight} stroke="#ccc" strokeWidth="1" /> {/* Z-axis */}

        {/* Text markers for the axes */}
        <text x={cardWidth - 15} y={centerY - 5} fontSize="10" fill="#666">X+</text>
        <text x={5} y={centerY - 5} fontSize="10" fill="#666">X-</text>
        <text x={centerX + 5} y={15} fontSize="10" fill="#666">Z+</text>
        <text x={centerX + 5} y={cardHeight - 5} fontSize="10" fill="#666">Z-</text>

        {/* XZ acceleration vector */}
        <line
          x1={centerX}
          y1={centerY}
          x2={endX}
          y2={endY_vector}
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
        />
        {/* Arrow tip (triangle) for the vector */}
        {magnitudeXZ > 0.1 && ( // Only show arrow tip if there's significant movement.
          <polygon
            points={`${endX},${endY_vector}
                     ${endX - 8 * Math.cos(angleRad - Math.PI / 6)},${endY_vector + 8 * Math.sin(angleRad - Math.PI / 6)}
                     ${endX - 8 * Math.cos(angleRad + Math.PI / 6)},${endY_vector + 8 * Math.sin(angleRad + Math.PI / 6)}`}
            fill={color}
          />
        )}
      </svg>
    </div>
  );
};

export default AccCardContent;