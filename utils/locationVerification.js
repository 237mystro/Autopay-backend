// backend/utils/locationVerification.js
const mongoose = require('mongoose');

// Convert DMS (Degrees Minutes Seconds) to Decimal Degrees
const convertDMSToDD = (dms) => {
  // Parse DMS format: "4°08'49.9"N 9°17'08.8"E"
  const parts = dms.split(' ');
  if (parts.length !== 2) {
    throw new Error('Invalid DMS format');
  }
  
  const latPart = parts[0];
  const lngPart = parts[1];
  
  // Extract latitude degrees, minutes, seconds
  const latMatch = latPart.match(/(\d+)°(\d+)'([\d.]+)"([NSEW])/);
  if (!latMatch) {
    throw new Error('Invalid latitude format');
  }
  
  const latDeg = parseFloat(latMatch[1]);
  const latMin = parseFloat(latMatch[2]);
  const latSec = parseFloat(latMatch[3]);
  const latDir = latMatch[4];
  
  // Extract longitude degrees, minutes, seconds
  const lngMatch = lngPart.match(/(\d+)°(\d+)'([\d.]+)"([NSEW])/);
  if (!lngMatch) {
    throw new Error('Invalid longitude format');
  }
  
  const lngDeg = parseFloat(lngMatch[1]);
  const lngMin = parseFloat(lngMatch[2]);
  const lngSec = parseFloat(lngMatch[3]);
  const lngDir = lngMatch[4];
  
  // Convert to decimal degrees
  let latitude = latDeg + (latMin / 60) + (latSec / 3600);
  let longitude = lngDeg + (lngMin / 60) + (lngSec / 3600);
  
  // Apply direction signs
  if (latDir === 'S') latitude = -latitude;
  if (lngDir === 'W') longitude = -longitude;
  
  return { latitude, longitude };
};

// Calculate distance between two coordinates using Haversine formula
const calculateDistance = (coords1, coords2) => {
  // Convert to radians
  const toRad = (value) => (value * Math.PI) / 180;
  
  // Earth radius in meters
  const R = 6371e3;
  
  const φ1 = toRad(coords1.latitude);
  const φ2 = toRad(coords2.latitude);
  const Δφ = toRad(coords2.latitude - coords1.latitude);
  const Δλ = toRad(coords2.longitude - coords1.longitude);

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
            
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
};

// Verify if user is within allowed radius of company location
const verifyLocation = (userCoords, companyLocationDMS, maxDistance = 20) => {
  try {
    // Convert company DMS coordinates to decimal degrees
    const companyCoords = convertDMSToDD(companyLocationDMS);
    
    // Calculate distance between user and company
    const distance = calculateDistance(userCoords, companyCoords);
    
    return { 
      isWithinRadius: distance <= maxDistance,
      distance: distance,
      maxDistance: maxDistance,
      allowed: distance <= maxDistance,
      companyCoords: companyCoords
    };
  } catch (error) {
    console.error('Location verification error:', error);
    throw new Error('Failed to verify location: ' + error.message);
  }
};

// Format distance for display
const formatDistance = (distance) => {
  if (distance < 1) {
    return `${Math.round(distance * 100)} cm`;
  } else if (distance < 1000) {
    return `${Math.round(distance)} m`;
  } else {
    return `${(distance / 1000).toFixed(2)} km`;
  }
};

module.exports = {
  convertDMSToDD,
  calculateDistance,
  verifyLocation,
  formatDistance
};