class shippingRates extends HTMLElement {
	static register(tagName) {
		if ("customElements" in window) {
			customElements.define(tagName || "shipping-rates", shippingRates);
		}
	}

	static observedAttributes = [
		'data-from',
		'data-length',
		'data-width',
		'data-height',
		'data-weight',
		'data-api',
	];

  static #appendShadowTemplate = (node) => {
    const template = document.createElement("template");
    template.innerHTML = `
			<form action="https://usps-rates.netlify.app/api" part="form">
      	<label for="to" part="label">Postal code</label>
				<input id="to" name="to" type="text" inputmode="numeric" pattern="^(?(^00000(|-0000))|(\d{5}(|-\d{4})))$" part="to">

				<input type="hidden" name="from">
				<input type="hidden" name="length">
				<input type="hidden" name="width">
				<input type="hidden" name="height">
				<input type="hidden" name="weight">

				<button part="button">check rates</button>
			</form>
    `;
    const shadowRoot = node.attachShadow({ mode: "open" });
    shadowRoot.appendChild(template.content.cloneNode(true));
  }

  static #adoptShadowStyles = (node) => {
    const shadowStyle = new CSSStyleSheet();
    shadowStyle.replaceSync(`
      /* styles tbd */
    `);
    node.shadowRoot.adoptedStyleSheets = [shadowStyle];
  }

  constructor() {
    super();
    shippingRates.#appendShadowTemplate(this);
    shippingRates.#adoptShadowStyles(this);
  }

	attributeChangedCallback(name, oldValue, newValue) {
		if (newValue === oldValue) return;

		switch (name) {
			case 'data-api':
				this.toZip = this.dataset.to;
				break;
		}
	};

	#form;
	#toZipInput;
	#fromZipInput;
	#lengthInput;
	#heightInput;
	#widthInput;
	#weightInput;

	connectedCallback() {
		this.#toZipInput = this.shadowRoot.getElementById('to');
		if (this.dataset.to) this.#toZipInput.value = this.dataset.to;
		this.#watchToZipInput();

		this.#form = this.shadowRoot.querySelector('[part=form]');
		if (this.dataset.api) this.#form.setAttribute('action', this.dataset.api);

		this.#fromZipInput = this.shadowRoot.querySelector('[name=from]');
		if (this.dataset.from) this.#fromZipInput.value = this.dataset.from;

		this.#lengthInput = this.shadowRoot.querySelector('[name=length]');
		if (this.dataset.length) this.#lengthInput.value = this.dataset.length;

		this.#widthInput = this.shadowRoot.querySelector('[name=width]');
		if (this.dataset.width) this.#widthInput.value = this.dataset.width;

		this.#heightInput = this.shadowRoot.querySelector('[name=height]');
		if (this.dataset.height) this.#heightInput.value = this.dataset.height;

		this.#weightInput = this.shadowRoot.querySelector('[name=weight]');
		if (this.dataset.weight) this.#weightInput.value = this.dataset.weight;
	}

	disconnectedCallback() {
		this.#unWatchToZipInput();
	}

	// get and set
	get zipInput () { return this.#toZipInput; }

	set toZip (value) {
		if (!this.#toZipInput) return;
		if (this.dataset.to !== value) {
			this.dataset.to = value || '';
		}
		if (this.#toZipInput.value !== value) {
			this.#toZipInput.value = value || '';
		}

		return this.toZip;
	}

	get toZip () {
		return this.#toZipInput?.value;
	}

	// private methods
	#toZipInputInput = () => {
		this.toZip = this.#toZipInput.value;
	}

	async #fetchData() {
		this.dataset.status="fetching";
		const response = await fetch('/api/shipping-rates/');

		if (!response.ok) {
			this.dataset.status="no-data";
			throw new Error(`Response statuses: ${response.status}`);
		}

		this.featureData = await response.json();
	}

	#watchToZipInput = () => {
		this.#toZipInput.addEventListener('change', this.#toZipInputInput);
	}

	#unWatchToZipInput = () => {
		this.#toZipInput.removeEventListener('change', this.#toZipInputInput);
	}
}

shippingRates.register();
