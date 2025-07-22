// src/components/card/GyroCard.tsx
import React, { useState, useCallback } from 'react';
import CardWrapper from '../CardWrapper';
import { cardConfigs } from '../../../config/cardConfig';

/**
 * @file GyroCard.tsx
 * @description Wrapper component for displaying Gyroscope data.
 * This component uses `CardWrapper` to provide a consistent card layout
 * and passes gyroscope-specific data and visualization configurations
 * to its content component. It also manages the display of rotation values.
 */

/**
 * Interface for Gyroscope data, containing arrays of x, y, and z rotation values.
 */
interface GyroscopeData {
  x: number[]; // Array of X-axis rotation values.
  y: number[]; // Array of Y-axis rotation values.
  z: number[]; // Array of Z-axis rotation values.
}

/**
 * Interface defining the props for the GyroscopeCard component.
 * NOVO: Adicionadas activeVisualizationIndex e onVisualizationChange.
 */
interface GyroscopeCardProps {
    title: string;                 // Title of the card.
    data: GyroscopeData | null;    // Gyroscope data to display.
    width?: number;                // Optional width of the card.
    height?: number;               // Optional height of the card.
    onClose?: () => void;          // Callback function to close the card.
    activeVisualizationIndex?: number; // NOVO: Índice da visualização ativa.
    onVisualizationChange?: (newIndex: number) => void; // NOVO: Callback para mudança de visualização.
}

/**
 * GyroscopeCard functional component.
 * Renders a gyroscope data card using `CardWrapper` and `GyroscopeCardContent`.
 * It maintains a state for displaying the latest rotation values.
 * @param {GyroscopeCardProps} props - The properties passed to the component.
 * @returns {JSX.Element} The gyroscope card JSX.
 */
const GyroscopeCard: React.FC<GyroscopeCardProps> = ({
    title,
    data,
    width,
    height,
    onClose,
    activeVisualizationIndex, // NOVO: Desestruturado da props
    onVisualizationChange,    // NOVO: Desestruturado da props
}) => {
    /**
     * State to store rotation values for display in the details section.
     * Initialized to `null` to indicate "no data" or "not yet received".
     */
    const [displayRotationValues, setDisplayRotationValues] = useState<{ x: number; y: number; z: number } | null>(null);

    /**
     * Callback function to update the rotation values.
     * This function will be passed to `GyroscopeCardContent` and called by it.
     * @param x The X-axis rotation value.
     * @param y The Y-axis rotation value.
     * @param z The Z-axis rotation value.
     */
    const handleRotationUpdate = useCallback((x: number, y: number, z: number) => {
        setDisplayRotationValues({ x, y, z });
    }, []);

    // Determine if there's any data present to show content or the "no data" message.
    const hasData = data && (data.x.length > 0 || data.y.length > 0 || data.z.length > 0);

    /**
     * Content to be displayed in the details area of the CardWrapper.
     * Shows the X, Y, and Z rotation values in degrees per second.
     */
    const detailsContent = (
        <div className="flex flex-col items-center justify-center w-full text-sm text-gray-700">
            <p>X: {displayRotationValues?.x.toFixed(2) ?? 'N/A'} deg/s</p>
            <p>Y: {displayRotationValues?.y.toFixed(2) ?? 'N/A'} deg/s</p>
            <p>Z: {displayRotationValues?.z.toFixed(2) ?? 'N/A'} deg/s</p>
        </div>
    );

    return (
        <CardWrapper
            title={title}
            width={width}
            height={height}
            isLoading={!hasData}
            noDataMessage="A aguardar dados do giroscópio..." // Message displayed when no data.
            detailsContent={detailsContent} // Pass the details content.
            onClose={onClose} // Pass the close function to CardWrapper.
            // Pass the array of visualizations defined in `cardConfigs` for 'gyroscope'.
            // `CardWrapper` will now render `GyroscopeCardContent`.
            visualizations={cardConfigs['gyroscope'].visualizations}
            cardData={data} // Pass the raw data to `CardWrapper`, which will pass it to the visualization.
            visualizationProps={{
                // Pass the `onRotationUpdate` callback to `GyroscopeCardContent`.
                onRotationUpdate: handleRotationUpdate,
            }}
            activeVisualizationIndex={activeVisualizationIndex} // NOVO: Passa o índice ativo
            onVisualizationChange={onVisualizationChange}       // NOVO: Passa o callback de mudança
        >
            {/* `GyroscopeCardContent` is no longer a direct child here.
                It will be rendered by `CardWrapper` based on the 'visualizations' configuration. */}
        </CardWrapper>
    );
};

export default GyroscopeCard;
