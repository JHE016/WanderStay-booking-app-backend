const express = require('express');
const cors = require('cors');
const { default: mongoose } = require('mongoose');
const jwt = require('jsonwebtoken');
const User = require('./models/User.js');
const Place = require('./models/Place.js');
const Booking = require('./models/Booking.js');
const bcrypt = require('bcryptjs');
const cookieParser = require('cookie-parser');
const imageDownloader = require('image-downloader');
const multer = require('multer');
require('dotenv').config();
const app = express();
const fs = require('fs');

const bcryptSalt = bcrypt.genSaltSync(10);
const jwtSecret = process.env.JWT_SECRET || 'defaultSecret'; // Use environment variable for security

app.use(express.json());
app.use(cookieParser());
app.use('/uploads', express.static(__dirname + '/uploads'));
app.use(cors({
    credentials: true,
    origin: 'http://localhost:5173',
}));

(async () => {
    try {
        await mongoose.connect(process.env.MONGO_URL);
        console.log('Connected to MongoDB');
    } catch (error) {
        console.error('Error connecting to MongoDB:', error);
    }
})();

// Helper function to extract user data from JWT token
function getUserDataFromReq(req) {
    return new Promise((resolve, reject) => {
        const token = req.cookies.token;
        if (!token) {
            reject(new Error('No token provided'));
        }
        jwt.verify(token, jwtSecret, {}, (err, userData) => {
            if (err) {
                reject(new Error('Token verification failed'));
            }
            resolve(userData);
        });
    });
}

// Root route
app.get('/', (req, res) => {
    res.send('Welcome to the API');
});

app.get('/test', (req, res) => {
    res.json('test ok');
});

// Register route
app.post('/register', async (req, res) => {
    const { name, email, password } = req.body;
    try {
        const userDoc = await User.create({
            name,
            email,
            password: bcrypt.hashSync(password, bcryptSalt),
        });
        res.json(userDoc);
    } catch (e) {
        res.status(422).json(e);
    }
});

// Login route
app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const userDoc = await User.findOne({ email });
        if (userDoc) {
            const passOk = bcrypt.compareSync(password, userDoc.password);
            if (passOk) {
                jwt.sign({ email: userDoc.email, id: userDoc._id }, jwtSecret, {}, (err, token) => {
                    if (err) throw err;
                    res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production' }).json(userDoc);
                });
            } else {
                res.status(422).json('Password not correct');
            }
        } else {
            res.status(404).json('User not found');
        }
    } catch (error) {
        res.status(500).json({ error: 'Login failed' });
    }
});

// Profile route
app.get('/profile', async (req, res) => {
    try {
        const userData = await getUserDataFromReq(req);
        const { name, email, _id } = await User.findById(userData.id);
        res.json({ name, email, _id });
    } catch (error) {
        res.json(null);
    }
});

// Logout route
app.post('/logout', (req, res) => {
    res.cookie('token', '').json(true);
});

// Upload by link route
app.post('/upload-by-link', async (req, res) => {
    const { link } = req.body;
    const newName = 'photo' + Date.now() + '.jpg';
    try {
        await imageDownloader.image({
            url: link,
            dest: __dirname + '/uploads/' + newName,
        });
        res.json(newName);
    } catch (error) {
        res.status(500).json({ error: 'Failed to download image' });
    }
});

// Multer setup for file uploads
const photosMiddleware = multer({ dest: 'uploads' });
app.post('/upload', photosMiddleware.array('photos', 100), (req, res) => {
    const uploadedFiles = [];
    for (let i = 0; i < req.files.length; i++) {
        const { path, originalname } = req.files[i];
        const parts = originalname.split('.');
        const ext = parts[parts.length - 1];
        const newPath = path + '.' + ext;
        fs.renameSync(path, newPath);
        uploadedFiles.push(newPath.replace('uploads/', ''));
    }
    res.json(uploadedFiles);
});

// Add a place
app.post('/places', async (req, res) => {
    const { title, address, city, phone, addedPhotos, description, perks, extraInfo, checkIn, checkOut, maxGuests, price } = req.body;
    try {
        const userData = await getUserDataFromReq(req);
        const placeDoc = await Place.create({
            owner: userData.id,
            title,
            address,
            city,
            phone,
            photos: addedPhotos,
            description,
            perks,
            extraInfo,
            checkIn,
            checkOut,
            maxGuests,
            price,
        });
        res.json(placeDoc);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create place' });
    }
});

// Get user's places
app.get('/user-places', async (req, res) => {
    try {
        const userData = await getUserDataFromReq(req);
        const places = await Place.find({ owner: userData.id });
        res.json(places);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch places' });
    }
});

// Get a specific place by ID
app.get('/places/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const placeDoc = await Place.findById(id);
        res.json(placeDoc);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch place' });
    }
});

// Update a place
app.put('/places', async (req, res) => {
    const { id, title, address, city, phone, addedPhotos, description, perks, extraInfo, checkIn, checkOut, maxGuests, price } = req.body;
    try {
        const userData = await getUserDataFromReq(req);
        const placeDoc = await Place.findById(id);
        if (userData.id === placeDoc.owner.toString()) {
            placeDoc.set({
                title,
                address,
                city,
                phone,
                photos: addedPhotos,
                description,
                perks,
                extraInfo,
                checkIn,
                checkOut,
                maxGuests,
                price,
            });
            await placeDoc.save();
            res.json('ok');
        } else {
            res.status(403).json({ error: 'Not authorized to edit this place' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Failed to update place' });
    }
});

// Get all places
app.get('/places', async (req, res) => {
    try {
        const places = await Place.find();
        res.json(places);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch places' });
    }
});

// Create a booking
app.post('/bookings', async (req, res) => {
    const { place, checkIn, checkOut, numberOfGuests, userName, unit, price } = req.body;
    try {
        const userData = await getUserDataFromReq(req);
        const booking = await Booking.create({
            place,
            checkIn,
            checkOut,
            numberOfGuests,
            userName,
            price,
            unit,
            user: userData.id,
        });
        res.json(booking);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create booking' });
    }
});

// Get user's bookings
app.get('/bookings', async (req, res) => {
    try {
        const userData = await getUserDataFromReq(req);
        const bookings = await Booking.find({ user: userData.id }).populate('place');
        res.json(bookings);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch bookings' });
    }
});

// Start the server
app.listen(4000, () => {
    console.log('Server is running on port 4000');
});