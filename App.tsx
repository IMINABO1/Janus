// App.tsx
import React, { useState, useEffect, useRef } from 'react';
import Viewer3D, { Viewer3DHandle } from './frontend/components/Viewer3D';
import ChatInterface from './frontend/components/ChatInterface';
import Header from './frontend/components/Header';
import SceneCollection from './frontend/components/SceneCollection';
import { csgEngine } from './backend/engine/CSGEngine';
import { geminiService } from './backend/services/geminiService';
import { visualFeedbackService } from './backend/services/visualFeedbackService';
import { CADObject, ChatMessage } from './types';

const App: React.FC = () => {
  const [objects, setObjects] = useState<CADObject[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [currentScript, setCurrentScript] = useState<string>("");
  const [initialError, setInitialError] = useState<{ message: string; stack?: string } | null>(null);
  
  const viewerRef = useRef<Viewer3DHandle>(null);

  // --- Handlers ---
  const handleSelectObject = (id: string | null) => {
    setSelectedId(id);
  };

  const handleDownload = () => {
    const blob = new Blob([currentScript], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `janus-design-${Date.now()}.js`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSendMessage = async (userText: string) => {
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: userText,
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMsg]);
    setIsAiLoading(true);

    try {
      // 1. Generate Script Code using Gemini
      let { code, explanation } = await geminiService.generateScript(userText, currentScript);
      let executedObjects: CADObject[] = [];

      // 2. Execute Code (First Attempt)
      try {
          executedObjects = csgEngine.execute(code);
          setObjects(executedObjects);
          setCurrentScript(code);
      } catch (execErr: any) {
          throw new Error("Script Execution Failed: " + execErr.message);
      }
      
      // 3. Visual Verification Loop
      if (viewerRef.current && executedObjects.length > 0) {
          // Allow a brief moment for the React render cycle to complete and update the canvas with new objects
          // Using a small delay to be safe
          await new Promise(r => setTimeout(r, 500)); 

          const views = viewerRef.current.captureViews();
          
          const msgId = (Date.now() + 1).toString();
          setMessages(prev => [...prev, {
              id: msgId,
              role: 'model',
              content: explanation + "\n\n(Verifying visuals...)",
              code: code,
              timestamp: Date.now()
          }]);

          const analysis = await visualFeedbackService.evaluateRender(userText, views);

          if (!analysis.looksCorrect) {
              // 4. Auto-Fix
              const fixMsgId = (Date.now() + 2).toString();
              setMessages(prev => prev.map(m => m.id === msgId ? {
                  ...m,
                  content: explanation + `\n\n⚠️ Visual Issue Detected: ${analysis.critique}\nAttempting auto-fix...`
              } : m));

              const fixed = await geminiService.fixScript(userText, code, analysis.critique + " " + analysis.suggestion);
              
              executedObjects = csgEngine.execute(fixed.code);
              setObjects(executedObjects);
              setCurrentScript(fixed.code);
              
              setMessages(prev => [...prev, {
                  id: fixMsgId,
                  role: 'model',
                  content: "Auto-Fix Applied: " + fixed.explanation,
                  code: fixed.code,
                  timestamp: Date.now()
              }]);
          } else {
             // Verification Passed
             setMessages(prev => prev.map(m => m.id === msgId ? {
                  ...m,
                  content: explanation + "\n\n✅ Visuals Verified."
              } : m));
          }
      } else {
          // Fallback if viewer ref not ready or empty scene
          const aiMsg: ChatMessage = {
            id: (Date.now() + 1).toString(),
            role: 'model',
            content: explanation,
            code: code,
            timestamp: Date.now() + 1
          };
          setMessages(prev => [...prev, aiMsg]);
      }

    } catch (error: any) {
        console.error(error);
        const errorMsg: ChatMessage = {
            id: (Date.now() + 1).toString(),
            role: 'model',
            content: "Error executing design: " + error.message,
            timestamp: Date.now() + 1
        };
        setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsAiLoading(false);
    }
  };

  // Initial load with a simple box
  useEffect(() => {
    const initialScript = `
// Initial Cube
const b = Box(1, 1, 1);
Color(b, "#3b82f6");
Add(b, "Starter Cube");
    `;
    try {
        const objs = csgEngine.execute(initialScript);
        setObjects(objs);
        setCurrentScript(initialScript);
    } catch(e: any) { 
        console.error("Initial load error:", e); 
        setInitialError({
            message: e.message || "Unknown error occurred",
            stack: e.stack
        });
    }
  }, []);

  if (initialError) {
      return (
          <div className="flex items-center justify-center h-screen bg-slate-900 text-white flex-col gap-6 p-8">
              <div className="max-w-3xl w-full bg-slate-800 border border-red-500/50 rounded-xl p-6 shadow-2xl">
                <div className="flex items-center gap-3 mb-4 text-red-500">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <h1 className="text-2xl font-bold">System Failure</h1>
                </div>
                
                <p className="text-slate-300 mb-4">
                    The 3D Engine failed to initialize. Please report this error.
                </p>

                <div className="bg-black/50 rounded-lg p-4 font-mono text-sm overflow-auto max-h-96 border border-slate-700">
                    <div className="text-red-400 font-bold mb-2">{initialError.message}</div>
                    <div className="text-slate-400 whitespace-pre-wrap">{initialError.stack}</div>
                </div>

                <div className="mt-6 flex justify-end gap-3">
                    <button 
                        onClick={() => {
                            navigator.clipboard.writeText(`${initialError.message}\n${initialError.stack}`);
                            alert("Error copied to clipboard");
                        }}
                        className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded text-sm transition-colors"
                    >
                        Copy Error
                    </button>
                    <button 
                        onClick={() => window.location.reload()}
                        className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded text-sm font-medium transition-colors"
                    >
                        Reload Application
                    </button>
                </div>
              </div>
          </div>
      );
  }

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-white">
      <Header onDownload={handleDownload} objectCount={objects.length} />
      
      <main className="flex-1 flex overflow-hidden">
        {/* Left: Scene Collection */}
        <SceneCollection 
          objects={objects} 
          selectedId={selectedId} 
          onSelect={handleSelectObject}
          onDelete={() => {}} // TODO: implement script modification for delete
          onDuplicate={() => {}}
          onRename={() => {}}
          onFocus={(id) => {
              const obj = objects.find(o => o.id === id);
              if (obj && viewerRef.current) viewerRef.current.focusObject(id, obj.position);
          }}
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
          isLoading={isAiLoading}
        />
      </main>
    </div>
  );
};

export default App;
