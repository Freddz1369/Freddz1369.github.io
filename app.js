(() => {
  'use strict';

  const ALLOWANCE = 5500;
  const SIZES = ['S', 'M', 'L', 'XL'];
  const STORAGE_KEY = 'workwear-selecta:selected:v3';
  const products = Array.isArray(window.WORKWEAR_PRODUCTS) ? window.WORKWEAR_PRODUCTS : [];
  const productById = new Map(products.map((product) => [product.id, product]));

  const state = {
    selectedItems: loadSelection(),
    pendingSizes: {},
    pendingColors: {},
    search: '',
    collection: '',
    category: '',
    sort: 'collection',
  };

  const els = {
    productGrid: document.querySelector('#productGrid'),
    productTemplate: document.querySelector('#productTemplate'),
    emptyState: document.querySelector('#emptyState'),
    searchInput: document.querySelector('#searchInput'),
    collectionFilter: document.querySelector('#collectionFilter'),
    categoryFilter: document.querySelector('#categoryFilter'),
    sortSelect: document.querySelector('#sortSelect'),
    clearFilters: document.querySelector('#clearFilters'),
    resultCount: document.querySelector('#resultCount'),
    usedAmount: document.querySelector('#usedAmount'),
    remainingAmount: document.querySelector('#remainingAmount'),
    budgetFill: document.querySelector('#budgetFill'),
    selectedCount: document.querySelector('#selectedCount'),
    selectionList: document.querySelector('#selectionList'),
    selectionEmpty: document.querySelector('#selectionEmpty'),
    selectionTotal: document.querySelector('#selectionTotal'),
    selectionRemaining: document.querySelector('#selectionRemaining'),
    copySummary: document.querySelector('#copySummary'),
    copyStatus: document.querySelector('#copyStatus'),
    resetSelection: document.querySelector('#resetSelection'),
    pantsRule: document.querySelector('#pantsRule'),
    pantsRuleStatus: document.querySelector('#pantsRuleStatus'),
  };

  function isValidSize(size) {
    return SIZES.includes(size);
  }

  function isValidColor(product, color) {
    return Boolean(product && Array.isArray(product.colors) && product.colors.includes(color));
  }

  function loadSelection() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      if (!Array.isArray(raw)) return [];

      let runningTotal = 0;
      let pantsSelected = false;
      const seen = new Set();
      const validItems = [];

      raw.forEach((item) => {
        if (!item || typeof item !== 'object') return;
        const { id, size, color } = item;
        const product = productById.get(id);
        if (!product || seen.has(id) || !isValidSize(size) || !isValidColor(product, color)) return;
        if (runningTotal + product.price > ALLOWANCE) return;

        const pantsItem = product.category === 'PANTS';
        if (pantsItem && pantsSelected) return;

        runningTotal += product.price;
        if (pantsItem) pantsSelected = true;
        seen.add(id);
        validItems.push({ id, size, color });
      });

      return validItems;
    } catch {
      return [];
    }
  }

  function saveSelection() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.selectedItems));
  }

  function money(value) {
    return `${new Intl.NumberFormat('nb-NO').format(value)} NOK`;
  }

  function totalSelected() {
    return state.selectedItems.reduce((sum, item) => sum + (productById.get(item.id)?.price || 0), 0);
  }

  function remainingAllowance() {
    return ALLOWANCE - totalSelected();
  }

  function selectedItem(id) {
    return state.selectedItems.find((item) => item.id === id) || null;
  }

  function isSelected(id) {
    return selectedItem(id) !== null;
  }

  function isPants(product) {
    return product.category === 'PANTS';
  }

  function selectedPantsCount() {
    return state.selectedItems.reduce((count, item) => {
      const product = productById.get(item.id);
      return count + (product && isPants(product) ? 1 : 0);
    }, 0);
  }

  function addBlockReason(product) {
    if (product.price > remainingAllowance()) return 'Over remaining allowance';
    if (isPants(product) && selectedPantsCount() >= 1) return 'Only 1 pants item allowed';
    return '';
  }

  function canAdd(product) {
    return addBlockReason(product) === '';
  }

  function currentSize(productId) {
    return selectedItem(productId)?.size || state.pendingSizes[productId] || '';
  }

  function currentColor(productId) {
    return selectedItem(productId)?.color || state.pendingColors[productId] || '';
  }

  function setSize(productId, size) {
    if (!isValidSize(size)) {
      delete state.pendingSizes[productId];
      return;
    }

    const existing = selectedItem(productId);
    if (existing) {
      existing.size = size;
      saveSelection();
      renderSelection();
      return;
    }

    state.pendingSizes[productId] = size;
  }

  function setColor(productId, color) {
    const product = productById.get(productId);
    if (!isValidColor(product, color)) {
      delete state.pendingColors[productId];
      return;
    }

    const existing = selectedItem(productId);
    if (existing) {
      existing.color = color;
      saveSelection();
      renderSelection();
      return;
    }

    state.pendingColors[productId] = color;
  }

  function toggleProduct(id) {
    const product = productById.get(id);
    if (!product) return;

    if (isSelected(id)) {
      const existing = selectedItem(id);
      if (existing?.size) state.pendingSizes[id] = existing.size;
      if (existing?.color) state.pendingColors[id] = existing.color;
      state.selectedItems = state.selectedItems.filter((item) => item.id !== id);
    } else if (canAdd(product)) {
      const size = state.pendingSizes[id];
      const color = state.pendingColors[id];
      if (!isValidSize(size) || !isValidColor(product, color)) return;
      state.selectedItems = [...state.selectedItems, { id, size, color }];
    }

    saveSelection();
    render();
  }

  function populateFilters() {
    const collections = [...new Set(products.map((p) => p.collection))]
      .sort((a, b) => a.localeCompare(b, 'nb'));
    const categoryOrder = ['PANTS', 'BASELAYER', 'MIDLAYER', 'SHIRTS'];
    const categories = categoryOrder.filter((category) => products.some((p) => p.category === category));

    collections.forEach((value) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = value;
      els.collectionFilter.append(option);
    });

    categories.forEach((value) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = value;
      els.categoryFilter.append(option);
    });
  }

  function filteredProducts() {
    const q = state.search.trim().toLocaleLowerCase('nb-NO');

    const filtered = products.filter((product) => {
      if (state.collection && product.collection !== state.collection) return false;
      if (state.category && product.category !== state.category) return false;
      if (!q) return true;

      const haystack = [
        product.collection,
        product.model,
        product.modelNumber,
        product.category,
        String(product.price),
        ...(product.colors || []),
      ].join(' ').toLocaleLowerCase('nb-NO');

      return haystack.includes(q);
    });

    return [...filtered].sort((a, b) => {
      if (state.sort === 'price-asc') return a.price - b.price || a.model.localeCompare(b.model, 'nb');
      if (state.sort === 'price-desc') return b.price - a.price || a.model.localeCompare(b.model, 'nb');
      if (state.sort === 'name') return a.model.localeCompare(b.model, 'nb');

      return (
        a.collection.localeCompare(b.collection, 'nb') ||
        a.category.localeCompare(b.category, 'nb') ||
        a.model.localeCompare(b.model, 'nb')
      );
    });
  }

  function renderProducts() {
    const visibleProducts = filteredProducts();
    const fragment = document.createDocumentFragment();

    visibleProducts.forEach((product) => {
      const node = els.productTemplate.content.cloneNode(true);
      const card = node.querySelector('.product-card');
      const button = node.querySelector('.select-button');
      const colorSelect = node.querySelector('.color-select');
      const sizeSelect = node.querySelector('.size-select');
      const selected = isSelected(product.id);
      const selectedColor = currentColor(product.id);
      const selectedSize = currentSize(product.id);
      const disabledReason = selected ? '' : addBlockReason(product);
      const blocked = disabledReason !== '';
      const colorMissing = !selected && !isValidColor(product, selectedColor);
      const sizeMissing = !selected && !isValidSize(selectedSize);

      node.querySelector('.collection-tag').textContent = product.collection;
      node.querySelector('.model-number').textContent = product.modelNumber;
      node.querySelector('.model-name').textContent = product.model;
      node.querySelector('.category').textContent = product.category;
      node.querySelector('.price').textContent = money(product.price);

      (product.colors || []).forEach((color) => {
        const option = document.createElement('option');
        option.value = color;
        option.textContent = color;
        colorSelect.append(option);
      });
      colorSelect.value = selectedColor;
      colorSelect.setAttribute('aria-label', `Color for ${product.model}`);
      colorSelect.addEventListener('change', (event) => {
        setColor(product.id, event.target.value);
        renderProducts();
      });

      SIZES.forEach((size) => {
        const option = document.createElement('option');
        option.value = size;
        option.textContent = size;
        sizeSelect.append(option);
      });
      sizeSelect.value = selectedSize;
      sizeSelect.setAttribute('aria-label', `Size for ${product.model}`);
      sizeSelect.addEventListener('change', (event) => {
        setSize(product.id, event.target.value);
        renderProducts();
      });

      card.classList.toggle('is-selected', selected);
      card.classList.toggle('is-disabled', blocked);
      button.textContent = selected ? 'Remove' : 'Add';
      button.disabled = !selected && (blocked || colorMissing || sizeMissing);
      button.setAttribute('aria-pressed', String(selected));
      button.setAttribute('aria-label', `${selected ? 'Remove' : 'Add'} ${product.model}`);

      const disabledNote = node.querySelector('.disabled-note');
      if (blocked) {
        disabledNote.textContent = disabledReason;
        disabledNote.hidden = false;
      } else if (colorMissing || sizeMissing) {
        if (colorMissing && sizeMissing) disabledNote.textContent = 'Choose color and size';
        else if (colorMissing) disabledNote.textContent = 'Choose color';
        else disabledNote.textContent = 'Choose size S–XL';
        disabledNote.hidden = false;
        disabledNote.classList.add('is-instruction');
      } else {
        disabledNote.hidden = true;
      }

      button.addEventListener('click', () => toggleProduct(product.id));
      fragment.append(node);
    });

    els.productGrid.replaceChildren(fragment);
    els.emptyState.hidden = visibleProducts.length !== 0;
    els.resultCount.textContent = `${visibleProducts.length} of ${products.length} products`;
  }

  function renderSelection() {
    const total = totalSelected();
    const remaining = ALLOWANCE - total;
    const percentage = Math.min(100, (total / ALLOWANCE) * 100);

    els.usedAmount.textContent = money(total);
    els.remainingAmount.textContent = money(remaining);
    els.selectedCount.textContent = String(state.selectedItems.length);
    els.budgetFill.style.width = `${percentage}%`;
    els.selectionTotal.textContent = money(total);
    els.selectionRemaining.textContent = money(remaining);

    const pantsCount = selectedPantsCount();
    const pantsRuleMet = pantsCount === 1;
    const allOptionsChosen = state.selectedItems.every((item) => {
      const product = productById.get(item.id);
      return product && isValidSize(item.size) && isValidColor(product, item.color);
    });
    els.copySummary.disabled = state.selectedItems.length === 0 || !pantsRuleMet || !allOptionsChosen;
    els.pantsRuleStatus.textContent = pantsRuleMet ? '1 / 1 selected' : '0 / 1 selected';
    els.pantsRule.classList.toggle('is-valid', pantsRuleMet);
    els.pantsRule.classList.toggle('is-invalid', !pantsRuleMet);

    els.selectionEmpty.hidden = state.selectedItems.length !== 0;
    const fragment = document.createDocumentFragment();

    state.selectedItems.forEach((selected) => {
      const product = productById.get(selected.id);
      if (!product) return;

      const item = document.createElement('div');
      item.className = 'selection-item';
      item.innerHTML = `
        <div>
          <p class="selection-item-name"></p>
          <div class="selection-item-meta"></div>
        </div>
        <div class="selection-item-price"></div>
        <div class="selection-options">
          <label class="selection-option-wrap">
            <span>Color</span>
            <select class="selection-color" aria-label="Selected color"></select>
          </label>
          <label class="selection-option-wrap">
            <span>Size</span>
            <select class="selection-size" aria-label="Selected size"></select>
          </label>
        </div>
        <button class="remove-button" type="button">Remove</button>
      `;

      item.querySelector('.selection-item-name').textContent = product.model;
      item.querySelector('.selection-item-meta').textContent =
        `${product.collection} · ${product.modelNumber} · ${product.category}`;
      item.querySelector('.selection-item-price').textContent = money(product.price);

      const selectionColor = item.querySelector('.selection-color');
      product.colors.forEach((color) => {
        const option = document.createElement('option');
        option.value = color;
        option.textContent = color;
        selectionColor.append(option);
      });
      selectionColor.value = selected.color;
      selectionColor.addEventListener('change', (event) => {
        setColor(product.id, event.target.value);
        renderProducts();
      });

      const selectionSize = item.querySelector('.selection-size');
      SIZES.forEach((size) => {
        const option = document.createElement('option');
        option.value = size;
        option.textContent = size;
        selectionSize.append(option);
      });
      selectionSize.value = selected.size;
      selectionSize.addEventListener('change', (event) => {
        setSize(product.id, event.target.value);
        renderProducts();
      });

      item.querySelector('.remove-button').addEventListener('click', () => toggleProduct(product.id));
      fragment.append(item);
    });

    els.selectionList.replaceChildren(fragment);
  }

  function render() {
    renderProducts();
    renderSelection();
  }

  async function copySelection() {
    const selected = state.selectedItems
      .map((item) => ({ product: productById.get(item.id), size: item.size, color: item.color }))
      .filter((item) =>
        item.product &&
        isValidSize(item.size) &&
        isValidColor(item.product, item.color)
      );
    if (!selected.length || selectedPantsCount() !== 1) return;

    const total = totalSelected();
    const lines = [
      'WORKWEAR SELECTA',
      '',
      ...selected.map(({ product, size, color }, index) =>
        `${index + 1}. ${product.model} · ${product.modelNumber} · ${color} · Size ${size} · ${money(product.price)}`
      ),
      '',
      `Total: ${money(total)}`,
      `Remaining: ${money(ALLOWANCE - total)}`,
    ];

    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      els.copyStatus.textContent = 'Selection copied.';
    } catch {
      els.copyStatus.textContent = 'Could not access clipboard. Select and copy manually.';
    }

    window.setTimeout(() => {
      els.copyStatus.textContent = '';
    }, 2600);
  }

  function resetSelection() {
    if (!state.selectedItems.length) return;
    state.selectedItems = [];
    state.pendingSizes = {};
    state.pendingColors = {};
    saveSelection();
    render();
  }

  function clearFilters() {
    state.search = '';
    state.collection = '';
    state.category = '';
    state.sort = 'collection';

    els.searchInput.value = '';
    els.collectionFilter.value = '';
    els.categoryFilter.value = '';
    els.sortSelect.value = 'collection';
    renderProducts();
  }

  function bindEvents() {
    els.searchInput.addEventListener('input', (event) => {
      state.search = event.target.value;
      renderProducts();
    });

    els.collectionFilter.addEventListener('change', (event) => {
      state.collection = event.target.value;
      renderProducts();
    });

    els.categoryFilter.addEventListener('change', (event) => {
      state.category = event.target.value;
      renderProducts();
    });

    els.sortSelect.addEventListener('change', (event) => {
      state.sort = event.target.value;
      renderProducts();
    });

    els.clearFilters.addEventListener('click', clearFilters);
    els.copySummary.addEventListener('click', copySelection);
    els.resetSelection.addEventListener('click', resetSelection);
  }

  populateFilters();
  bindEvents();
  render();
})();
