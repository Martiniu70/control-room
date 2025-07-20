// MainGrid.tsx
import React, { useEffect, useRef, useState, useCallback } from "react";
import GridLayout, { Layout } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

// Importar todos os componentes de card diretamente
import ChartCard from "./card/ChartCard";
import AccelerometerCard from "./card/AccCard";
import EegRawCard from "./card/EegRawCard";
import GyroscopeCard from "./card/GyroCard";
import FaceLandmarksCard from "./card/FaceLandmarksCard"; // NOVO: Importar o FaceLandmarksCard

// Importar a interface CardConfig para tipagem
import { CardConfig } from "../config/cardConfig";

// ATUALIZADO: A interface CardType agora é mais detalhada, incluindo componentType
interface CardType {
  id: string;
  label: string;
  colSpan: number;
  rowSpan: number;
  signalType: CardConfig['signalType'];
  componentType: CardConfig['componentType']; // NOVO: Adiciona o tipo de componente para renderização dinâmica
  signalName: string;
  component: string;
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

// NOVO: Interface para os dados de Face Landmarks
interface FaceLandmarksProcessedData {
  landmarks: number[][];
  gaze_vector: { dx: number; dy: number };
  ear: number;
  blink_rate: number;
  blink_counter: number;
  confidence: number;
  frame_b64: string;
  attentionPattern: string;
  isBlinking: boolean;
  frameNumber: number;
  frameTimestamp: number;
  anomalyType: string;
  timestamp: number;
}


interface MainGridProps {
  activeSignals: CardType[];
  hrData: Point[];
  ecgData: Point[];
  accelerometerData: AccelerometerProcessedData | null;
  gyroscopeData: GyroscopeProcessedData | null;
  eegRawData: EegRawProcessedData;
  faceLandmarksData: FaceLandmarksProcessedData | null; // NOVO: Prop para dados de face landmarks
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
  faceLandmarksData, // NOVO: Desestruturar a prop
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
  const getChartData = (item: CardType) => {
    switch (item.signalType) {
      case "hr":
        return hrData;
      case "ecg":
        return ecgData;
      // 'eeg' genérico não tem dados específicos aqui, mas 'eegRaw' sim.
      // Se houver um 'eeg' processado que não seja raw, adicione-o aqui.
      default:
        return [];
    }
  };

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

          // console.log(`MainGrid: Rendering card ID: ${item.id}, Label: ${item.label}, ComponentType: ${item.componentType}`);

          // Calcular as dimensões reais em pixels para o card
          const cardWidth = currentLayoutItem.w * (gridProps.width / gridProps.cols) - GAP;
          const cardHeight = currentLayoutItem.h * gridProps.rowHeight - GAP;

          // Renderização condicional baseada no componentType
          let CardComponent;
          let cardProps: any = {
            title: item.label,
            width: cardWidth,
            height: cardHeight,
          };

          switch (item.componentType) {
            case 'accelerometer':
              CardComponent = AccelerometerCard;
              cardProps.data = accelerometerData;
              break;
            case 'eegRaw':
              CardComponent = EegRawCard;
              cardProps.data = eegRawData;
              cardProps.unit = item.unit; // Usa a unidade da configuração do card
              break;
            case 'gyroscope':
              CardComponent = GyroscopeCard;
              cardProps.data = gyroscopeData;
              break;
            case 'faceLandmarks': // NOVO: Case para FaceLandmarks
              CardComponent = FaceLandmarksCard;
              cardProps.data = faceLandmarksData;
              break;
            case 'chart':
              CardComponent = ChartCard;
              cardProps.data = getChartData(item);
              cardProps.color = item.color; // Usa a cor da configuração do card
              cardProps.unit = item.unit; // Usa a unidade da configuração do card
              break;
            default:
              // Fallback ou componente de erro
              return (
                <div key={item.id} className="relative bg-white rounded-lg shadow-md p-4 flex items-center justify-center text-red-500">
                  Componente Desconhecido: {item.componentType}
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

          return (
            <div key={item.id} className="relative">
              {/* Renderiza o componente de card dinamicamente */}
              <CardComponent {...cardProps} />
              <button
                onClick={() => onDisableSignal(item.id)}
                className="absolute top-2 right-2 text-xs text-red-500 hover:text-red-700 z-10 p-1 rounded-full bg-white/70"
                title="Desativar sinal"
              >
                ✕
              </button>
            </div>
          );
        })}
      </GridLayout>
    </div>
  );
};

export default MainGrid;
