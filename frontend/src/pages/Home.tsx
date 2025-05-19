import React, { useEffect, useRef, useState } from "react";
import { useWebSocket } from "../hooks/useWebSocket";
import { scaleLinear } from "@visx/scale";
import { Group } from "@visx/group";
import { LinePath } from "@visx/shape";
import { AxisLeft, AxisBottom } from "@visx/axis";
import { curveMonotoneX } from "@visx/curve";

interface SignalPoint {
  timestamp: number;
  value: number;
}

interface SimulatorData {
  ecg: SignalPoint | null;
  eeg: SignalPoint | null;
  ppg: SignalPoint | null;
}

interface DataPoint {
  x: number;
  ecg?: number;
  eeg?: number;
  ppg?: number;
}

const width = 800;
const height = 200;
const margin = { top: 20, right: 20, bottom: 30, left: 40 };
const INITIAL_WINDOW_SIZE = 20;

export default function Home() {
  const { data } = useWebSocket<SimulatorData>(
    "ws://localhost:8000/ws/simulator/latest"
  );
  const [series, setSeries] = useState<DataPoint[]>([]);
  const elapsedSeconds = useRef(0);
  const [showAllData, setShowAllData] = useState(false);
  
  useEffect(() => {
    if (!data) return;

    const newPoint: DataPoint = {
      x: elapsedSeconds.current,
      ecg: data.ecg?.value,
      eeg: data.eeg?.value,
      ppg: data.ppg?.value,
    };

    elapsedSeconds.current += 1;

    setSeries((prev) => {
      const updated = [...prev, newPoint];
      // Se ultrapassou o tamanho inicial da janela, ativa a exibição de todos os dados
      if (elapsedSeconds.current > INITIAL_WINDOW_SIZE && !showAllData) {
        setShowAllData(true);
      }
      return updated;
    });
  }, [data, showAllData]);

  const getXScale = (data: DataPoint[]) => {
    // Se estamos mostrando todos os dados ou ainda não temos dados suficientes
    if (showAllData || elapsedSeconds.current <= INITIAL_WINDOW_SIZE) {
      return scaleLinear({
        domain: [0, Math.max(INITIAL_WINDOW_SIZE, elapsedSeconds.current)],
        range: [margin.left, width - margin.right],
      });
    } else {
      // Caso contrário, mostra apenas os últimos INITIAL_WINDOW_SIZE segundos
      return scaleLinear({
        domain: [
          Math.max(0, elapsedSeconds.current - INITIAL_WINDOW_SIZE),
          elapsedSeconds.current,
        ],
        range: [margin.left, width - margin.right],
      });
    }
  };

  const getYScale = (data: DataPoint[], key: keyof DataPoint) => {
    const values = data.map((d) => d[key]).filter((v) => typeof v === "number") as number[];
    const min = Math.min(...values, 0);
    const max = Math.max(...values, 1);
    return scaleLinear({
      domain: [min, max],
      range: [height - margin.bottom, margin.top],
      nice: true,
    });
  };

  const renderSignalChart = (
    title: string,
    color: string,
    key: keyof DataPoint
  ) => {
    const xScale = getXScale(series);
    
    // Determinar quais dados mostrar com base na configuração
    let visibleData = series;
    if (!showAllData && elapsedSeconds.current > INITIAL_WINDOW_SIZE) {
      // Se não estamos mostrando todos os dados e temos mais de INITIAL_WINDOW_SIZE
      // pegamos apenas os últimos INITIAL_WINDOW_SIZE pontos
      const startIndex = Math.max(0, elapsedSeconds.current - INITIAL_WINDOW_SIZE);
      visibleData = series.filter((d) => d.x >= startIndex);
    }

    const yScale = getYScale(visibleData, key);

    return (
      <div>
        <h2 className="text-lg font-semibold mb-2">{title}</h2>
        <svg width={width} height={height}>
          <Group>
            <AxisBottom
              scale={xScale}
              top={height - margin.bottom}
              tickFormat={(v) => `${v}s`}
            />
            <AxisLeft scale={yScale} left={margin.left} />
            <LinePath
              data={visibleData}
              x={(d) => xScale(d.x)}
              y={(d) => yScale(d[key] ?? 0)}
              stroke={color}
              strokeWidth={2}
              curve={curveMonotoneX}
            />
          </Group>
        </svg>
      </div>
    );
  };

  return (
    <div className="p-4 space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Control Room Dashboard (VisX)</h1>
        <div className="flex items-center">
          <input
            type="checkbox"
            id="showAllData"
            checked={showAllData}
            onChange={(e) => setShowAllData(e.target.checked)}
            className="mr-2"
          />
          <label htmlFor="showAllData" className="text-sm">
            Mostrar todo o histórico
          </label>
        </div>
      </div>

      {renderSignalChart("ECG (bpm)", "#8884d8", "ecg")}
      {renderSignalChart("EEG (ondas cerebrais)", "#82ca9d", "eeg")}
      {renderSignalChart("PPG (pulse)", "#ff7300", "ppg")}
    </div>
  );
}