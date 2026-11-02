class ShopControl extends HTMLElement {
	static register(tagName) {
		if ("customElements" in window) {
			customElements.define(tagName || "shop-control", ShopControl);
		}
	}

  static knownProps = [
    'count',
    'offer',
    'note'
  ];

  #shop;
	#input;

  get inCart() {
    return this.#shop.srcProductInCart(this);
  }

  get name() {
    return this.dataset.prop || this.#input?.name
  }

  get value() {
    return this.#input.value;
  }

  set value(to) {
    if (to === undefined) return;
    this.#input.value = to;
  }

  get cartValue() {
    if (!this.inCart) return;

    return this.inCart[this.name];
  }

  set cartValue(to) {
    if (!this.inCart) return;

    const newItem = this.inCart;
    newItem[this.name] = to;

    this.#shop.setProduct(newItem);
  }

  get isValid() {
    return this.#input.checkValidity();
  }

  get readOnly() {
    return this.#input.hasAttribute('readonly');
  }

  set readOnly(to) {
    this.#input.toggleAttribute('readonly', to);
    this.toggleAttribute('data-readonly', to);
  }

	connectedCallback() {
    this.#shop = document.querySelector('shop-keep');
    this.#input = this.querySelector('input');

    if (!this.#shop) console.error('This shopping cart needs a shop!');
    if (!this.#input) console.error('Need an input for controlling the cart');
    if (!this.name) console.error('Name the value to control');
    if (!ShopControl.knownProps.includes(this.name)) {
      console.error('Unknown shop control property');
    }

    this.#waitForShop();
	}

	disconnectedCallback() {
		this.#input.removeEventListener("change", this.#updateCart);
    document.removeEventListener('cartChange', this.#updateFromCart);
	}

	// private methods
  #waitForShop = async () => {
    await customElements.whenDefined(this.#shop.localName);

    this.#input.addEventListener("change", this.#updateCart);
    document.addEventListener('cartChange', this.#updateFromCart);

    this.#updateFromCart();
  }

	#updateCart = () => {
    this.cartValue = this.value;
  }

	#updateFromCart = () => {
    this.#fieldHasProduct();
    this.#updateReadOnly();
  }

  #updateReadOnly = () => {
    this.readOnly = Boolean(!this.inCart);
  }

  #fieldHasProduct = () => {
    if (!this.inCart) {
      this.value = '';
      return;
    }

    if (this.cartValue) this.value = this.cartValue;

    switch (this.name) {
      case 'count':
        this.#input.setAttribute('max', this.inCart.stock);
        break;
      case 'offer':
        if (!this.cartValue) this.value = this.inCart.price;
        this.#input.setAttribute(
          'min',
          this.#input.getAttribute('min')
          || this.inCart.offerMin
          || Number(this.inCart.price) / 2
        );
        break;
      default:
        break;
    }
  }
}

ShopControl.register();
