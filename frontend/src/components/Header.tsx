// Header.tsx
import React from 'react';

/**
 * @file Header.tsx
 * @description This component renders the application's header,
 * including the title "Control Room" and a button to add new data cards.
 */

/**
 * Interface defining the props for the Header component.
 */
interface HeaderProps {
  onAddCard: (signalType?: any) => void; // Callback function triggered when the "Add Card" button is clicked.
}

/**
 * Header functional component.
 * @param {HeaderProps} props - The properties passed to the component.
 * @returns {JSX.Element} The header element JSX.
 */
const Header: React.FC<HeaderProps> = ({ onAddCard }) => {
  return (
    <header className="flex items-center justify-between p-4 bg-gray-800 text-white">
      {/* Application title */}
      <h1 className="text-lg font-bold">Control Room</h1>
      {/* Button to add a new card */}
      <button
        onClick={() => onAddCard()} // Calls the onAddCard callback when clicked.
        className="bg-green-600 hover:bg-green-700 px-3 py-1 rounded"
      >
        + Adicionar Cartão
      </button>
    </header>
  );
};

export default Header;