const fs = require('fs');
const path = require('path');

// Read the parking_data.js file
const parkingDataPath = path.resolve('..', 'pb', 'docs', 'parking_data.js');
let fileContent = fs.readFileSync(parkingDataPath, 'utf8');

// Extract the array part (removing the variable declaration and semicolon)
fileContent = fileContent.replace('const parkingData = ', '').replace(/;$/, '');

try {
  // Parse the JavaScript array as JSON
  const parkingData = JSON.parse(fileContent);
  console.log(`Extracted ${parkingData.length} parking locations`);
  
  // Format the parking data to match our application's structure
  const formattedData = parkingData.map(parking => ({
    id: parking.id,
    name: parking.name,
    street: parking.street || "",
    house: parking.house || "",
    subway: parking.subway || "",
    lat: parking.lat,
    lon: parking.lon,
    polygon: parking.polygon || []
  }));
  
  // Write the formatted data to our public folder
  const outputPath = path.resolve('public', 'data', 'parking_data.json');
  fs.writeFileSync(outputPath, JSON.stringify(formattedData, null, 2));
  
  console.log(`Parking data saved to ${outputPath}`);
} catch (error) {
  console.error('Error parsing or saving parking data:', error);
  process.exit(1);
} 