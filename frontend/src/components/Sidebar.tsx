import React, { useState, useRef, useEffect } from "react";
import { Plus, X } from "lucide-react";

/**
 * @file Sidebar.tsx
 * @description This component renders a sidebar for tab navigation in the dashboard.
 * It dynamically adjusts tab heights based on available space and provides
 * functionality to add and close tabs.
 */

/**
 * Interface defining the structure of a single tab.
 */
interface Tab {
  id: number;    // Unique identifier for the tab.
  label: string; // Display label for the tab.
}

/**
 * Interface defining the props for the Sidebar component.
 */
interface SidebarProps {
  tabs: Tab[];                               // Array of tab objects to display.
  currentTabId: number;                      // The ID of the currently active tab.
  onTabClick: (id: number) => void;          // Callback function when a tab is clicked.
  onAddTab: () => void;                      // Callback function to add a new tab.
  onCloseTab: (id: number) => void;          // Callback function to close a tab.
}

/**
 * Sidebar functional component.
 * @param {SidebarProps} props - The properties passed to the component.
 * @returns {JSX.Element} The sidebar navigation JSX.
 */
const Sidebar: React.FC<SidebarProps> = ({
  tabs,
  currentTabId,
  onTabClick,
  onAddTab,
  onCloseTab
}) => {
  // Refs to get DOM element dimensions for dynamic height calculations.
  const containerRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLDivElement>(null);
  const addButtonRef = useRef<HTMLButtonElement>(null);

  // State to manage the calculated height of each tab.
  const [tabHeight, setTabHeight] = useState<number>(112);
  // State to manage the maximum height available for the tabs container.
  const [tabsContainerMaxHeight, setTabsContainerMaxHeight] = useState<number>(0);

  /**
   * Effect hook to calculate and adjust tab heights and container max height
   * based on the sidebar's available vertical space.
   * Runs on component mount and whenever the window is resized or tabs change.
   */
  useEffect(() => {
    function calculateHeight() {
      // Ensure all necessary DOM elements are available.
      if (!containerRef.current || !logoRef.current || !addButtonRef.current) return;

      const containerHeight = containerRef.current.clientHeight;
      const logoHeight = logoRef.current.clientHeight;
      const addButtonHeight = addButtonRef.current.clientHeight;

      // Total vertical padding/margins between elements inside the sidebar.
      const totalPadding = 24;

      // Calculate the available height for the tabs container.
      const availableHeight = containerHeight - logoHeight - addButtonHeight - totalPadding;

      // Set the maximum height for the scrollable tabs container.
      setTabsContainerMaxHeight(availableHeight);

      const maxTabHeight = 112; // Maximum desired height for a single tab.
      // Calculate new tab height, ensuring it doesn't exceed maxTabHeight
      // and distributes available height among all tabs.
      const newTabHeight = Math.min(maxTabHeight, availableHeight / tabs.length);

      setTabHeight(newTabHeight);
    }

    calculateHeight(); // Initial calculation on mount.
    window.addEventListener("resize", calculateHeight); // Recalculate on window resize.
    // Cleanup function to remove the event listener on component unmount.
    return () => window.removeEventListener("resize", calculateHeight);
  }, [tabs.length]); // Re-run effect if the number of tabs changes.

  return (
    <div
      ref={containerRef}
      className="w-20 bg-gray-900 text-white flex flex-col items-center p-4 min-h-screen"
      style={{ height: "100vh" }} // Enforce viewport height strictly.
    >
      {/* Logo section */}
      <div ref={logoRef} className="text-xl font-bold mb-4 select-none">
        🗂️
      </div>

      {/* Tabs container: scrollable area for individual tabs */}
      <div
        className="flex flex-col items-center w-full overflow-y-auto"
        style={{ maxHeight: tabsContainerMaxHeight }} // Dynamically set max height.
      >
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={`group relative w-12 p-1 rounded-lg cursor-pointer select-none ${
              tab.id === currentTabId ? "bg-gray-700 font-semibold" : "hover:bg-gray-800"
            }`}
            style={{ height: tabHeight, minHeight: 40 }} // Apply calculated height and minimum height.
            onClick={() => onTabClick(tab.id)} // Handle tab click to switch tabs.
          >
            {/* Rotated tab label for vertical display */}
            <span
              className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 -rotate-90 whitespace-nowrap pointer-events-none"
              style={{ transformOrigin: "center" }}
            >
              {tab.label}
            </span>

            {/* Close icon for tabs (hidden until hover, not shown for single tab) */}
            {tabs.length > 1 && (
              <X
                size={14}
                className="absolute bottom-1 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 hover:text-red-400 cursor-pointer transition-opacity"
                onClick={(e) => {
                  e.stopPropagation(); // Prevent tab click event when close icon is clicked.
                  onCloseTab(tab.id); // Call the close tab handler.
                }}
              />
            )}
          </div>
        ))}
      </div>

      {/* Add new tab button */}
      <button
        ref={addButtonRef}
        onClick={onAddTab} // Call the add tab handler.
        className="flex items-center justify-center w-12 h-12 rounded-full bg-blue-600 hover:bg-blue-700 transition mt-4"
        aria-label="Adicionar novo separador" // Accessibility label.
      >
        <Plus size={16} /> {/* Plus icon */}
      </button>
    </div>
  );
};

export default Sidebar;