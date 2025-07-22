// components/CardWrapper.tsx
import React, { useState, useCallback, Suspense, useEffect } from 'react';

/**
 * @file CardWrapper.tsx
 * @description This component serves as a flexible container for various data visualization cards.
 * It provides a consistent header, loading states, and the ability to cycle through
 * different visualization components for the same data.
 */

/**
 * Interface defining the properties that visualization content components must accept.
 */
export interface VisualizationContentProps {
  cardWidth?: number;  // Optional: Injected by CardWrapper for responsive sizing.
  cardHeight?: number; // Optional: Injected by CardWrapper for responsive sizing.
  data: any;           // Generic data; the specific visualization component will know its type.
  unit?: string;       // Optional: Unit of measurement, if applicable.
  color?: string;      // Optional: Color for visualization, if applicable.
  selectedChannelKey?: string; // Optional: For components like EegRawCard, to select a channel.
  onRotationUpdate?: (x: number, y: number, z: number) => void; // Optional: For components like GyroCard, to handle rotation.
}

/**
 * Interface for configuring a specific visualization option within a card.
 */
interface VisualizationConfig {
  label: string;                     // Label for the visualization (e.g., "Gráfico", "Mapa Cerebral").
  component: React.ComponentType<any>; // The React component to render for this visualization.
}

/**
 * Interface defining the props for the CardWrapper component.
 */
interface CardWrapperProps {
  title: string;                               // The title displayed in the card header.
  width?: number;                              // Optional: Width of the card container.
  height?: number;                             // Optional: Height of the card container.
  isLoading?: boolean;                         // Optional: Flag to show a loading indicator.
  noDataMessage?: string;                      // Optional: Message to display when no data is available.
  detailsContent?: React.ReactNode;            // Optional: Slot for additional details or summary content below the header.
  onClose?: () => void;                        // Optional: Callback function when the close button is clicked.
  headerContent?: React.ReactNode;             // Optional: Custom content to be rendered in the header (e.g., EEG channel buttons).
  visualizations?: VisualizationConfig[];      // Optional: Array of available visualization configurations.
  cardData?: any;                              // Optional: Raw data for the card, passed to the active visualization.
  visualizationProps?: { [key: string]: any }; // Optional: Additional props to pass directly to the visualization component.
  activeVisualizationIndex?: number;           // NOVO: Índice da visualização ativa para persistência
  onVisualizationChange?: (newIndex: number) => void; // NOVO: Callback para notificar a mudança de visualização
}

/**
 * CardWrapper functional component.
 * Acts as a generic container and manager for different data visualization cards.
 * It handles card sizing, loading states, and cycling through multiple visualization types.
 * @param {CardWrapperProps} props - The properties passed to the component.
 * @returns {JSX.Element} The wrapped card JSX.
 */
const CardWrapper: React.FC<CardWrapperProps> = ({
  title,
  width = 300,
  height = 200,
  isLoading = false,
  noDataMessage = "A aguardar dados...",
  detailsContent,
  onClose,
  headerContent,
  visualizations = [], // Default to an empty array if no visualizations are provided.
  cardData,
  visualizationProps = {}, // Default to an empty object if no additional props are provided.
  activeVisualizationIndex = 0, // NOVO: Usa a prop para o índice ativo, padrão 0
  onVisualizationChange, // NOVO: Recebe o callback
}) => {
  // Determine the active visualization component based on the current index from props.
  const ActiveVisualization = visualizations[activeVisualizationIndex]?.component;

  // Combine default and custom properties for the visualization component.
  const newVisualizationProps = {
    ...visualizationProps,
    data: cardData,
    cardWidth: width - 20, // Adjust width for internal padding.
    cardHeight: height - (detailsContent ? 100 : 60), // Adjust height for header and optional details content.
  };

  /**
   * Callback function to cycle to the next available visualization.
   * It loops back to the first visualization after reaching the last one.
   * NOVO: Agora chama o callback onVisualizationChange para atualizar o estado pai.
   */
  const cycleVisualization = useCallback(() => {
    if (onVisualizationChange) {
      const nextIndex = (activeVisualizationIndex + 1) % visualizations.length;
      onVisualizationChange(nextIndex);
    }
  }, [activeVisualizationIndex, visualizations.length, onVisualizationChange]);

  // Calculate dynamic height for the visualization area based on presence of details content.
  const visualizationHeight = detailsContent ? height - 100 : height - 60; // 60px for header, 100px if details are present.

  return (
    <div
      className="bg-white rounded-xl shadow-lg flex flex-col overflow-hidden transform transition-all duration-300 ease-in-out hover:scale-[1.01]"
      style={{ width: width, height: height }}
    >
      {/* Card Header */}
      <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-t-xl shadow-md">
        <h2 className="text-lg font-semibold truncate">{title}</h2>
        <div className="flex items-center space-x-2">
          {/* Visualization cycle button (only shown if more than one visualization is available) */}
          {visualizations.length > 1 && (
            <button
              onClick={cycleVisualization}
              className="no-drag bg-white/20 hover:bg-white/30 text-white text-xs font-medium px-3 py-1 rounded-full transition-colors duration-200"
              title="Alternar visualização"
            >
              {visualizations[activeVisualizationIndex]?.label || "Visualização"}
            </button>
          )}

          {/* Slot for custom header content (e.g., EEG channel selection buttons) */}
          {headerContent}

          {/* Close button for the card */}
          {onClose && (
            <button
              onClick={onClose}
              className="no-drag text-white hover:text-red-300 transition-colors duration-200 p-1 rounded-full hover:bg-white/20"
              aria-label="Fechar cartão"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Details Area (conditionally rendered if detailsContent is provided) */}
      {detailsContent && (
        <div className="p-4 bg-gray-50 border-b border-gray-200 flex items-center justify-center min-h-[60px]">
          {detailsContent}
        </div>
      )}

      {/* Visualization Area */}
      <div
        className="flex-1 flex items-center justify-center relative overflow-hidden bg-white"
        style={{ height: visualizationHeight }} // Dynamic height for the visualization.
      >
        {isLoading ? (
          // Loading message when data is being fetched.
          <div className="text-center text-gray-500 p-4">
            <p className="text-sm">A carregar...</p>
          </div>
        ) : (
          // Suspense boundary for lazy-loaded visualization components.
          <Suspense fallback={<div className="text-center text-gray-500 p-4">A carregar visualização...</div>}>
            {/* Render the active visualization component and pass its properties. */}
            {ActiveVisualization && <ActiveVisualization {...newVisualizationProps} />}
          </Suspense>
        )}
      </div>
    </div>
  );
};

export default CardWrapper;
