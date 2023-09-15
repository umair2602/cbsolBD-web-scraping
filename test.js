const axios = require('axios');

// Replace 'YOUR_API_KEY' with your actual API key
const API_KEY = '6767f3b8aa507a5819bdb55c995a451e2e3d4f4a0fc258c187b6aa2ba68577d9';

// Function to fetch SERP data
async function fetchSerpData(query) {
  try {
    const response = await axios.get(`https://serpapi.com/search?api_key=${API_KEY}&q=${encodeURIComponent(query)}`);
    
    // Check if the request was successful
    if (response.status === 200) {
      const data = response.data;
      console.log('SERP Results:');
      console.log(data);
    } else {
      console.error('Error fetching SERP data:', response.statusText);
    }
  } catch (error) {
    console.error('An error occurred:', error.message);
  }
}

// Example usage
const userQuery = 'coffee';

fetchSerpData(userQuery);
