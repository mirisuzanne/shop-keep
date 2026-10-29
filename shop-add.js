class ShopAdd extends HTMLElement {
	static register(tagName) {
		if ("customElements" in window) {
			customElements.define(tagName || "shop-add", ShopAdd);
		}
	}

  static #appendShadowTemplate = (node) => {
    const template = document.createElement("template");
    template.innerHTML = `
      <slot>
        <button part="button" type="button">
          Add to cart
        </button>
      </slot>
    `;
    const shadowRoot = node.attachShadow({ mode: "open" });
    shadowRoot.appendChild(template.content.cloneNode(true));
  }

  static #adoptShadowStyles = (node) => {
    const shadowStyle = new CSSStyleSheet();
    shadowStyle.replaceSync(`
			:host { display: inline flow-root; }
		`);
    node.shadowRoot.adoptedStyleSheets = [shadowStyle];
  }

  constructor() {
    super();
    ShopAdd.#appendShadowTemplate(this);
    ShopAdd.#adoptShadowStyles(this);
  }

  #productEl;
  #shop;
	#button;

  get id() {
    return this.dataset.product;
  }

  get product() {
    return {
      title: this.#productEl.dataset.title,
      id: this.#productEl.dataset.product,
      weight: this.#productEl.dataset.weight,
      size: this.#productEl.dataset.size,
      price: this.#productEl.dataset.price,
      stock: this.#productEl.dataset.stock || 1,
      count: this.#productEl.dataset.count || 1,
    };
  }

  get inCart() {
    return this.#shop.findProduct(this.product.id)?.count;
  }

  get isInCart() {
    return this.inCart > 0;
  }

	connectedCallback() {
    this.#shop = document.querySelector('shop-keep');
    this.#productEl = this.closest('[data-product]');
    this.#button = this.querySelector('button') || this.shadowRoot.querySelector('button');

    if (!this.#productEl) throw new Error('A product ID is required');
    if (!this.#shop) throw new Error('You need a shop to keep things in!');

    this.#waitForShop();
	}

	disconnectedCallback() {
		this.#button.removeEventListener("click", (e) => this.addToShop());
    document.removeEventListener('cartChange', (e) => this.onCartChange());
	}

	addToShop = () => {
    const update = this.product;

    if (this.isInCart) update.count += this.inCart;

    this.#shop.setProduct(update);
	}

  // handler
  onCartChange = () => {
    this.dataset.cart = this.inCart;
  }

	// private methods
  #waitForShop = async () => {
    await customElements.whenDefined(this.#shop.localName);

    this.#button.setAttribute('type', 'button');

    this.#button.addEventListener("click", (e) => this.addToShop());
    document.addEventListener('cartChange', (e) => this.onCartChange());

    this.onCartChange();
  }
}

ShopAdd.register();
