// EegRawCard.tsx
import React from "react";
import { scaleLinear } from "@visx/scale";
import { Group } from "@visx/group";
import { LinePath } from "@visx/shape";
import { AxisLeft, AxisBottom } from "@visx/axis";
import { curveMonotoneX } from "@visx/curve";

// Interface para um ponto de dados de um canal EEG
interface EegChannelPoint {
  x: number; // Tempo em segundos
  value: number; // Valor do sinal
}

// Interface para os dados brutos do EEG, onde 'value' é um objeto com canais
interface EegRawData {
  timestamp: number;
  value: {
    ch0?: number[];
    ch1?: number[];
    ch2?: number[];
    ch3?: number[];
    // Adicione mais canais conforme necessário
  };
}

interface EegRawCardProps {
  title: string;
  data: { [key: string]: EegChannelPoint[] }; // Objeto onde a chave é o nome do canal (ex: 'ch0') e o valor é um array de pontos
  width?: number;
  height?: number;
  unit?: string;
}

const EegRawCard: React.FC<EegRawCardProps> = ({
  title,
  data,
  width = 300,
  height = 150,
  unit = "µV",
}) => {
  const margin = { top: 10, right: 10, bottom: 30, left: 40 };

  // Obter todos os valores de todos os canais para determinar o domínio Y
  const allYValues: number[] = [];
  Object.values(data).forEach(channelData => {
    channelData.forEach(point => allYValues.push(point.value));
  });

  if (allYValues.length === 0) {
    return (
      <div className="w-full h-full p-2 flex items-center justify-center">
        <div className="text-center text-gray-500">
          <h2 className="text-sm font-medium mb-2">{title}</h2>
          <p className="text-xs">A aguardar dados EEG brutos...</p>
        </div>
      </div>
    );
  }

  // Determinar o domínio X com base nos dados disponíveis
  const allXValues: number[] = [];
  Object.values(data).forEach(channelData => {
    channelData.forEach(point => allXValues.push(point.x));
  });

  let maxTime: number = Math.max(...allXValues);
  // Ajustado para 1 segundo de janela
  let minTime: number = maxTime - 1; 

  if (minTime < Math.min(...allXValues)) {
    minTime = Math.min(...allXValues);
  }

  const xScale = scaleLinear({
    domain: [minTime, maxTime],
    range: [margin.left, width - margin.right],
  });

  let yMin = Math.min(...allYValues);
  let yMax = Math.max(...allYValues);

  // Ajustar o domínio Y para ser simétrico em torno de zero, comum para EEG
  const absMax = Math.max(Math.abs(yMin), Math.abs(yMax));
  yMin = -absMax;
  yMax = absMax;

  const yPadding = (yMax - yMin) * 0.1 || 1;

  const yScale = scaleLinear({
    domain: [yMin - (yMin < 0 ? yPadding : 0), yMax + yPadding],
    range: [height - margin.bottom, margin.top],
    nice: true,
  });

  const getDisplayPrecision = (value: number) => value.toFixed(2);

  // Cores para os canais (pode ser expandido)
  const channelColors = {
    ch0: "#e74c3c", // Vermelho
    ch1: "#27ae60", // Verde
    ch2: "#3498db", // Azul
    ch3: "#f39c12", // Laranja
    // Adicione mais cores para mais canais
  };

  return (
    <div className="w-full h-full p-2">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-sm font-medium">{title}</h2>
        <div className="text-right">
          <div className="text-sm font-bold" style={{ color: "#8884d8" }}>
            EEG Raw ({unit})
          </div>
          <div className="text-xs text-gray-500">
            Canais: {Object.keys(data).length}
          </div>
        </div>
      </div>

      <svg width={width} height={height}>
        <Group>
          <AxisBottom
            scale={xScale}
            top={height - margin.bottom}
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
            tickFormat={(v) => getDisplayPrecision(Number(v))}
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
              key={`grid-line-y-${i}`}
              x1={margin.left}
              y1={yScale(tick)}
              x2={width - margin.right}
              y2={yScale(tick)}
              stroke="#eee"
              strokeDasharray="4,4"
              strokeWidth={1}
            />
          ))}

          {Object.entries(data).map(([channelName, channelData]) => (
            <LinePath
              key={`eeg-line-${channelName}`}
              data={channelData}
              x={(d) => xScale(d.x)}
              y={(d) => yScale(d.value)}
              stroke={channelColors[channelName as keyof typeof channelColors] || "#95a5a6"}
              strokeWidth={1.5}
              curve={curveMonotoneX}
            />
          ))}

          {/* Opcional: Adicionar círculos para o último ponto de cada canal */}
          {Object.entries(data).map(([channelName, channelData]) => {
            if (channelData.length > 0) {
              const lastPoint = channelData[channelData.length - 1];
              return (
                <circle
                  key={`eeg-last-point-${channelName}`}
                  cx={xScale(lastPoint.x)}
                  cy={yScale(lastPoint.value)}
                  r={3}
                  fill={channelColors[channelName as keyof typeof channelColors] || "#95a5a6"}
                  opacity={0.8}
                />
              );
            }
            return null;
          })}
        </Group>
      </svg>

      <div className="flex justify-between text-xs text-gray-500 mt-1">
        <span>Min Y: {getDisplayPrecision(yMin)} {unit}</span>
        <span>Max Y: {getDisplayPrecision(yMax)} {unit}</span>
      </div>
    </div>
  );
};

export default EegRawCard;
