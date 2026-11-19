
import express from 'express';
import { healthRouter } from './routes/health.routes.js';
import { vehiclesRouter } from './routes/vehicles.routes.js';
import { tripsRouter } from './routes/trips.routes.js';
import { maintenanceRouter } from './routes/maintenance.routes.js';
import { expensesRouter } from './routes/expenses.routes.js';
import { dashboardRouter } from './routes/dashboard.routes.js';  
import { notFound, errorHandler } from './middleware/errors.js';

export const app = express();

app.use((req, res, next) => {
    console.log(`${req.method} ${req.originalUrl}`);
    next();
});

app.use(express.json());

app.use('/api/health', healthRouter);
app.use('/api/vehicles', vehiclesRouter);
app.use('/api/trips', tripsRouter);     
app.use('/api/maintenance', maintenanceRouter);  
app.use('/api/expenses', expensesRouter);   
app.use('/api/dashboard', dashboardRouter); 

app.use('/api', notFound);

app.use(express.static('frontend'));

app.use(notFound);

app.use(errorHandler);


