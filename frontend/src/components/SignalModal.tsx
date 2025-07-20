import React from 'react';

interface SignalModalProps {
  open: boolean;
  availableSignals: Record<string, string[]>; // { component: string[] }
  loading?: boolean;
  onClose: () => void;
  onSelect: (component: string, signalName: string) => void;
}

const SignalModal: React.FC<SignalModalProps> = ({
  open,
  availableSignals,
  loading = false,
  onClose,
  onSelect
}) => {
  if (!open) return null;

  // Função para capitalizar a primeira letra
  const capitalize = (str: string) => {
    return str.charAt(0).toUpperCase() + str.slice(1);
  };

  return (
    <div
      className="fixed inset-0 bg-[rgba(0,0,0,0.5)] flex justify-center items-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg p-6 max-w-md w-full max-h-[80vh] overflow-y-auto shadow-lg"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Adicionar Sinal ao Dashboard</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl"
          >
            &times;
          </button>
        </div>

        {loading ? (
          <div className="text-center py-4">
            <p>A carregar sinais disponíveis...</p>
          </div>
        ) : Object.keys(availableSignals).length === 0 ? (
          <div className="text-center py-4">
            <p>Nenhum sinal disponível</p>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(availableSignals).map(([component, signals]) => (
              <div key={component} className="border rounded-lg p-4">
                <h3 className="font-medium text-lg mb-2">{capitalize(component)}</h3>
                <ul className="space-y-2">
                  {signals.map((signal) => {
                    return (
                      <li key={`${component}-${signal}`}>
                        <button
                          className="w-full text-left px-4 py-2 rounded flex items-center hover:bg-gray-100 transition-colors"
                          onClick={() => onSelect(component, signal)}
                        >
                          <span>{capitalize(signal.replace(/_/g, ' '))}</span> {/* Melhora a exibição do nome do sinal */}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 flex justify-end">
          <button
            className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 transition-colors"
            onClick={onClose}
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
};

export default SignalModal;