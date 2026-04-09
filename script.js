const STORAGE_KEY = "candlestick-cart-v1";
const ORDER_STORAGE_KEY = "candlestick-orders-v1";

const catalog = Array.from(document.querySelectorAll("[data-id]")).reduce((items, element) => {
  const { id, title, price, type, freeDelivery } = element.dataset;
  items[id] = {
    id,
    title,
    price: Number(price),
    type,
    freeDelivery: freeDelivery === "true",
  };
  return items;
}, {});

const elements = {
  cartToggle: document.querySelector(".cart-toggle"),
  drawer: document.querySelector(".order-drawer"),
  drawerBackdrop: document.querySelector(".order-drawer__backdrop"),
  drawerClose: document.querySelector(".order-drawer__close"),
  drawerButtons: document.querySelectorAll(".button--drawer"),
  cartCount: document.getElementById("cart-count"),
  cartList: document.getElementById("cart-list"),
  cartEmpty: document.getElementById("cart-empty"),
  subtotal: document.getElementById("subtotal"),
  deliveryFee: document.getElementById("delivery-fee"),
  grandTotal: document.getElementById("grand-total"),
  shippingOptions: document.querySelectorAll('input[name="shipping"]'),
  addButtons: document.querySelectorAll(".add-to-cart"),
  toast: document.getElementById("toast"),
  orderForm: document.getElementById("order-form"),
  faqButtons: document.querySelectorAll(".faq-question"),
  revealTargets: document.querySelectorAll(".reveal"),
  tiltTargets: document.querySelectorAll(".tilt-target"),
  submitButton: document.querySelector(".button--submit"),
};

let cart = readStorage(STORAGE_KEY, {});
let toastTimeout = null;

function readStorage(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    return fallback;
  }
}

function writeStorage(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    return;
  }
}

function formatBDT(amount) {
  return `BDT ${amount.toLocaleString("en-US")}`;
}

function getEntries() {
  return Object.entries(cart)
    .map(([id, quantity]) => {
      const product = catalog[id];
      if (!product || quantity < 1) {
        return null;
      }

      return {
        ...product,
        quantity,
        total: product.price * quantity,
      };
    })
    .filter(Boolean);
}

function getShippingMode() {
  const selected = Array.from(elements.shippingOptions).find((option) => option.checked);
  return selected ? selected.value : "standard";
}

function getShippingCost(entries, subtotal) {
  if (!entries.length) {
    return 0;
  }

  if (getShippingMode() === "express") {
    return 180;
  }

  const freeDeliveryUnlocked = subtotal >= 4500 || entries.some((item) => item.freeDelivery);
  return freeDeliveryUnlocked ? 0 : 90;
}

function renderCart() {
  const entries = getEntries();
  const itemCount = entries.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = entries.reduce((sum, item) => sum + item.total, 0);
  const shipping = getShippingCost(entries, subtotal);
  const total = subtotal + shipping;

  elements.cartCount.textContent = itemCount;
  elements.subtotal.textContent = formatBDT(subtotal);
  elements.deliveryFee.textContent =
    shipping === 0 && entries.length ? "FREE" : formatBDT(shipping);
  elements.grandTotal.textContent = formatBDT(total);

  elements.cartEmpty.hidden = entries.length > 0;
  elements.submitButton.disabled = entries.length === 0;
  elements.submitButton.setAttribute("aria-disabled", String(entries.length === 0));

  if (!entries.length) {
    elements.cartList.innerHTML = "";
    return;
  }

  elements.cartList.innerHTML = entries
    .map(
      (item) => `
        <li class="cart-item">
          <div class="cart-row__meta">
            <div>
              <strong>${item.title}</strong>
              <small>${item.type === "bundle" ? "Bundle offer" : "Single volume"}</small>
            </div>
            <span class="cart-item__price">${formatBDT(item.total)}</span>
          </div>
          <div class="cart-controls">
            <button class="qty-button" type="button" data-action="decrease" data-id="${item.id}" aria-label="Decrease quantity for ${item.title}">-</button>
            <span>${item.quantity}</span>
            <button class="qty-button" type="button" data-action="increase" data-id="${item.id}" aria-label="Increase quantity for ${item.title}">+</button>
            <button class="remove-button" type="button" data-action="remove" data-id="${item.id}">Remove</button>
          </div>
        </li>
      `
    )
    .join("");
}

function saveCart() {
  writeStorage(STORAGE_KEY, cart);
}

function addToCart(id) {
  if (!catalog[id]) {
    return;
  }

  cart[id] = (cart[id] || 0) + 1;
  saveCart();
  renderCart();
  showToast(`${catalog[id].title} added to your stack`);
}

function updateQuantity(id, nextQuantity) {
  if (!catalog[id]) {
    return;
  }

  if (nextQuantity <= 0) {
    delete cart[id];
  } else {
    cart[id] = nextQuantity;
  }

  saveCart();
  renderCart();
}

function openDrawer() {
  elements.drawer.classList.add("is-open");
  elements.drawer.setAttribute("aria-hidden", "false");
  elements.cartToggle.setAttribute("aria-expanded", "true");
  document.body.classList.add("drawer-open");
}

function closeDrawer() {
  elements.drawer.classList.remove("is-open");
  elements.drawer.setAttribute("aria-hidden", "true");
  elements.cartToggle.setAttribute("aria-expanded", "false");
  document.body.classList.remove("drawer-open");
}

function showToast(message) {
  window.clearTimeout(toastTimeout);
  elements.toast.textContent = message;
  elements.toast.classList.add("is-visible");

  toastTimeout = window.setTimeout(() => {
    elements.toast.classList.remove("is-visible");
  }, 2400);
}

function attachCartEvents() {
  elements.addButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const card = button.closest("[data-id]");
      if (!card) {
        return;
      }

      addToCart(card.dataset.id);
    });
  });

  elements.cartList.addEventListener("click", (event) => {
    const control = event.target.closest("[data-action]");
    if (!control) {
      return;
    }

    const id = control.dataset.id;
    const action = control.dataset.action;
    const currentQuantity = cart[id] || 0;

    if (action === "increase") {
      updateQuantity(id, currentQuantity + 1);
    }

    if (action === "decrease") {
      updateQuantity(id, currentQuantity - 1);
    }

    if (action === "remove") {
      updateQuantity(id, 0);
      showToast("Item removed from your stack");
    }
  });
}

function attachDrawerEvents() {
  elements.cartToggle.addEventListener("click", openDrawer);
  elements.drawerButtons.forEach((button) => button.addEventListener("click", openDrawer));
  elements.drawerClose.addEventListener("click", closeDrawer);
  elements.drawerBackdrop.addEventListener("click", closeDrawer);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && elements.drawer.classList.contains("is-open")) {
      closeDrawer();
    }
  });
}

function attachShippingEvents() {
  elements.shippingOptions.forEach((option) => {
    option.addEventListener("change", renderCart);
  });
}

function attachFaqEvents() {
  elements.faqButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const item = button.closest(".faq-item");
      const nextState = !item.classList.contains("is-open");

      item.classList.toggle("is-open", nextState);
      button.setAttribute("aria-expanded", String(nextState));
    });
  });
}

function attachRevealAnimations() {
  if (!("IntersectionObserver" in window)) {
    elements.revealTargets.forEach((target) => target.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries, currentObserver) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }

        entry.target.classList.add("is-visible");
        currentObserver.unobserve(entry.target);
      });
    },
    {
      rootMargin: "0px 0px -10% 0px",
      threshold: 0.16,
    }
  );

  elements.revealTargets.forEach((target) => {
    const { top } = target.getBoundingClientRect();
    if (top < window.innerHeight * 0.92) {
      target.classList.add("is-visible");
      return;
    }

    observer.observe(target);
  });
}

function attachTiltEffect() {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const coarsePointer = window.matchMedia("(pointer: coarse)");

  if (reducedMotion.matches || coarsePointer.matches) {
    return;
  }

  elements.tiltTargets.forEach((target) => {
    target.addEventListener("pointermove", (event) => {
      const bounds = target.getBoundingClientRect();
      const x = (event.clientX - bounds.left) / bounds.width - 0.5;
      const y = (event.clientY - bounds.top) / bounds.height - 0.5;

      target.style.setProperty("--tilt-y", `${x * 8}deg`);
      target.style.setProperty("--tilt-x", `${y * -8}deg`);
    });

    target.addEventListener("pointerleave", () => {
      target.style.setProperty("--tilt-y", "0deg");
      target.style.setProperty("--tilt-x", "0deg");
    });
  });
}

function resetForm() {
  elements.orderForm.reset();
  elements.shippingOptions[0].checked = true;
}

function handleOrderSubmit(event) {
  event.preventDefault();

  const entries = getEntries();
  if (!entries.length) {
    showToast("Add a book before placing an order request");
    return;
  }

  if (!elements.orderForm.reportValidity()) {
    return;
  }

  const formData = new FormData(elements.orderForm);
  const subtotal = entries.reduce((sum, item) => sum + item.total, 0);
  const shipping = getShippingCost(entries, subtotal);
  const total = subtotal + shipping;
  const orderId = `CS-${Date.now().toString().slice(-6)}`;

  const order = {
    orderId,
    placedAt: new Date().toISOString(),
    customer: {
      name: formData.get("name"),
      phone: formData.get("phone"),
      address: formData.get("address"),
      note: formData.get("note"),
    },
    shippingMode: getShippingMode(),
    items: entries,
    subtotal,
    shipping,
    total,
  };

  const existingOrders = readStorage(ORDER_STORAGE_KEY, []);
  writeStorage(ORDER_STORAGE_KEY, [order, ...existingOrders].slice(0, 15));

  cart = {};
  saveCart();
  renderCart();
  resetForm();
  closeDrawer();
  showToast(`Order request ${orderId} stored locally`);
}

elements.orderForm.addEventListener("submit", handleOrderSubmit);

if (window.CandlestickTheme && typeof window.CandlestickTheme.syncUi === "function") {
  window.CandlestickTheme.syncUi();
}
attachCartEvents();
attachDrawerEvents();
attachShippingEvents();
attachFaqEvents();
attachRevealAnimations();
attachTiltEffect();
renderCart();
