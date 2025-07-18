// MainGrid.tsx
import React, { useEffect, useRef, useState } from "react";
import ChartCard from "./ChartCard";
import GridLayout, { Layout } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

type SignalType = "hr" | "ecg" | "eeg" | "steering" | "speed" | string;
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

interface EcgBatch{
  timeSeconds: number;
  values: number[];
}

interface MainGridProps {
  items: CardType[];
  layout: Layout[];
  onLayoutChange: (layout: Layout[]) => void;
  ecgDataBatches: EcgBatch[];
  heartRateData: Point[]; // Dados específicos de HR
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
  ecgDataBatches, 
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
      const cols = Math.floor((clientWidth + GAP) / (ITEM_WIDTH + GAP));

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

  // ✅ FUNÇÃO ATUALIZADA: Preparar dados para cada tipo de gráfico
  const getChartData = (cardType: CardType) => {
    switch (cardType.signalType) {
      case 'hr':
        // Dados HR já estão formatados como Point[], apenas filtramos se necessário
        return heartRateData.filter(point => point.value !== undefined);
      
      case 'ecg':
        const ecgPoints: Point[] = [];
        // ✅ IMPORTANTE: VERIFIQUE se esta sampleRate (200) corresponde à taxa real dos seus dados ECG.
        // Se for diferente, ajuste aqui.
        const sampleRate = 200; 
        const sampleDuration = 1 / sampleRate;
        const windowDuration = 5; // Duração da janela para ECG em segundos (ex: 5 segundos)
        const desiredPointsInWindow = Math.ceil(windowDuration * sampleRate); // Calcular quantos pontos precisamos

        // ✅ ACUMULAR TODOS OS PONTOS DOS BATCHES RECENTES
        ecgDataBatches.forEach(batch => {
          batch.values.forEach((val, index) => {
            const pointTime = batch.timeSeconds + (index * sampleDuration);
            ecgPoints.push({x: pointTime, value: val});
          });
        });
        
        // ✅ CORTAR A ARRAY PARA CONTER APENAS OS PONTOS DENTRO DA JANELA DE INTERESSE
        // Isso é crucial para evitar que o gráfico se comprima com muitos dados históricos.
        return ecgPoints.slice(-desiredPointsInWindow); 
      
      case 'eeg':
        // TODO - dados EEG
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
      default: return "#95a5a6";
    }
  };

  const getChartUnit = (signalType: string) => {
    switch (signalType) {
      case 'hr': return "bpm";
      case 'ecg': return "mV";
      case 'eeg': return "µV";
      case 'gyroscope': return "deg/s";
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
        isResizable={false}
        isDraggable={true}
        onLayoutChange={onLayoutChange}
      >
        {items.map((item) => {
          const chartData = getChartData(item);
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
                  title="Disable signal"
                >
                  Disable
                </button>
              </div>
              
              <div className="flex-1 p-2">
                {/* Removi a condição extra com item.signalType === 'hr' || item.signalType === "ecg"
                    porque getChartData sempre retorna [] se não houver dados ou não for um tipo gerido.
                    A condição chartData.length > 0 já é suficiente para mostrar o ChartCard
                    com 'Waiting for data...' se a array estiver vazia. */}
                <ChartCard 
                  title=""
                  color={chartColor}
                  data={chartData}
                  unit={chartUnit}
                  width={gridProps.width / gridProps.cols - GAP * 2}
                  height={gridProps.rowHeight - 60}
                />
              </div>
            </div>
          );
        })}
      </GridLayout>
    </div>
  );
};

export default MainGrid;