const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3333;

// Enable CORS
app.use(cors());

// Serve static files from the current directory
app.use(express.static(__dirname));

// Default route serves the fixed XRAI viewer
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'xrai-fixed-viewer.html'));
});

// Simple viewer route
app.get('/simple', (req, res) => {
  res.sendFile(path.join(__dirname, 'xrai-simple-viewer.html'));
});

// Minimal viewer route
app.get('/minimal', (req, res) => {
  res.sendFile(path.join(__dirname, 'minimal-viewer.html'));
});

// Original viewer route
app.get('/original', (req, res) => {
  res.sendFile(path.join(__dirname, 'xrai-original-fixed.html'));
});

// Broken original viewer route
app.get('/original-broken', (req, res) => {
  res.sendFile(path.join(__dirname, 'xrai-viewer.html'));
});

// Start the server
app.listen(PORT, () => {
  console.log(`XRAI Format Browser Demo server running at http://localhost:${PORT}`);
  console.log(`Open your browser to http://localhost:${PORT} to view the demo`);
});
