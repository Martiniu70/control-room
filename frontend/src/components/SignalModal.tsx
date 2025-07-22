import React from 'react';

/**
 * @file SignalModal.tsx
 * @description This component renders a modal dialog for selecting available signals
 * to be added to the dashboard. It displays signals grouped by their components
 * and allows users to choose which signals to visualize.
 */

/**
 * Interface defining the props for the SignalModal component.
 */
interface SignalModalProps {
  open: boolean;                                   // Controls the visibility of the modal.
  availableSignals: Record<string, string[]>;      // A map where keys are component names and values are arrays of available signal names.
  loading?: boolean;                               // Optional flag to indicate if signals are currently being loaded.
  onClose: () => void;                             // Callback function to close the modal.
  onSelect: (component: string, signalName: string) => void; // Callback function triggered when a signal is selected.
}

/**
 * SignalModal functional component.
 * @param {SignalModalProps} props - The properties passed to the component.
 * @returns {JSX.Element | null} The modal dialog JSX or null if not open.
 */
const SignalModal: React.FC<SignalModalProps> = ({
  open,
  availableSignals,
  loading = false, // Default loading to false if not provided.
  onClose,
  onSelect
}) => {
  // If the modal is not set to open, return null to render nothing.
  if (!open) return null;

  /**
   * Helper function to capitalize the first letter of a string.
   * @param {string} str - The input string.
   * @returns {string} The capitalized string.
   */
  const capitalize = (str: string) => {
    return str.charAt(0).toUpperCase() + str.slice(1);
  };

  return (
    // Overlay for the modal, covering the entire screen.
    <div
      className="fixed inset-0 bg-[rgba(0,0,0,0.5)] flex justify-center items-center z-50"
      onClick={onClose} // Allows closing the modal by clicking outside it.
    >
      {/* Modal content container */}
      <div
        className="bg-white rounded-lg p-6 max-w-md w-full max-h-[80vh] overflow-y-auto shadow-lg"
        onClick={e => e.stopPropagation()} // Prevents clicks inside the modal from closing it.
      >
        {/* Modal header with title and close button */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Adicionar Sinal ao Dashboard</h2>
          <button
            onClick={onClose} // Close button.
            className="text-gray-500 hover:text-gray-700 text-2xl"
          >
            &times; {/* 'x' icon for closing */}
          </button>
        </div>

        {/* Conditional rendering based on loading state and available signals */}
        {loading ? (
          // Display loading message if signals are being fetched.
          <div className="text-center py-4">
            <p>A carregar sinais disponíveis...</p>
          </div>
        ) : Object.keys(availableSignals).length === 0 ? (
          // Display message if no signals are available.
          <div className="text-center py-4">
            <p>Nenhum sinal disponível</p>
          </div>
        ) : (
          // Render the list of available signals grouped by component.
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
                          onClick={() => onSelect(component, signal)} // Select signal on click.
                        >
                          {/* Improve display name by replacing underscores and capitalizing */}
                          <span>{capitalize(signal.replace(/_/g, ' '))}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}

        {/* Modal footer with a cancel button */}
        <div className="mt-4 flex justify-end">
          <button
            className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 transition-colors"
            onClick={onClose} // Cancel button closes the modal.
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
};

export default SignalModal;