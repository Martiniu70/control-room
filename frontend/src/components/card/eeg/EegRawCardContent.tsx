// components/EegRawCardContent.tsx
import React, { useState } from "react"; // Importar useState
import { scaleLinear } from "@visx/scale";
import { Group } from "@visx/group";
import { LinePath } from "@visx/shape";
import { AxisLeft, AxisBottom } from "@visx/axis";
import { curveMonotoneX } from "@visx/curve";

// NOVO: Interface para as props de conteúdo do EegRawCard
// Agora estende VisualizationContentProps do CardWrapper
import { VisualizationContentProps } from '../CardWrapper';
// Não importa CardWrapper aqui, pois este é o conteúdo interno

// Interface para um ponto de dados de um canal EEG
interface EegChannelPoint {
  x: number; // Tempo em segundos
  value: number; // Valor do sinal
} // Importar do CardWrapper

interface EegRawContentProps extends VisualizationContentProps {
  data: { [key: string]: EegChannelPoint[] }; // Dados específicos para EEG Raw
  unit?: string;
  selectedChannelKey?: string; // Canal selecionado para visualização
  // cardWidth e cardHeight já vêm de VisualizationContentProps
}

const EegRawCardContent: React.FC<EegRawContentProps> = ({
  data,
  unit = "µV",
  cardWidth = 300, // Fornecer um valor padrão
  cardHeight = 100, // Fornecer um valor padrão
  selectedChannelKey, // Recebe o canal selecionado
}) => {
  // Gerar um ID único para o clipPath para evitar colisões
  const [clipId] = useState(() => `eeg-raw-clip-${Math.random().toString(36).substr(2, 9)}`); //

  const margin = { top: 15, right: 30, bottom: 40, left: 40 }; // Margens ajustadas para a área de visualização

  // Filtrar os dados com base no canal selecionado
  const channelsToDisplay = selectedChannelKey
    ? { [selectedChannelKey]: data[selectedChannelKey] || [] } // Apenas o canal selecionado
    : data; // Todos os canais

  // Obter todos os valores de todos os canais para determinar o domínio Y
  const allYValues: number[] = [];
  Object.values(channelsToDisplay).forEach(channelData => {
    channelData.forEach(point => allYValues.push(point.value));
  });

  // Determinar o domínio X com base nos dados disponíveis
  const allXValues: number[] = [];
  Object.values(channelsToDisplay).forEach(channelData => {
    channelData.forEach(point => allXValues.push(point.x));
  });

  // --- Lógica de domínio X (Tempo) ---
  let maxTime: number = 0;
  let minTime: number = 0;
  const windowDuration = 1; // 1 segundo de janela de visualização

  if (allXValues.length > 0) {
    maxTime = Math.max(...allXValues);
    minTime = maxTime - windowDuration;

    // Garante que minTime não seja menor que o tempo inicial dos dados
    if (minTime < Math.min(...allXValues)) {
      minTime = Math.min(...allXValues);
    }
  } else {
    // Valores padrão se não houver dados
    maxTime = 1;
    minTime = 0;
  }

  const xScale = scaleLinear({
    domain: [minTime, maxTime],
    range: [margin.left, cardWidth - margin.right],
  });

  // --- Lógica de domínio Y (Valores do Sinal) ---
  let yMinData = 0;
  let yMaxData = 0;

  if (allYValues.length > 0) {
    yMinData = Math.min(...allYValues);
    yMaxData = Math.max(...allYValues);
  } else {
    // Valores padrão se não houver dados
    yMinData = -1;
    yMaxData = 1;
  }

  // EEG é tipicamente bipolar, centrado em 0
  const absMaxData = Math.max(Math.abs(yMinData), Math.abs(yMaxData));
  // Padding de 10% do valor absoluto máximo, com um mínimo de 1 para evitar divisão por zero ou ranges muito pequenos
  const dynamicYPadding = absMaxData * 0.1 || 1;

  let domainYMin: number;
  let domainYMax: number;

  // Garantir que o domínio seja simétrico em torno de zero e tenha padding
  domainYMin = -absMaxData - dynamicYPadding;
  domainYMax = absMaxData + dynamicYPadding;

  // Se absMaxData é 0 (todos os valores são 0), garantir um domínio simétrico mínimo
  if (absMaxData === 0) {
    domainYMin = -1 - dynamicYPadding;
    domainYMax = 1 + dynamicYPadding;
  }

  const yScale = scaleLinear({
    domain: [domainYMin, domainYMax],
    range: [cardHeight - margin.bottom, margin.top],
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
              x2={cardWidth - margin.right}
              y2={yScale(tick)}
              stroke="#eee"
              strokeDasharray="4,4"
              strokeWidth={1}
            />
          ))}

          {Object.entries(channelsToDisplay).map(([channelName, channelData]) => (
            <LinePath
              key={`eeg-line-${channelName}`}
              data={channelData}
              x={(d) => xScale(d.x)}
              y={(d) => yScale(d.value)}
              stroke={channelColors[channelName as keyof typeof channelColors] || "#95a5a6"}
              strokeWidth={1.5}
              curve={curveMonotoneX}
              // Aplicar o clipPath aqui com o ID único
              clipPath={`url(#${clipId})`} //
            />
          ))}

          {/* Opcional: Adicionar círculos para o último ponto de cada canal */}
          {Object.entries(channelsToDisplay).map(([channelName, channelData]) => {
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
                  // Aplicar o clipPath também ao círculo para consistência
                  clipPath={`url(#${clipId})`} //
                />
              );
            }
            return null;
          })}
        </Group>
      </svg>
    </div>
  );
};

export default EegRawCardContent;