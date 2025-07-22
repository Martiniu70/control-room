// src/components/card/alcohol_level/AlcoholLevelCardContent.tsx
import React, { useMemo } from 'react';
import { VisualizationContentProps } from '../CardWrapper';
import { getCardConfigBySignalName } from '../../../config/cardConfig';

/**
 * @file AlcoholLevelCardContent.tsx
 * @description This component renders the visualization content for Alcohol Level data.
 * It displays the current alcohol level as a large number and a progress bar,
 * with color coding based on the level's severity.
 */

/**
 * Interface for Alcohol Level data.
 */
interface AlcoholLevelData {
  alcohol_level: number; // The alcohol level value (e.g., 0.3).
}

/**
 * Interface defining the props for the AlcoholLevelCardContent component,
 * extending common visualization properties.
 */
interface AlcoholLevelCardContentProps extends VisualizationContentProps {
  data: AlcoholLevelData; // Alcohol level data.
  // cardWidth and cardHeight are inherited from VisualizationContentProps.
  unit?: string;         // Optional unit of measurement (e.g., '‰').
  color?: string;        // Optional color for the visualization.
}

/**
 * AlcoholLevelCardContent functional component.
 * Displays the alcohol level with a numeric value and a color-coded progress bar.
 * @param {AlcoholLevelCardContentProps} props - The properties passed to the component.
 * @returns {JSX.Element} The alcohol level visualization JSX.
 */
const AlcoholLevelCardContent: React.FC<AlcoholLevelCardContentProps> = ({
  data,
  cardWidth = 300,
  cardHeight = 100,
  unit = getCardConfigBySignalName("alcohol_level")?.unit, // Get default unit from config.
  color = '#2ecc71', // Default green color.
}) => {
  // Memoized alcohol level value, defaulting to 0 if data is not available.
  const alcoholLevel = useMemo(() => data?.alcohol_level ?? 0, [data]);

  /**
   * Normalizes the alcohol level to a value between 0 and 1 for the progress bar.
   * Assumes a reasonable upper limit for the bar (e.g., 3.0 ‰).
   */
  const normalizedLevel = Math.min(1, Math.max(0, alcoholLevel / 3.0));
  const progressBarWidth = normalizedLevel * 100; // Calculate width as a percentage.

  /**
   * Memoized calculation of the progress bar color based on the alcohol level.
   * Provides visual feedback for different severity levels.
   */
  const progressBarColor = useMemo(() => {
    if (alcoholLevel >= 0.8) return '#e74c3c'; // Red for very high levels.
    if (alcoholLevel >= 0.5) return '#f39c12'; // Orange for high levels.
    return color; // Default color (green) for low/moderate levels.
  }, [alcoholLevel, color]);

  return (
    <div className="flex flex-col items-center justify-center w-full h-full p-4">
      {/* Current alcohol level display */}
      <div className="text-center mb-4">
        <p className="text-4xl font-bold" style={{ color: progressBarColor }}>
          {alcoholLevel.toFixed(2)} {unit}
        </p>
        <p className="text-sm text-gray-600">Nível de Álcool Atual</p>
      </div>

      {/* Progress bar for alcohol level */}
      <div className="w-full bg-gray-200 rounded-full h-4 relative overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{
            width: `${progressBarWidth}%`,
            backgroundColor: progressBarColor,
          }}
        ></div>
        {/* Optional limit markers on the progress bar */}
        <div className="absolute top-0 left-1/2 h-full border-l border-gray-400" style={{ transform: 'translateX(-50%)' }}></div>
      </div>
      {/* Labels for the progress bar limits */}
      <div className="flex justify-between w-full text-xs text-gray-500 mt-1">
        <span>0.0</span>
        <span>3.0</span>
      </div>
    </div>
  );
};

export default AlcoholLevelCardContent;