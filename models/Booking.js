const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
    place: {type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Place'},
    user: {type: mongoose.Schema.Types.ObjectId, required: true},
    checkIn: {type: Date, required: true},
    checkOut: {type: Date, required: true},
    userName: {type: String, required: true},
    numberOfGuests:{type: Number, required: true},
    unit: {type: Number, required: true},
    price: {type: Number, required: true},
})

const BookingModel = mongoose.model('Booking', bookingSchema);

module.exports = BookingModel;