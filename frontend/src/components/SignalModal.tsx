interface ModalProps {
  open: boolean;
  signals: string[];
  onClose: () => void;
  onSelect: (signal: string) => void;
}

const SignalModal: React.FC<ModalProps> = ({ open, signals, onClose, onSelect }) => {
  if (!open) return null;

  return (
    <div 
      className="fixed inset-0 bg-[rgba(0,0,0,0.5)] flex justify-center items-center z-50"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded p-6 max-w-sm w-full shadow-lg"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold mb-4">Select Signal to Add</h2>
        <ul className="space-y-2 max-h-64 overflow-y-auto">
          {signals.length === 0 && (
            <li className="text-gray-500">No signals available</li>
          )}
          {signals.map((signal) => (
            <li key={signal}>
              <button
                className="w-full text-left px-4 py-2 rounded hover:bg-gray-200"
                onClick={() => onSelect(signal)}
              >
                {signal}
              </button>
            </li>
          ))}
        </ul>
        <button 
          className="mt-4 px-4 py-2 bg-gray-300 rounded hover:bg-gray-400 focus:outline-none"
          onClick={onClose}
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

export default SignalModal;