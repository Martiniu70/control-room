import React, { useMemo, useEffect, useRef, useState } from 'react';
import { VisualizationContentProps } from '../CardWrapper';

/**
 * @file PulsingHeartRateContent.tsx
 * @description This component renders a pulsing circle visualization for Heart Rate data.
 * The circle's pulse animation speed and scale are dynamically adjusted based on the
 * incoming heart rate value, providing an intuitive visual feedback.
 */

/**
 * Interface for a single data point.
 */
interface Point {
  x: number;
  value: number;
}

/**
 * Interface defining the props for the HeartRatePulsingCircleContent component,
 * extending common visualization properties.
 */
interface HeartRatePulsingCircleContentProps extends VisualizationContentProps {
  data: Point[];    // Heart rate data points.
  color: string;    // Color of the pulsing circle.
  cardWidth?: number;  // Optional width of the card.
  cardHeight?: number; // Optional height of the card.
}

/**
 * HeartRatePulsingCircleContent functional component.
 * Displays a pulsing circle whose animation reflects the heart rate.
 * @param {HeartRatePulsingCircleContentProps} props - The properties passed to the component.
 * @returns {JSX.Element} The pulsing heart rate visualization JSX.
 */
const HeartRatePulsingCircleContent: React.FC<HeartRatePulsingCircleContentProps> = ({
  data,
  color,
  cardWidth = 300,
  cardHeight = 100,
}) => {
  // Memoized latest heart rate value, defaulting to 0 if no data.
  const latestHr = useMemo(() => (data.length > 0 ? data[data.length - 1].value : 0), [data]);

  /**
   * Calculates the animation duration based on heart rate.
   * Higher heart rate means shorter duration (faster pulse).
   * Ensures a minimum duration of 0.3s to prevent excessively fast animations.
   * @param hr The heart rate value.
   * @returns {string} The animation duration as a CSS string (e.g., "1s").
   */
  const getAnimationDuration = (hr: number) => {
    if (hr === 0) return '2s'; // Default duration if HR is 0.
    return `${Math.max(0.3, 60 / hr)}s`; // 60/HR gives seconds per beat.
  };

  /**
   * Calculates the base scale for the pulse animation based on heart rate.
   * Higher heart rate results in a slightly larger pulse scale.
   * @param hr The heart rate value.
   * @returns {number} The base scale factor.
   */
  const getPulseScale = (hr: number) => {
    if (hr === 0) return 1.1; // Default scale if HR is 0.
    return 1.1 + (hr / 200) * 0.2; // Scale increases with HR.
  };

  // State to hold the currently active HR for animation.
  const [activeHr, setActiveHr] = useState(latestHr);
  // State for the base scale of the pulse animation.
  const [baseScale, setBaseScale] = useState(getPulseScale(latestHr));
  // State for the animation duration.
  const [animationDuration, setAnimationDuration] = useState(getAnimationDuration(latestHr));
  // Ref to store a pending HR update, to be applied at the end of an animation cycle.
  const pendingHr = useRef<number | null>(null);
  // Ref for the SVG circle element to attach event listeners.
  const circleRef = useRef<SVGCircleElement>(null);

  /**
   * Effect hook to update `pendingHr` when `latestHr` changes.
   * This prepares the new HR value to be applied smoothly.
   */
  useEffect(() => {
    if (latestHr !== activeHr) {
      pendingHr.current = latestHr;
    }
  }, [latestHr, activeHr]);

  /**
   * Effect hook to apply the pending HR update at the end of an animation iteration.
   * This ensures smooth transitions between different heart rate values.
   */
  useEffect(() => {
    const circle = circleRef.current;
    if (!circle) return;

    // Event handler for `animationiteration` event.
    const handleAnimationIteration = () => {
      // If there's a pending HR update and it's different from the current active HR.
      if (pendingHr.current !== null && pendingHr.current !== activeHr) {
        const newHr = pendingHr.current;
        setActiveHr(newHr);                      // Update active HR.
        setBaseScale(getPulseScale(newHr));      // Update base scale.
        setAnimationDuration(getAnimationDuration(newHr)); // Update animation duration.
        pendingHr.current = null;                // Clear pending HR.
      }
    };

    // Add event listener for animation iteration.
    circle.addEventListener('animationiteration', handleAnimationIteration);
    // Cleanup function to remove the event listener.
    return () => {
      circle.removeEventListener('animationiteration', handleAnimationIteration);
    };
  }, [activeHr]); // Re-run effect when `activeHr` changes.

  /**
   * Memoized calculation of the circle radius, ensuring it scales with card dimensions.
   */
  const circleRadius = useMemo(() => Math.min(cardWidth, cardHeight) / 4, [cardWidth, cardHeight]);

  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
      {/* Inline style block for CSS keyframe animation */}
      <style>
        {`
        @keyframes pulse {
          0% {
            transform: scale(1);
            opacity: 1;
          }
          50% {
            transform: scale(1.1); /* Fixed animation scale */
            opacity: 0.7;
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }

        .heart-pulse-circle {
          animation: pulse ${animationDuration} infinite ease-in-out;
          transform-origin: center center;
          transition: transform 0.3s ease; /* Smooth transition between base scales */
        }
        `}
      </style>
      {/* SVG container for the pulsing circle */}
      <svg width={cardWidth} height={cardHeight} viewBox={`0 0 ${cardWidth} ${cardHeight}`}>
        <circle
          ref={circleRef}
          cx={cardWidth / 2}
          cy={cardHeight / 2}
          r={circleRadius}
          fill={color}
          className="heart-pulse-circle"
          style={{
            transform: `scale(${baseScale})`, // Apply dynamic base scale.
          }}
        />
        {/* Text displaying the active heart rate */}
        <text
          x={cardWidth / 2}
          y={cardHeight / 2 + 5}
          textAnchor="middle"
          alignmentBaseline="middle"
          fill="#FFFFFF"
          fontSize="20px"
          fontWeight="bold"
          pointerEvents="none" // Ensures text doesn't interfere with mouse events on the circle.
        >
          {activeHr > 0 ? `${activeHr.toFixed(0)} bpm` : 'N/A'}
        </text>
      </svg>
    </div>
  );
};

export default HeartRatePulsingCircleContent;