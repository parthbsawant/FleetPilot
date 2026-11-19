import { app } from './app.js';
import { config } from './config.js';

app.listen(config.port, () => {
    console.log(
        `FleetPilot running at http://localhost:${config.port} (${config.env})`
    );
});
