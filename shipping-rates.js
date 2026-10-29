class ShippingRates extends HTMLElement {
	static register(tagName) {
		if ("customElements" in window) {
			customElements.define(tagName || "shipping-rates", ShippingRates);
		}
	}

  static #appendShadowTemplate = (node) => {
    const template = document.createElement("template");
    template.innerHTML = `
			<form action="/api/shipping" part="form">
				<input type="hidden" id="from-zip" name="from-zip">
				<input type="hidden" id="item-data" name="items">

				<div part="public-fields">
					<div part="to-zip form-field">
						<label for="to-zip" part="label">Postal code</label>
						<input id="to-zip" name="to-zip" type="text" inputmode="numeric" pattern="${ShippingRates.#usPostalPattern}" part="input postal-code" autocomplete="shipping postal-code">
					</div>
					<div part="to-country form-field" hidden>
						${ShippingRates.#countrySelect}
					</div>
				</div>

				<button type="submit" part="button">
					<slot>estimate shipping</slot>
				</button>
				<output part="result" hidden></output>
			</form>
    `;
    const shadowRoot = node.attachShadow({ mode: "open" });
    shadowRoot.appendChild(template.content.cloneNode(true));
  }

  static #adoptShadowStyles = (node) => {
    const shadowStyle = new CSSStyleSheet();
    shadowStyle.replaceSync(`
			:host {
				display: block;
				container: shipping-rates / inline-size;
			}

			:host([data-status="fetching"]) button[type=submit]::after {
				content: '…';
			}

			:host([data-status="error"]) {
				--status-color: var(--shipping-error-color, red);
			}

			[hidden] { display: none !important; }

			output {
				display: block;
				border-inline-start: thick solid var(--status-color, currentColor);
				padding-inline-start: 1ch;
			}

			input, select, button {
				font: inherit;
				padding: 0.25lh;
				line-height: normal;
			}

			input:user-invalid:not(:focus) {
				border-color: var(--shipping-error-color, red);
			}

			[part~=form],
			[part~=public-fields] {
				display: grid;
				gap: 0.5lh;
			}

			[part~=form-field] {
				display: grid;
			}

			[part~=button] {
				place-self: start;
			}
		`);
    node.shadowRoot.adoptedStyleSheets = [shadowStyle];
  }

  static shippingChange = new Event('shippingChange', {bubbles: true});
  static addressChange = new Event('addressChange', {bubbles: true});

  constructor() {
    super();
    ShippingRates.#appendShadowTemplate(this);
    ShippingRates.#adoptShadowStyles(this);
  }

	#shop;
	#parts = {};
	#uspsData;
	#estimate;

	get estimate() {
		return this.#estimate;
	}

	set estimate(value) {
		this.#estimate = value ? Number(value) : value;
		this.#onEstimateChange();
	}

	get api() {
		return this.#parts.form.getAttribute('action');
	}

	set api(value) {
		if (!value) return;
		this.#parts.form.setAttribute('action', value);
	}

	get fromZip() {
		return this.#parts.fromZip.value;
	}

	set fromZip(value) {
		this.#parts.fromZip.value = value || '';
	}

	get address() {
		const local = localStorage.getItem('shipping-address');
		return JSON.parse(local) || null;
	}

	set address(value) {
		if (typeof value !== 'object') throw 'Address must be an object';

		let trimValue = Object.keys(value)
			.filter((key) => value[key])
			.reduce((all, key) => ({ ...all, [key]: value[key] }), {});

		localStorage.setItem('shipping-address', JSON.stringify(trimValue));

		this.#onAddressChange();
	}

	get country() {
		return this.address.country;
	}

	get postalCode() {
		return this.address.postalCode;
	}

	get items() {
		return this.#shop?.cart || [{
			id: this.dataset.item || 'default',
			weight: Number(this.dataset.weight) || 2,
			count: Number(this.dataset.count) || 1,
			size: this.dataset.size || 8,
		}];
	}

	connectedCallback() {
		this.#parts = {
			form: this.shadowRoot.querySelector('[part=form]'),
			output: this.shadowRoot.querySelector('[part=result]'),
			items: this.shadowRoot.getElementById('item-data'),
			fromZip: this.shadowRoot.getElementById('from-zip'),
			toZip: this.shadowRoot.getElementById('to-zip'),
			toCountry: this.shadowRoot.getElementById('to-country'),
		};

		if (this.dataset.api) this.api = this.dataset.api;
		if (this.dataset.from) this.fromZip = this.dataset.from;

		try {
			if (!this.fromZip) throw new Error('Origin zip code is required.');
		} catch (error) {
			console.error(error);
		}

		this.#updateItemInput();
		this.#updateAddressInputs();
		this.#toggleHiddenField(this.#parts.toCountry, !this.dataset.global);

		this.#parts.form.addEventListener('submit', this.#onFormSubmit);
		this.#parts.toZip.addEventListener('change', this.clear);
		this.#parts.toCountry.addEventListener('change', this.#onCountryChange);

		this.#ifShopKeep();
	}

	disconnectedCallback() {
		this.#parts.form.removeEventListener('submit', this.#onFormSubmit);
		this.#parts.toZip.removeEventListener('change', this.clear);
		this.#parts.toCountry.removeEventListener('change', this.#onCountryChange);
    document.removeEventListener('cartChange', (e) => this.#updateItemInput());
	}

	// public methods
	clear = () => {
		this.estimate = null;
	}

	// shop integration
  #ifShopKeep = async () => {
    this.#shop = document.querySelector('shop-keep');
    await customElements.whenDefined(this.#shop.localName);

    document.addEventListener('cartChange', (e) => this.#updateItemInput());

    this.#updateItemInput();
  }

	// handlers
	#onFormSubmit = (event) => {
  	event.preventDefault();
  	this.#fetchData();
	}

	#onCountryChange = () => {
		const isUS = this.#parts.toCountry.value === 'US';
		this.#parts.toZip.toggleAttribute('required', isUS);

		if (isUS) {
			this.#parts.toZip.setAttribute(
				'pattern',
				ShippingRates.#usPostalPattern
			);
		} else {
			this.#parts.toZip.removeAttribute('pattern');
		}
	}

	// internals
	#updateItemInput = () => {
		const itemShippingData = this.items.map((item) => ({
			id: item.id,
			size: item.size,
			weight: item.weight,
			count: item.count,
		}));

		this.#parts.items.value = JSON.stringify(itemShippingData);
	}

	#toggleHiddenField = (part, hidden) => {
		part?.closest('[part~=form-field]')?.toggleAttribute('hidden', hidden);
	}

	// on change
  #onEstimateChange = () => {
		this.estimate
			? this.#result(`Estimated shipping: $${this.estimate}`, 'success')
			: this.#result();
    this.dispatchEvent(ShippingRates.shippingChange);
  }

	#onAddressChange = () => {
		this.#updateAddressInputs();
		this.clear();
		this.dispatchEvent(ShippingRates.addressChange);
  }

	#updateAddressInputs = () => {
		if (this.address) {
			this.#parts.toZip.value = this.address.postalCode;
			this.#parts.toCountry.value = this.address.country;
		}
	}

	// fetching async
	async #fetchData() {
		if (this.items.length > 0) {
			this.clear();
			this.dataset.status = "fetching";
		} else {
			this.dataset.status = "error";
			this.#result(`There are no items in your cart`, 'error');
			return;
		}

		const formData = new FormData(this.#parts.form);
		const queryString = new URLSearchParams(formData).toString();
		const url = `${this.api}?${queryString}`;

		const response = await fetch(url);
		const body = await response.json();

		if (!response.ok) {
			this.dataset.status = "error";
			console.error(body);
			this.#result(body, 'error');
		} else {
			this.#uspsData = body;
			this.#updateResults();
		}
	}

	#updateResults = () => {
		this.address = this.#uspsData?.address || {
			country: this.#parts.toCountry.value,
			postalCode: this.#parts.toZip.value,
		};

		if (!this.#uspsData.total) {
			console.error(this.#uspsData);
			this.#result('Something went wrong', 'error');
			return;
		}

		this.estimate = this.#uspsData.total;
	}

	#result = (message, state) => {
		this.#parts.output.value = message || '';
		this.dataset.status = state || 'no-data';
		this.#parts.output.toggleAttribute('hidden', !message);
	}

	// static
	static #usPostalPattern = '[\\d]{5}(-[\\d]{4})?';

	static countryCodes = {
		AF: "Afghanistan",
		AX: "Åland Islands",
		AL: "Albania",
		DZ: "Algeria",
		AS: "American Samoa",
		AD: "Andorra",
		AO: "Angola",
		AI: "Anguilla",
		AQ: "Antarctica",
		AG: "Antigua and Barbuda",
		AR: "Argentina",
		AM: "Armenia",
		AW: "Aruba",
		AU: "Australia",
		AT: "Austria",
		AZ: "Azerbaijan",
		BS: "Bahamas",
		BH: "Bahrain",
		BD: "Bangladesh",
		BB: "Barbados",
		BY: "Belarus",
		BE: "Belgium",
		BZ: "Belize",
		BJ: "Benin",
		BM: "Bermuda",
		BT: "Bhutan",
		BO: "Bolivia (Plurinational State of)",
		BA: "Bosnia and Herzegovina",
		BW: "Botswana",
		BV: "Bouvet Island",
		BR: "Brazil",
		IO: "British Indian Ocean Territory",
		BN: "Brunei Darussalam",
		BG: "Bulgaria",
		BF: "Burkina Faso",
		BI: "Burundi",
		CV: "Cabo Verde",
		KH: "Cambodia",
		CM: "Cameroon",
		CA: "Canada",
		BQ: "Caribbean Netherlands",
		KY: "Cayman Islands",
		CF: "Central African Republic",
		TD: "Chad",
		CL: "Chile",
		CN: "China",
		CX: "Christmas Island",
		CC: "Cocos (Keeling) Islands",
		CO: "Colombia",
		KM: "Comoros",
		CG: "Congo",
		CD: "Congo, Democratic Republic of the",
		CK: "Cook Islands",
		CR: "Costa Rica",
		HR: "Croatia",
		CU: "Cuba",
		CW: "Curaçao",
		CY: "Cyprus",
		CZ: "Czech Republic",
		CI: "Côte d'Ivoire",
		DK: "Denmark",
		DJ: "Djibouti",
		DM: "Dominica",
		DO: "Dominican Republic",
		EC: "Ecuador",
		EG: "Egypt",
		SV: "El Salvador",
		GQ: "Equatorial Guinea",
		ER: "Eritrea",
		EE: "Estonia",
		SZ: "Eswatini (Swaziland)",
		ET: "Ethiopia",
		FK: "Falkland Islands (Malvinas)",
		FO: "Faroe Islands",
		FJ: "Fiji",
		FI: "Finland",
		FR: "France",
		GF: "French Guiana",
		PF: "French Polynesia",
		TF: "French Southern Territories",
		GA: "Gabon",
		GM: "Gambia",
		GE: "Georgia",
		DE: "Germany",
		GH: "Ghana",
		GI: "Gibraltar",
		GR: "Greece",
		GL: "Greenland",
		GD: "Grenada",
		GP: "Guadeloupe",
		GU: "Guam",
		GT: "Guatemala",
		GG: "Guernsey",
		GN: "Guinea",
		GW: "Guinea-Bissau",
		GY: "Guyana",
		HT: "Haiti",
		HM: "Heard Island and Mcdonald Islands",
		HN: "Honduras",
		HK: "Hong Kong",
		HU: "Hungary",
		IS: "Iceland",
		IN: "India",
		ID: "Indonesia",
		IR: "Iran",
		IQ: "Iraq",
		IE: "Ireland",
		IM: "Isle of Man",
		IL: "Israel",
		IT: "Italy",
		JM: "Jamaica",
		JP: "Japan",
		JE: "Jersey",
		JO: "Jordan",
		KZ: "Kazakhstan",
		KE: "Kenya",
		KI: "Kiribati",
		KP: "Korea, North",
		KR: "Korea, South",
		XK: "Kosovo",
		KW: "Kuwait",
		KG: "Kyrgyzstan",
		LA: "Lao People's Democratic Republic",
		LV: "Latvia",
		LB: "Lebanon",
		LS: "Lesotho",
		LR: "Liberia",
		LY: "Libya",
		LI: "Liechtenstein",
		LT: "Lithuania",
		LU: "Luxembourg",
		MO: "Macao",
		MK: "Macedonia North",
		MG: "Madagascar",
		MW: "Malawi",
		MY: "Malaysia",
		MV: "Maldives",
		ML: "Mali",
		MT: "Malta",
		MH: "Marshall Islands",
		MQ: "Martinique",
		MR: "Mauritania",
		MU: "Mauritius",
		YT: "Mayotte",
		MX: "Mexico",
		FM: "Micronesia",
		MD: "Moldova",
		MC: "Monaco",
		MN: "Mongolia",
		ME: "Montenegro",
		MS: "Montserrat",
		MA: "Morocco",
		MZ: "Mozambique",
		MM: "Myanmar (Burma)",
		NA: "Namibia",
		NR: "Nauru",
		NP: "Nepal",
		NL: "Netherlands",
		AN: "Netherlands Antilles",
		NC: "New Caledonia",
		NZ: "New Zealand",
		NI: "Nicaragua",
		NE: "Niger",
		NG: "Nigeria",
		NU: "Niue",
		NF: "Norfolk Island",
		MP: "Northern Mariana Islands",
		NO: "Norway",
		OM: "Oman",
		PK: "Pakistan",
		PW: "Palau",
		PS: "Palestine",
		PA: "Panama",
		PG: "Papua New Guinea",
		PY: "Paraguay",
		PE: "Peru",
		PH: "Philippines",
		PN: "Pitcairn Islands",
		PL: "Poland",
		PT: "Portugal",
		PR: "Puerto Rico",
		QA: "Qatar",
		RE: "Reunion",
		RO: "Romania",
		RU: "Russian Federation",
		RW: "Rwanda",
		BL: "Saint Barthelemy",
		SH: "Saint Helena",
		KN: "Saint Kitts and Nevis",
		LC: "Saint Lucia",
		MF: "Saint Martin",
		PM: "Saint Pierre and Miquelon",
		VC: "Saint Vincent and the Grenadines",
		WS: "Samoa",
		SM: "San Marino",
		ST: "Sao Tome and Principe",
		SA: "Saudi Arabia",
		SN: "Senegal",
		RS: "Serbia",
		CS: "Serbia and Montenegro",
		SC: "Seychelles",
		SL: "Sierra Leone",
		SG: "Singapore",
		SX: "Sint Maarten",
		SK: "Slovakia",
		SI: "Slovenia",
		SB: "Solomon Islands",
		SO: "Somalia",
		ZA: "South Africa",
		GS: "South Georgia and the South Sandwich Islands",
		SS: "South Sudan",
		ES: "Spain",
		LK: "Sri Lanka",
		SD: "Sudan",
		SR: "Suriname",
		SJ: "Svalbard and Jan Mayen",
		SE: "Sweden",
		CH: "Switzerland",
		SY: "Syria",
		TW: "Taiwan",
		TJ: "Tajikistan",
		TZ: "Tanzania",
		TH: "Thailand",
		TL: "Timor-Leste",
		TG: "Togo",
		TK: "Tokelau",
		TO: "Tonga",
		TT: "Trinidad and Tobago",
		TN: "Tunisia",
		TR: "Turkey (Türkiye)",
		TM: "Turkmenistan",
		TC: "Turks and Caicos Islands",
		TV: "Tuvalu",
		UM: "U.S. Outlying Islands",
		UG: "Uganda",
		UA: "Ukraine",
		AE: "United Arab Emirates",
		GB: "United Kingdom",
		US: "United States",
		UY: "Uruguay",
		UZ: "Uzbekistan",
		VU: "Vanuatu",
		VA: "Vatican City Holy See",
		VE: "Venezuela",
		VN: "Vietnam",
		VG: "Virgin Islands, British",
		VI: "Virgin Islands, U.S",
		WF: "Wallis and Futuna",
		EH: "Western Sahara",
		YE: "Yemen",
		ZM: "Zambia",
		ZW: "Zimbabwe",
	};

	static #countrySelect = `
		<label for="to-country" part="label">Country</label>
		<select id="to-country" name="to-country" part="country" autocomplete="shipping country">
			${Object.keys(ShippingRates.countryCodes).map((code) => {
				const selected = code === 'US' ? ` selected` : '';

				return `
					<option value="${code}"${selected}>
						${ShippingRates.countryCodes[code]}
					</option>
				`;
			}).join('')}
		</select>
	`;
}

ShippingRates.register();
