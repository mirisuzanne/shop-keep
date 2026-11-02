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
    const previous = this.cart;

    this.#updateOutput();
    if (data === previous) return;

    localStorage.setItem('cart', JSON.stringify(data));
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

  // callbacks
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

  // products
  validProduct = (item) => {
    if (typeof item !== 'object') return;
    if (!item.id) return;
    if (!item.price) console.warn('No price provided');

    if (item.offer) item.offer = Number(item.offer);

    item.price = item.price ? Number(item.price) : 0;
    item.count = item.count ? Number(item.count) : 0;

    return item;
  }

  // product prices
  productUnitPrice = (product) => product
    ? Number(product.offer || product.price || 0)
    : undefined;

  productTotalPrice = (product) => product
    ? Number(product.count) * this.productUnitPrice(product)
    : undefined;

  // find by ID
	getProductByID = (id) => this.cart.find((item) => item.id === id);
	productIndexByID = (id) => this.cart.findIndex((item) => item.id === id);

  // find from source
  srcProductElement = (el) => el.closest('[data-product]');

  srcProductID = (el) => {
    const src = this.srcProductElement(el);
    return src?.dataset.product;
  }

  srcProductInCart = (src) => {
    const id = this.srcProductID(src);
    return this.getProductByID(id);
  }

  srcProduct = (src) => {
    const productElement = this.srcProductElement(src);
    if (!productElement) return;

    return {
      title: productElement.dataset.title,
      id: productElement.dataset.product,
      weight: productElement.dataset.weight,
      size: productElement.dataset.size,
      price: productElement.dataset.price,
      stock: Number(productElement.dataset.stock || 0),
      count: Number(productElement.dataset.count || 1),
    };
  }

  srcProductDetails = (src) => {
    const srcProduct = this.srcProduct(src);

    if (!srcProduct) {
      console.error('Product is not defined');
      return;
    }

    const inCart = this.getProductByID(srcProduct.id);

    return {
      src: srcProduct,
      cart: inCart,
    }
  }

  // add and remove products
  setProduct = (product) => {
    if (!this.validProduct(product)) throw new Error('Invalid product', product);

    product.count = Math.max(0, product.count);
    if (product.count && product.stock) product.count = Math.min(product.count, product.stock);

    let update = this.cart;
    const cartIndex = this.productIndexByID(product.id);

    if (~cartIndex) update[cartIndex] = product;
    else update.push(product);

    this.cart = update;
  }

  moveProductCount = (product, count) => {
    product.count += count;
    this.setProduct(product);
  }

  addProduct = (id, count) => {
    const inCart = this.getProductByID(id);
    if (!inCart) return;
    this.moveProductCount(inCart, count || 1);
  }

  reduceProduct = (id, count) => {
    const inCart = this.getProductByID(id);
    if (!inCart) return;
    this.moveProductCount(inCart, (count || 1) * -1);
  }

  removeProduct = (id) => {
    const cartIndex = this.productIndexByID(id);
    if (!~cartIndex) return;

    const update = this.cart.toSpliced(cartIndex, 1);
    this.cart = update;
  }

  createOrAddProduct = (product) => {
    const inCart = this.getProductByID(product.id);

    if (inCart) {
      this.moveProductCount(inCart, product.count || 1);
    } else {
      this.setProduct(product);
    }
  }

  // cart actions
  empty = () => {
    this.cart = [];
  }

  refresh = () => {
    this.cart = this.cart
      .map((item) => this.validProduct(item))
      .filter((item) => item.count > 0);
  }

  #updateOutput = () => {
    this.dataset.count = this.count;
    this.#output.value = this.count;
  }

  // commands
  #commands = (event) => {
    switch (event.command) {
      case '--refresh':
        this.refresh();
        break;

      case '--empty':
        this.empty();
        break;

      case '--add-product': {
        const product = this.srcProduct(event.source);
        this.createOrAddProduct(product);
        break;
      }

      case '--reduce-product': {
        const product = this.srcProduct(event.source);
        this.reduceProduct(product.id, product.count);
        break;
      }

      case '--remove-product': {
        const id = this.srcProductID(event.source);
        this.removeProduct(id);
        break;
      }
    }
  }
}

ShopKeep.register();
