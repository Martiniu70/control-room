// src/components/MainGrid.tsx
import React, { useEffect, useRef, useState, useCallback } from "react";
import GridLayout, { Layout } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

// Importar apenas o CardWrapper
import CardWrapper from "./card/CardWrapper"; 
// Importar os wrappers de card específicos
import EegRawCard from './card/eeg/EegRawCard'; 
import HeartRateCard from './card/heart_rate/HeartRateCard'; 
import EcgCard from './card/ecg/EcgCard'; 
import AccCard from './card/acc/AccCard'; 
import GyroCard from './card/gyro/GyroCard'; // NOVO: Importar o GyroCard

// Importar a interface CardConfig e a função getCardConfigBySignalName
import { CardConfig, getCardConfigBySignalName } from "../config/cardConfig";

// ATUALIZADO: A interface CardType agora é mais simples, pois o CardWrapper gerencia as visualizações
interface CardType {
  id: string;
  label: string;
  colSpan: number;
  rowSpan: number;
  signalType: CardConfig['signalType'];
  signalName: string; // O nome completo do sinal (ex: 'hr_data', 'eegRaw_ch0')
  unit?: string; // Opcional, pode vir da config
  color?: string; // Opcional, pode vir da config
}

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


interface MainGridProps {
  activeSignals: CardType[];
  hrData: Point[];
  ecgData: Point[];
  accelerometerData: AccelerometerProcessedData | null;
  gyroscopeData: GyroscopeProcessedData | null;
  eegRawData: EegRawProcessedData;
  faceLandmarksData: FaceLandmarksProcessedData | null;
  onDisableSignal: (id: string) => void;
  onLayoutChange: (newLayout: Layout[]) => void;
}

const GAP = 10; // Espaço entre os cards
const ITEM_WIDTH = 300; // Largura base de um item para cálculo de colunas

const MainGrid: React.FC<MainGridProps> = ({
  activeSignals,
  hrData,
  ecgData,
  accelerometerData,
  gyroscopeData,
  eegRawData,
  faceLandmarksData,
  onDisableSignal,
  onLayoutChange
}) => {
  const gridRef = useRef<HTMLDivElement>(null);
  const [gridProps, setGridProps] = useState({
    width: 0,
    cols: 1,
    rowHeight: 400, // Altura padrão para uma linha
  });

  // Estado para o layout da grade
  const [layout, setLayout] = useState<Layout[]>(
    (activeSignals || []).map((card, index) => ({
      i: card.id,
      x: index % 3, // Posição inicial simples
      y: Math.floor(index / 3), // Posição inicial simples
      w: card.colSpan,
      h: card.rowSpan,
      minW: 1, // Largura mínima (1 coluna)
      minH: 1, // Altura mínima (1 linha)
    }))
  );

  // ATUALIZA O LAYOUT QUANDO activeSignals MUDA
  useEffect(() => {
    const currentActiveSignals = activeSignals || [];

    setLayout(prevLayout => {
      let newLayout = prevLayout;

      // 1. Remove cards that are no longer in activeSignals
      newLayout = newLayout.filter(layoutItem =>
        currentActiveSignals.some(card => card.id === layoutItem.i)
      );

      // 2. Add new cards from activeSignals that are not yet in the layout
      currentActiveSignals.forEach((card, index) => {
        if (!newLayout.some(layoutItem => layoutItem.i === card.id)) {
          // Adiciona novo card com posição e tamanho iniciais
          newLayout.push({
            i: card.id,
            // Tenta posicionar o novo card de forma a não colidir com os existentes
            x: index % (gridProps.cols || 1),
            y: Math.floor(index / (gridProps.cols || 1)),
            w: card.colSpan,
            h: card.rowSpan,
            minW: 1,
            minH: 1,
          });
        }
      });

      return newLayout;
    });
  }, [activeSignals, gridProps.cols]);


  const calculateGrid = useCallback(() => {
    if (gridRef.current) {
      const clientWidth = gridRef.current.clientWidth;
      const newCols = Math.floor((clientWidth + GAP) / (ITEM_WIDTH + GAP)) || 1;
      const newWidth = clientWidth;

      setGridProps({
        width: newWidth,
        cols: newCols,
        rowHeight: 400,
      });
    }
  }, []);

  useEffect(() => {
    calculateGrid();
    window.addEventListener("resize", calculateGrid);
    return () => {
      window.removeEventListener("resize", calculateGrid);
    };
  }, [calculateGrid]);

  // Função interna para lidar com mudanças no layout (incluindo redimensionamento)
  const handleLayoutChange = (newLayout: Layout[]) => {
    setLayout(newLayout);
    onLayoutChange(newLayout); // Chama a prop onLayoutChange para notificar o pai
  };

  // Funções auxiliares para obter dados
  const getCardDataBySignalType = useCallback((signalType: string) => {
    switch (signalType) {
      case "hr":
        return hrData;
      case "ecg":
        return ecgData;
      case "eeg": // Para o caso de EEG processado genérico
        // Se houver dados EEG processados que não sejam raw, retorne-os aqui
        return []; 
      case "eegRaw":
        return eegRawData;
      case "accelerometer":
        return accelerometerData;
      case "gyroscope":
        return gyroscopeData;
      case "faceLandmarks":
        return faceLandmarksData;
      // Adicione outros tipos de sinal conforme necessário
      default:
        return null;
    }
  }, [hrData, ecgData, eegRawData, accelerometerData, gyroscopeData, faceLandmarksData]);

  // NOVO: Função para gerar o conteúdo de detalhes
  // Agora MainGrid só gera detalhes para cards que NÃO SÃO EEG Raw, HR, ECG ou Accelerometer
  const getDetailsContent = useCallback((item: CardType, data: any) => {
    // Se for um card EEG Raw, HR, ECG, Accelerometer ou Gyroscope, ele gerencia seus próprios detalhes.
    // Retornamos undefined para que o CardWrapper use seu fallback ou o que o wrapper de card passar.
    if (item.signalType === 'eegRaw' || item.signalType === 'hr' || item.signalType === 'ecg' || item.signalType === 'accelerometer' || item.signalType === 'gyroscope') {
      return undefined; 
    }

    switch (item.signalType) {
      case 'eeg': // EEG processado ainda usa ChartCardContent
      case 'steering':
      case 'speed':
        // Para cards baseados em gráfico, mostrar o último valor
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
  }, [ecgData, accelerometerData, gyroscopeData, faceLandmarksData]); 

  return (
    <div ref={gridRef} className="p-4 w-full h-full overflow-auto">
      <GridLayout
        className="layout"
        layout={layout}
        cols={gridProps.cols}
        rowHeight={gridProps.rowHeight}
        width={gridProps.width}
        isDraggable={true}
        isResizable={true}
        margin={[GAP, GAP]}
        containerPadding={[0, 0]}
        onLayoutChange={handleLayoutChange}
      >
        {(activeSignals || []).map((item) => {
          const currentLayoutItem = layout.find((l) => l.i === item.id);
          if (!currentLayoutItem) return null;

          // Obter a configuração do card a partir de cardConfig.ts
          const cardConfig = getCardConfigBySignalName(item.signalType);

          if (!cardConfig || cardConfig.visualizations.length === 0) {
            // Fallback se a configuração não for encontrada ou não tiver visualizações
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

          // Calcular as dimensões reais em pixels para o card
          const cardWidth = currentLayoutItem.w * (gridProps.width / gridProps.cols) - GAP;
          const cardHeight = currentLayoutItem.h * gridProps.rowHeight - GAP;

          // Obter os dados específicos para este tipo de sinal
          const cardData = getCardDataBySignalType(item.signalType);

          // Renderização condicional para HeartRateCard, EcgCard, EegRawCard, AccCard e GyroCard
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
                />
              </div>
            );
          } else if (item.signalType === 'gyroscope') { // NOVO: Renderizar GyroCard diretamente
            return (
              <div key={item.id} className="relative">
                <GyroCard 
                  title={item.label}
                  width={cardWidth}
                  height={cardHeight}
                  data={cardData as GyroscopeProcessedData} 
                  onClose={() => onDisableSignal(item.id)}
                />
              </div>
            );
          }


          // Para todos os outros tipos de card (EEG processado, Steering, Speed, FaceLandmarks)
          // que ainda usarão o CardWrapper diretamente com ChartCardContent ou outros conteúdos
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
              />
            </div>
          );
        })}
      </GridLayout>
    </div>
  );
};

export default MainGrid;
