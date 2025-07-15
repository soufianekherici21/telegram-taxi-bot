
const express = require('express');
const bookingRoutes = require('./booking');

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS headers للسماح بالطلبات من مواقع أخرى
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    
    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
    } else {
        next();
    }
});

// Routes
app.get('/', (req, res) => {
    res.json({ 
        message: 'Taxi Booking API is running!',
        status: 'active',
        endpoints: {
            booking: 'POST /'
        }
    });
});

app.use('/', bookingRoutes);

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚖 Taxi Booking API running on port ${PORT}`);
});
