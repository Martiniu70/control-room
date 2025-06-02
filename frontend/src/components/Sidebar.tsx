import React, { useState, useRef, useEffect } from "react";
import { Plus, X } from "lucide-react";

interface Tab {
  id: number;
  label: string;
}

interface SidebarProps {
  tabs: Tab[];
  currentTabId: number;
  onTabClick: (id: number) => void;
  onAddTab: () => void;
  onCloseTab: (id: number) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  tabs, 
  currentTabId, 
  onTabClick, 
  onAddTab, 
  onCloseTab 
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLDivElement>(null);
  const addButtonRef = useRef<HTMLButtonElement>(null);

  const [tabHeight, setTabHeight] = useState<number>(112);
  const [tabsContainerMaxHeight, setTabsContainerMaxHeight] = useState<number>(0);

  useEffect(() => {
    function calculateHeight() {
      if (!containerRef.current || !logoRef.current || !addButtonRef.current) return;

      const containerHeight = containerRef.current.clientHeight;
      const logoHeight = logoRef.current.clientHeight;
      const addButtonHeight = addButtonRef.current.clientHeight;

      // Total vertical padding/margins between elements inside sidebar:
      const totalPadding = 24; // adjust if you add margins/padding between elements

      // Available height for tabs container
      const availableHeight = containerHeight - logoHeight - addButtonHeight - totalPadding;

      // Set max height for tabs container
      setTabsContainerMaxHeight(availableHeight);

      const maxTabHeight = 112;
      const newTabHeight = Math.min(maxTabHeight, availableHeight / tabs.length);

      setTabHeight(newTabHeight);
    }

    calculateHeight();
    window.addEventListener("resize", calculateHeight);
    return () => window.removeEventListener("resize", calculateHeight);
  }, [tabs.length]);

  return (
    <div
      ref={containerRef}
      className="w-20 bg-gray-900 text-white flex flex-col items-center p-4 min-h-screen"
      style={{ height: "100vh" }} // enforce viewport height strictly
    >
      {/* Logo */}
      <div ref={logoRef} className="text-xl font-bold mb-4 select-none">
        🗂️
      </div>

      {/* Tabs container with maxHeight and scroll */}
      <div
        className="flex flex-col items-center w-full overflow-y-auto"
        style={{ maxHeight: tabsContainerMaxHeight }}
      >
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={`group relative w-12 p-1 rounded-lg cursor-pointer select-none ${
              tab.id === currentTabId ? "bg-gray-700 font-semibold" : "hover:bg-gray-800"
            }`}
            style={{ height: tabHeight, minHeight: 40 }} // minHeight to prevent too tiny tabs
            onClick={() => onTabClick(tab.id)}
          >
            {/* Rotated tab label */}
            <span
              className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 -rotate-90 whitespace-nowrap pointer-events-none"
              style={{ transformOrigin: "center" }}
            >
              {tab.label}
            </span>

            {/* Close icon bottom centered */}
            {tabs.length > 1 && (
              <X
                size={14}
                className="absolute bottom-1 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 hover:text-red-400 cursor-pointer transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  onCloseTab(tab.id);
                }}
              />
            )}
          </div>
        ))}
      </div>

      {/* Add button below tabs container */}
      <button
        ref={addButtonRef}
        onClick={onAddTab}
        className="flex items-center justify-center w-12 h-12 rounded-full bg-blue-600 hover:bg-blue-700 transition mt-4"
        aria-label="Add new tab"
      >
        <Plus size={16} />
      </button>
    </div>
  );
};

export default Sidebar;