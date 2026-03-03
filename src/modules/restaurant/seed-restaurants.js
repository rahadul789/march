const mongoose = require("mongoose");
const Restaurant = require("./model/restaurant.model"); // adjust path if needed

const MONGO_URI =
  "mongodb+srv://rahadul:rahadul@cluster0.npsow97.mongodb.net/march_food_delivery_system?retryWrites=true&w=majority"; // change DB name

const OWNER_ID = "69a5349f293cac4ce2ddd0c3";

const BASE_LAT = 24.876534;
const BASE_LNG = 90.724831;

/**
 * Generate random coordinate within X km
 */
function generateNearbyCoordinates(baseLat, baseLng, maxDistanceKm) {
  const earthRadius = 6371; // km

  const randomDistance = Math.random() * maxDistanceKm;
  const randomAngle = Math.random() * 2 * Math.PI;

  const deltaLat = (randomDistance / earthRadius) * (180 / Math.PI);
  const deltaLng =
    ((randomDistance / earthRadius) * (180 / Math.PI)) /
    Math.cos(baseLat * (Math.PI / 180));

  const newLat = baseLat + deltaLat * Math.cos(randomAngle);
  const newLng = baseLng + deltaLng * Math.sin(randomAngle);

  return [newLng, newLat];
}

async function seed() {
  await mongoose.connect(MONGO_URI);
  console.log("Connected to DB");

  await Restaurant.deleteMany({ ownerId: OWNER_ID });
  console.log("Old test restaurants removed");

  const restaurants = [];

  // 10 inside 5km
  for (let i = 1; i <= 10; i++) {
    const coordinates = generateNearbyCoordinates(BASE_LAT, BASE_LNG, 4.5);

    restaurants.push({
      name: `Nearby Test Restaurant ${i}`,
      description: "Test restaurant within 5km radius",
      address: {
        fullAddress: `Nearby Address ${i}`,
        city: "Test City",
        state: "Test State",
        country: "Bangladesh",
        postalCode: "2200",
      },
      geoLocation: {
        type: "Point",
        coordinates,
      },
      ownerId: OWNER_ID,
      approvalStatus: "approved",
      commissionRate: 15,
      isActive: true,
      isDeleted: false,
    });
  }

  // 10 outside 5km (8–12km range)
  for (let i = 11; i <= 20; i++) {
    const coordinates = generateNearbyCoordinates(BASE_LAT, BASE_LNG, 12);

    restaurants.push({
      name: `Far Test Restaurant ${i}`,
      description: "Test restaurant outside 5km radius",
      address: {
        fullAddress: `Far Address ${i}`,
        city: "Test City",
        state: "Test State",
        country: "Bangladesh",
        postalCode: "2200",
      },
      geoLocation: {
        type: "Point",
        coordinates,
      },
      ownerId: OWNER_ID,
      approvalStatus: "approved",
      commissionRate: 15,
      isActive: true,
      isDeleted: false,
    });
  }

  await Restaurant.insertMany(restaurants);

  console.log("20 restaurants seeded successfully");
  process.exit();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
