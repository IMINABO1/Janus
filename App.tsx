
import React, { useState, useEffect, useRef } from 'react';
import Viewer3D, { Viewer3DHandle } from './frontend/components/Viewer3D';
import ChatInterface from './frontend/components/ChatInterface';
import Header from './frontend/components/Header';
import SceneCollection from './frontend/components/SceneCollection';
import { SceneManager } from './backend/engine/SceneManager';
import { geminiService } from './backend/services/geminiService';
import { CADObject, ChatMessage, AICommand, AIActionType } from './types';

// Initialize core logic outside component
const sceneManager = new SceneManager();

const App: React.FC = () => {
  // --- State ---
  const [objects, setObjects] = useState<CADObject[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isAiLoading, setIsAiLoading] = useState(false);
  
  // --- Refs ---
  const viewerRef = useRef<Viewer3DHandle>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // --- Helpers ---
  const refreshScene = () => {
    setObjects(sceneManager.getObjects());
  };

  // --- Handlers ---
  const handleSelectObject = (id: string | null) => {
    setSelectedId(id);
    const objs = sceneManager.getObjects();
    objs.forEach(o => o.selected = (o.id === id));
  };

  const handleDeleteObject = (id: string) => {
      // Create a manual command for deletion so it follows the same flow
      const cmd: AICommand = { action: AIActionType.DELETE, targetId: id, reasoning: 'User deleted via Scene Collection' };
      sceneManager.processCommands([cmd]);
      refreshScene();
      if (selectedId === id) setSelectedId(null);
  };
  
  const handleDuplicateObject = (id: string) => {
      sceneManager.duplicateObject(id);
      refreshScene();
  };

  const handleRenameObject = (id: string, newName: string) => {
      sceneManager.renameObject(id, newName);
      refreshScene();
  };

  const handleFocusObject = (id: string) => {
      const obj = sceneManager.getObject(id);
      if (obj && viewerRef.current) {
          viewerRef.current.focusObject(obj.id, obj.position);
          handleSelectObject(obj.id);
      }
  };

  const handleDownload = () => {
    const data = sceneManager.exportScene();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `janus-design-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsAiLoading(false);
      
      // Update the last message to show it was stopped
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last && last.role === 'model') {
           return [
             ...prev.slice(0, -1),
             { ...last, content: last.content + "\n[Stopped by user]" }
           ];
        }
        return prev;
      });
    }
  };

  const handleSendMessage = async (userText: string) => {
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: userText,
      timestamp: Date.now(),
    };

    // Placeholder for AI response
    const aiPlaceholderMsg: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: 'model',
      content: "Thinking...",
      thoughtProcess: "Initializing stream...",
      timestamp: Date.now() + 1,
    };

    setMessages(prev => [...prev, userMsg, aiPlaceholderMsg]);
    setIsAiLoading(true);

    // Setup AbortController
    const ac = new AbortController();
    abortControllerRef.current = ac;

    try {
      const { commands, thoughtProcess } = await geminiService.generateCommandsStream(
        userText, 
        objects, 
        (accumulatedText) => {
           setMessages(prev => {
             const newMsgs = [...prev];
             const lastIdx = newMsgs.length - 1;
             if (lastIdx >= 0 && newMsgs[lastIdx].role === 'model') {
               newMsgs[lastIdx] = {
                 ...newMsgs[lastIdx],
                 thoughtProcess: accumulatedText,
               };
             }
             return newMsgs;
           });
        },
        ac.signal
      );

      // Process Data commands
      sceneManager.processCommands(commands);
      
      // Handle UI-specific commands (FOCUS)
      commands.forEach(cmd => {
          if (cmd.action === AIActionType.FOCUS && cmd.targetId) {
             handleFocusObject(cmd.targetId);
          }
      });

      refreshScene();
      
      setMessages(prev => {
        const newMsgs = [...prev];
        const lastIdx = newMsgs.length - 1;
        if (lastIdx >= 0) {
          newMsgs[lastIdx] = {
            ...newMsgs[lastIdx],
            content: `Done. Actions:\n${commands.map(c => `- ${c.reasoning}`).join('\n')}`,
            thoughtProcess: thoughtProcess,
            commands: commands
          };
        }
        return newMsgs;
      });

    } catch (error: any) {
      if (error.message === "Aborted by user") {
        console.log("Generation stopped");
      } else {
        console.error(error);
        setMessages(prev => {
           const newMsgs = [...prev];
           const lastIdx = newMsgs.length - 1;
           newMsgs[lastIdx] = {
               ...newMsgs[lastIdx],
               content: "Sorry, I encountered an error or connection issue.",
               thoughtProcess: error.message
           };
           return newMsgs;
        });
      }
    } finally {
      setIsAiLoading(false);
      abortControllerRef.current = null;
    }
  };

  // Initial load
  useEffect(() => {
    const initialCmds: AICommand[] = [{
        action: 'CREATE' as any,
        reasoning: 'Initial scene setup',
        objectData: {
            id: 'default-grid-1',
            type: 'BOX' as any,
            position: [0, 0.5, 0],
            scale: [1, 1, 1],
            color: '#64748b',
            name: 'Starter Cube'
        }
    }];
    sceneManager.processCommands(initialCmds);
    refreshScene();
  }, []);

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-white">
      <Header onDownload={handleDownload} objectCount={objects.length} />
      
      <main className="flex-1 flex overflow-hidden">
        {/* Left: Scene Collection */}
        <SceneCollection 
          objects={objects} 
          selectedId={selectedId} 
          onSelect={handleSelectObject}
          onDelete={handleDeleteObject}
          onDuplicate={handleDuplicateObject}
          onRename={handleRenameObject}
          onFocus={handleFocusObject}
        />

        {/* Center: 3D Viewport */}
        <div className="flex-1 relative border-l border-slate-800">
           <Viewer3D 
             ref={viewerRef}
             objects={objects} 
             onSelect={handleSelectObject} 
             selectedId={selectedId}
           />
        </div>

        {/* Right: AI Chat */}
        <ChatInterface 
          messages={messages} 
          objects={objects}
          onSendMessage={handleSendMessage}
          onStop={handleStopGeneration}
          isLoading={isAiLoading}
        />
      </main>
    </div>
  );
};

export default App;
