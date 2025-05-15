const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS
app.use(cors());

// Serve static files from the current directory
app.use(express.static(__dirname));

// Default route serves the viewer
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'xrai-viewer.html'));
});

// Start the server
app.listen(PORT, () => {
  console.log(`XRAI Format Browser Demo server running at http://localhost:${PORT}`);
  console.log(`Open your browser to http://localhost:${PORT} to view the demo`);
});
