// src/components/card/face_landmarks/FaceLandmarksCardContent.tsx
import React from 'react';
import { VisualizationContentProps } from '../CardWrapper';

/**
 * @file FaceLandmarksCardContent.tsx
 * @description This component renders the visualization content for Face Landmarks data.
 * It displays facial landmarks as a series of small circles on an SVG canvas,
 * representing the detected points on a face.
 */

/**
 * Interface for Face Landmarks data.
 */
interface FaceLandmarksData {
  landmarks: number[][]; // Array of [x, y, z] normalized points (0 to 1).
  gaze_vector: { dx: number; dy: number }; // Gaze direction vector.
  ear: number;           // Eye Aspect Ratio.
  blink_rate: number;    // Blink rate.
  blink_counter: number; // Blink counter.
  frame_b64: string;     // Base64 encoded image frame.
  timestamp: number;     // Timestamp of the data.
}

/**
 * Interface defining the props for the FaceLandmarksContent component,
 * extending common visualization properties.
 */
interface FaceLandmarksContentProps extends VisualizationContentProps {
  data: FaceLandmarksData; // Face landmarks data.
  // cardWidth and cardHeight are inherited from VisualizationContentProps.
}

/**
 * FaceLandmarksCardContent functional component.
 * Displays facial landmarks as an SVG overlay of points.
 * @param {FaceLandmarksContentProps} props - The properties passed to the component.
 * @returns {JSX.Element} The face landmarks visualization JSX.
 */
const FaceLandmarksCardContent: React.FC<FaceLandmarksContentProps> = ({
  data,
  cardWidth = 300,  // Default width if not provided.
  cardHeight = 100, // Default height if not provided.
}) => {
  const {
    landmarks,
    // `gaze_vector`, `ear`, `blink_rate`, `blink_counter`, `timestamp` are for `detailsContent`
    // and are not directly used in this SVG visualization.
    // `frame_b64` is also removed from this SVG visualization to focus on points.
  } = data;

  // Define margins for the SVG to provide space.
  const svgMarginTop = 5;
  const svgMarginBottom = 5;
  const svgMarginLeft = 5;
  const svgMarginRight = 5;

  // Calculate the effective width and height for the SVG drawing area.
  const svgWidth = cardWidth - svgMarginLeft - svgMarginRight;
  const svgHeight = cardHeight - svgMarginTop - svgMarginBottom;

  /**
   * Scales for mapping normalized landmark coordinates (0-1) to SVG pixel dimensions.
   * @param val The normalized coordinate value.
   * @returns {number} The scaled pixel value.
   */
  const xScale = (val: number) => val * svgWidth;
  const yScale = (val: number) => val * svgHeight;

  return (
    <div className="flex flex-col items-center justify-center w-full h-full p-2">
      <div className="relative flex-1 w-full flex items-center justify-center bg-gray-50 rounded-md overflow-hidden">
        {landmarks && landmarks.length > 0 ? (
          <svg
            width={svgWidth}
            height={svgHeight}
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            className="border border-gray-300 rounded-md"
          >
            {/* Draw each landmark as a small circle */}
            {landmarks.map((point, index) => {
              // Ignore the Z-coordinate for 2D visualization.
              const [x, y] = point;
              // The condition `index < 163` is to draw a subset of points if desired.
              // To draw all points, remove this condition.
              if (index < 163) {
                return (
                  <circle
                    key={index}
                    cx={xScale(x)}
                    cy={yScale(y)}
                    r={1.5} // Small radius for the points.
                    fill="#e74c3c" // Red color for the points.
                    opacity={0.7}
                    // Add transition for smooth movement of points.
                    style={{ transition: 'cx 0.1s linear, cy 0.1s linear' }}
                  />
                );
              }
              return null; // Return null for points not rendered.
            })}
            {/* Optional: Draw a circle at the approximate center of the face */}
            {landmarks.length > 0 && (
              <circle
                cx={xScale(landmarks[90][0])} // Using landmark 90 as a center reference.
                cy={yScale(landmarks[90][1])}
                r={3}
                fill="#3498db" // Blue color for the center point.
                opacity={0.9}
                // Add transition for smooth movement of the center point.
                style={{ transition: 'cx 0.1s linear, cy 0.1s linear' }}
              />
            )}
          </svg>
        ) : (
          <p className="text-gray-500">A aguardar pontos de landmarks...</p>
        )}
      </div>
    </div>
  );
};

export default FaceLandmarksCardContent;