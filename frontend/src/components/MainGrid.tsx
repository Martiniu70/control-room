// src/components/MainGrid.tsx
import React, { useEffect, useRef, useState, useCallback } from "react";
import GridLayout, { Layout } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

/**
 * @file MainGrid.tsx
 * @description This component renders the main grid layout for the dashboard,
 * displaying various data visualization cards. It manages the dynamic sizing
 * of the grid and the individual cards, and handles layout changes.
 */

// Import the base CardWrapper and specific card components for different signal types.
import CardWrapper from "./card/CardWrapper";
import EegRawCard from './card/eeg/EegRawCard';
import HeartRateCard from './card/heart_rate/HeartRateCard';
import EcgCard from './card/ecg/EcgCard';
import AccCard from './card/acc/AccCard';
import GyroCard from './card/gyro/GyroCard';
import AlcoholLevelCard from './card/alcohol_level/AlcoholLevelCard';
import CarInfoCard from './card/car_info/CarInfoCard';

// Import CardConfig interface and helper function for signal-to-card mapping.
import { CardConfig, getCardConfigBySignalName } from "../config/cardConfig";

/**
 * Interface defining the structure for a card displayed on the grid.
 */
interface CardType {
  id: string;
  label: string;
  colSpan: number;
  rowSpan: number;
  signalType: CardConfig['signalType'];
  signalName: string; // The full signal name (e.g., 'hr_data', 'eegRaw_ch0').
  unit?: string;     // Optional unit, can be derived from config.
  color?: string;    // Optional color, can be derived from config.
  activeVisualizationIndex?: number; // NOVO: Índice da visualização ativa para persistência
}

// Interfaces for various processed data types passed as props.
interface Point {
  x: number;
  value: number;
}

interface AccelerometerProcessedData {
  x: number;
  y: number;
  z: number;
  timestamp: number;
}

interface GyroscopeProcessedData {
  x: number[];
  y: number[];
  z: number[];
  timestamp: number;
}

interface EegRawProcessedData {
  [channel: string]: { x: number; value: number }[];
}

interface FaceLandmarksProcessedData {
  landmarks: number[][];
  gaze_vector: { dx: number; dy: number };
  ear: number;
  blink_rate: number;
  blink_counter: number;
  frame_b64: string;
  timestamp: number;
}

interface AlcoholLevelProcessedData {
  alcohol_level: number;
  timestamp: number;
}

interface CarInformationProcessedData {
  speed: number;
  lane_centrality: number;
  timestamp: number;
}

/**
 * Interface defining the props for the MainGrid component.
 */
interface MainGridProps {
  activeSignals: CardType[];                 // Array of cards currently active and to be displayed.
  layout: Layout[];                          // The current layout of the grid items.
  hrData: Point[];                           // Heart rate data.
  ecgData: Point[];                          // ECG data.
  accelerometerData: AccelerometerProcessedData | null; // Accelerometer data.
  gyroscopeData: GyroscopeProcessedData | null;       // Gyroscope data.
  eegRawData: EegRawProcessedData;                   // Raw EEG data.
  faceLandmarksData: FaceLandmarksProcessedData | null; // Face landmarks data.
  alcoholLevelData: AlcoholLevelProcessedData | null;   // Alcohol level data.
  carInformationData: CarInformationProcessedData | null; // Car information data.
  onDisableSignal: (id: string) => void;     // Callback to disable a signal and remove its card.
  onLayoutChange: (newLayout: Layout[]) => void; // Callback when the grid layout changes.
  onVisualizationChange: (cardId: string, newIndex: number) => void; // NOVO: Callback para notificar mudança de visualização
}

const GAP = 10; // Gap between cards in pixels.
const ITEM_WIDTH = 300; // Base width of a grid item for column calculation.

/**
 * MainGrid functional component.
 * Renders a responsive grid of data visualization cards.
 * @param {MainGridProps} props - The properties passed to the component.
 * @returns {JSX.Element} The main grid layout JSX.
 */
const MainGrid: React.FC<MainGridProps> = ({
  activeSignals,
  layout,
  hrData,
  ecgData,
  accelerometerData,
  gyroscopeData,
  eegRawData,
  faceLandmarksData,
  alcoholLevelData,
  carInformationData,
  onDisableSignal,
  onLayoutChange,
  onVisualizationChange // NOVO: Recebe o callback de mudança de visualização
}) => {
  const gridRef = useRef<HTMLDivElement>(null); // Ref for the grid container to measure its width.
  const [gridProps, setGridProps] = useState({
    width: 0,       // Calculated width of the grid.
    cols: 1,        // Number of columns in the grid.
    rowHeight: 400, // Standard height for a row.
  });

  /**
   * `currentGridLayout` state is removed as the `GridLayout` component
   * will directly use the `layout` prop passed from the parent component.
   */

  /**
   * Calculates the grid properties (width and number of columns) based on
   * the available space in the `gridRef` container.
   * This ensures the grid is responsive to window size changes.
   */
  const calculateGrid = useCallback(() => {
    if (gridRef.current) {
      const clientWidth = gridRef.current.clientWidth; // Get the current width of the container.
      // Calculate the number of columns, ensuring at least one column.
      const newCols = Math.floor((clientWidth + GAP) / (ITEM_WIDTH + GAP)) || 1;
      const newWidth = clientWidth; // Set grid width to client width.

      setGridProps({
        width: newWidth,
        cols: newCols,
        rowHeight: 400, // Maintain a consistent row height.
      });
    }
  }, []);

  /**
   * Effect hook to perform initial grid calculation and
   * re-calculate on window resize events.
   * Cleans up the event listener on component unmount.
   */
  useEffect(() => {
    calculateGrid(); // Initial calculation on component mount.
    window.addEventListener("resize", calculateGrid); // Add resize listener.
    return () => {
      window.removeEventListener("resize", calculateGrid); // Clean up listener.
    };
  }, [calculateGrid]);

  /**
   * Handles changes to the grid layout, including item dragging and resizing.
   * This function simply passes the new layout up to the parent component.
   * @param newLayout The updated layout array from `react-grid-layout`.
   */
  const handleLayoutChange = (newLayout: Layout[]) => {
    // There is no internal state to update here.
    // The change is simply propagated to the parent component via `onLayoutChange`.
    onLayoutChange(newLayout);
  };

  /**
   * Memoized helper function to retrieve the appropriate data for a card
   * based on its signal type.
   * @param signalType The type of signal (e.g., 'hr', 'ecg', 'accelerometer').
   * @returns The corresponding data array or object, or `null` if not found.
   */
  const getCardDataBySignalType = useCallback((signalType: string) => {
    switch (signalType) {
      case "hr":
        return hrData;
      case "ecg":
        return ecgData;
      case "eeg":
        return []; // EEG processed data might be handled differently or not directly here.
      case "eegRaw":
        return eegRawData;
      case "accelerometer":
        return accelerometerData;
      case "gyroscope":
        return gyroscopeData;
      case "faceLandmarks":
        return faceLandmarksData;
      case "alcohol_level":
        return alcoholLevelData;
      case "car_information":
        return carInformationData;
      default:
        return null; // Return null for unknown signal types.
    }
  }, [hrData, ecgData, eegRawData, accelerometerData, gyroscopeData, faceLandmarksData, alcoholLevelData, carInformationData]);

  /**
   * Memoized helper function to generate additional content for a card's details section.
   * This is used for signals that might have specific summary information to display.
   * @param item The `CardType` object for the current card.
   * @param data The data associated with the card.
   * @returns A JSX element containing the details content, or `undefined` if no details are available.
   */
  const getDetailsContent = useCallback((item: CardType, data: any) => {
    // For certain signal types, no specific details content is provided here,
    // as their visualization components handle all display.
    if (item.signalType === 'eegRaw' || item.signalType === 'hr' || item.signalType === 'ecg' || item.signalType === 'accelerometer' || item.signalType === 'gyroscope' || item.signalType === 'alcohol_level' || item.signalType === 'car_information') {
      return undefined;
    }

    // Provide specific details content based on signal type.
    switch (item.signalType) {
      case 'eeg':
        const latestValue = data && data.length > 0 ? data[data.length - 1].value : 'N/A';
        return (
          <div className="flex flex-col items-center justify-center w-full text-sm text-gray-700">
            <p>Último Valor: {typeof latestValue === 'number' ? `${latestValue.toFixed(2)} ${item.unit || ''}` : latestValue}</p>
            <p>Unidade: {item.unit || 'N/A'}</p>
          </div>
        );
      case 'faceLandmarks':
        const blinkRate = data?.blink_rate !== undefined ? data.blink_rate.toFixed(2) : 'N/A';
        const blinkCounter = data?.blink_counter !== undefined ? data.blink_counter : 'N/A';
        return (
          <div className="flex flex-col items-center justify-center w-full text-sm text-gray-700">
            <p>Blink Rate: {blinkRate}</p>
            <p>Blink Counter: {blinkCounter}</p>
          </div>
        );
      default:
        return <p className="text-xs text-gray-500">Sem detalhes disponíveis.</p>;
    }
  }, [ecgData, accelerometerData, gyroscopeData, faceLandmarksData, alcoholLevelData, carInformationData]);

  return (
    <div ref={gridRef} className="p-4 w-full h-full overflow-auto">
      {/* React Grid Layout component */}
      <GridLayout
        className="layout"
        layout={layout} // Uses the layout prop directly from the parent.
        cols={gridProps.cols}
        rowHeight={gridProps.rowHeight}
        width={gridProps.width}
        isDraggable={true}
        isResizable={true}
        margin={[GAP, GAP]}
        containerPadding={[0, 0]}
        onLayoutChange={handleLayoutChange} // Propagates layout changes to the parent.
        draggableCancel=".no-drag" // Elements with this class cannot be dragged.
      >
        {(activeSignals || []).map((item) => {
          // Find the corresponding layout item from the `layout` prop.
          const currentLayoutItem = layout.find((l) => l.i === item.id);

          // If the layout item is not found, it means the card should not be rendered.
          // This ensures that only cards with a valid layout entry are displayed.
          if (!currentLayoutItem) {
            console.warn(`Layout item for card ID ${item.id} not found in current layout prop. Skipping render.`);
            return null;
          }

          // Get the card configuration based on the signal type.
          const cardConfig = getCardConfigBySignalName(item.signalType);

          // Render a fallback message if no configuration or visualizations are found.
          if (!cardConfig || cardConfig.visualizations.length === 0) {
            return (
              <div key={item.id} className="relative bg-white rounded-lg shadow-md p-4 flex items-center justify-center text-red-500">
                Componente Desconhecido ou sem visualizações: {item.signalType}
                <button
                  onClick={() => onDisableSignal(item.id)}
                  className="absolute top-2 right-2 text-xs text-red-500 hover:text-red-700 z-10 p-1 rounded-full bg-white/70"
                  title="Desativar sinal"
                >
                  ✕
                </button>
              </div>
            );
          }

          // Calculate card dimensions based on grid properties and layout item.
          const cardWidth = currentLayoutItem.w * (gridProps.width / gridProps.cols) - GAP;
          const cardHeight = currentLayoutItem.h * gridProps.rowHeight - GAP;

          // Get the data specific to this card's signal type.
          const cardData = getCardDataBySignalType(item.signalType);

          // Render specific card components based on signal type.
          // These components are wrappers that will internally use CardWrapper.
          if (item.signalType === 'hr') {
            return (
              <div key={item.id} className="relative">
                <HeartRateCard
                  title={item.label}
                  width={cardWidth}
                  height={cardHeight}
                  data={cardData as Point[]}
                  color={item.color || cardConfig.color || '#000000'}
                  unit={item.unit || cardConfig.unit}
                  onClose={() => onDisableSignal(item.id)}
                  // Pass the active visualization index and the change handler
                  activeVisualizationIndex={item.activeVisualizationIndex}
                  onVisualizationChange={(newIndex) => onVisualizationChange(item.id, newIndex)}
                />
              </div>
            );
          } else if (item.signalType === 'ecg') {
            return (
              <div key={item.id} className="relative">
                <EcgCard
                  title={item.label}
                  width={cardWidth}
                  height={cardHeight}
                  data={cardData as Point[]}
                  color={item.color || cardConfig.color || '#000000'}
                  unit={item.unit || cardConfig.unit}
                  onClose={() => onDisableSignal(item.id)}
                  // Pass the active visualization index and the change handler
                  activeVisualizationIndex={item.activeVisualizationIndex}
                  onVisualizationChange={(newIndex) => onVisualizationChange(item.id, newIndex)}
                />
              </div>
            );
          } else if (item.signalType === 'eegRaw') {
            return (
              <div key={item.id} className="relative">
                <EegRawCard
                  title={item.label}
                  width={cardWidth}
                  height={cardHeight}
                  data={cardData as EegRawProcessedData}
                  unit={item.unit || cardConfig.unit}
                  onClose={() => onDisableSignal(item.id)}
                  // Pass the active visualization index and the change handler
                  activeVisualizationIndex={item.activeVisualizationIndex}
                  onVisualizationChange={(newIndex) => onVisualizationChange(item.id, newIndex)}
                />
              </div>
            );
          } else if (item.signalType === 'accelerometer') {
            return (
              <div key={item.id} className="relative">
                <AccCard
                  title={item.label}
                  width={cardWidth}
                  height={cardHeight}
                  data={cardData as AccelerometerProcessedData}
                  color={item.color || cardConfig.color || '#000000'}
                  unit={item.unit || cardConfig.unit}
                  onClose={() => onDisableSignal(item.id)}
                  // Pass the active visualization index and the change handler
                  activeVisualizationIndex={item.activeVisualizationIndex}
                  onVisualizationChange={(newIndex) => onVisualizationChange(item.id, newIndex)}
                />
              </div>
            );
          } else if (item.signalType === 'gyroscope') {
            return (
              <div key={item.id} className="relative">
                <GyroCard
                  title={item.label}
                  width={cardWidth}
                  height={cardHeight}
                  data={cardData as GyroscopeProcessedData}
                  onClose={() => onDisableSignal(item.id)}
                  // Pass the active visualization index and the change handler
                  activeVisualizationIndex={item.activeVisualizationIndex}
                  onVisualizationChange={(newIndex) => onVisualizationChange(item.id, newIndex)}
                />
              </div>
            );
          } else if (item.signalType === 'alcohol_level') {
            return (
              <div key={item.id} className="relative">
                <AlcoholLevelCard
                  title={item.label}
                  width={cardWidth}
                  height={cardHeight}
                  data={cardData as AlcoholLevelProcessedData}
                  unit={item.unit || cardConfig.unit}
                  color={item.color || cardConfig.color}
                  onClose={() => onDisableSignal(item.id)}
                  // Pass the active visualization index and the change handler
                  activeVisualizationIndex={item.activeVisualizationIndex}
                  onVisualizationChange={(newIndex) => onVisualizationChange(item.id, newIndex)}
                />
              </div>
            );
          } else if (item.signalType === 'car_information') {
            return (
              <div key={item.id} className="relative">
                <CarInfoCard
                  title={item.label}
                  width={cardWidth}
                  height={cardHeight}
                  data={cardData as CarInformationProcessedData}
                  unit={item.unit || cardConfig.unit}
                  color={item.color || cardConfig.color}
                  onClose={() => onDisableSignal(item.id)}
                  // Pass the active visualization index and the change handler
                  activeVisualizationIndex={item.activeVisualizationIndex}
                  onVisualizationChange={(newIndex) => onVisualizationChange(item.id, newIndex)}
                />
              </div>
            );
          }


          // For all other card types (e.g., EEG processed, Steering, Speed, FaceLandmarks)
          // that use the generic CardWrapper with ChartCardContent or other content.
          const detailsContent = getDetailsContent(item, cardData);
          let customHeaderContent: React.ReactNode = undefined;

          const visualizationProps: { [key: string]: any } = {
            unit: item.unit || cardConfig.unit,
            color: item.color || cardConfig.color,
          };

          return (
            <div key={item.id} className="relative">
              <CardWrapper
                title={item.label}
                width={cardWidth}
                height={cardHeight}
                isLoading={cardData === null || (Array.isArray(cardData) && cardData.length === 0) || (typeof cardData === 'object' && Object.keys(cardData).length === 0)}
                noDataMessage="A aguardar dados..."
                onClose={() => onDisableSignal(item.id)}
                headerContent={customHeaderContent}
                detailsContent={detailsContent}
                visualizations={cardConfig.visualizations}
                cardData={cardData}
                visualizationProps={visualizationProps}
                // Pass the active visualization index and the change handler
                activeVisualizationIndex={item.activeVisualizationIndex}
                onVisualizationChange={(newIndex) => onVisualizationChange(item.id, newIndex)}
              />
            </div>
          );
        })}
      </GridLayout>
    </div>
  );
};

export default MainGrid;
