// components/card/FaceLandmarksCard.tsx
import React, { useEffect, useRef, useState } from 'react';
import CardWrapper from './CardWrapper'; // Importar o CardWrapper

interface FaceLandmarksData {
  landmarks: number[][]; // Array de [x, y, z] pontos normalizados (0 a 1)
  gaze_vector: { dx: number; dy: number };
  ear: number; // Eye Aspect Ratio
  blink_rate: number;
  blink_counter: number;
  confidence: number;
  frame_b64: string; // Imagem em base64 (mantida na interface, mas não usada para renderização direta dos pontos)
  attentionPattern: string;
  isBlinking: boolean;
  frameNumber: number;
  frameTimestamp: number;
  anomalyType: string;
}

interface FaceLandmarksContentProps {
  data: FaceLandmarksData;
  cardWidth: number;
  cardHeight: number;
}

const FaceLandmarksCardContent: React.FC<FaceLandmarksContentProps> = ({
  data,
  cardWidth,
  cardHeight,
}) => {
  const {
    landmarks,
    gaze_vector, // Mantido para referência, mas não usado na visualização atual
    ear = 0, // Adicionado valor padrão
    blink_rate = 0, // Adicionado valor padrão
    confidence = 0, // Adicionado valor padrão
    attentionPattern = 'normal', // Adicionado valor padrão
    isBlinking = false, // Adicionado valor padrão
    anomalyType = 'normal', // Adicionado valor padrão
  } = data;

  // Definir margens para o SVG para dar espaço aos textos
  const svgMarginTop = 10;
  const svgMarginBottom = 100; // Espaço para as métricas abaixo
  const svgMarginLeft = 10;
  const svgMarginRight = 10;

  const svgWidth = cardWidth - svgMarginLeft - svgMarginRight;
  const svgHeight = cardHeight - svgMarginTop - svgMarginBottom;

  // Escalas para mapear os landmarks normalizados (0-1) para as dimensões do SVG
  // Invertemos o eixo Y para que o 0 esteja no topo (como em coordenadas de tela)
  const xScale = (val: number) => val * svgWidth;
  const yScale = (val: number) => val * svgHeight;

  return (
    <div className="flex flex-col items-center justify-between w-full h-full p-2">
      <div className="relative flex-1 w-full flex items-center justify-center bg-gray-50 rounded-md overflow-hidden">
        {landmarks && landmarks.length > 0 ? (
          <svg
            width={svgWidth}
            height={svgHeight}
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            className="border border-gray-300 rounded-md"
          >
            {/* Desenha cada landmark como um pequeno círculo */}
            {landmarks.map((point, index) => {
              // Ignoramos a coordenada Z para a visualização 2D
              if(index < 68){
                const [x, y] = point;
                return (
                    <circle
                    key={index}
                    cx={xScale(x)}
                    cy={yScale(y)}
                    r={1.5} // Raio pequeno para os pontos
                    fill="#e74c3c" // Cor vermelha para os pontos
                    opacity={0.7}
                    // Adicionado transition para animar o movimento dos pontos
                    style={{ transition: 'cx 0.5s linear, cy 0.5s linear' }}
                    />
                );
              }
            })}
            {/* Opcional: Desenhar um círculo no centro da face (aproximado) */}
            {landmarks.length > 0 && (
              <circle
                cx={xScale(landmarks[29][0])} // Usando o primeiro landmark como referência de centro
                cy={yScale(landmarks[29][1])}
                r={3}
                fill="#3498db" // Azul para o centro
                opacity={0.9}
                // Adicionado transition para animar o movimento do ponto central
                style={{ transition: 'cx 0.1s linear, cy 0.1s linear' }}
              />
            )}
          </svg>
        ) : (
          <p className="text-gray-500">A aguardar pontos de landmarks...</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-700 mt-2 w-full max-w-xs">
        <span className="font-semibold">EAR:</span> <span>{ear.toFixed(2)}</span>
        <span className="font-semibold">Blink Rate:</span> <span>{blink_rate.toFixed(1)} bpm</span>
        <span className="font-semibold">Confiança:</span> <span>{(confidence * 100).toFixed(1)}%</span>
        <span className="font-semibold">Atenção:</span> <span>{attentionPattern.replace(/_/g, ' ')}</span>
        <span className="font-semibold">A piscar:</span> <span>{isBlinking ? 'Sim' : 'Não'}</span>
        <span className="font-semibold">Anomalia:</span> <span className={`${anomalyType !== 'normal' ? 'text-red-500 font-bold' : ''}`}>{anomalyType.replace(/_/g, ' ')}</span>
      </div>
    </div>
  );
};

interface FaceLandmarksCardProps {
  title: string;
  data: FaceLandmarksData | null;
  width?: number;
  height?: number;
}

const FaceLandmarksCard: React.FC<FaceLandmarksCardProps> = ({
  title,
  data,
  width,
  height,
}) => {
  // A condição hasData verifica se os dados existem e se há landmarks
  const hasData = data !== null && data.landmarks && data.landmarks.length > 0;

  // console.log("FaceLandmarksCard - data prop:", data); // Manter para depuração se necessário
  // console.log("FaceLandmarksCard - hasData:", hasData); // Manter para depuração se necessário

  const headerContent = (
    <div className="text-right text-sm text-gray-700">
      {data && (
        <>
          <p>Frame: {data.frameNumber ?? 'N/A'}</p>
          <p>Tempo: {data.frameTimestamp?.toFixed(1) ?? 'N/A'}s</p>
        </>
      )}
    </div>
  );

  return (
    <CardWrapper
      title={title}
      width={width}
      height={height}
      isLoading={!hasData}
      noDataMessage="A aguardar dados de Face Landmarks..."
      headerContent={headerContent}
    >
      {hasData ? (
        <FaceLandmarksCardContent
          data={data}
          cardWidth={width || 300}
          cardHeight={height || 200}
        />
      ) : null}
    </CardWrapper>
  );
};

export default FaceLandmarksCard;
