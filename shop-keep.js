class ShopKeep extends HTMLElement {
	static register(tagName) {
		if ("customElements" in window) {
			customElements.define(tagName || "shop-keep", ShopKeep);
		}
	}

  static #appendShadowTemplate = (node) => {
    const template = document.createElement("template");
    template.innerHTML = `
      <output part="output"></output>
    `;
    const shadowRoot = node.attachShadow({ mode: "open" });
    shadowRoot.appendChild(template.content.cloneNode(true));
  }

  static #adoptShadowStyles = (node) => {
    const shadowStyle = new CSSStyleSheet();
    shadowStyle.replaceSync(`
      :host(:not([data-show])) { display: none; }

      :host([data-show=products]:not([data-count])),
      :host([data-show=products][data-count='0']) {
        display: none;
      }
		`);
    node.shadowRoot.adoptedStyleSheets = [shadowStyle];
  }

  static cartChange = new Event('cartChange', {bubbles: true});

  constructor() {
    super();
    ShopKeep.#appendShadowTemplate(this);
    ShopKeep.#adoptShadowStyles(this);
  }

  #output;

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

    this.#updateOutput();
    if (update === replace) return;

    localStorage.setItem('cart', JSON.stringify(update));
    this.dispatchEvent(ShopKeep.cartChange);
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
    this.#output = this.shadowRoot.querySelector('output');

    window.addEventListener('storage', this.#updateOutput);
    document.addEventListener('cartChange', this.#updateOutput);
    this.addEventListener('command', this.#commands);

    this.refresh();
	}

	disconnectedCallback() {
    window.removeEventListener('storage', this.#updateOutput);
    document.removeEventListener('cartChange', this.#updateOutput);
    this.removeEventListener('command', this.#commands);
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
    if (!~cartIndex) return;

    const update = this.cart.toSpliced(cartIndex, 1);
    this.cart = update;
  }

  productFrom = (src) => {
    const productSrc = src.closest('[data-product]');
    if (!productSrc) return;

    return {
      title: productSrc.dataset.title,
      id: productSrc.dataset.product,
      weight: productSrc.dataset.weight,
      size: productSrc.dataset.size,
      price: productSrc.dataset.price,
      stock: Number(productSrc.dataset.stock || 1),
      count: Number(productSrc.dataset.count || 1),
    };
  }

  empty = () => {
    this.cart = [];
  }

  refresh = () => {
    this.cart = this.cart;
  }

  #updateOutput = () => {
    this.dataset.count = this.count;
    this.#output.value = this.count;
  }

  #commands = (event) => {
    const srcProduct = this.productFrom(event.source);

    switch (event.command) {
      case '--refresh':
        this.refresh();
        break;
      case '--empty':
        this.empty();
        break;
      case '--add-product':
        if (!srcProduct) console.warn('Product is not defined');
        const inCart = this.findProduct(srcProduct.id);
        if (inCart) inCart.count += srcProduct.count;
        this.setProduct(inCart || srcProduct);
        break;
      case '--remove-product':
        this.removeProduct(srcProduct.id);
        break;
      default:
        break;
    }
  }
}

ShopKeep.register();
