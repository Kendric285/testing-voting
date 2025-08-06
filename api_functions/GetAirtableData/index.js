const fetch = require('node-fetch');

module.exports = async function(context, req){
  context.log('HTTP trigger function processed a request for Airtable data.');

  const { AIRTABLE_API_TOKEN, AIRTABLE_BASE_ID, AIRTABLE_TABLE_ID, MAX_RECORDS, PAGE_SIZE } = process.env;

  if(!AIRTABLE_API_TOKEN || !AIRTABLE_BASE_ID || !AIRTABLE_TABLE_ID){
    context.res = {
      status: 500,
      body: "Airtable API keys or IDs are not configured in environment variables."
    };
    context.error("AIRTABLE_API_TOKEN or IDs are missing in environment variables.");
    return;
  }

  let allRecords = [];
  let offset = undefined;
  const maxRecordsToFetch = parseInt(MAX_RECORDS || '400', 10);
  const pageSize = parseInt(PAGE_SIZE || '100', 10);

  try{
    do{
      let url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}?` +
        `fields[]=Category&` +
        `fields[]=Date%20and%20Time&` +
        `fields[]=End%20Time&` +
        `fields[]=Name%20of%20Voting%20Location%20or%20Voting%20Event&` +
        `fields[]=Borough&` +
        `fields[]=Address&` +
        `fields[]=Geocode+Cache+(For+Maps+Extension)&` +
        `fields[]=Address%20Formatted&` +
        `fields[]=Zip%20Code&` +
        `fields[]=Open%20Hours&` +
        `fields[]=CS%20Open%20Hours&` +
        `pageSize=${pageSize}&` +
        `maxRecords=${maxRecordsToFetch}`;

      if(offset){
        url += `&offset=${offset}`;
      }

      context.log(`Fetching Airtable URL: ${url}`); 
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${AIRTABLE_API_TOKEN}`
        }
      });

      if(!response.ok){
        const errorData = await response.json();
        throw new Error(`Airtable API error: ${response.status} - ${errorData.error.type || response.statusText}`);
      }

      const data = await response.json();
      allRecords.push(...data.records);
      offset = data.offset;

    }while(offset && allRecords.length < maxRecordsToFetch);

    context.res = {
      status: 200,
      body: allRecords
    };
    context.log(`Successfully fetched ${allRecords.length} Airtable records.`);

  }catch(error){
    context.log.error("Error fetching Airtable data:", error.message);
    context.res = {
      status: 500,
      body: `Failed to fetch Airtable data: ${error.message}`
    };
  }
};