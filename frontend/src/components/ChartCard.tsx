// ChartCard.tsx
import React from "react";
import { scaleLinear } from "@visx/scale";
import { Group } from "@visx/group";
import { LinePath } from "@visx/shape";
import { AxisLeft, AxisBottom } from "@visx/axis";
import { curveMonotoneX } from "@visx/curve";

interface Point {
  x: number;   // Tempo em segundos
  value: number; // Valor (ex: HR em bpm)
}

interface ChartCardProps {
  title: string;
  data: Point[];
  color: string;
  width?: number;
  height?: number;
  unit?: string;
}

const ChartCard: React.FC<ChartCardProps> = ({
  title,
  data,
  color,
  width = 300,
  height = 150,
  unit = "",
}) => {
  const margin = { top: 10, right: 10, bottom: 30, left: 40 };

  if (data.length === 0) {
    return (
      <div className="w-full h-full p-2 flex items-center justify-center">
        <div className="text-center text-gray-500">
          <h2 className="text-sm font-medium mb-2">{title}</h2>
          <p className="text-xs">Waiting for data...</p>
        </div>
      </div>
    );
  }

  // Definir a duração da janela de visualização por tipo de sinal
  let windowDuration: number;
  switch (unit) {
    case 'bpm':
      windowDuration = 50; // HR pode ter uma janela mais longa, ex: 10 segundos
      break;
    case 'mV':
      windowDuration = 10; // ECG geralmente precisa de uma janela mais curta, ex: 5 segundos
      break;
    case 'eeg':
      windowDuration = 5; // EEG também pode ser mais curto
      break;
    case 'steering':
      windowDuration = 10; // Direção pode ser mais longa
      break;
    case 'speed':
      windowDuration = 10; // Velocidade pode ser mais longa
      break;
    default:
      windowDuration = 5; // Duração padrão para outros sinais
      break;
  }

  // Cálculo de minTime e maxTime para janela deslizante
  let maxTime: number = data[data.length - 1].x;
  let minTime: number = maxTime - windowDuration;
  
  // Garantir que minTime não vá para o negativo se a duração total dos dados for menor que windowDuration
  if (data.length > 0 && minTime < data[0].x) {
    minTime = data[0].x;
  }

  // Se a diferença entre maxTime e minTime ainda for muito pequena (poucos dados),
  // garantir que o domínio X tenha uma largura mínima para visualização.
  if ((maxTime - minTime) < 1) { 
      minTime = maxTime - 1; // Garante pelo menos 1 segundo de largura
      if (minTime < 0) minTime = 0; // Evita valores negativos
  }

  const xScale = scaleLinear({
    domain: [minTime, maxTime],
    range: [margin.left, width - margin.right],
  });

  const yValues = data.map((d) => d.value);
  let yMin = Math.min(...yValues);
  let yMax = Math.max(...yValues);
  
  // Lógica para definir a origem do eixo Y (0) com base no tipo de sinal
  if (unit === "bpm" || unit === "km/h" || unit === "deg" || unit === "m/s²") {
    yMin = 0;
  } else if (unit === "mV" || unit === "µV" || unit === "deg/s") {
    const absMax = Math.max(Math.abs(yMin), Math.abs(yMax));
    yMin = -absMax;
    yMax = absMax;
  }

  const yPadding = (yMax - yMin) * 0.1 || 1;
  
  const yScale = scaleLinear({
    domain: [yMin - (yMin < 0 ? yPadding : 0), yMax + yPadding],
    range: [height - margin.bottom, margin.top],
    nice: true,
  });

  const currentValue = data[data.length - 1]?.value;
  const avgValue = data.length > 0 ? 
    (data.reduce((sum, d) => sum + d.value, 0) / data.length) : 0;
  const minValue = Math.min(...yValues);
  const maxValue = Math.max(...yValues);

  const getDisplayPrecision = (value: number, currentUnit: string) => {
    if(currentUnit === "bpm" || currentUnit === "deg" || currentUnit === "km/h"){
      return value.toFixed(0);
    }
    return value.toFixed(2);
  }

  return (
    <div className="w-full h-full p-2">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-sm font-medium">{title}</h2>
        <div className="text-right">
          <div className="text-sm font-bold" style={{ color }}>
            {currentValue !== undefined ? `${getDisplayPrecision(currentValue, unit)} ${unit}` : "N/A"}
          </div>
          <div className="text-xs text-gray-500">
            Avg: {getDisplayPrecision(avgValue, unit)} {unit}
          </div>
        </div>
      </div>

      <svg width={width} height={height}>
        <Group>
          <AxisBottom
            scale={xScale}
            top={height - margin.bottom}
            // ✅ ATUALIZADO: Mostra o tempo absoluto (em segundos)
            tickFormat={(v) => `${Number(v).toFixed(0)}s`} 
            numTicks={5}
            stroke="#ccc"
            tickLabelProps={() => ({
              fill: "#666",
              fontSize: 10,
              textAnchor: "middle",
            })}
          />
          <AxisLeft 
            scale={yScale} 
            left={margin.left}
            tickFormat={(v) => getDisplayPrecision(Number(v), unit)}
            numTicks={4}
            stroke="#ccc"
            tickLabelProps={() => ({
              fill: "#666",
              fontSize: 10,
              textAnchor: "end",
            })}
          />
          
          {yScale.ticks(4).map((tick, i) => (
            <line
              key = {`grid-line-y-${i}`}
              x1 = {margin.left}
              y1 = {yScale(tick)}
              x2 = {width - margin.right}
              y2 = {yScale(tick)}
              stroke = "#eee"
              strokeDasharray = "4,4"
              strokeWidth = {1}
            />
          ))}
          
          <LinePath
            data={data}
            x={(d) => xScale(d.x)}
            y={(d) => yScale(d.value)}
            stroke={color}
            strokeWidth={2}
            curve={curveMonotoneX}
          />
          
          {data.length > 0 && (
            <circle
              cx={xScale(data[data.length - 1].x)}
              cy={yScale(data[data.length - 1].value)}
              r={4}
              fill={color}
              opacity={0.8}
            />
          )}
        </Group>
      </svg>

      <div className="flex justify-between text-xs text-gray-500 mt-1">
        <span>Min: {getDisplayPrecision(minValue, unit)} {unit}</span>
        <span>Max: {getDisplayPrecision(maxValue, unit)} {unit}</span>
        <span>{data.length} points</span>
      </div>
    </div>
  );
};

export default ChartCard;