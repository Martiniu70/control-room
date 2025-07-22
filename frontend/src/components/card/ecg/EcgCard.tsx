// src/components/card/ecg/EcgCard.tsx
import React from "react";
import CardWrapper from '../CardWrapper';
import { cardConfigs } from '../../../config/cardConfig';

/**
 * @file EcgCard.tsx
 * @description Wrapper component for displaying Electrocardiogram (ECG) data.
 * This component uses `CardWrapper` to provide a consistent card layout
 * and passes ECG-specific data and visualization configurations
 * to its content components.
 */

/**
 * Interface for a single data point in the ECG chart.
 */
interface Point {
  x: number;     // Time in seconds.
  value: number; // ECG value.
}

/**
 * Interface defining the props for the EcgCard component.
 * NOVO: Adicionadas activeVisualizationIndex e onVisualizationChange.
 */
interface EcgCardProps {
    title: string;       // Title of the card.
    data: Point[];       // ECG data to display.
    width?: number;      // Optional width of the card.
    height?: number;     // Optional height of the card.
    unit?: string;       // Optional unit for ECG data (defaults to mV).
    color?: string;      // Optional color for the ECG visualization.
    onClose?: () => void; // Callback function to close the card.
    activeVisualizationIndex?: number; // NOVO: Índice da visualização ativa.
    onVisualizationChange?: (newIndex: number) => void; // NOVO: Callback para mudança de visualização.
}

/**
 * EcgCard functional component.
 * Renders an ECG data card using `CardWrapper` and its configured visualizations.
 * @param {EcgCardProps} props - The properties passed to the component.
 * @returns {JSX.Element} The ECG card JSX.
 */
const EcgCard: React.FC<EcgCardProps> = ({
    title,
    data,
    color = "#82ca9d", // Default color for ECG.
    width,
    height,
    unit = "mV",    // Default unit for ECG.
    onClose,
    activeVisualizationIndex, // NOVO: Desestruturado da props
    onVisualizationChange,    // NOVO: Desestruturado da props
}) => {
    // Get the latest ECG value.
    const currentValue = data[data.length - 1]?.value;
    // Calculate the average ECG value.
    const avgValue = data.length > 0 ?
      (data.reduce((sum, d) => sum + d.value, 0) / data.length) : 0;

    /**
     * Helper function to format numeric values with appropriate precision.
     * ECG typically requires more decimal places.
     * @param value The number to format.
     * @param currentUnit The unit of the value (though not used for precision decision here).
     * @returns {string} The formatted string.
     */
    const getDisplayPrecision = (value: number, currentUnit: string) => {
        return value.toFixed(2); // Two decimal places for ECG values.
    }

    /**
     * Content to be displayed in the details area of the CardWrapper.
     * Shows the current and average ECG values.
     */
    const detailsContent = (
        <div className="flex justify-between w-full text-sm text-gray-700">
            <span className="font-semibold" style={{ color }}>
                Atual: {currentValue !== undefined ? `${getDisplayPrecision(currentValue, unit)} ${unit}` : "N/A"}
            </span>
            <span className="text-gray-500">
                Média: {getDisplayPrecision(avgValue, unit)} {unit}
            </span>
        </div>
    );

    // The `EcgCard` does not have specific control buttons in the header (like EEG),
    // so `customHeaderContent` can be undefined.

    return (
        <CardWrapper
            title={title}
            width={width}
            height={height}
            isLoading={!data || data.length === 0} // Card is loading if data is empty or null.
            noDataMessage="A aguardar dados..." // Message displayed when no data.
            detailsContent={detailsContent} // Pass the details content.
            onClose={onClose} // Pass the close function to CardWrapper.
            // `headerContent` is undefined, so it's not explicitly passed.

            // Pass the array of visualizations defined in `cardConfigs` for 'ecg'.
            visualizations={cardConfigs['ecg'].visualizations}
            cardData={data} // Pass the raw chart data to the visualization component.
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

export default EcgCard;
