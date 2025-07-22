// src/components/card/FaceLandmarksCard.tsx
import React from 'react';
import CardWrapper from '../CardWrapper'; // Importar o CardWrapper
import * as cardConfigs from '../../../config/cardConfig'; // Importar cardConfigs
// Não precisamos importar FaceLandmarksCardContent aqui, pois o CardWrapper o fará via cardConfig.

// ATUALIZADO: Interface para os dados de Face Landmarks com a nova estrutura
interface FaceLandmarksData {
  landmarks: number[][]; // Array de [x, y, z] pontos normalizados (0 a 1)
  gaze_vector: { dx: number; dy: number };
  ear: number; // Eye Aspect Ratio
  blink_rate: number;
  blink_counter: number;
  frame_b64: string; // Imagem em base64
  timestamp: number; // NOVO: Adicionado o timestamp
}

interface FaceLandmarksCardProps {
  title: string;
  data: FaceLandmarksData | null;
  width?: number;
  height?: number;
  onClose?: () => void; // Adicionado para passar para o CardWrapper
}

const FaceLandmarksCard: React.FC<FaceLandmarksCardProps> = ({
  title,
  data,
  width,
  height,
  onClose,
}) => {
  // A condição hasData verifica se os dados existem e se há landmarks
  // Removido frame_b64 da condição, pois a visualização atual (SVG de pontos) não a usa diretamente
  const hasData = data !== null && data.landmarks && data.landmarks.length > 0;

  // Conteúdo para a nova área de detalhes
  const detailsContent = (
    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-700 w-full max-w-xs">
      <span className="font-semibold">EAR:</span> <span>{data?.ear.toFixed(2) ?? 'N/A'}</span>
      <span className="font-semibold">Blink Rate:</span> <span>{data?.blink_rate.toFixed(1) ?? 'N/A'} bpm</span>
      <span className="font-semibold">Tempo:</span> <span>{data?.timestamp?.toFixed(1) ?? 'N/A'}s</span>
    </div>
  );

  return (
    <CardWrapper
      title={title}
      width={width}
      height={height}
      isLoading={!hasData}
      noDataMessage="A aguardar dados de Face Landmarks..."
      detailsContent={detailsContent} // Passa o conteúdo dos detalhes
      onClose={onClose} // Passa a função de fechar
      // NOVO: Passa as visualizações do cardConfig.ts para o CardWrapper
      // O CardWrapper agora renderizará o FaceLandmarksCardContent.
      visualizations={cardConfigs.cardConfigs['faceLandmarks'].visualizations}
      cardData={data} // Passa os dados brutos para o CardWrapper, que os passará para a visualização
      visualizationProps={{
          // Se FaceLandmarksCardContent precisar de props específicas, adicione-as aqui
          // Ex: color: cardConfigs.cardConfigs['faceLandmarks'].color,
      }}
    >
      {/* O FaceLandmarksCardContent já não é um filho direto aqui.
          Ele será renderizado pelo CardWrapper com base na configuração 'visualizations'. */}
    </CardWrapper>
  );
};

export default FaceLandmarksCard;
