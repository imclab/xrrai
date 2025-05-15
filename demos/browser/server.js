const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS
app.use(cors());

// Set Content-Type for .xrai files in the route handler

// Serve static files from the current directory
app.use(express.static(__dirname));

// Fallback route for any other requests
app.get('*', (req, res) => {
  // If the request is for the root, serve index.html
  if (req.path === '/') {
    res.sendFile(path.join(__dirname, 'xrai-viewer.html'));
  } else {
    // Otherwise, try to serve the requested file
    const filePath = path.join(__dirname, req.path);
    
    if (fs.existsSync(filePath)) {
      // For .xrai files, set appropriate headers
      if (filePath.endsWith('.xrai')) {
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename="${path.basename(filePath)}"`);
      }
      
      // Stream the file
      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
    } else {
      res.status(404).send('File not found');
    }
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`XRAI Format Browser Demo server running at http://localhost:${PORT}`);
  console.log(`Open your browser to http://localhost:${PORT} to view the demo`);
});
