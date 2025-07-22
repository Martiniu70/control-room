// src/components/card/FaceLandmarksCard.tsx
import React from 'react';
import CardWrapper from '../CardWrapper';
import * as cardConfigs from '../../../config/cardConfig';

/**
 * @file FaceLandmarksCard.tsx
 * @description Wrapper component for displaying Face Landmarks data.
 * This component uses `CardWrapper` to provide a consistent card layout
 * and passes face landmarks-specific data and visualization configurations
 * to its content component.
 */

/**
 * Interface for Face Landmarks data, including normalized points, gaze vector,
 * eye aspect ratio (EAR), blink rate, blink counter, base64 image frame, and timestamp.
 */
interface FaceLandmarksData {
  landmarks: number[][]; // Array of [x, y, z] normalized points (0 to 1).
  gaze_vector: { dx: number; dy: number }; // Gaze direction vector.
  ear: number;           // Eye Aspect Ratio.
  blink_rate: number;    // Blink rate in bpm.
  blink_counter: number; // Total blink count.
  frame_b64: string;     // Base64 encoded image frame.
  timestamp: number;     // Timestamp of the data.
}

/**
 * Interface defining the props for the FaceLandmarksCard component.
 */
interface FaceLandmarksCardProps {
  title: string;                 // Title of the card.
  data: FaceLandmarksData | null; // Face landmarks data to display.
  width?: number;                // Optional width of the card.
  height?: number;               // Optional height of the card.
  onClose?: () => void;          // Callback function to close the card.
}

/**
 * FaceLandmarksCard functional component.
 * Renders a face landmarks data card using `CardWrapper` and `FaceLandmarksContent`.
 * @param {FaceLandmarksCardProps} props - The properties passed to the component.
 * @returns {JSX.Element} The face landmarks card JSX.
 */
const FaceLandmarksCard: React.FC<FaceLandmarksCardProps> = ({
  title,
  data,
  width,
  height,
  onClose,
}) => {
  // The `hasData` condition checks if data exists and if there are landmarks.
  // `frame_b64` is removed from the condition as the current visualization (SVG points) doesn't directly use it.
  const hasData = data !== null && data.landmarks && data.landmarks.length > 0;

  /**
   * Content to be displayed in the details area of the CardWrapper.
   * Shows EAR, Blink Rate, and Timestamp.
   */
  const detailsContent = (
    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-700 w-full max-w-xs">
      <span className="font-semibold">EAR:</span> <span>{data?.ear.toFixed(2) ?? 'N/A'}</span>
      <span className="font-semibold">Blink Rate:</span> <span>{data?.blink_rate.toFixed(1) ?? 'N/A'} bpm</span>
      <span className="font-semibold">Tempo:</span> <span>{data?.timestamp?.toFixed(1) ?? 'N/A'}s</span>
    </div>
  );

  return (
    <CardWrapper
      title={title}
      width={width}
      height={height}
      isLoading={!hasData}
      noDataMessage="A aguardar dados de Pontos Faciais..." // Message displayed when no data.
      detailsContent={detailsContent} // Pass the details content.
      onClose={onClose} // Pass the close function to CardWrapper.
      // Pass the visualizations from `cardConfig.ts` to CardWrapper.
      // CardWrapper will now render `FaceLandmarksCardContent` based on this configuration.
      visualizations={cardConfigs.cardConfigs['faceLandmarks'].visualizations}
      cardData={data} // Pass the raw data to CardWrapper, which will pass it to the visualization.
      visualizationProps={{
          // Add any specific props needed by `FaceLandmarksCardContent` here.
          // Example: color: cardConfigs.cardConfigs['faceLandmarks'].color,
      }}
    >
      {/* `FaceLandmarksCardContent` is no longer a direct child here.
          It will be rendered by `CardWrapper` based on the 'visualizations' configuration. */}
    </CardWrapper>
  );
};

export default FaceLandmarksCard;