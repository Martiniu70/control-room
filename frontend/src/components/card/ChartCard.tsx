// ChartCard.tsx
import React from "react";
import { scaleLinear } from "@visx/scale";
import { Group } from "@visx/group";
import { LinePath } from "@visx/shape";
import { AxisLeft, AxisBottom } from "@visx/axis";
import { curveMonotoneX } from "@visx/curve";
import CardWrapper from './CardWrapper'; // Importar o CardWrapper

interface Point {
  x: number;   // Tempo em segundos
  value: number; // Valor (ex: HR em bpm)
}

interface ChartContentProps { // Renomeado para indicar que é o conteúdo
  data: Point[];
  color: string;
  unit?: string;
  cardWidth: number; // Recebe a largura do CardWrapper
  cardHeight: number; // Recebe a altura do CardWrapper
}

const ChartCardContent: React.FC<ChartContentProps> = ({
  data,
  color,
  unit = "",
  cardWidth,
  cardHeight,
}) => {
  // Margens que você ajustou anteriormente
  const margin = { top: 25, right: 40, bottom: 120, left: 30 };

  // Definir a duração da janela de visualização por tipo de sinal
  let windowDuration: number;
  switch (unit) {
    case 'bpm':
      windowDuration = 50; 
      break;
    case 'mV':
      windowDuration = 10; 
      break;
    case 'eeg':
      windowDuration = 5; 
      break;
    case 'steering':
      windowDuration = 10; 
      break;
    case 'speed':
      windowDuration = 10; 
      break;
    default:
      windowDuration = 5; 
      break;
  }

  // Cálculo de minTime e maxTime para janela deslizante
  let maxTime: number = data[data.length - 1]?.x || 0;
  let minTime: number = maxTime - windowDuration;
  
  if (data.length > 0 && minTime < data[0].x) {
    minTime = data[0].x;
  }

  if ((maxTime - minTime) < 1) { 
      minTime = maxTime - 1; 
      if (minTime < 0) minTime = 0; 
  }

  const xScale = scaleLinear({
    domain: [minTime, maxTime],
    range: [margin.left, cardWidth - margin.right],
  });

  const yValues = data.map((d) => d.value);
  const yMinData = Math.min(...yValues);
  const yMaxData = Math.max(...yValues);
  
  let domainYMin: number;
  let domainYMax: number;

  const dataAmplitude = yMaxData - yMinData;
  const dynamicYPadding = dataAmplitude * 0.1 || 1; 

  if (unit === "bpm" || unit === "km/h" || unit === "deg" || unit === "m/s²") {
    domainYMin = 0;
    domainYMax = yMaxData + dynamicYPadding;
    if (domainYMax - domainYMin < 2) { 
      domainYMax = domainYMin + 2;
    }
  } else if (unit === "mV" || unit === "µV" || unit === "deg/s") {
    const absMaxData = Math.max(Math.abs(yMinData), Math.abs(yMaxData));
    domainYMin = -absMaxData - dynamicYPadding;
    domainYMax = absMaxData + dynamicYPadding;
    if (absMaxData === 0) {
      domainYMin = -1 - dynamicYPadding;
      domainYMax = 1 + dynamicYPadding;
    }
  } else {
    domainYMin = yMinData - dynamicYPadding;
    domainYMax = yMaxData + dynamicYPadding;
    if (domainYMax - domainYMin < 2) {
      const center = (yMinData + yMaxData) / 2;
      domainYMin = center - 1;
      domainYMax = center + 1;
    }
  }
  
  const yScale = scaleLinear({
    domain: [domainYMin, domainYMax],
    range: [cardHeight - margin.bottom, margin.top],
    nice: true, 
  });

  const minValue = Math.min(...yValues);
  const maxValue = Math.max(...yValues);

  const getDisplayPrecision = (value: number, currentUnit: string) => {
    if(currentUnit === "bpm" || currentUnit === "deg" || currentUnit === "km/h"){
      return value.toFixed(0);
    }
    return value.toFixed(2);
  }

  // Definir as dimensões da área de plotagem para o clipPath
  const plotX = margin.left + 5;
  const plotY = margin.top;
  const plotWidth = cardWidth - margin.left - margin.right;
  const plotHeight = cardHeight - margin.top - margin.bottom;

  return (
    <div className="w-full h-full flex flex-col justify-between">
      <svg width={cardWidth} height={cardHeight}>
        {/* Definir o clipPath */}
        <defs>
          <clipPath id="chart-clip">
            <rect 
              x={plotX} 
              y={plotY} 
              width={plotWidth} 
              height={plotHeight} 
            />
          </clipPath>
        </defs>

        <Group>
          <AxisBottom
            scale={xScale}
            top={cardHeight - margin.bottom}
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
              x2 = {cardWidth - margin.right}
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
            // Aplicar o clipPath aqui
            clipPath="url(#chart-clip)" 
          />
          
          {data.length > 0 && (
            <circle
              cx={xScale(data[data.length - 1].x)}
              cy={yScale(data[data.length - 1].value)}
              r={4}
              fill={color}
              opacity={0.8}
              // Aplicar o clipPath também ao círculo para consistência
              clipPath="url(#chart-clip)" 
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

// Componente Wrapper para uso externo
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
    width,
    height,
    unit = "",
}) => {
    const currentValue = data[data.length - 1]?.value;
    const avgValue = data.length > 0 ? 
      (data.reduce((sum, d) => sum + d.value, 0) / data.length) : 0;

    const getDisplayPrecision = (value: number, currentUnit: string) => {
        if(currentUnit === "bpm" || currentUnit === "deg" || currentUnit === "km/h"){
          return value.toFixed(0);
        }
        return value.toFixed(2);
    }

    const headerContent = (
        <div className="text-right">
            <div className="text-sm font-bold" style={{ color }}>
                {currentValue !== undefined ? `${getDisplayPrecision(currentValue, unit)} ${unit}` : "N/A"}
            </div>
            <div className="text-xs text-gray-500">
                Avg: {getDisplayPrecision(avgValue, unit)} {unit}
            </div>
        </div>
    );

    return (
        <CardWrapper
            title={title}
            width={width}
            height={height}
            isLoading={!data || data.length === 0}
            noDataMessage="Waiting for data..."
            headerContent={headerContent}
        >
            {data && data.length > 0 ? (
                <ChartCardContent
                    data={data}
                    color={color}
                    unit={unit}
                    cardWidth={width || 300} 
                    cardHeight={height || 200} 
                />
            ) : null}
        </CardWrapper>
    );
};

export default ChartCard;