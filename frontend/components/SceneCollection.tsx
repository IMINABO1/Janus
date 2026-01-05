// frontend/components/SceneCollection.tsx
import React, { useState, useEffect } from 'react';
import { CADObject, ShapeType } from '../../types';

interface SceneCollectionProps {
  objects: CADObject[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onRename: (id: string, newName: string) => void;
  onFocus: (id: string) => void;
}

const getIconForType = (type: ShapeType) => {
  switch (type) {
    case ShapeType.BOX:
      return (
        <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      );
    case ShapeType.SPHERE:
      return (
        <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <circle cx="12" cy="12" r="10" strokeWidth={2} />
        </svg>
      );
    case ShapeType.CYLINDER:
      return (
        <svg className="w-4 h-4 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v14m0-14c-4.418 0-8 1.343-8 3s3.582 3 8 3 8-1.343 8-3-3.582-3-8-3zm0 14c-4.418 0-8-1.343-8-3s3.582-3 8 3 8-1.343 8-3-3.582-3-8-3z" />
        </svg>
      );
    default:
      return (
        <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6z" />
        </svg>
      );
  }
};

const SceneCollection: React.FC<SceneCollectionProps> = ({ 
    objects, 
    selectedId, 
    onSelect, 
    onDelete, 
    onDuplicate,
    onRename,
    onFocus
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  // Close menu on click outside
  useEffect(() => {
    const handleClickOutside = () => setMenuOpenId(null);
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  const startEditing = (obj: CADObject) => {
    setEditingId(obj.id);
    setEditName(obj.name);
    setMenuOpenId(null);
  };

  const saveEditing = () => {
    if (editingId && editName.trim()) {
        onRename(editingId, editName.trim());
    }
    setEditingId(null);
  };

  return (
    <div className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col h-full select-none">
      <div className="p-3 border-b border-slate-800 bg-slate-900/50">
        <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
          </svg>
          Scene Collection
        </h2>
      </div>
      
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {objects.length === 0 && (
            <div className="text-xs text-slate-500 text-center py-4">
                Empty Scene
            </div>
        )}

        {objects.map((obj) => (
          <div
            key={obj.id}
            className={`group relative flex items-center justify-between px-3 py-2 rounded-md cursor-pointer transition-colors ${
              selectedId === obj.id
                ? 'bg-blue-600/20 border border-blue-600/50'
                : 'border border-transparent hover:bg-slate-800'
            }`}
            onClick={() => onSelect(obj.id)}
          >
            <div className="flex items-center gap-2 truncate flex-1">
              {getIconForType(obj.type)}
              
              {editingId === obj.id ? (
                  <input 
                    type="text"
                    autoFocus
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onBlur={saveEditing}
                    onKeyDown={(e) => {
                        if(e.key === 'Enter') saveEditing();
                        if(e.key === 'Escape') setEditingId(null);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="bg-slate-800 text-white text-xs px-1 py-0.5 rounded border border-blue-500 outline-none w-full"
                  />
              ) : (
                  <span 
                    className={`text-xs font-medium truncate ${selectedId === obj.id ? 'text-white' : 'text-slate-300'}`}
                    onDoubleClick={() => startEditing(obj)}
                  >
                    {obj.name}
                  </span>
              )}
            </div>
            
            {/* Options Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpenId(menuOpenId === obj.id ? null : obj.id);
              }}
              className={`p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-white transition-all opacity-0 group-hover:opacity-100 ${menuOpenId === obj.id ? 'opacity-100 bg-slate-700' : ''}`}
              title="Options"
            >
               <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" />
              </svg>
            </button>

            {/* Context Menu Dropdown */}
            {menuOpenId === obj.id && (
                <div 
                    className="absolute right-0 top-8 z-50 w-32 bg-slate-800 border border-slate-700 rounded-md shadow-xl py-1 flex flex-col"
                    onClick={(e) => e.stopPropagation()} 
                >
                    <button 
                        className="text-left px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700 hover:text-white flex items-center gap-2"
                        onClick={() => { onFocus(obj.id); setMenuOpenId(null); }}
                    >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                        Locate
                    </button>
                    <button 
                        className="text-left px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700 hover:text-white flex items-center gap-2"
                        onClick={() => startEditing(obj)}
                    >
                         <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        Rename
                    </button>
                    <button 
                        className="text-left px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700 hover:text-white flex items-center gap-2"
                        onClick={() => { onDuplicate(obj.id); setMenuOpenId(null); }}
                    >
                         <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                        Duplicate
                    </button>
                    <div className="h-px bg-slate-700 my-1"></div>
                    <button 
                        className="text-left px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 hover:text-red-300 flex items-center gap-2"
                        onClick={() => { onDelete(obj.id); setMenuOpenId(null); }}
                    >
                         <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        Delete
                    </button>
                </div>
            )}
          </div>
        ))}
      </div>
      
      <div className="p-2 border-t border-slate-800 text-[10px] text-slate-600 text-center">
         Double-click to rename or use options menu
      </div>
    </div>
  );
};

export default SceneCollection;
