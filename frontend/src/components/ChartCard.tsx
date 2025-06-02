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
}

const ChartCard: React.FC<ChartCardProps> = ({
  title,
  data,
  color,
  width = 300,
  height = 150,
}) => {
  const margin = { top: 10, right: 10, bottom: 30, left: 40 };

  // VERIFICAÇÃO: Se não há dados, mostrar mensagem
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

  // SCALES INTELIGENTES
  const xScale = scaleLinear({
    domain: [
      Math.max(0, data[0]?.x || 0), 
      Math.max(data[0]?.x + 30, data[data.length - 1]?.x || 30) // Mínimo 30s de janela
    ],
    range: [margin.left, width - margin.right],
  });

  const yValues = data.map((d) => d.value);
  const yMin = Math.min(...yValues, 0);
  const yMax = Math.max(...yValues, 1);
  
  const yScale = scaleLinear({
    domain: [yMin, yMax],
    range: [height - margin.bottom, margin.top],
    nice: true,
  });

  // ESTATÍSTICAS SIMPLES
  const currentValue = data[data.length - 1]?.value;
  const avgValue = data.length > 0 ? 
    (data.reduce((sum, d) => sum + d.value, 0) / data.length) : 0;
  const minValue = Math.min(...yValues);
  const maxValue = Math.max(...yValues);

  return (
    <div className="w-full h-full p-2">
      {/* HEADER COM INFORMAÇÃO ATUAL */}
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-sm font-medium">{title}</h2>
        <div className="text-right">
          <div className="text-sm font-bold" style={{ color }}>
            {currentValue?.toFixed(0)} bpm
          </div>
          <div className="text-xs text-gray-500">
            Avg: {avgValue.toFixed(0)}
          </div>
        </div>
      </div>

      {/*  GRÁFICO */}
      <svg width={width} height={height}>
        <Group>
          {/* EIXOS */}
          <AxisBottom
            scale={xScale}
            top={height - margin.bottom}
            tickFormat={(v) => `${Number(v).toFixed(0)}s`}
            numTicks={5}
          />
          <AxisLeft 
            scale={yScale} 
            left={margin.left}
            tickFormat={(v) => `${Number(v).toFixed(0)}`}
            numTicks={4}
          />
          
          {/* LINHA DO SINAL */}
          <LinePath
            data={data}
            x={(d) => xScale(d.x)}
            y={(d) => yScale(d.value)}
            stroke={color}
            strokeWidth={2}
            curve={curveMonotoneX}
          />
          
          {/* PONTO ATUAL */}
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

      {/* FOOTER COM ESTATÍSTICAS */}
      <div className="flex justify-between text-xs text-gray-500 mt-1">
        <span>Min: {minValue.toFixed(0)}</span>
        <span>Max: {maxValue.toFixed(0)}</span>
        <span>{data.length} points</span>
      </div>
    </div>
  );
};

export default ChartCard;