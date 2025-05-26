import { useEffect, useRef, useState } from "react";
import ChartCard from "frontend/src/components/ChartCard";
import GridLayout from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

export default function MainGrid({ items, layout, onLayoutChange, series}) {
  const containerRef = useRef(null);
  const [gridProps, setGridProps] = useState({
    cols: 4,
    rowHeight: 200,
    width: 800,
  });

  const ITEM_WIDTH = 300; // Desired item width
  const GAP = 16; // Gap between grid items

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
    };

    calculateGrid();
    window.addEventListener("resize", calculateGrid);
    return () => window.removeEventListener("resize", calculateGrid);
  }, []);

  // Layout definition for RGL
  const initialLayout = layout.length
    ? layout
    : items.map((item, i) => ({
        i: item.id.toString(),
        x: i % gridProps.cols,
        y: Math.floor(i / gridProps.cols),
        w: 1,
        h: 1,
    }));

    const completeLayout = initialLayout.map((l) => {
        const item = items.find((i) => i.id.toString() === l.i);
        return item 
            ? l
            : null;
    }).filter(Boolean);

    const missingItems = items.filter(
        (i) => !completeLayout.find((l) => l.i === i.id.toString())
    );

    const layoutWithMissing = [
        ...completeLayout,
        ...missingItems.map((item, i) => ({
            i: item.id.toString(),
            x: (completeLayout.length + i) % gridProps.cols,
            y: Math.floor((completeLayout.length + i) / gridProps.cols),
            w: 1,
            h: 1,
        })),
    ];


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
            {items.map((item) => (
            <div
                key={item.id}
                className="bg-white rounded-lg shadow-md flex items-center justify-center text-gray-700 font-semibold overflow-hidden"
            >
                {/* Exemplo: mostra gráfico de ECG para todos os cards */}
                <ChartCard title="ECG" color="#8884d8" data={series.map(p => ({ x: p.x, value: p.ecg ?? 0 }))} />
            </div>
            ))}
        </GridLayout>
    </div>
    );
}
