import express from 'express';

const app = express();

app.get('/', (req, res) => {
    res.send("Hello from Fleetpilot!!");
});


app.get('/api/hello', (req, res) => {
    res.json({data : {message: 'Hello from the API', time: new Date()}});
});

app.get('/api/missing', (req, res) => {
    res.status(404).json(({
        error : {
            code : 'NOT_FOUND',
            message : "Nothing lives here",
            details : null 
        }
    }));
});

app.listen(3000, () => {
    console.log("Server running at http://localhost:3000");
});