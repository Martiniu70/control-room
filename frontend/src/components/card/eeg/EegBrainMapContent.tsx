// components/EegBrainMapContent.tsx
import React from 'react';

/**
 * @file EegBrainMapContent.tsx
 * @description This component visualizes EEG brain activity on a simplified brain map.
 * It displays "foci" (circles) at predefined brain regions, with their size and
 * intensity (opacity) reflecting the amplitude of the EEG signal in that channel.
 */

/**
 * Interface for a single EEG channel data point.
 */
interface EegChannelPoint {
  x: number;     // Time in seconds.
  value: number; // Signal value.
}

/**
 * Interface defining the props for the EegBrainMapContent component.
 */
interface EegBrainMapContentProps {
  data: { [key: string]: EegChannelPoint[] }; // EEG data, organized by channel key.
  cardWidth?: number;                         // Optional width of the card.
  cardHeight?: number;                        // Optional height of the card.
  selectedChannelKey?: string;                // Optional key of a specific channel to highlight/display.
}

/**
 * EegBrainMapContent functional component.
 * Renders an SVG representation of a brain map with dynamic circles
 * indicating EEG activity.
 * @param {EegBrainMapContentProps} props - The properties passed to the component.
 * @returns {JSX.Element} The EEG brain map visualization JSX.
 */
const EegBrainMapContent: React.FC<EegBrainMapContentProps> = ({
  data,
  cardWidth = 300,
  cardHeight = 100,
  selectedChannelKey, // Receives the selected channel key.
}) => {
  /**
   * Defines approximate coordinates for brain foci on a normalized 0-100 viewBox.
   * These positions are adjusted for the brain's scale and translation within the SVG.
   */
  const brainFociPositions = {
    ch0: { x: 39.5, y: 29, label: "Córtex Pré-frontal Esquerdo" },
    ch1: { x: 60.5, y: 29, label: "Córtex Pré-frontal Direito" },
    ch2: { x: 32.5, y: 60.5, label: "Área Auditória/Linguística" },
    ch3: { x: 67.5, y: 60.5, label: "Área Auditória/Visual" },
  };

  // Find the maximum absolute value across all channels for normalization of circle radius.
  let maxOverallValue = 0;
  Object.values(data).forEach(channelData => {
    if (channelData.length > 0) {
      const channelMax = Math.max(...channelData.map(p => Math.abs(p.value)));
      if (channelMax > maxOverallValue) {
        maxOverallValue = channelMax;
      }
    }
  });

  /**
   * Maps signal intensity to the radius of the circle.
   * Ensures a minimum radius for visibility and scales up to a maximum radius.
   * @param value The signal value.
   * @returns {number} The calculated radius.
   */
  const getRadius = (value: number) => {
    if (maxOverallValue === 0) return 0; // Avoid division by zero.
    const minRadius = 3;
    const maxRadius = 25;
    const normalizedValue = Math.abs(value) / maxOverallValue;
    return minRadius + (maxRadius - minRadius) * normalizedValue;
  };

  /**
   * Maps signal intensity to the peak opacity of the radial gradient.
   * This creates a "glowing" effect where stronger signals are more opaque.
   * @param value The signal value.
   * @returns {number} The calculated peak opacity (0.0 to 1.0).
   */
  const getGradientPeakOpacity = (value: number) => {
    if (maxOverallValue === 0) return 0;
    const normalizedValue = Math.abs(value) / maxOverallValue;
    return 0.5 + 0.5 * normalizedValue; // Opacity ranges from 50% to 100% at peak.
  };

  // Base colors for each EEG channel.
  const channelColors = {
    ch0: "#e74c3c", // Red
    ch1: "#27ae60", // Green
    ch2: "#3498db", // Blue
    ch3: "#f39c12", // Orange
  };

  /**
   * Enhanced SVG path for the brain outline.
   * This path creates a shape that tapers at the front and is wider/rounder at the back.
   */
  const brainOutlinePath = `
    M 50,5
    C 15,0 10,20 5,50
    C 0,80 20,100 50,95
    C 80,100 100,80 95,50
    C 90,20 85,0 50,5 Z
  `;
  // Central fissure path, adapted to the new brain shape.
  const centralFissurePath = `M 50,5 C 48,20 48,80 50,95`;

  // Scale and translation factors for the brain SVG.
  const scaleFactor = 0.7; // Reduce brain size to 70%.
  const translateX = (100 - 100 * scaleFactor) / 2; // Center horizontally.
  const translateY = (100 - 100 * scaleFactor) / 2; // Center vertically.


  return (
    <div className="w-full h-full flex flex-col items-center justify-center">
      <svg
        width={cardWidth}
        height={cardHeight}
        viewBox="0 0 100 100" // ViewBox for the brain drawing.
        preserveAspectRatio="xMidYMid meet" // Maintain aspect ratio and center.
        className="bg-gray-50 rounded-md border border-gray-300"
      >
        {/* Definitions for radial gradients used for the "foci" circles. */}
        <defs>
          {Object.keys(channelColors).map(channelKey => {
            const color = channelColors[channelKey as keyof typeof channelColors];
            // Get the last value of the channel to determine the peak opacity of the gradient.
            const channelData = data[channelKey];
            const lastValue = channelData && channelData.length > 0
              ? channelData[channelData.length - 1].value
              : 0;
            const peakOpacity = getGradientPeakOpacity(lastValue);

            return (
              <radialGradient
                key={`gradient-${channelKey}`}
                id={`gradient-${channelKey}`}
                cx="50%" cy="50%" r="50%" fx="50%" fy="50%"
              >
                <stop offset="0%" stopColor={color} stopOpacity={peakOpacity} />
                <stop offset="100%" stopColor={color} stopOpacity="0" />
              </radialGradient>
            );
          })}
        </defs>

        {/* Group to apply scale and translation transformations to the brain outline. */}
        <g transform={`scale(${scaleFactor}) translate(${translateX / scaleFactor}, ${translateY / scaleFactor})`}>
          {/* Brain outline path */}
          <path
            d={brainOutlinePath}
            fill="#dcdcdc" // Background color of the brain.
            stroke="#a0a0a0" // Outline stroke color.
            strokeWidth="1"
          />

          {/* Central fissure path */}
          <path
            d={centralFissurePath}
            fill="none"
            stroke="#a0a0a0"
            strokeWidth="1.5"
          />
        </g>

        {/* Intensity foci for each channel (rendered outside the group to maintain size). */}
        {Object.entries(brainFociPositions).map(([channelKey, pos]) => {
          // Logic to only show the selected channel if one is specified.
          if (selectedChannelKey && selectedChannelKey !== channelKey) {
            return null; // Don't render if a specific channel is selected and this is not it.
          }

          const channelData = data[channelKey];
          const lastValue = channelData && channelData.length > 0
            ? channelData[channelData.length - 1].value
            : 0; // Last value of the channel or 0 if no data.

          const radius = getRadius(lastValue);

          return (
            <circle
              key={channelKey}
              cx={pos.x}
              cy={pos.y}
              r={radius}
              fill={`url(#gradient-${channelKey})`} // Apply the radial gradient as fill.
              className="transition-all duration-300 ease-out" // Smooth animation for changes.
            >
              {/* Basic tooltip on hover */}
              <title>{`${pos.label}: ${lastValue.toFixed(2)} ${data.unit || 'µV'}`}</title>
            </circle>
          );
        })}
      </svg>
    </div>
  );
};

export default EegBrainMapContent;