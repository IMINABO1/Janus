// index.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Global error handler to catch module loading or early runtime errors
window.onerror = function(message, source, lineno, colno, error) {
  console.error("Global Error Caught:", message, error);
  const root = document.getElementById('root');
  if (root) {
    // Clear existing content to show error
    root.innerHTML = `
      <div style="
        font-family: 'Courier New', monospace; 
        background-color: #0f172a; 
        color: #ef4444; 
        padding: 40px; 
        height: 100vh; 
        width: 100vw; 
        box-sizing: border-box; 
        overflow: auto;
        display: flex;
        flex-direction: column;
        gap: 20px;
      ">
        <h2 style="margin: 0; font-size: 24px; color: #f87171;">System Failure</h2>
        
        <div style="border: 1px solid #ef4444; padding: 20px; border-radius: 8px; background: rgba(239, 68, 68, 0.1);">
            <div style="font-weight: bold; font-size: 18px; margin-bottom: 10px;">${String(message)}</div>
            <div style="color: #94a3b8; font-size: 14px;">Source: ${source}:${lineno}:${colno}</div>
        </div>

        ${error && error.stack ? `
          <div style="background: #1e293b; padding: 20px; border-radius: 8px; border: 1px solid #334155; white-space: pre-wrap; word-break: break-all; font-size: 14px; color: #cbd5e1; overflow-x: auto;">
            ${error.stack}
          </div>
        ` : ''}
        
        <div style="margin-top: auto; color: #64748b; font-size: 12px;">
          Error caught by Global Exception Handler in index.tsx
        </div>
      </div>
    `;
  }
};

// Catch unhandled promise rejections (e.g. async imports or async functions failing silently)
window.onunhandledrejection = function(event) {
    console.error("Unhandled Rejection:", event.reason);
    const root = document.getElementById('root');
    // Only overwrite if we haven't already shown a crash screen
    if (root && !root.innerHTML.includes("System Failure")) {
       root.innerHTML = `
      <div style="
        font-family: 'Courier New', monospace; 
        background-color: #0f172a; 
        color: #f59e0b; 
        padding: 40px; 
        height: 100vh; 
        width: 100vw; 
        box-sizing: border-box; 
        overflow: auto;
        display: flex;
        flex-direction: column;
        gap: 20px;
      ">
        <h2 style="margin: 0; font-size: 24px;">Unhandled Promise Rejection</h2>
        
         <div style="border: 1px solid #f59e0b; padding: 20px; border-radius: 8px; background: rgba(245, 158, 11, 0.1);">
            <div style="font-weight: bold; font-size: 18px; margin-bottom: 10px;">
                ${event.reason ? String(event.reason) : "Unknown Reason"}
            </div>
        </div>

         ${event.reason && event.reason.stack ? `
          <div style="background: #1e293b; padding: 20px; border-radius: 8px; border: 1px solid #334155; white-space: pre-wrap; word-break: break-all; font-size: 14px; color: #cbd5e1; overflow-x: auto;">
            ${event.reason.stack}
          </div>
        ` : ''}

         <div style="margin-top: auto; color: #64748b; font-size: 12px;">
          Error caught by Global Rejection Handler in index.tsx
        </div>
      </div>
    `;
    }
};

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

try {
    const root = ReactDOM.createRoot(rootElement);
    root.render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
    );
} catch (e: any) {
    console.error("Root Render Error:", e);
    // Manually trigger the handler if sync render fails
    if (window.onerror) {
        window.onerror(e.message, "index.tsx", 0, 0, e);
    }
}
