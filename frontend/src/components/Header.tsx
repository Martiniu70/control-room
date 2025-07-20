// Header.tsx (simples)
import React from 'react';

interface HeaderProps {
  onAddCard: (signalType?: any) => void;
}

const Header: React.FC<HeaderProps> = ({ onAddCard }) => {
  return (
    <header className="flex items-center justify-between p-4 bg-gray-800 text-white">
      <h1 className="text-lg font-bold">Control Room</h1>
      <button
        onClick={() => onAddCard()}
        className="bg-green-600 hover:bg-green-700 px-3 py-1 rounded"
      >
        + Add Card
      </button>
    </header>
  );
};

export default Header;