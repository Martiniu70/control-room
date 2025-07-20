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

  // A imagem é 200x200, então o SVG também deve ter essas dimensões para o mapeamento 0-1
  const imageDisplaySize = 200;

  // Escalas para mapear os landmarks normalizados (0-1) para as dimensões da imagem (0-200)
  const xScale = (val: number) => val * imageDisplaySize;
  const yScale = (val: number) => val * imageDisplaySize;

  // Calcula a altura aproximada para as métricas de texto na parte inferior
  const textMetricsHeight = 80; // Ajuste conforme necessário
  // Calcula o espaço visual disponível para a imagem/SVG
  const availableVisualHeight = cardHeight - textMetricsHeight - 20; // 20px de padding/margem extra

  // Calcula a margem superior para centralizar verticalmente a imagem/SVG
  const visualAreaTopOffset = Math.max(0, (availableVisualHeight - imageDisplaySize) / 2);


  return (
    <div className="flex flex-col items-center justify-between w-full h-full p-2">
      <div
        className="relative flex-shrink-0" // flex-shrink-0 para evitar que encolha
        style={{ width: imageDisplaySize, height: imageDisplaySize, marginTop: visualAreaTopOffset }}
      >
        {frame_b64 && (
          <img
            src={`data:image/jpeg;base64,${frame_b64}`}
            alt="Face"
            className="absolute top-0 left-0 w-full h-full object-contain rounded-md shadow-inner"
            onError={(e) => {
              e.currentTarget.src = "https://placehold.co/200x200/cccccc/000000?text=Image+Error";
              console.error("Failed to load face landmarks image.");
            }}
          />
        )}
        {landmarks && landmarks.length > 0 && (
          <svg
            width={imageDisplaySize}
            height={imageDisplaySize}
            viewBox={`0 0 ${imageDisplaySize} ${imageDisplaySize}`} // Viewbox corresponde ao tamanho da imagem
            className="absolute top-0 left-0 w-full h-full" // Sobrepõe o SVG perfeitamente
          >
            {/* Desenha cada landmark como um pequeno círculo */}
            {landmarks.map((point, index) => {
              const [x, y] = point;
              return (
                <circle
                  key={index}
                  cx={xScale(x)}
                  cy={yScale(y)}
                  r={1.5} // Raio pequeno para os pontos
                  fill="#e74c3c" // Cor vermelha para os pontos
                  opacity={0.7}
                  style={{ transition: 'cx 0.1s linear, cy 0.1s linear' }}
                />
              );
            })}
            {/* Opcional: Desenhar um círculo no centro da face (aproximado) */}
            {landmarks.length > 0 && (
              <circle
                cx={xScale(landmarks[0][0])}
                cy={yScale(landmarks[0][1])}
                r={3}
                fill="#3498db" // Azul para o centro
                opacity={0.9}
                style={{ transition: 'cx 0.1s linear, cy 0.1s linear' }}
              />
            )}
          </svg>
        )}
      </div>

      {/* ATUALIZADO: Removidas as propriedades que já não existem */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-700 mt-2 w-full max-w-xs">
        <span className="font-semibold">EAR:</span> <span>{ear.toFixed(2)}</span>
        <span className="font-semibold">Blink Rate:</span> <span>{blink_rate.toFixed(1)} bpm</span>
        {/* 'Confidence' removido */}
        {/* <span className="font-semibold">Confiança:</span> <span>{(confidence * 100).toFixed(1)}%</span> */}
        {/* As propriedades abaixo foram removidas: */}
        {/* <span className="font-semibold">Atenção:</span> <span>{attentionPattern.replace(/_/g, ' ')}</span> */}
        {/* <span className="font-semibold">A piscar:</span> <span>{isBlinking ? 'Sim' : 'Não'}</span> */}
        {/* <span className="font-semibold">Anomalia:</span> <span className={`${anomalyType !== 'normal' ? 'text-red-500 font-bold' : ''}`}>{anomalyType.replace(/_/g, ' ')}</span> */}
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