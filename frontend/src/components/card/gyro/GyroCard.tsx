// src/components/card/GyroCard.tsx
import React, { useState, useCallback } from 'react';
import CardWrapper from '../CardWrapper'; // Importar o CardWrapper
import * as cardConfigs from '../../../config/cardConfig'; // Importar cardConfigs
// Não precisamos importar GyroscopeCardContent aqui, pois o CardWrapper o fará via cardConfig.

// Define a interface para os dados do giroscópio
interface GyroscopeData {
  x: number[];
  y: number[];
  z: number[];
}

// Componente Wrapper para uso externo
interface GyroscopeCardProps {
    title: string;
    data: GyroscopeData | null;
    width?: number;
    height?: number;
    onClose?: () => void; // Adicionado para passar para o CardWrapper
}

const GyroscopeCard: React.FC<GyroscopeCardProps> = ({
    title,
    data,
    width,
    height,
    onClose,
}) => {
    // Estado para armazenar os valores de rotação para exibição no header
    // Iniciado com null para indicar "sem dados" ou "ainda não recebido"
    const [displayRotationValues, setDisplayRotationValues] = useState<{ x: number; y: number; z: number } | null>(null);

    // Callback para atualizar os valores de rotação
    // Esta função será passada para GyroscopeCardContent e chamada por ele.
    const handleRotationUpdate = useCallback((x: number, y: number, z: number) => {
        setDisplayRotationValues({ x, y, z });
    }, []);

    // Determine if there's any data present to show content or the "no data" message
    const hasData = data && (data.x.length > 0 || data.y.length > 0 || data.z.length > 0);

    // Conteúdo para a nova área de detalhes
    const detailsContent = (
        <div className="flex flex-col items-center justify-center w-full text-sm text-gray-700">
            <p>X: {displayRotationValues?.x.toFixed(2) ?? 'N/A'} deg/s</p>
            <p>Y: {displayRotationValues?.y.toFixed(2) ?? 'N/A'} deg/s</p>
            <p>Z: {displayRotationValues?.z.toFixed(2) ?? 'N/A'} deg/s</p>
        </div>
    );

    return (
        <CardWrapper
            title={title}
            width={width}
            height={height}
            isLoading={!hasData}
            noDataMessage="A aguardar dados do giroscópio..."
            detailsContent={detailsContent} // Passa o conteúdo dos detalhes
            onClose={onClose} // Passa a função de fechar
            // NOVO: Passa as visualizações do cardConfig.ts para o CardWrapper
            // O CardWrapper agora renderizará o GyroscopeCardContent.
            visualizations={cardConfigs.cardConfigs['gyroscope'].visualizations}
            cardData={data} // Passa os dados brutos para o CardWrapper, que os passará para a visualização
            visualizationProps={{
                // Passa o callback onRotationUpdate para o GyroscopeCardContent
                onRotationUpdate: handleRotationUpdate,
            }}
        >
            {/* O GyroscopeCardContent já não é um filho direto aqui.
                Ele será renderizado pelo CardWrapper com base na configuração 'visualizations'. */}
        </CardWrapper>
    );
};

export default GyroscopeCard;
