// components/card/FaceLandmarksCard.tsx
import React from 'react';
import CardWrapper from './CardWrapper'; // Importar o CardWrapper

// ATUALIZADO: Interface para os dados de Face Landmarks com a nova estrutura
interface FaceLandmarksData {
  landmarks: number[][]; // Array de [x, y, z] pontos normalizados (0 a 1)
  gaze_vector: { dx: number; dy: number };
  ear: number; // Eye Aspect Ratio
  blink_rate: number;
  blink_counter: number;
  frame_b64: string; // Imagem em base64
  timestamp: number; // NOVO: Adicionado o timestamp
  // 'confidence', 'attentionPattern', 'isBlinking', 'frameNumber', 'frameTimestamp', 'anomalyType' removidos
}

interface FaceLandmarksContentProps {
  data: FaceLandmarksData;
  cardWidth: number; // Largura do CardWrapper
  cardHeight: number; // Altura do CardWrapper
}

const FaceLandmarksCardContent: React.FC<FaceLandmarksContentProps> = ({
  data,
  cardWidth,
  cardHeight,
}) => {
  const {
    landmarks,
    // gaze_vector, // Não usado diretamente na visualização atual
    ear = 0,
    blink_rate = 0,
    // 'confidence' removido da desestruturação
    frame_b64, // Agora usaremos este atributo
    // 'attentionPattern', 'isBlinking', 'anomalyType' removidos da desestruturação
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

  return(
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
              const [x, y] = point;
              if(index < 163){
                return (
                  <circle
                    key={index}
                    cx={xScale(x)}
                    cy={yScale(y)}
                    r={1.5} // Raio pequeno para os pontos
                    fill="#e74c3c" // Cor vermelha para os pontos
                    opacity={0.7}
                    // Adicionado transition para animar o movimento dos pontos
                    style={{ transition: 'cx 0.1s linear, cy 0.1s linear' }}
                  />
                );
              }
              else{
                return;
              }
              
            })}
            {/* Opcional: Desenhar um círculo no centro da face (aproximado) */}
            {landmarks.length > 0 && (
              <circle
                cx={xScale(landmarks[90][0])} // Usando o primeiro landmark como referência de centro
                cy={yScale(landmarks[90][1])}
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
  // A condição hasData verifica se os dados existem, se há landmarks E se a imagem base64 está presente
  const hasData = data !== null && data.landmarks && data.landmarks.length > 0 && data.frame_b64 !== undefined && data.frame_b64 !== null && data.frame_b64 !== "";

  // console.log("FaceLandmarksCard - data prop:", data);
  // console.log("FaceLandmarksCard - hasData:", hasData);

  const headerContent = (
    <div className="text-right text-sm text-gray-700">
      {/* ATUALIZADO: Removidas as propriedades que já não existem */}
      {data && (
        <>
          {/* 'frameNumber' removido */}
          <p>Tempo: {data.timestamp?.toFixed(1) ?? 'N/A'}s</p> {/* Usando o timestamp da mensagem */}
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