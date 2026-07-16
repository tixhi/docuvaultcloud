/**
 * DocuVault backend -- entry point.
 * Modular Express app: security middleware -> routes -> error handling.
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./src/routes/authRoutes');
const fileRoutes = require('./src/routes/fileRoutes');
const folderRoutes = require('./src/routes/folderRoutes');
const shareRoutes = require('./src/routes/shareRoutes');
const auditRoutes = require('./src/routes/auditRoutes');
const userRoutes = require('./src/routes/userRoutes');
const { notFoundHandler, errorHandler } = require('./src/middleware/errorHandler');
const logger = require('./src/utils/logger');

const app = express();
const PORT = process.env.PORT || 4000;

// --- Security & platform middleware -----------------------------------------
app.use(helmet());
app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
    credentials: true,
  })
);
app.use(compression());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// General API rate limit (auth routes have a stricter one of their own).
app.use(
  '/api',
  rateLimit({
    windowMs: 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

// --- Health check -----------------------------------------------------------
app.get('/api/health', (_req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// --- Routes ------------------------------------------------------------------
app.use('/api/auth', authRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/folders', folderRoutes);
app.use('/api/shares', shareRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/users', userRoutes);

// --- 404 + error handling -----------------------------------------------------
app.use(notFoundHandler);
app.use(errorHandler);

app.listen(PORT, () => {
  logger.info(`DocuVault API listening on port ${PORT} (${process.env.NODE_ENV || 'development'})`);
});

module.exports = app;
