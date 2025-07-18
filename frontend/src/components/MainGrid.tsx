// MainGrid.tsx
import React, { useEffect, useRef, useState } from "react";
import ChartCard from "./ChartCard";
import GridLayout, { Layout } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import AccelerometerCard from "./AccCard"; 
import EegRawCard from "./EegRawCard";
// NOVO: Importar o GyroscopeCard
import GyroscopeCard from "./GyroCard";

// ATUALIZADO: Adicionado 'gyroscope' ao SignalType
type SignalType = "hr" | "ecg" | "eeg" | "gyroscope" | "accelerometer" | "steering" | "speed" | "eegRaw" | string;

interface CardType {
  id: string;
  label: string;
  colSpan: number;
  rowSpan: number;
  signalType: SignalType;
  signalName: string;
  component: string;
}

interface Point{
  x: number;
  value: number;
}

interface AccelerometerProcessedData {
  x: number;
  y: number;
  z: number;
  timestamp: number;
}

// NOVO: Interface para os dados do giroscópio processados
interface GyroscopeProcessedData {
  x: number[];
  y: number[];
  z: number[];
  timestamp: number;
}

interface EegRawProcessedData {
  [channel: string]: Point[]; 
}

interface MainGridProps {
  items: CardType[];
  layout: Layout[];
  onLayoutChange: (layout: Layout[]) => void;
  ecgData: Point[]; 
  heartRateData: Point[]; 
  accelerometerData: AccelerometerProcessedData | null; 
  gyroscopeData: GyroscopeProcessedData | null; // NOVO: Prop para os dados do giroscópio
  eegRawData: EegRawProcessedData; 
  onDisableSignal: (cardId: string) => void;
}

interface GridProps {
  cols: number;
  rowHeight: number;
  width: number;
}

const MainGrid: React.FC<MainGridProps> = ({ 
  items, 
  layout, 
  onLayoutChange, 
  heartRateData,
  ecgData, 
  accelerometerData, 
  gyroscopeData, // NOVO: Recebe os dados do giroscópio
  eegRawData, 
  onDisableSignal
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [gridProps, setGridProps] = useState<GridProps>({
    cols: 4,
    rowHeight: 265,
    width: 800,
  });

  const ITEM_WIDTH = 300;
  const GAP = 16;

  useEffect(() => {
    function calculateGrid() {
      if (!containerRef.current) return;

      const clientWidth = containerRef.current.clientWidth;
      const cols = Math.floor((clientWidth + GAP) / (ITEM_WIDTH + GAP)) || 1; 

      setGridProps((prev) => ({
        ...prev,
        cols,
        width: clientWidth,
      }));
    }

    calculateGrid();
    window.addEventListener("resize", calculateGrid);
    return () => window.removeEventListener("resize", calculateGrid);
  }, []);

  const initialLayout: Layout[] = layout.length
    ? layout
    : items.map((item, i) => ({
        i: item.id.toString(),
        x: i % gridProps.cols,
        y: Math.floor(i / gridProps.cols),
        w: 1,
        h: 1,
      }));

  const completeLayout = initialLayout
    .map((l) => {
      const item = items.find((i) => i.id.toString() === l.i);
      return item ? l : null;
    })
    .filter((l): l is Layout => l !== null);

  const missingItems = items.filter(
    (i) => !completeLayout.find((l) => l.i === i.id.toString())
  );

  const layoutWithMissing: Layout[] = [
    ...completeLayout,
    ...missingItems.map((item, i) => ({
      i: item.id.toString(),
      x: (completeLayout.length + i) % gridProps.cols,
      y: Math.floor((completeLayout.length + i) / gridProps.cols),
      w: 1,
      h: 1,
    })),
  ];

  const getChartData = (cardType: CardType) => {
    switch (cardType.signalType) {
      case 'hr':
        return heartRateData.filter(point => point.value !== undefined);
      
      case 'ecg':
        return ecgData; 
      
      case 'eeg': 
        return [];
      
      default:
        return [];
    }
  };

  const getChartColor = (signalType: string) => {
    switch (signalType) {
      case 'hr': return "#e74c3c";
      case 'ecg': return "#27ae60";
      case 'eeg': return "#8884d8"; 
      case 'eegRaw': return "#8884d8"; 
      case 'gyroscope': return "#f39c12"; // Cor para giroscópio
      case 'accelerometer': return "#9b59b6"; 
      case 'steering': return "#3498db";
      case 'speed': return "#e67e22";
      default: return "#95a5a6";
    }
  };

  const getChartUnit = (signalType: string) => {
    switch (signalType) {
      case 'hr': return "bpm";
      case 'ecg': return "mV";
      case 'eeg': return "µV"; 
      case 'eegRaw': return "µV"; 
      case 'gyroscope': return "deg/s"; // Unidade para giroscópio
      case 'accelerometer': return "m/s²"; 
      case 'steering': return "deg";
      case 'speed': return "km/h";
      default: return "";
    }
  };

  return (
    <div ref={containerRef} className="w-full h-full overflow-hidden">
      <GridLayout
        className="layout"
        layout={layoutWithMissing}
        cols={gridProps.cols}
        rowHeight={gridProps.rowHeight}
        width={gridProps.width}
        margin={[GAP, GAP]}
        isResizable={true}
        isDraggable={true}
        onLayoutChange={onLayoutChange}
      >
        {items.map((item) => {
          const chartColor = getChartColor(item.signalType);
          const chartUnit = getChartUnit(item.signalType);
          
          return (
            <div
              key={item.id}
              className="bg-white rounded-lg shadow-md flex flex-col"
            >
              <div className="flex justify-between items-center p-2 border-b">
                <h3 className="font-medium text-sm">{item.label}</h3>
                <button 
                  onClick={() => onDisableSignal(item.id)}
                  className="text-xs text-red-500 hover:text-red-700"
                  title="Desativar sinal"
                >
                  Desativar
                </button>
              </div>
              
              <div className="flex-1 p-2">
                {/* Lógica condicional para renderizar o card correto */}
                {item.signalType === 'accelerometer' ? (
                  <AccelerometerCard
                    title="" 
                    data={accelerometerData}
                    width={gridProps.width / gridProps.cols - GAP * 2}
                    height={gridProps.rowHeight - 60} 
                  />
                ) : item.signalType === 'eegRaw' ? ( 
                  <EegRawCard
                    title=""
                    data={eegRawData}
                    unit={chartUnit}
                    width={gridProps.width / gridProps.cols - GAP * 2}
                    height={gridProps.rowHeight - 60}
                  />
                ) : item.signalType === 'gyroscope' ? ( // NOVO: Renderizar GyroscopeCard
                  <GyroscopeCard
                    title=""
                    data={gyroscopeData} // Passa apenas os dados do giroscópio
                    width={gridProps.width / gridProps.cols - GAP * 2}
                    height={gridProps.rowHeight - 60} 
                  />
                ) : (
                  <ChartCard 
                    title=""
                    color={chartColor}
                    data={getChartData(item)} 
                    unit={chartUnit}
                    width={gridProps.width / gridProps.cols - GAP * 2}
                    height={gridProps.rowHeight - 60} 
                  />
                )}
              </div>
            </div>
          );
        })}
      </GridLayout>
    </div>
  );
};

export default MainGrid;
