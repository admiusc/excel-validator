require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;
const IS_PROD = process.env.NODE_ENV === 'production';

const BASE_URL = process.env.BASE_URL ||
  (process.env.RAILWAY_PUBLIC_DOMAIN
    ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
    : `http://localhost:${PORT}`);

app.use(cors({
  origin: IS_PROD ? BASE_URL : (process.env.FRONTEND_URL || 'http://localhost:5173'),
}));
app.use(express.json({ limit: '50mb' }));

app.use('/api', require('./routes/process'));

if (IS_PROD) {
  const distPath = path.join(__dirname, '../client/dist');
  app.use(express.static(distPath));
  app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
}

app.listen(PORT, () => {
  console.log(`\n✅ Excel Validator corriendo en ${BASE_URL}\n`);
});
