
import { Router } from 'express';

import {
    parseId,
    validateVehicle,
    validateVehicleQuery
} from '../validation/vehicles.validation.js';

import * as vehicles from '../services/vehicles.service.js';

// Create the vehicle router.
export const vehiclesRouter = Router();

// GET /api/vehicles
// Get all vehicles with optional filters and pagination.
vehiclesRouter.get('/', async (req, res) => {
    const { filters, page, limit } = validateVehicleQuery(req.query);

    const { vehicles: list, total } = await vehicles.listVehicles({
        filters,
        page,
        limit
    });

    res.json({
        data: list,
        meta: {
            page,
            limit,
            total
        }
    });
});

// GET /api/vehicles/:id
// Get one vehicle using its ID.
vehiclesRouter.get('/:id', async (req, res) => {
    const id = parseId(req.params.id);

    const vehicle = await vehicles.getVehicle(id);

    res.json({
        data: vehicle
    });
});


// POST /api/vehicles
// Create a new vehicle.
vehiclesRouter.post('/', async (req, res) => {
    const values = validateVehicle(req.body, { isNew: true });

    const vehicle = await vehicles.createVehicle(values);

    res.status(201).json({
        data: vehicle
    });
});