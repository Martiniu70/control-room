import React from 'react';

interface HeaderProps {
  onAddCard: () => void;
}

const Header: React.FC<HeaderProps> = ({ onAddCard }) => {
  return (
    <header className="bg-white shadow-md p-4 flex items-center justify-between">
      <h1 className="text-xl font-bold text-gray-700">Control Room</h1>
      <button
        onClick={onAddCard}
        className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded shadow transition-colors"
      >
        + Add Card
      </button>
    </header>
  );
};

export default Header;