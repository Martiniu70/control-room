// src/components/card/car_info/CarInfoCard.tsx
import React from 'react';
import CardWrapper from '../CardWrapper';
import { cardConfigs } from '../../../config/cardConfig';

/**
 * @file CarInfoCard.tsx
 * @description Wrapper component for displaying Car Information data.
 * This component uses `CardWrapper` to provide a consistent card layout
 * and passes car-specific data and visualization configurations
 * to its content component.
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
 * Interface defining the props for the CarInfoCard component.
 * NOVO: Adicionadas activeVisualizationIndex e onVisualizationChange.
 */
interface CarInfoCardProps {
  title: string;                 // Title of the card.
  data: CarInfoData | null;      // Car information data to display.
  width?: number;                // Optional width of the card.
  height?: number;               // Optional height of the card.
  unit?: string;                 // Optional unit for speed (defaults to km/h).
  color?: string;                // Optional color for the visualization.
  onClose?: () => void;          // Callback function to close the card.
  activeVisualizationIndex?: number; // NOVO: Índice da visualização ativa.
  onVisualizationChange?: (newIndex: number) => void; // NOVO: Callback para mudança de visualização.
}

/**
 * CarInfoCard functional component.
 * Renders a car information data card using `CardWrapper` and `CarInfoCardContent`.
 * @param {CarInfoCardProps} props - The properties passed to the component.
 * @returns {JSX.Element} The car information card JSX.
 */
const CarInfoCard: React.FC<CarInfoCardProps> = ({
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
  // The `hasData` condition checks if data exists and essential properties are present.
  const hasData = data !== null && data.speed !== undefined && data.lane_centrality !== undefined;

  /**
   * Content to be displayed in the details area of the CardWrapper.
   * Shows current speed, lane centrality, and timestamp.
   */
  const detailsContent = (
    <div className="flex flex-col items-center justify-center w-full text-sm text-gray-700">
      <p>Velocidade: {data?.speed !== undefined ? `${data.speed.toFixed(1)} ${unit || 'km/h'}` : 'N/A'}</p>
      <p>Centralidade da Faixa: {data?.lane_centrality !== undefined ? data.lane_centrality.toFixed(2) : 'N/A'}</p>
      <p>Tempo: {data?.timestamp !== undefined ? `${data.timestamp.toFixed(1)}s` : 'N/A'}</p>
    </div>
  );

  return (
    <CardWrapper
      title={title}
      width={width}
      height={height}
      isLoading={!hasData} // Card is loading if data is not available.
      noDataMessage="A aguardar dados de Informação do Carro..." // Message displayed when no data.
      detailsContent={detailsContent} // Pass the details content.
      onClose={onClose} // Pass the close function to CardWrapper.
      // Pass the array of visualizations defined in cardConfigs for 'car_information'.
      visualizations={cardConfigs['car_information'].visualizations}
      cardData={data} // Pass the complete data (including timestamp) to the visualization component.
      // Pass specific props (unit, color) to the visualization.
      visualizationProps={{
        unit: unit || cardConfigs['car_information'].unit,
        color: color || cardConfigs['car_information'].color,
      }}
      activeVisualizationIndex={activeVisualizationIndex} // NOVO: Passa o índice ativo
      onVisualizationChange={onVisualizationChange}       // NOVO: Passa o callback de mudança
    />
  );
};

export default CarInfoCard;
