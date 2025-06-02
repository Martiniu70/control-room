import React, { useEffect, useRef, useState } from "react";
import ChartCard from "./ChartCard";
import GridLayout, { Layout } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

interface CardType {
  id: string;
  label: string;
  colSpan: number;
  rowSpan: number;
  signalType: 'hr' | 'ecg' | 'eeg' | 'steering' | 'speed';
}

interface DataPoint {
  timeSeconds: number;  // Tempo real em segundos
  hr?: number;         // Heart Rate
  ecg?: number;        // TODO
  eeg?: number;        // TODO
}

interface MainGridProps {
  items: CardType[];
  layout: Layout[];
  onLayoutChange: (layout: Layout[]) => void;
  heartRateData: DataPoint[]; // Dados específicos de HR
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
  heartRateData
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

  // Layout definition for RGL (mantido igual)
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

  // ✅ FUNÇÃO SIMPLES: Preparar dados para cada tipo de gráfico
  const getChartData = (cardType: CardType) => {
    switch (cardType.signalType) {
      case 'hr':
        // Converter dados HR para formato do ChartCard
        return heartRateData
          .filter(point => point.hr !== undefined)
          .map(point => ({
            x: point.timeSeconds,
            value: point.hr!
          }));
      
      case 'ecg':
        // TODO - dados ECG
        return [];
      
      case 'eeg':
        // TODO - dados EEG
        return [];
      
      default:
        return [];
    }
  };

  // Escolher cor por tipo
  const getChartColor = (signalType: CardType['signalType']) => {
    switch (signalType) {
      case 'hr': return "#e74c3c";      // Vermelho para HR
      case 'ecg': return "#27ae60";     // Verde para ECG
      case 'eeg': return "#8884d8";     // Azul para EEG
      default: return "#95a5a6";        // Cinza para outros
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
          
          return (
            <div
              key={item.id}
              className="bg-white rounded-lg shadow-md flex items-center justify-center text-gray-700 font-semibold overflow-hidden"
            >
              {/* RENDERIZAÇÃO SIMPLES BASEADA NO TIPO */}
              {item.signalType === 'hr' && (
                <ChartCard 
                  title={`Heart Rate (${chartData.length} points)`}
                  color={chartColor}
                  data={chartData}
                  width={280}
                  height={180}
                />
              )}
              
              {item.signalType !== 'hr' && (
                <div className="text-center text-gray-500">
                  <h3 className="font-medium">{item.label}</h3>
                  <p className="text-sm">Coming soon...</p>
                </div>
              )}
            </div>
          );
        })}
      </GridLayout>
    </div>
  );
};

export default MainGrid;