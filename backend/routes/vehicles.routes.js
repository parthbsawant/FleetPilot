
import { Router } from 'express';

import {
    parseId,
    validateVehicle,
    validateVehicleQuery
} from '../validation/vehicles.validation.js';

import * as vehicles from '../services/vehicles.service.js';

export const vehiclesRouter = Router();

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

vehiclesRouter.get('/:id', async (req, res) => {
    const id = parseId(req.params.id);

    const vehicle = await vehicles.getVehicle(id);

    res.json({
        data: vehicle
    });
});

vehiclesRouter.post('/', async (req, res) => {
    const values = validateVehicle(req.body, { isNew: true });

    const vehicle = await vehicles.createVehicle(values);

    res.status(201).json({
        data: vehicle
    });
});

vehiclesRouter.patch('/:id', async(req, res) => {
    const id = parseId(req.params.id);

    const values = validateVehicle(req.body, { isNew: false });

    const vehicle = await vehicles.updateVehicle(id, values);

    res.json({
        data: vehicle
    });
});

vehiclesRouter.delete('/:id', async(req,res) => {
    const id = parseId(req.params.id);

    await vehicles.deleteVehicle(id);

    res.json({
        data: {id, deleted: true}
    });
});