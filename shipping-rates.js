class shippingRates extends HTMLElement {
	static register(tagName) {
		if ("customElements" in window) {
			customElements.define(tagName || "shipping-rates", shippingRates);
		}
	}

	static observedAttributes = [
		'data-to',
	];

  static #appendShadowTemplate = (node) => {
    const template = document.createElement("template");
    template.innerHTML = `
			<form action="/api/shipping-rates/" part="form">
      	<label for="zip" part="label">Zip code (5-digit)</label>
				<input id="zip" type="text" pattern="[0-9]{5}" part="input"/>
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
			case 'data-to':
				this.toZip = this.dataset.to;
				break;
		}
	};

	#zipField;

	connectedCallback() {
		this.#findZipField();
	}

	disconnectedCallback() {
		this.#unWatchZipField();
	}

	// get and set
	get zipField () { return this.#zipField; }

	set toZip (value) {
		if (!this.#zipField) return;
		if (this.dataset.to !== value) {
			this.dataset.to = value || '';
		}
		if (this.#zipField.value !== value) {
			this.#zipField.value = value || '';
		}

		return this.toZip;
	}

	get toZip () {
		return this.#zipField?.value || this.dataset.toZip;
	}

	// private methods
	#findZipField = () => {
		if (this.#zipField) this.#unWatchZipField();

		this.#zipField = this.shadowRoot.getElementById('zip');

		this.toZip = this.toZip;
		this.#watchZipField();
	}

	#zipFieldInput = () => {
		this.toZip = this.#zipField.value;
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

	#watchZipField = () => {
		this.#zipField.addEventListener('change', this.#zipFieldInput);
	}

	#unWatchZipField = () => {
		this.#zipField.removeEventListener('change', this.#zipFieldInput);
	}
}

shippingRates.register();
