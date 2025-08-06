const fetch = require('node-fetch');

module.exports = async function (context, req){
  context.log('HTTP trigger function processed a request for geocoding.');

  const { GEOCODING_API_KEY } = process.env;
  const address = req.query.address || (req.body && req.body.address);

  if(!GEOCODING_API_KEY){
    context.res = {
      status: 500,
      body: "Geocoding API key is not configured in environment variables."
    };
    return;
  }

  if(!address){
    context.res = {
      status: 400,
      body: "Please provide an 'address' in the query string or request body."
    };
    return;
  }

  try{
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GEOCODING_API_KEY}`;
    const response = await fetch(url);

    if(!response.ok){
      const errorData = await response.json();
      throw new Error(`Geocoding API error: ${response.status} - ${errorData.error_message || response.statusText}`);
    }

    const data = await response.json();

    if(data.status == "OK" && data.results.length > 0){
      const { lat, lng } = data.results[0].geometry.location;
      context.res = {
        status: 200,
        body: { lat, lng }
      };
    } else {
      context.res = {
        status: 404,
        body: "Address not found."
      };
    }
  }catch (error){
    context.log.error("Error geocoding address:", error.message);
    context.res = {
      status: 500,
      body: `Failed to geocode address: ${error.message}`
    };
  }
};