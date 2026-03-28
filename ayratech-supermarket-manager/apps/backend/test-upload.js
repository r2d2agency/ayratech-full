const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

// Configuration
const BASE_URL = 'http://localhost:3000'; // Adjust port if needed
const ROUTE_ITEM_ID = 'YOUR_ROUTE_ITEM_ID_HERE'; // Replace with a valid ID
const PHOTO_PATH = path.join(__dirname, 'test-photo.jpg'); // Ensure this file exists

async function testUpload() {
  try {
    // 1. Create a dummy photo if it doesn't exist
    if (!fs.existsSync(PHOTO_PATH)) {
      console.log('Creating dummy photo...');
      // Create a simple 1x1 pixel JPEG or similar (simulated)
      // For simplicity, just write some text, backend might reject if it checks mime type strictly
      // But let's try to use a real buffer or just a text file renamed to .jpg if backend only checks extension
      // Better: Create a minimal valid buffer?
      // Let's just create a text file for now, but RoutesService uses sharp, so it might fail if not an image.
      // So we should warn the user to provide a real image.
      console.log('Please provide a valid test-photo.jpg in this directory for real testing.');
      fs.writeFileSync(PHOTO_PATH, 'dummy content');
    }

    const form = new FormData();
    form.append('type', 'before'); // or 'after'
    form.append('category', 'Bebidas'); // Category name
    form.append('file', fs.createReadStream(PHOTO_PATH));

    console.log(`Uploading photo to ${BASE_URL}/routes/items/${ROUTE_ITEM_ID}/photos...`);

    const response = await axios.post(`${BASE_URL}/routes/items/${ROUTE_ITEM_ID}/photos`, form, {
      headers: {
        ...form.getHeaders(),
        // Add Authorization header if needed
        // 'Authorization': 'Bearer YOUR_JWT_TOKEN'
      }
    });

    console.log('Upload successful!');
    console.log('Response:', response.data);

  } catch (error) {
    console.error('Upload failed:', error.response ? error.response.data : error.message);
  }
}

testUpload();
