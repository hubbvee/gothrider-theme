/**
 * GothRider Cart Enhancements
 * Injects free shipping progress bar and upsell recommendations
 * into Horizon's existing cart drawer without modifying core files.
 */
(function () {
  'use strict';

  /* ---- Configuration (set via data attributes on script tag) ---- */
  var script = document.currentScript;
  var THRESHOLD_CENTS = parseInt(script?.dataset.threshold || '7500', 10);
  var CURRENCY = script?.dataset.currency || '$';
  var UPSELL_COLLECTION = script?.dataset.upsellCollection || '';
  var UPSELL_LIMIT = parseInt(script?.dataset.upsellLimit || '6', 10);
  var QUALIFIED_TEXT = script?.dataset.qualifiedText || 'You qualify for free shipping!';
  var REMAINING_TEXT = script?.dataset.remainingText || 'away from free shipping';
  var UPSELL_TITLE = script?.dataset.upsellTitle || 'You might also like';

  /* ---- Helpers ---- */
  function formatMoney(cents) {
    return CURRENCY + (cents / 100).toFixed(2);
  }

  function getCartTotal() {
    var el = document.querySelector('[data-cart-subtotal]');
    if (!el) return 0;
    var raw = el.getAttribute('value') || el.textContent || '';
    var num = parseFloat(raw.replace(/[^0-9.]/g, ''));
    return isNaN(num) ? 0 : Math.round(num * 100);
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  /* ---- Free Shipping Bar ---- */
  function buildShippingBar() {
    var bar = el('div', 'gr-shipping-bar');
    bar.setAttribute('role', 'status');
    bar.setAttribute('aria-live', 'polite');
    /* child placeholders */
    bar.appendChild(el('div', 'gr-shipping-bar__text'));
    var track = el('div', 'gr-shipping-bar__track');
    track.appendChild(el('div', 'gr-shipping-bar__fill'));
    bar.appendChild(track);
    bar.appendChild(el('div', 'gr-shipping-bar__icon'));
    updateShippingBar(bar);
    return bar;
  }

  function updateShippingBar(bar) {
    if (!bar) return;
    var total = getCartTotal();
    var pct = Math.min((total / THRESHOLD_CENTS) * 100, 100);
    var remaining = THRESHOLD_CENTS - total;
    var textEl = bar.querySelector('.gr-shipping-bar__text');
    var fillEl = bar.querySelector('.gr-shipping-bar__fill');
    var iconEl = bar.querySelector('.gr-shipping-bar__icon');

    if (!textEl || !fillEl) return;

    fillEl.style.width = pct + '%';

    /* Clear existing children safely */
    while (textEl.firstChild) textEl.removeChild(textEl.firstChild);
    while (iconEl && iconEl.firstChild) iconEl.removeChild(iconEl.firstChild);

    if (total >= THRESHOLD_CENTS) {
      textEl.className = 'gr-shipping-bar__text gr-shipping-bar__text--complete';
      var strong = el('strong', '', QUALIFIED_TEXT);
      textEl.appendChild(strong);
      if (iconEl) iconEl.style.display = 'none';
    } else {
      textEl.className = 'gr-shipping-bar__text';
      var amountStrong = el('strong', '', formatMoney(remaining));
      textEl.appendChild(amountStrong);
      textEl.appendChild(document.createTextNode(' ' + REMAINING_TEXT));
      if (iconEl) iconEl.style.display = 'none';
    }
  }

  /* ---- Cart Upsell ---- */
  function buildUpsellContainer() {
    var wrap = el('div', 'gr-cart-upsell');
    wrap.appendChild(el('div', 'gr-cart-upsell__title', UPSELL_TITLE));
    wrap.appendChild(el('div', 'gr-cart-upsell__items'));
    return wrap;
  }

  function loadUpsellProducts(container) {
    if (!UPSELL_COLLECTION) return;

    var itemsWrap = container.querySelector('.gr-cart-upsell__items');
    if (!itemsWrap) return;

    fetch('/collections/' + encodeURIComponent(UPSELL_COLLECTION) + '/products.json?limit=' + UPSELL_LIMIT)
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (!data.products || data.products.length === 0) {
          container.style.display = 'none';
          return;
        }

        /* Collect titles already in cart */
        var cartItems = document.querySelectorAll('.cart-items__title');
        var cartTitles = [];
        cartItems.forEach(function (titleEl) {
          cartTitles.push(titleEl.textContent.trim().toLowerCase());
        });

        var hasItems = false;

        data.products.forEach(function (product) {
          if (cartTitles.indexOf(product.title.toLowerCase()) !== -1) return;

          var imgSrc = product.images && product.images.length > 0
            ? product.images[0].src + '&width=240'
            : '';
          var price = product.variants && product.variants.length > 0
            ? formatMoney(Math.round(parseFloat(product.variants[0].price) * 100))
            : '';
          var url = '/products/' + encodeURIComponent(product.handle);

          var card = el('a', 'gr-cart-upsell__card');
          card.href = url;

          if (imgSrc) {
            var img = document.createElement('img');
            img.className = 'gr-cart-upsell__img';
            img.src = imgSrc;
            img.alt = product.title;
            img.loading = 'lazy';
            img.width = 120;
            img.height = 120;
            card.appendChild(img);
          }

          card.appendChild(el('div', 'gr-cart-upsell__name', product.title));
          card.appendChild(el('div', 'gr-cart-upsell__price', price));

          itemsWrap.appendChild(card);
          hasItems = true;
        });

        if (!hasItems) {
          container.style.display = 'none';
        }
      })
      .catch(function () {
        container.style.display = 'none';
      });
  }

  /* ---- Injection ---- */
  function injectIntoDrawer() {
    var drawer = document.querySelector('.cart-drawer__dialog');
    if (!drawer) return;

    /* Shipping bar: inject above cart items (below header) */
    var content = drawer.querySelector('.cart-drawer__content');
    if (content && !content.querySelector('.gr-shipping-bar')) {
      content.insertBefore(buildShippingBar(), content.firstChild);
    }

    /* Upsell: inject at end of items area */
    var items = drawer.querySelector('.cart-drawer__items');
    if (items && !items.querySelector('.gr-cart-upsell') && UPSELL_COLLECTION) {
      var upsell = buildUpsellContainer();
      items.appendChild(upsell);
      loadUpsellProducts(upsell);
    }
  }

  /* ---- Observe cart changes ---- */
  function observeCartDrawer() {
    var drawer = document.querySelector('.cart-drawer__dialog');
    if (!drawer) return;

    var observer = new MutationObserver(function () {
      injectIntoDrawer();
      var bar = drawer.querySelector('.gr-shipping-bar');
      if (bar) {
        setTimeout(function () { updateShippingBar(bar); }, 100);
      }
    });

    observer.observe(drawer, { childList: true, subtree: true });
  }

  /* ---- Cart page injection ---- */
  function injectIntoCartPage() {
    var cartSummary = document.querySelector('.cart-page__summary');
    if (!cartSummary) return;

    if (!cartSummary.querySelector('.gr-shipping-bar')) {
      cartSummary.insertBefore(buildShippingBar(), cartSummary.firstChild);
    }
  }

  /* ---- Init ---- */
  function init() {
    injectIntoDrawer();
    injectIntoCartPage();
    observeCartDrawer();

    /* Re-run when drawer opens */
    document.addEventListener('dialog:open', function () {
      setTimeout(injectIntoDrawer, 50);
    });

    /* Fallback: watch for dialog[open] attribute */
    var drawerDialog = document.querySelector('.cart-drawer__dialog');
    if (drawerDialog) {
      var attrObserver = new MutationObserver(function (mutations) {
        mutations.forEach(function (m) {
          if (m.attributeName === 'open' && drawerDialog.hasAttribute('open')) {
            setTimeout(injectIntoDrawer, 50);
          }
        });
      });
      attrObserver.observe(drawerDialog, { attributes: true });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
