// components/CardWrapper.tsx
import React from 'react';

interface CardWrapperProps {
  title: string;
  width?: number;
  height?: number;
  isLoading?: boolean;
  noDataMessage?: string;
  headerContent?: React.ReactNode; // Para conteúdo customizado no cabeçalho
  children: React.ReactNode;
}

const CardWrapper: React.FC<CardWrapperProps> = ({
  title,
  width = 300,
  height = 200,
  isLoading = false,
  noDataMessage = "Waiting for data...",
  headerContent,
  children,
}) => {
  return (
    <div
      className="bg-white rounded-lg shadow-md p-4 flex flex-col"
      style={{ width: width, height: height }}
    >
      <div className="flex justify-between items-start mb-2">
        <h2 className="text-md font-semibold text-gray-800">{title}</h2>
        {headerContent && <div className="ml-auto">{headerContent}</div>}
      </div>
      <div className="flex-1 flex items-center justify-center relative overflow-hidden">
        {isLoading ? (
          <div className="text-center text-gray-500">
            <p className="text-sm">Loading...</p>
          </div>
        ) : (
          <>
            {/* O children será o conteúdo específico do card (gráfico, 3D, etc.) */}
            {children ? children : (
                <div className="text-center text-gray-500">
                    <p className="text-sm">{noDataMessage}</p>
                </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default CardWrapper;