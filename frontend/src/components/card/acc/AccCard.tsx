// src/components/card/accelerometer/AccCard.tsx
import React from "react";
import CardWrapper from '../CardWrapper';
import { cardConfigs } from '../../../config/cardConfig';
import AccCardContent from './AccCardContent';

/**
 * @file AccCard.tsx
 * @description Wrapper component for displaying Accelerometer data.
 * This component uses `CardWrapper` to provide a consistent card layout
 * and passes accelerometer-specific data and visualization configurations
 * to its content component.
 */

/**
 * Interface for processed Accelerometer data.
 */
interface AccelerometerProcessedData {
  x: number;       // Acceleration along the X-axis.
  y: number;       // Acceleration along the Y-axis.
  z: number;       // Acceleration along the Z-axis.
  timestamp: number; // Timestamp of the data point.
}

/**
 * Interface defining the props for the AccCard component.
 * NOVO: Adicionadas activeVisualizationIndex e onVisualizationChange.
 */
interface AccCardProps {
    title: string;                               // Title of the card.
    data: AccelerometerProcessedData | null;     // Accelerometer data to display.
    width?: number;                              // Optional width of the card.
    height?: number;                             // Optional height of the card.
    unit?: string;                               // Optional unit for acceleration (defaults to m/s²).
    color?: string;                              // Optional color for the accelerometer visualization.
    onClose?: () => void;                        // Callback function to close the card.
    activeVisualizationIndex?: number; // NOVO: Índice da visualização ativa.
    onVisualizationChange?: (newIndex: number) => void; // NOVO: Callback para mudança de visualização.
}

/**
 * AccCard functional component.
 * Renders an accelerometer data card using `CardWrapper` and `AccCardContent`.
 * @param {AccCardProps} props - The properties passed to the component.
 * @returns {JSX.Element} The accelerometer card JSX.
 */
const AccCard: React.FC<AccCardProps> = ({
    title,
    data,
    color = "#3498db", // Default color for Accelerometer visualization.
    width,
    height,
    unit = "m/s²",    // Default unit for acceleration.
    onClose,
    activeVisualizationIndex, // NOVO: Desestruturado da props
    onVisualizationChange,    // NOVO: Desestruturado da props
}) => {
    /**
     * Content to be displayed in the details area of the CardWrapper.
     * Shows the X, Y, and Z values of the accelerometer data.
     */
    const detailsContent = (
        <div className="flex flex-col items-center justify-center w-full text-sm text-gray-700">
            <p>X: {data?.x !== undefined ? `${data.x.toFixed(2)} ${unit}` : "N/A"}</p>
            <p>Y: {data?.y !== undefined ? `${data.y.toFixed(2)} ${unit}` : "N/A"}</p>
            <p>Z: {data?.z !== undefined ? `${data.z.toFixed(2)} ${unit}` : "N/A"}</p>
        </div>
    );

    return (
        <CardWrapper
            title={title}
            width={width}
            height={height}
            isLoading={!data} // Card is loading if data is null.
            noDataMessage="A aguardar dados do acelerômetro..." // Message displayed when no data.
            detailsContent={detailsContent} // Pass the details content.
            onClose={onClose} // Pass the close function to CardWrapper.

            // Pass the array of visualizations defined in cardConfigs for 'accelerometer'.
            visualizations={cardConfigs['accelerometer'].visualizations}
            cardData={data} // Pass the raw accelerometer data to the visualization component.
            // Pass specific props (color, unit) to the visualization.
            visualizationProps={{ color, unit }}
            activeVisualizationIndex={activeVisualizationIndex} // NOVO: Passa o índice ativo
            onVisualizationChange={onVisualizationChange}       // NOVO: Passa o callback de mudança
        >
            {/* The CardWrapper now renders the active visualization component. */}
            {/* No direct children are rendered here, as visualizations are managed by CardWrapper. */}
        </CardWrapper>
    );
};

export default AccCard;
