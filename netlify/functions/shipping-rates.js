import fetch from 'node-fetch';

const apiOptions = {
	test: 'apis-tem.usps.com',
	prod: 'apis.usps.com',
}

const api = apiOptions.test;

var tomorrow = new Date();
tomorrow
	.setDate(tomorrow.getDate() + 1)
	.toISOString()
	.slice(0,10);

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

const cityStateFromZip = async (zip) => {
	const cityStateResponse = await fetch(`https://${api}/addresses/v3/city-state?ZIPCode=30022`, {
		headers: {
			accept: 'application/json',
			Authorization: `Bearer ${auth.access_token}`,
		},
	});

	return await cityStateResponse.json();
}

const getRates = async (details = {}) => {
	const ratesResponse = await fetch(`https://${api}/prices/v3/base-rates/search`, {
		method: 'post',
		body: JSON.stringify({
			originZIPCode: details.from || '80205',
			destinationZIPCode: details.to,
			weight: details.weight,
			length: details.length,
			width: details.width,
			height: details.height,
			mailingDate: tomorrow,
		}),
		headers: {
			accept: 'Content-Type: application/json',
			Authorization: `Bearer ${auth.access_token}`,
		},
	});

	return await ratesResponse.json();
}

export default async = (request, context) => {
	try {
		const query = new URLSearchParams(request.rawQuery);

		const cityState = await cityStateFromZip(query.get('zip'));

		return {
			statusCode: 200,
			body: JSON.stringify({cityState}),
		};
	} catch (e) {
		console.error(e);

		return {
			statusCode: 400,
			body: JSON.stringify(e),
		};
	}
}

export const config = {
  path: "/api",
}
