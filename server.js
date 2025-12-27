const express = require('express');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 3000; 
app.listen(port, '0.0.0.0', () => {
    console.log(`Server läuft auf Port ${port}`);
});

// Erlaubt Anfragen von Ihrer HTML-Seite
app.use(cors({
  origin: 'https://aaron.royalart.de.de' 
}));

app.get('/api/data', (req, res) => {
  res.json({ message: "Hallo von Railway!" });
});

app.listen(port, () => {
  console.log(`Server läuft auf Port ${port}`);
});