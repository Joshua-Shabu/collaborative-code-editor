import React, { useState, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { FileText, Sun, Moon, ChevronDown, Users, Play, Terminal, X } from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import axios from 'axios';

interface File {
  id: string;
  name: string;
  language: string;
  content: string;
}

interface User {
  id: string;
  cursor: { line: number; column: number };
}

const App: React.FC = () => {
  const [darkMode, setDarkMode] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState('javascript');
  const [selectedFile, setSelectedFile] = useState<string>('1');
  const [connectedUsers, setConnectedUsers] = useState<User[]>([]);
  const [roomId, setRoomId] = useState<string>('default-room');
  const [isConnected, setIsConnected] = useState(false);
  const [editorContent, setEditorContent] = useState('');
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);
  const [terminalOutput, setTerminalOutput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [fileContents, setFileContents] = useState<{[key: string]: string}>({});
  const [showCopiedToast, setShowCopiedToast] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const editorRef = useRef<any>(null);
  const isRemoteChange = useRef(false);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  const [files] = useState<File[]>([
    { id: '1', name: 'index.js', language: 'javascript', content: '// Welcome to the Code Editor\nconsole.log("Hello, World!");' },
    { id: '2', name: 'script.py', language: 'python', content: '# Welcome to the Code Editor\nprint("Hello, World!")' },
    { id: '3', name: 'main.cpp', language: 'cpp', content: '// Welcome to the Code Editor\n#include <iostream>\n\nint main() {\n    std::cout << "Hello, World!" << std::endl;\n    return 0;\n}' },
  ]);

  const currentFile = files.find(f => f.id === selectedFile);

  const languages = [
    { value: 'javascript', label: 'JavaScript', judge0Id: 63 },
    { value: 'python', label: 'Python', judge0Id: 71 },
    { value: 'cpp', label: 'C++', judge0Id: 54 },
  ];

  // Handle running code
  const handleRunCode = async () => {
    if (!currentFile || isRunning) return;
    
    setIsRunning(true);
    setTerminalOutput('Running code...\n');
    setIsTerminalOpen(true);

    try {
      const response = await axios.post('http://localhost:3001/api/execute', {
        language_id: languages.find(lang => lang.value === selectedLanguage)?.judge0Id,
        source_code: editorContent,
        stdin: ''
      });

      const { stdout, stderr, compile_output, exit_code } = response.data;
      
      let output = '';
      if (compile_output) {
        output += `Compilation Error:\n${compile_output}\n`;
      }
      if (stderr) {
        output += `Error:\n${stderr}\n`;
      }
      if (stdout) {
        output += `Output:\n${stdout}\n`;
      }
      if (exit_code !== 0 && !compile_output && !stderr) {
        output += `Process exited with code: ${exit_code}\n`;
      }
      
      setTerminalOutput(output || 'Program executed successfully (no output)');
    } catch (error) {
      setTerminalOutput(`Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`);
    } finally {
      setIsRunning(false);
    }
  };

  // Initialize WebSocket connection
  useEffect(() => {
    // Get room ID from URL or use default
    let urlRoomId = window.location.pathname.slice(1) || 'default-room';
    
    // If it's the default room and not in URL, update the URL
    if (urlRoomId === 'default-room' && window.location.pathname === '/') {
      // Generate a unique room ID for better sharing
      const uniqueRoomId = 'room-' + Math.random().toString(36).substr(2, 9);
      urlRoomId = uniqueRoomId;
      window.history.replaceState(null, '', `/${uniqueRoomId}`);
      setRoomId(uniqueRoomId);
    } else {
      setRoomId(urlRoomId);
    }

    // Initialize socket connection
    const socket = io('http://localhost:3001');
    socketRef.current = socket;

    // Initialize file contents with default values
    const initialFileContents: {[key: string]: string} = {};
    files.forEach(file => {
      initialFileContents[file.id] = file.content;
    });
    setFileContents(initialFileContents);

    // Socket event handlers
    socket.on('connect', () => {
      setIsConnected(true);
      socket.emit('join-room', urlRoomId);
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('room-state', (data) => {
      setConnectedUsers(data.users);
      // Handle initial content for current file
      if (data.fileContents) {
        setFileContents(data.fileContents);
        if (currentFile && data.fileContents[currentFile.id]) {
          isRemoteChange.current = true;
          setEditorContent(data.fileContents[currentFile.id]);
          setTimeout(() => {
            isRemoteChange.current = false;
          }, 100);
        }
      }
    });

    socket.on('user-joined', (data) => {
      setConnectedUsers(data.users);
    });

    socket.on('user-left', (data) => {
      setConnectedUsers(prev => prev.filter(user => user.id !== data.userId));
    });

    socket.on('content-change', (data) => {
      // Only apply content change if it's for the current file
      if (data.userId !== socket.id && currentFile && data.fileId === currentFile.id && !isRemoteChange.current) {
        isRemoteChange.current = true;
        setEditorContent(data.content);
        setFileContents(prev => ({
          ...prev,
          [data.fileId]: data.content
        }));
        setTimeout(() => {
          isRemoteChange.current = false;
        }, 100);
      }
    });

    socket.on('cursor-move', (data) => {
      // Handle remote cursor movement
      if (editorRef.current && data.userId !== socket.id) {
        const editor = editorRef.current;
        const monaco = (window as any).monaco;
        // Add cursor decoration for remote user
        const decorations = editor.createDecorationsCollection([{
          range: new monaco.Range(
            data.cursor.line,
            data.cursor.column,
            data.cursor.line,
            data.cursor.column
          ),
          options: {
            className: 'remote-cursor',
            hoverMessage: { value: `User ${data.userId.slice(0, 8)}` }
          }
        }]);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, []); // Only run once on mount

  // Handle room persistence
  useEffect(() => {
    const urlRoomId = window.location.pathname.slice(1) || 'default-room';
    if (urlRoomId !== roomId) {
      setRoomId(urlRoomId);
    }
  }, []);

  // Handle copy link functionality
  const handleCopyLink = async () => {
    // Ensure we have the current URL with room ID
    const currentUrl = window.location.href;
    try {
      await navigator.clipboard.writeText(currentUrl);
      setShowCopiedToast(true);
      setTimeout(() => setShowCopiedToast(false), 2000);
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
  };

  // Handle file switching
  useEffect(() => {
    if (currentFile && fileContents[currentFile.id]) {
      isRemoteChange.current = true;
      setEditorContent(fileContents[currentFile.id]);
      setTimeout(() => {
        isRemoteChange.current = false;
      }, 100);
    }
  }, [selectedFile, fileContents]);

  // Handle editor mount and content changes
  const handleEditorDidMount = (editor: any, monaco: any) => {
    editorRef.current = editor;
    
    // Handle content changes
    editor.onDidChangeModelContent((e: any) => {
      if (!isRemoteChange.current && socketRef.current && currentFile) {
        const newContent = editor.getValue();
        setEditorContent(newContent);
        setFileContents(prev => ({
          ...prev,
          [currentFile.id]: newContent
        }));
        
        // Clear existing timer
        if (debounceTimer.current) {
          clearTimeout(debounceTimer.current);
        }
        
        // Debounce to prevent conflicts
        debounceTimer.current = setTimeout(() => {
          if (socketRef.current) {
            const changeData = {
              roomId,
              fileId: currentFile.id,
              content: newContent,
              operation: e
            };
            
            console.log('Sending content change (debounced):', changeData);
            
            // Send content change to server with file ID
            socketRef.current.emit('content-change', changeData);
          }
        }, 300); // 300ms debounce
      }
    });

    // Handle cursor changes
    editor.onDidChangeCursorPosition((e: any) => {
      if (socketRef.current) {
        socketRef.current.emit('cursor-move', {
          roomId,
          cursor: {
            line: e.position.lineNumber,
            column: e.position.column
          }
        });
      }
    });
  };

  return (
    <div>
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <header style={{ height: '56px', borderBottom: '1px solid #ccc', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', backgroundColor: darkMode ? '#1f2937' : 'white' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <h1 style={{ fontSize: '18px', fontWeight: '600', color: darkMode ? 'white' : '#111827' }}>
              Code Editor
            </h1>
            
            {/* Room ID and Connection Status */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', color: darkMode ? '#9ca3af' : '#6b7280' }}>
                Room: {roomId}
              </span>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: isConnected ? '#10b981' : '#ef4444' }} />
            </div>
            
            {/* Connected Users */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Users style={{ width: '16px', height: '16px', color: darkMode ? '#9ca3af' : '#6b7280' }} />
              <span style={{ fontSize: '14px', color: darkMode ? '#9ca3af' : '#6b7280' }}>
                {connectedUsers.length}
              </span>
              
              {/* Copy Link Button */}
              <button
                onClick={handleCopyLink}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  backgroundColor: darkMode ? '#374151' : '#f3f4f6',
                  color: darkMode ? '#d1d5db' : '#6b7280',
                  border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`,
                  cursor: 'pointer',
                  transition: 'background-color 0.2s'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = darkMode ? '#4b5563' : '#e5e7eb';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = darkMode ? '#374151' : '#f3f4f6';
                }}
                title="Copy invite link"
              >
                <span style={{ fontSize: '10px' }}>📋</span>
                <span>Copy Link</span>
              </button>
            </div>
            
            {/* Language Dropdown */}
            <select
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              style={{
                backgroundColor: 'transparent',
                border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`,
                borderRadius: '6px',
                padding: '4px 32px 4px 12px',
                fontSize: '14px',
                color: darkMode ? 'white' : '#111827',
                cursor: 'pointer'
              }}
            >
              {languages.map(lang => (
                <option key={lang.value} value={lang.value} style={{ backgroundColor: darkMode ? '#1f2937' : 'white' }}>
                  {lang.label}
                </option>
              ))}
            </select>

            {/* Run Button */}
            <button
              onClick={handleRunCode}
              disabled={isRunning}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '4px 12px',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '500',
                backgroundColor: isRunning ? '#d1d5db' : '#10b981',
                color: isRunning ? '#6b7280' : 'white',
                border: 'none',
                cursor: isRunning ? 'not-allowed' : 'pointer'
              }}
            >
              <Play style={{ width: '16px', height: '16px' }} />
              <span>{isRunning ? 'Running...' : 'Run'}</span>
            </button>
          </div>

          {/* Theme Toggle */}
          <button
            onClick={() => setDarkMode(!darkMode)}
            style={{
              padding: '8px',
              borderRadius: '8px',
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            {darkMode ? <Sun style={{ width: '20px', height: '20px', color: '#d1d5db' }} /> : <Moon style={{ width: '20px', height: '20px', color: '#6b7280' }} />}
          </button>
        </header>

        {/* Toast Notification */}
        {showCopiedToast && (
          <div style={{
            position: 'fixed',
            top: '80px',
            right: '20px',
            backgroundColor: '#10b981',
            color: 'white',
            padding: '12px 20px',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '500',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            zIndex: 1000,
            animation: 'slideIn 0.3s ease-out'
          }}>
            ✓ Link Copied!
          </div>
        )}

        {/* Main Content */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Sidebar */}
          <aside style={{ width: '256px', borderRight: '1px solid #ccc', backgroundColor: darkMode ? '#1f2937' : '#f9fafb' }}>
            <div style={{ padding: '16px', borderBottom: '1px solid #ccc' }}>
              <h2 style={{ fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', color: darkMode ? '#9ca3af' : '#6b7280' }}>
                Files
              </h2>
            </div>
            <div style={{ padding: '8px' }}>
              {files.map(file => (
                <button
                  key={file.id}
                  onClick={() => setSelectedFile(file.id)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    backgroundColor: selectedFile === file.id ? (darkMode ? '#374151' : '#dbeafe') : 'transparent',
                    color: selectedFile === file.id ? (darkMode ? 'white' : '#1d4ed8') : (darkMode ? '#d1d5db' : '#374151'),
                    border: 'none',
                    cursor: 'pointer',
                    marginBottom: '4px'
                  }}
                >
                  <FileText style={{ width: '16px', height: '16px' }} />
                  <span style={{ fontSize: '14px' }}>{file.name}</span>
                </button>
              ))}
            </div>
          </aside>

          {/* Editor and Terminal */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            {/* Editor */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              {currentFile && (
                <>
                  <div style={{ height: '40px', borderBottom: '1px solid #ccc', display: 'flex', alignItems: 'center', padding: '0 16px', backgroundColor: darkMode ? '#111827' : '#f3f4f6' }}>
                    <span style={{ fontSize: '14px', fontWeight: '500', color: darkMode ? '#d1d5db' : '#6b7280' }}>
                      {currentFile.name}
                    </span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <Editor
                      height="100%"
                      language={currentFile.language}
                      value={editorContent}
                      theme={darkMode ? 'vs-dark' : 'light'}
                      onMount={handleEditorDidMount}
                      options={{
                        minimap: { enabled: false },
                        fontSize: 14,
                        wordWrap: 'on',
                        automaticLayout: true,
                        scrollBeyondLastLine: false,
                        padding: { top: 10, bottom: 10 },
                      }}
                    />
                  </div>
                </>
              )}
            </div>

            {/* Terminal - ALWAYS VISIBLE FOR TESTING */}
            <div style={{ height: '200px', borderTop: '1px solid #ccc', backgroundColor: '#f3f4f6', display: 'block' }}>
              <div style={{ height: '40px', borderBottom: '1px solid #ccc', backgroundColor: 'white', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Terminal style={{ width: '16px', height: '16px', color: '#6b7280' }} />
                  <span style={{ fontSize: '14px', fontWeight: '500', color: '#6b7280' }}>
                    Terminal
                  </span>
                </div>
              </div>
              <div style={{ height: '160px', padding: '16px', backgroundColor: 'black', color: '#10b981', fontFamily: 'monospace', fontSize: '14px', overflow: 'auto' }}>
                <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>
                  {terminalOutput || 'Terminal ready...'}
                </pre>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Add CSS animation for toast */}
      <style>{`
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
};

export default App;
