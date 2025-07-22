// src/components/card/alcohol_level/AlcoholLevelCard.tsx
import React from 'react';
import CardWrapper from '../CardWrapper';
import * as cardConfigs from '../../../config/cardConfig';

/**
 * @file AlcoholLevelCard.tsx
 * @description Wrapper component for displaying Alcohol Level data.
 * This component uses `CardWrapper` to provide a consistent card layout
 * and passes alcohol level-specific data and visualization configurations
 * to its content component.
 */

/**
 * Interface for Alcohol Level data.
 */
interface AlcoholLevelData {
  alcohol_level: number; // The alcohol level value (e.g., 0.3).
}

/**
 * Interface defining the props for the AlcoholLevelCard component.
 * NOVO: Adicionadas activeVisualizationIndex e onVisualizationChange.
 */
interface AlcoholLevelCardProps {
  title: string;                 // Title of the card.
  data: AlcoholLevelData | null; // Alcohol level data to display.
  width?: number;                // Optional width of the card.
  height?: number;               // Optional height of the card.
  unit?: string;                 // Optional unit for alcohol level (defaults to ‰).
  color?: string;                // Optional color for the visualization.
  onClose?: () => void;          // Callback function to close the card.
  activeVisualizationIndex?: number; // NOVO: Índice da visualização ativa.
  onVisualizationChange?: (newIndex: number) => void; // NOVO: Callback para mudança de visualização.
}

/**
 * AlcoholLevelCard functional component.
 * Renders an alcohol level data card using `CardWrapper` and `AlcoholLevelCardContent`.
 * @param {AlcoholLevelCardProps} props - The properties passed to the component.
 * @returns {JSX.Element} The alcohol level card JSX.
 */
const AlcoholLevelCard: React.FC<AlcoholLevelCardProps> = ({
  title,
  data,
  width,
  height,
  unit,
  color,
  onClose,
  activeVisualizationIndex, // NOVO: Desestruturado da props
  onVisualizationChange,    // NOVO: Desestruturado da props
}) => {
  // Check if data is available and contains an alcohol_level.
  const hasData = data !== null && data.alcohol_level !== undefined;

  /**
   * Content to be displayed in the details area of the CardWrapper.
   * Shows the current alcohol level.
   */
  const detailsContent = (
    <div className="flex flex-col items-center justify-center w-full text-sm text-gray-700">
      <p>Nível Atual: {data?.alcohol_level !== undefined ? `${data.alcohol_level.toFixed(2)} ${unit || '‰'}` : 'N/A'}</p>
      {/* Additional details like history or status could be added here. */}
    </div>
  );

  return (
    <CardWrapper
      title={title}
      width={width}
      height={height}
      isLoading={!hasData} // Card is loading if data is not available.
      noDataMessage="A aguardar dados de Nível de Álcool..." // Message displayed when no data.
      detailsContent={detailsContent} // Pass the details content.
      onClose={onClose} // Pass the close function to CardWrapper.
      // Pass the array of visualizations defined in cardConfigs for 'alcohol_level'.
      visualizations={cardConfigs.cardConfigs['alcohol_level'].visualizations}
      cardData={data} // Pass the raw alcohol level data to the visualization component.
      // Pass specific props (unit, color) to the visualization.
      visualizationProps={{
        unit: unit || cardConfigs.cardConfigs['alcohol_level'].unit,
        color: color || cardConfigs.cardConfigs['alcohol_level'].color,
      }}
      activeVisualizationIndex={activeVisualizationIndex} // NOVO: Passa o índice ativo
      onVisualizationChange={onVisualizationChange}       // NOVO: Passa o callback de mudança
    />
  );
};

export default AlcoholLevelCard;
