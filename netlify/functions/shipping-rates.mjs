import fetch from 'node-fetch';

const apiOptions = {
	dev: 'apis-tem.usps.com',
	prod: 'apis.usps.com',
}

const api = apiOptions[process.env.CONTEXT] || apiOptions.prod;

// auth
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

// api calls
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

const getRates = async (url, body) => {
	const auth = await getAuth();
	const ratesResponse = await fetch(url, {
		method: 'post',
		body: JSON.stringify(body),
		headers: {
			accept: 'Content-Type: application/json',
			Authorization: `Bearer ${auth}`,
			'Content-Type': 'application/json',
		},
	});

	return await ratesResponse.json();
}

const domesticRates = async (shipping, item) => await getRates(
	`https://${api}/prices/v3/base-rates/search`,
	{
		...item,
		originZIPCode: shipping.fromZip,
		destinationZIPCode: shipping.toZip,
		priceType: "COMMERCIAL",
		mailClass: "USPS_GROUND_ADVANTAGE",
		processingCategory: "MACHINABLE",
		rateIndicator: "SP",
		destinationEntryFacilityType: "NONE",
	}
);

const globalRates = async (shipping, item) => await getRates(
	`https://${api}/international-prices/v3/base-rates/search`,
	{
		...item,
		originZIPCode: shipping.fromZip,
		foreignPostalCode: shipping.toZip,
		destinationCountryCode: shipping.toCountry,
		priceType: "COMMERCIAL",
		mailClass: item.weight < 4
			? 'FIRST-CLASS_PACKAGE_INTERNATIONAL_SERVICE'
			: 'PRIORITY_MAIL_INTERNATIONAL',
		processingCategory: "MACHINABLE",
		rateIndicator: "SP",
		destinationEntryFacilityType: "NONE",
	}
);

const rateForItem = async (shipping, item) => {
	const reply = shipping.toCountry === 'US'
		? await domesticRates(shipping, item.ship)
		: await globalRates(shipping, item.ship);

	return Number(reply.totalBasePrice) * item.count;
}

const getRatesForItems = async (shipping, items) => {
	const rates = items.map(async (item) => await rateForItem(shipping, item));
	return await Promise.all(rates);
}

// form data
const numberSort = (list) => list.toSorted((a,b) => b - a);

const expandSize = (size) => {
	const sizeArray = size.split(' ').map((d) => Number(d));

	while (sizeArray.length < 3) {
		sizeArray.push(sizeArray.at(-1));
	}

	return numberSort(sizeArray.map((n) => Number(n)));
}

const expandItem = (item) => {
	const size = expandSize(item.size);

	return {
		count: Number(item.count || 1),
		ship: {
			length: Number(size[0]),
			height: Number(size[1]),
			width: Number(size[2]),
			weight: Number(item.weight),
		}
	};
}

// process
export default async (request, context) => {
	try {
		const query = new URL(request.url).searchParams;

		const shipping = {
			fromZip: query.get('from-zip') || '80205',
			toZip: query.get('to-zip'),
			toCountry: query.get('to-country') || 'US',
		};

		const items = JSON.parse(query.get('items')).map(expandItem);

		console.log([shipping, items]);

		const rates = await getRatesForItems(shipping, items);
		const total = rates.reduce((total, current) => total + (current || 0), 0);

		const cityState = shipping.toCountry === 'US'
			? await cityStateFromZip(shipping.toZip)
			: null
		;

		const address = cityState?.city
			? {
				locality: cityState.city,
				region: cityState.state,
				postalCode: cityState.ZIPCode,
				country: shipping.toCountry,
			}
			: null
		;

		return new Response(
			JSON.stringify({ rates, total, address }),
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
  path: "/api/shipping",
	rateLimit: {
    windowLimit: 100,
    windowSize: 60,
    aggregateBy: ["ip", "domain"],
  },
}
