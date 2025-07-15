
const express = require('express');
const axios = require('axios');
const router = express.Router();

const JSONBIN_API_KEY = process.env.JSONBIN_API_KEY;
const JSONBIN_BOOKINGS_ID = process.env.JSONBIN_BOOKINGS_ID;

const JSONBIN_BASE_URL = 'https://api.jsonbin.io/v3/b';

// POST route لاستقبال بيانات الحجز
router.post('/', async (req, res) => {
    try {
        console.log('📨 Received booking data:', req.body);

        // التحقق من وجود البيانات المطلوبة
        const { name, phone, pickup, destination, date, time } = req.body;
        
        if (!name || !phone || !pickup || !destination || !date || !time) {
            return res.status(400).json({
                success: false,
                error: 'جميع الحقول مطلوبة'
            });
        }

        // جلب البيانات الحالية من JSONBin
        console.log('🔍 Fetching existing bookings from JSONBin...');
        const getResponse = await axios.get(`${JSONBIN_BASE_URL}/${JSONBIN_BOOKINGS_ID}/latest`, {
            headers: {
                'X-Master-Key': JSONBIN_API_KEY
            }
        });

        let bookings = getResponse.data.record || [];
        console.log('📋 Current bookings count:', bookings.length);

        // إنشاء حجز جديد
        const newBooking = {
            id: Date.now().toString(),
            name,
            phone,
            pickup,
            destination,
            date,
            time,
            status: 'pending',
            createdAt: new Date().toISOString()
        };

        // إضافة الحجز الجديد إلى القائمة
        bookings.push(newBooking);
        console.log('➕ Added new booking with ID:', newBooking.id);

        // تحديث البيانات في JSONBin
        console.log('💾 Updating JSONBin with new booking...');
        const updateResponse = await axios.put(`${JSONBIN_BASE_URL}/${JSONBIN_BOOKINGS_ID}`, bookings, {
            headers: {
                'Content-Type': 'application/json',
                'X-Master-Key': JSONBIN_API_KEY
            }
        });

        console.log('✅ Booking saved successfully!');
        
        res.json({
            success: true,
            message: 'تم حفظ الحجز بنجاح',
            booking: newBooking,
            totalBookings: bookings.length
        });

    } catch (error) {
        console.error('❌ Error processing booking:', error.message);
        
        res.status(500).json({
            success: false,
            error: 'حدث خطأ في حفظ الحجز',
            details: error.message
        });
    }
});

// GET route لعرض جميع الحجوزات (للاختبار)
router.get('/bookings', async (req, res) => {
    try {
        const getResponse = await axios.get(`${JSONBIN_BASE_URL}/${JSONBIN_BOOKINGS_ID}/latest`, {
            headers: {
                'X-Master-Key': JSONBIN_API_KEY
            }
        });

        const bookings = getResponse.data.record || [];
        
        res.json({
            success: true,
            bookings,
            count: bookings.length
        });

    } catch (error) {
        console.error('❌ Error fetching bookings:', error.message);
        
        res.status(500).json({
            success: false,
            error: 'حدث خطأ في جلب الحجوزات',
            details: error.message
        });
    }
});

module.exports = router;
