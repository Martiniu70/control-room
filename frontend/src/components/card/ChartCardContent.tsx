// src/components/card/ChartCardContent.tsx
import React, { useMemo, useCallback, useState } from "react"; // Importar useState
import { scaleLinear } from "@visx/scale";
import { Group } from "@visx/group";
import { LinePath } from "@visx/shape";
import { AxisLeft, AxisBottom } from "@visx/axis";
import { curveMonotoneX } from "@visx/curve";

// Importar a interface VisualizationContentProps do CardWrapper
import { VisualizationContentProps } from './CardWrapper'; // Caminho ajustado

// Interface para um ponto de dados de gráfico
interface Point {
  x: number;   // Tempo em segundos
  value: number; // Valor (ex: HR em bpm)
}

// Interface para as props do componente de conteúdo do gráfico
interface ChartContentProps extends VisualizationContentProps {
  data: Point[];
  color: string;
  unit?: string;
  // cardWidth e cardHeight já vêm de VisualizationContentProps
}

const ChartCardContent: React.FC<ChartContentProps> = ({
  data,
  color,
  unit = "",
  cardWidth = 300, // Fornecer um valor padrão
  cardHeight = 100, // Fornecer um valor padrão
}) => {
  // Gerar um ID único para o clipPath para evitar colisões
  // Este ID será gerado uma vez por instância do componente
  const [clipId] = useState(() => `chart-clip-${Math.random().toString(36).substr(2, 9)}`);

  // Margens que você ajustou anteriormente, adaptadas à nova altura
  const margin = { top: 15, right: 30, bottom: 40, left: 40 }; // Margens ajustadas para a área de visualização

  // Definir a duração da janela de visualização por tipo de sinal
  const windowDuration = useMemo(() => { // Usar useMemo para windowDuration
    switch (unit) {
      case 'bpm':
        return 50;
      case 'mV':
        return 10;
      case 'µV':
        return 5;
      case 'deg':
        return 10;
      case 'km/h':
        return 10;
      default:
        return 5;
    }
  }, [unit]); // Recalcular se a unidade mudar

  // Cálculo de minTime e maxTime para janela deslizante
  const { minTime, maxTime } = useMemo(() => { // Usar useMemo para minTime/maxTime
    let currentMaxTime: number = data[data.length - 1]?.x || 0;
    let currentMinTime: number = currentMaxTime - windowDuration;

    if (data.length > 0 && currentMinTime < data[0].x) {
      currentMinTime = data[0].x;
    }

    if ((currentMaxTime - currentMinTime) < 1) {
        currentMinTime = currentMaxTime - 1;
        if (currentMinTime < 0) currentMinTime = 0;
    }
    return { minTime: currentMinTime, maxTime: currentMaxTime };
  }, [data, windowDuration]); // Recalcular se os dados ou a duração da janela mudarem

  const xScale = useMemo(() => scaleLinear({ // Usar useMemo para xScale
    domain: [minTime, maxTime],
    range: [margin.left, cardWidth - margin.right],
  }), [minTime, maxTime, cardWidth, margin.left, margin.right]); // Dependências para xScale

  const yValues = useMemo(() => data.map((d) => d.value), [data]); // Memoizar yValues
  const yMinData = yValues.length > 0 ? Math.min(...yValues) : 0;
  const yMaxData = yValues.length > 0 ? Math.max(...yValues) : 1;

  const { domainYMin, domainYMax } = useMemo(() => { // Usar useMemo para o domínio Y
    const dataAmplitude = yMaxData - yMinData;
    const dynamicYPadding = dataAmplitude * 0.1 || 1;

    let currentDomainYMin: number;
    let currentDomainYMax: number;

    if (unit === "bpm" || unit === "km/h" || unit === "deg" || unit === "m/s²") {
      currentDomainYMin = 0;
      currentDomainYMax = yMaxData + dynamicYPadding;
      if (currentDomainYMax - currentDomainYMin < 2) {
        currentDomainYMax = currentDomainYMin + 2;
      }
    } else if (unit === "mV" || unit === "µV" || unit === "deg/s") {
      const absMaxData = Math.max(Math.abs(yMinData), Math.abs(yMaxData));
      currentDomainYMin = -absMaxData - dynamicYPadding;
      currentDomainYMax = absMaxData + dynamicYPadding;
      if (absMaxData === 0) {
        currentDomainYMin = -1 - dynamicYPadding;
        currentDomainYMax = 1 + dynamicYPadding;
      }
    } else {
      currentDomainYMin = yMinData - dynamicYPadding;
      currentDomainYMax = yMaxData + dynamicYPadding;
      if (currentDomainYMax - currentDomainYMin < 2) {
        const center = (yMinData + yMaxData) / 2;
        currentDomainYMin = center - 1;
        currentDomainYMax = center + 1;
      }
    }
    return { domainYMin: currentDomainYMin, domainYMax: currentDomainYMax };
  }, [unit, yMinData, yMaxData]); // Dependências para o domínio Y

  const yScale = useMemo(() => scaleLinear({ // Usar useMemo para yScale
    domain: [domainYMin, domainYMax],
    range: [cardHeight - margin.bottom, margin.top],
    nice: true,
  }), [domainYMin, domainYMax, cardHeight, margin.bottom, margin.top]); // Dependências para yScale

  const getDisplayPrecision = useCallback((value: number, currentUnit: string) => { // Memoizar esta função
    if(currentUnit === "bpm" || currentUnit === "deg" || currentUnit === "km/h"){
      return value.toFixed(0);
    }
    return value.toFixed(2);
  }, []); // Sem dependências, pois é uma função pura

  // Definir as dimensões da área de plotagem para o clipPath
  const plotX = margin.left;
  const plotY = margin.top;
  const plotWidth = cardWidth - margin.left - margin.right;
  const plotHeight = cardHeight - margin.top - margin.bottom;

  return (
    <div className="w-full h-full flex flex-col justify-center items-center">
      <svg width={cardWidth} height={cardHeight}>
        {/* Definir o clipPath com um ID único */}
        <defs>
          <clipPath id={clipId}>
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
            // Aplicar o clipPath com o ID único
            clipPath={`url(#${clipId})`}
          />

          {data.length > 0 && (
            <circle
              cx={xScale(data[data.length - 1].x)}
              cy={yScale(data[data.length - 1].value)}
              r={4}
              fill={color}
              opacity={0.8}
              // Aplicar o clipPath também ao círculo para consistência
              clipPath={`url(#${clipId})`}
            />
          )}
        </Group>
      </svg>
    </div>
  );
};

export default ChartCardContent;
