import express from 'express';

const app = express();
app.use(express.json());

app.post('/echo/:vehicleID/trips/:tripID', (req, res) => {
    res.json({
        params : req.params,
        query : req.query,
        body: req.body
    });
});

app.listen(3999, () => {
    console.log("Echo Server Running on http://localhost:3999");
});