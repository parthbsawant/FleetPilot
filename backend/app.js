
// Builds the Express app: the line of functions every request travels through.
// It does NOT start the server; server.js does that.

import express from 'express';
import { healthRouter } from './routes/health.routes.js';
import { notFound, errorHandler } from './middleware/errors.js';

export const app = express();


// 1. Print every request in the terminal.
app.use((req, res, next) => {
    console.log(`${req.method} ${req.originalUrl}`);
    next();
});


// 2. Turn JSON request bodies into req.body.
app.use(express.json());


// 3. API routes (more are added in later steps).
app.use('/api/health', healthRouter);


// 4. Unknown /api/... URLs get a JSON 404.
app.use('/api', notFound);


// 5. Everything else: serve files from the frontend folder.
app.use(express.static('frontend'));


// 6. No file matched either: 404.
app.use(notFound);


// 7. Error handler: must be last.
app.use(errorHandler);


// What we are doing: We are creating the central Express application 
// in app.js. It brings together request logging, JSON parsing, the health 
// router, API-specific 404 handling, frontend static-file serving, general 
// 404 handling, and the error handler. Notice that we mount healthRouter at 
// /api/health; since its internal route is /, the complete endpoint remains 
// /api/health. This file configures the application but does not start the server.