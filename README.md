# 🚀 Collaborative Code Editor

A real-time collaborative code editor built with React, TypeScript, and Socket.io. Multiple users can edit code together in shared rooms, with support for JavaScript, Python, and C++ code execution.

## ✨ Features

### 🤝 Real-Time Collaboration
- **Live code synchronization** - Multiple users can edit simultaneously
- **File-specific rooms** - JavaScript, Python, and C++ files sync independently
- **Remote cursor tracking** - See where other users are typing
- **User presence** - Shows connected users in real-time
- **Room system** - Unique collaboration rooms via URL

### 💻 Code Execution
- **JavaScript** - Node.js runtime
- **Python** - Python interpreter
- **C++** - g++ compiler and execution
- **Terminal output** - Real-time execution results
- **Error handling** - Compilation and runtime errors

### 🎨 User Experience
- **Monaco Editor** - Professional code editor with syntax highlighting
- **Dark/Light themes** - Toggle between themes
- **File explorer** - Multiple files with language switching
- **Invite system** - Copy shareable links with unique room IDs
- **Responsive design** - Works on all screen sizes

## 🛠️ Tech Stack

### Frontend
- **React 18** - Modern UI framework
- **TypeScript** - Type-safe development
- **Monaco Editor** - VS Code's editor
- **Socket.io Client** - Real-time communication
- **Tailwind CSS** - Utility-first styling
- **Lucide React** - Beautiful icons

### Backend
- **Node.js** - JavaScript runtime
- **Express** - Web framework
- **Socket.io** - WebSocket server
- **Local execution** - No external API costs
- **UUID** - Unique room generation

## 🚀 Quick Start

### Prerequisites
- **Node.js** (v14 or higher)
- **npm** (v6 or higher)
- **Python** (for Python execution)
- **g++** (for C++ compilation)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd code-editor
   ```

2. **Install dependencies**
   ```bash
   npm install
   cd server
   npm install
   cd ..
   ```

3. **Start the servers**
   ```bash
   # Start backend server (port 3001)
   npm start --prefix server
   
   # Start frontend server (port 3000)
   npm start
   ```

4. **Open the application**
   Visit [http://localhost:3000](http://localhost:3000)

## 📖 Usage

### Starting a Collaboration Session

1. **Open the app** - A unique room ID is automatically generated
2. **Copy the invite link** - Click "📋 Copy Link" in the header
3. **Share the link** - Send it to collaborators
4. **Start coding** - Multiple users can edit in real-time

### Code Execution

1. **Select a language** - Use the dropdown in the header
2. **Write your code** - Monaco editor provides syntax highlighting
3. **Click "Run"** - Execute code and see results in the terminal

### File Management

- **JavaScript files** (`.js`) - Node.js execution
- **Python files** (`.py`) - Python interpreter
- **C++ files** (`.cpp`) - Compile and run with g++

## 🏗️ Architecture

```
┌─────────────────┐
│   Frontend     │
│   (React)      │
├─────────────────┤
│   Socket.io    │◄─────────────────┐
│   Client       │   Backend       │
│               │   (Node.js)      │
└─────────────────┘─────────────────┘
       │                   │
       ▼                   ▼
   Monaco Editor      Local Code Execution
   (Real-time)        (Node.js/Python/g++)
```

## 🎯 Advanced Features

### Room System
- **Unique room IDs** - Auto-generated for each session
- **URL-based routing** - `/room-abc123def`
- **Session persistence** - Stay in room on page refresh
- **Cross-file isolation** - Different files sync independently

### Real-Time Sync
- **Debounced updates** - Prevents character conflicts
- **Conflict resolution** - CRDT-like behavior
- **Cursor sharing** - See other users' cursor positions
- **User awareness** - Visual indicators for active users

### Code Execution
- **Sandboxed execution** - 2-second timeout, 128MB memory limit
- **Multiple languages** - JavaScript, Python, C++
- **Error handling** - Compilation and runtime errors
- **Output capture** - stdout, stderr, exit codes

## 🔧 Development

### Project Structure
```
code-editor/
├── src/                 # React frontend
│   ├── App.tsx         # Main component
│   ├── index.css        # Styles
│   └── ...
├── server/              # Node.js backend
│   ├── index.js         # Express server
│   └── temp/            # Temporary execution files
├── package.json         # Frontend dependencies
└── server/package.json  # Backend dependencies
```

### Adding New Languages

1. **Update language configurations** in `server/index.js`
2. **Add language option** in `src/App.tsx`
3. **Add file template** in the files array

### Customizing Themes

The editor uses inline styles for maximum compatibility. Modify the color variables in the `style` objects to customize themes.

## 📜 API Reference

### Socket.io Events

#### Client → Server
- `join-room` - Join a collaboration room
- `content-change` - Sync code changes
- `cursor-move` - Share cursor position

#### Server → Client
- `room-state` - Initial room data
- `content-change` - Receive remote changes
- `user-joined/left` - User presence updates

### Code Execution API

#### POST `/api/execute`
```json
{
  "language_id": 63,
  "source_code": "console.log('Hello');",
  "stdin": ""
}
```

## 🚀 Deployment

### GitHub Pages (Recommended)

1. **Build the application**
   ```bash
   npm run build
   ```

2. **Deploy to GitHub Pages**
   ```bash
   npm install -g gh-pages
   gh-pages -d build
   ```

### Alternative Deployment

- **Vercel** - `npm i -g vercel && vercel`
- **Netlify** - Drag and drop build folder
- **Heroku** - Follow Node.js deployment guide

## 🤝 Contributing

1. **Fork the repository**
2. **Create a feature branch**
3. **Make your changes**
4. **Test thoroughly**
5. **Submit a pull request**

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏‍ Acknowledgments

- **Monaco Editor** - Microsoft's code editor
- **Socket.io** - Real-time communication
- **React** - UI framework
- **Tailwind CSS** - Utility-first CSS framework
- **Lucide** - Icon library

---

**Built with ❤️ for collaborative coding!** 🚀
