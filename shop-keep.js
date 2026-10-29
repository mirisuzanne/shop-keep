class ShopKeep extends HTMLElement {
	static register(tagName) {
		if ("customElements" in window) {
			customElements.define(tagName || "shop-keep", ShopKeep);
		}
	}

  static #appendShadowTemplate = (node) => {
    const template = document.createElement("template");
    template.innerHTML = `
      <output part="output before"></output>
      <slot><output part="output slot"></output></slot>
      <output part="output after"></output>
    `;
    const shadowRoot = node.attachShadow({ mode: "open" });
    shadowRoot.appendChild(template.content.cloneNode(true));
  }

  static #adoptShadowStyles = (node) => {
    const shadowStyle = new CSSStyleSheet();
    shadowStyle.replaceSync(`
      :host(:not([data-show])),
      [part~=output]:empty { display: none; }
		`);
    node.shadowRoot.adoptedStyleSheets = [shadowStyle];
  }

  static cartChange = new Event('cartChange', {bubbles: true});

  constructor() {
    super();
    ShopKeep.#appendShadowTemplate(this);
    ShopKeep.#adoptShadowStyles(this);
  }

  #parts;

	get cart() {
    const cart = localStorage.getItem('cart');
    return cart
      ? JSON.parse(cart)
      : [];
  }

  set cart(data) {
    const replace = this.cart;
    const update = data
      .map((item) => this.validProduct(item))
      .filter((item) => item.count > 0);

    if (update === replace) return;

    localStorage.setItem('cart', JSON.stringify(update));
    this.dispatchEvent(ShopKeep.cartChange);

    if (!this.hasAttribute('data-show')) return;

    const outPut = this.#parts[this.dataset.show || 'slot'];
    outPut.value = this.count;
  }

  get count() {
    return this.cart.reduce((all, item) => all + Number(item.count), 0);
  }

  get total() {
    return this.cart.reduce((all, item) => (
      all + this.productTotalPrice(item)
    ), 0);
  }

	connectedCallback() {
    window.addEventListener('storage', (e) => this.refresh());
    this.#parts = {
      before: this.shadowRoot.querySelector('[part~=before]'),
      slot: this.shadowRoot.querySelector('[part~=slot]'),
      after: this.shadowRoot.querySelector('[part~=after]'),
    };

    this.refresh();
	}

	disconnectedCallback() {
    window.removeEventListener('storage', (e) => this.refresh());
	}

  validProduct = (item) => {
    if (typeof item !== 'object') return;
    if (!item.id) return;
    item.count = item.count ? Number(item.count) : 1;
    item.price = item.price ? Number(item.price) : 0;
    return item;
  }

	findProduct = (id) => this.cart.find((item) => item.id === id);
	findProductIndex = (id) => this.cart.findIndex((item) => item.id === id);

  productUnitPrice = (item) => item
    ? Number(item.userPrice || item.price || 0)
    : undefined;

  productTotalPrice = (item) => item
    ? Number(item.count) * this.productUnitPrice(item)
    : undefined;

  setProduct = (item) => {
    if (!this.validProduct(item)) throw new Error('Invalid item', item);

    let update = this.cart;
    const cartIndex = this.findProductIndex(item.id);

    if (~cartIndex) update[cartIndex] = item;
    else update.push(item);

    this.cart = update;
  }

  removeProduct = (id) => {
    const cartIndex = this.findProductIndex(id);
    if (!~cartIndex) throw new Error('No item in cart for:', id);

    const update = this.cart.toSpliced(cartIndex, 1);
    this.cart = update;
  }

  clearCart = () => {
    this.cart = [];
  }

  refresh = () => {
    this.cart = this.cart;
  }
}

ShopKeep.register();
