const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// Create temp directory for code execution
const tempDir = path.join(__dirname, 'temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// Language execution configurations
const languageConfigs = {
  javascript: {
    extension: 'js',
    command: 'node',
    args: (filePath) => [filePath]
  },
  python: {
    extension: 'py',
    command: 'python',
    args: (filePath) => [filePath]
  },
  cpp: {
    extension: 'cpp',
    compileCommand: 'g++',
    compileArgs: (filePath, outputFile) => [filePath, '-o', outputFile],
    runCommand: (outputFile) => outputFile
  }
};

// Store active rooms and users
const rooms = new Map();

// Helper function to get or create room
function getOrCreateRoom(roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      users: new Map(),
      fileContents: {} // Store content per file
    });
  }
  return rooms.get(roomId);
}

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Join room
  socket.on('join-room', (roomId) => {
    const room = getOrCreateRoom(roomId);
    socket.join(roomId);
    
    // Add user to room
    room.users.set(socket.id, {
      id: socket.id,
      cursor: { line: 1, column: 1 }
    });

    // Notify room about new user
    socket.to(roomId).emit('user-joined', {
      userId: socket.id,
      users: Array.from(room.users.values())
    });

    // Send current room state to new user
    socket.emit('room-state', {
      fileContents: room.fileContents || {},
      users: Array.from(room.users.values())
    });

    console.log(`User ${socket.id} joined room ${roomId}`);
  });

  // Handle content changes
  socket.on('content-change', (data) => {
    console.log('Content change received:', data);
    const { roomId, content, operation, fileId } = data;
    const room = getOrCreateRoom(roomId);
    
    // Update room content for specific file
    if (!room.fileContents) {
      room.fileContents = {};
    }
    room.fileContents[fileId] = content;
    
    console.log(`Broadcasting to room ${roomId} for file ${fileId}`);
    // Broadcast to other users in the room
    socket.to(roomId).emit('content-change', {
      content,
      operation,
      fileId,
      userId: socket.id
    });
  });

  // Handle cursor movements
  socket.on('cursor-move', (data) => {
    const { roomId, cursor } = data;
    const room = getOrCreateRoom(roomId);
    
    // Update user cursor position
    if (room.users.has(socket.id)) {
      room.users.get(socket.id).cursor = cursor;
    }
    
    // Broadcast cursor position to other users
    socket.to(roomId).emit('cursor-move', {
      userId: socket.id,
      cursor
    });
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    
    // Find and remove user from all rooms
    rooms.forEach((room, roomId) => {
      if (room.users.has(socket.id)) {
        room.users.delete(socket.id);
        
        // Notify other users
        socket.to(roomId).emit('user-left', {
          userId: socket.id
        });

        // Clean up empty rooms
        if (room.users.size === 0) {
          rooms.delete(roomId);
        }
      }
    });
  });
});

// API endpoint to get room info
app.get('/api/room/:roomId', (req, res) => {
  const { roomId } = req.params;
  const room = rooms.get(roomId);
  
  if (room) {
    res.json({
      roomId,
      userCount: room.users.size,
      exists: true
    });
  } else {
    res.json({
      roomId,
      userCount: 0,
      exists: false
    });
  }
});

// Code execution endpoint
app.post('/api/execute', async (req, res) => {
  try {
    const { language_id, source_code, stdin = '' } = req.body;

    if (!language_id || !source_code) {
      return res.status(400).json({
        error: 'Missing required parameters: language_id and source_code'
      });
    }

    // Map language_id to language name
    const languageMap = {
      63: 'javascript',
      71: 'python',
      54: 'cpp'
    };

    const language = languageMap[language_id];
    if (!language) {
      return res.status(400).json({
        error: 'Unsupported language_id. Supported: 63 (JavaScript), 71 (Python), 54 (C++)'
      });
    }

    const config = languageConfigs[language];
    const fileId = uuidv4();
    const fileName = `${fileId}.${config.extension}`;
    const filePath = path.join(tempDir, fileName);

    // Write source code to file
    fs.writeFileSync(filePath, source_code);

    let stdout = '';
    let stderr = '';
    let compile_output = '';
    let exit_code = 0;

    try {
      if (language === 'cpp') {
        // Compile C++ code first
        const outputFile = path.join(tempDir, `${fileId}.exe`);
        const compileResult = await new Promise((resolve, reject) => {
          const compileProcess = spawn(config.compileCommand, config.compileArgs(filePath, outputFile));
          
          compileProcess.stdout.on('data', (data) => {
            compile_output += data.toString();
          });
          
          compileProcess.stderr.on('data', (data) => {
            compile_output += data.toString();
          });
          
          compileProcess.on('close', (code) => {
            resolve({ code, compile_output });
          });
          
          compileProcess.on('error', (error) => {
            reject(error);
          });
        });

        if (compileResult.code !== 0) {
          exit_code = compileResult.code;
          stderr = compile_output;
        } else {
          // Run compiled C++ code
          const runResult = await new Promise((resolve, reject) => {
            const runProcess = spawn(config.runCommand(outputFile), [], { 
              stdio: ['pipe', 'pipe', 'pipe'],
              timeout: 5000 // 5 second timeout
            });
            
            if (stdin) {
              runProcess.stdin.write(stdin);
              runProcess.stdin.end();
            }
            
            runProcess.stdout.on('data', (data) => {
              stdout += data.toString();
            });
            
            runProcess.stderr.on('data', (data) => {
              stderr += data.toString();
            });
            
            runProcess.on('close', (code) => {
              resolve({ code, stdout, stderr });
            });
            
            runProcess.on('error', (error) => {
              reject(error);
            });
          });
          
          exit_code = runResult.code;
          stdout = runResult.stdout;
          stderr = runResult.stderr;
        }

        // Clean up compiled file
        if (fs.existsSync(outputFile)) {
          fs.unlinkSync(outputFile);
        }
      } else {
        // Run interpreted languages (JavaScript, Python)
        const runResult = await new Promise((resolve, reject) => {
          const runProcess = spawn(config.command, config.args(filePath), { 
            stdio: ['pipe', 'pipe', 'pipe'],
            timeout: 5000 // 5 second timeout
          });
          
          if (stdin) {
            runProcess.stdin.write(stdin);
            runProcess.stdin.end();
          }
          
          runProcess.stdout.on('data', (data) => {
            stdout += data.toString();
          });
          
          runProcess.stderr.on('data', (data) => {
            stderr += data.toString();
          });
          
          runProcess.on('close', (code) => {
            resolve({ code, stdout, stderr });
          });
          
          runProcess.on('error', (error) => {
            reject(error);
          });
        });
        
        exit_code = runResult.code;
        stdout = runResult.stdout;
        stderr = runResult.stderr;
      }
    } catch (error) {
      stderr = error.message;
      exit_code = 1;
    } finally {
      // Clean up source file
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    res.json({
      stdout,
      stderr,
      compile_output,
      exit_code,
      status: {
        id: exit_code === 0 ? 3 : 4, // 3 = Success, 4 = Runtime Error
        description: exit_code === 0 ? 'Success' : 'Runtime Error'
      }
    });

  } catch (error) {
    console.error('Execution Error:', error.message);
    res.status(500).json({
      error: 'Failed to execute code',
      details: error.message
    });
  }
});

// Start server
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
