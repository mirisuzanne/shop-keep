import fetch from 'node-fetch';

const apiOptions = {
	test: 'apis-tem.usps.com',
	prod: 'apis.usps.com',
}

const api = apiOptions.test;

var tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 1);
tomorrow = tomorrow.toISOString().slice(0,10);

let authToken;

const getAuth = async () => {
	if (authToken) return authToken;

	const authResponse = await fetch(`https://${api}/oauth2/v3/token`, {
		method: 'post',
		body: JSON.stringify({
			grant_type: 'client_credentials',
			client_id: process.env.USPS_KEY,
			client_secret: process.env.USPS_SECRET,
		}),
		headers: {'Content-Type': 'application/json'}
	});

	const auth = await authResponse.json();
	authToken = auth.access_token;
	return auth.access_token;
}


const cityStateFromZip = async (zip) => {
	const auth = await getAuth();
	const cityStateResponse = await fetch(`https://${api}/addresses/v3/city-state?ZIPCode=${zip}`, {
		headers: {
			accept: 'application/json',
			Authorization: `Bearer ${auth}`,
		},
	});

	return await cityStateResponse.json();
}

const getRates = async (details = {}) => {
	const auth = await getAuth();
	const ratesResponse = await fetch(`https://${api}/prices/v3/base-rates/search`, {
		method: 'post',
		body: JSON.stringify({
			originZIPCode: details.from || '80205',
			destinationZIPCode: details.to,
			weight: Number(details.weight),
			length: Number(details.length),
			width: Number(details.width),
			height: Number(details.height),
			mailingDate: tomorrow,
			priceType: "COMMERCIAL",
			mailClass: "USPS_GROUND_ADVANTAGE",
			processingCategory: "MACHINABLE",
			rateIndicator: "SP",
			destinationEntryFacilityType: "NONE",
		}),
		headers: {
			accept: 'Content-Type: application/json',
			Authorization: `Bearer ${auth}`,
			'Content-Type': 'application/json',
		},
	});

	return await ratesResponse.json();
}

export default async (request, context) => {
	try {
		const url = new URL(request.url);
		const query = new URLSearchParams(url.search);

		const details = {
			from: query.get('from'),
			to: query.get('to'),
			weight: query.get('weight'),
			length: query.get('length'),
			width: query.get('width'),
			height: query.get('height'),
		}

		if (!details.to) throw 'No destination zip code provided';

		const reply = {
			cityState: await cityStateFromZip(details.to),
		};

		if (details.length && details.height && details.width && details.weight) {
			reply.rates = await getRates(details);
		}

		return new Response(
			JSON.stringify(reply),
			{ status: 200, statusText: 'ok', }
		);
	} catch (e) {
		console.error(e);

		return new Response(
			JSON.stringify(e),
			{ status: 400, }
		);
	}
}

export const config = {
  path: "/api",
}
