// src/components/card/car_info/CarInfoCardContent.tsx
import React, { useMemo } from 'react';
import { VisualizationContentProps } from '../CardWrapper';
import { getCardConfigBySignalName } from '../../../config/cardConfig';

/**
 * @file CarInfoCardContent.tsx
 * @description This component renders the visualization content for Car Information data.
 * It displays the car's current speed and lane centrality with visual indicators.
 */

/**
 * Interface for Car Information data.
 */
interface CarInfoData {
  speed: number;          // Current speed of the car.
  lane_centrality: number; // How centered the car is in its lane (0.0 to 1.0).
  timestamp: number;      // Timestamp of the data point.
}

/**
 * Interface defining the props for the CarInfoCardContent component,
 * extending common visualization properties.
 */
interface CarInfoCardContentProps extends VisualizationContentProps {
  data: CarInfoData; // Car information data.
  // cardWidth and cardHeight are inherited from VisualizationContentProps.
  unit?: string;     // Optional unit for speed (e.g., 'km/h').
  color?: string;    // Optional color for the visualization.
}

/**
 * CarInfoCardContent functional component.
 * Displays car speed and lane centrality with color-coded indicators.
 * @param {CarInfoCardContentProps} props - The properties passed to the component.
 * @returns {JSX.Element} The car information visualization JSX.
 */
const CarInfoCardContent: React.FC<CarInfoCardContentProps> = ({
  data,
  cardWidth = 300,
  cardHeight = 100,
  unit = getCardConfigBySignalName("car_information")?.unit, // Get default unit for speed from config.
  color = '#3498db', // Default blue color.
}) => {
  // Memoized speed and lane centrality values, defaulting to 0 if data is not available.
  const speed = useMemo(() => data?.speed ?? 0, [data]);
  const laneCentrality = useMemo(() => data?.lane_centrality ?? 0, [data]);

  /**
   * Determines the color for the lane centrality indicator based on its value.
   * Provides visual feedback on how centered the car is.
   * @param value The lane centrality value (0.0 to 1.0).
   * @returns {string} A Tailwind CSS color class.
   */
  const getLaneCentralityColor = (value: number) => {
    if (value <= 0.5) return '#e74c3c'; // Red for very off-center.
    if (value <= 0.7) return '#f39c12'; // Orange for slightly off-center.
    return '#2ecc71'; // Green for centralized.
  };

  return (
    <div className="flex flex-col items-center justify-center w-full h-full p-4 space-y-4">
      {/* Current Speed Display */}
      <div className="text-center">
        <p className="text-4xl font-bold" style={{ color: color }}>
          {speed.toFixed(1)} {unit}
        </p>
        <p className="text-sm text-gray-600">Velocidade Atual</p>
      </div>

      {/* Lane Centrality Display */}
      <div className="text-center">
        <p className="text-2xl font-bold" style={{ color: getLaneCentralityColor(laneCentrality) }}>
          {laneCentrality.toFixed(2)}
        </p>
        <p className="text-sm text-gray-600">Centralidade da Faixa</p>
        <div className="w-full bg-gray-200 rounded-full h-2 mt-1 relative">
          <div
            className="h-full rounded-full transition-all duration-300 ease-out"
            style={{
              width: `${laneCentrality * 100}%`,
              backgroundColor: getLaneCentralityColor(laneCentrality),
            }}
          ></div>
          {/* Center indicator line */}
          <div className="absolute top-0 left-1/2 h-full border-l-2 border-gray-500" style={{ transform: 'translateX(-50%)' }}></div>
        </div>
      </div>
    </div>
  );
};

export default CarInfoCardContent;