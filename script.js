const STORAGE_KEY = 'shopping_items_v1';

const state = {
  items: [],
  editId: null,
  filterScope: 'all',
  sortMode: 'due',
  sortBy: 'created',
  placeFilter: 'all',
};

const MAX_UNDO = 3;
const undoStack = [];
const lastValues = new WeakMap();
let suppressDialogClose = false;
let registerImages = [];
let registerImageNames = [];

const recordUndoEntry = (entry) => {
  undoStack.push(entry);
  if (undoStack.length > MAX_UNDO) undoStack.shift();
};

const els = {
  accordions: document.querySelectorAll('.accordion'),
  registerAccordion: document.getElementById('registerAccordion'),
  listAccordion: document.getElementById('listAccordion'),
  registerForm: document.getElementById('registerForm'),
  itemName: document.getElementById('itemName'),
  itemQty: document.getElementById('itemQty'),
  itemUnit: document.getElementById('itemUnit'),
  specFields: document.getElementById('specFields'),
  itemPlace: document.getElementById('itemPlace'),
  itemDueDate: document.getElementById('itemDueDate'),
  itemDueTime: document.getElementById('itemDueTime'),
  itemUrl: document.getElementById('itemUrl'),
  historyAccordion: document.getElementById('historyAccordion'),
  historyList: document.getElementById('historyList'),
  historyNames: document.getElementById('historyNames'),
  historyDetails: document.getElementById('historyDetails'),
  historyPlaces: document.getElementById('historyPlaces'),
  historyName: document.getElementById('historyName'),
  historyPlace: document.getElementById('historyPlace'),
  listContainer: document.getElementById('listContainer'),
  segments: document.querySelectorAll('.segment'),
  sortBy: document.getElementById('sortBy'),
  placeFilter: document.getElementById('placeFilter'),
  itemDialog: document.getElementById('itemDialog'),
  dialogTitle: document.getElementById('dialogTitle'),
  dialogContent: document.getElementById('dialogContent'),
  dialogTitleInput: document.getElementById('dialogTitleInput'),
  imagePicker: document.getElementById('imagePicker'),
  filePicker: document.getElementById('filePicker'),
  cameraPicker: document.getElementById('cameraPicker'),
  imagePreview: document.getElementById('imagePreview'),
  imageViewer: document.getElementById('imageViewer'),
  imageViewerImg: document.getElementById('imageViewerImg'),
  registerImagePhoto: document.getElementById('registerImagePhoto'),
  registerImageFile: document.getElementById('registerImageFile'),
  registerImageCamera: document.getElementById('registerImageCamera'),
  registerImageNames: document.getElementById('registerImageNames'),
  registerImageClear: document.getElementById('registerImageClear'),
};

const priorityLabel = {
  '': '優先度無',
  high: '高',
  mid: '中',
  low: '低',
};

const priorityColor = {
  high: 'var(--high)',
  mid: 'var(--mid)',
  low: 'var(--low)',
};

const specIndexMarks = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩'];
const formatSpecLabel = (index) => {
  const mark = specIndexMarks[index - 1] || `(${index})`;
  return `仕様・規格 + 内容・備考 ${mark}`;
};

const updateSpecLabels = () => {
  const groups = Array.from(els.specFields.querySelectorAll('[data-spec-group]'));
  groups.forEach((group, index) => {
    const label = group.querySelector('[data-spec-row] .field-label');
    if (label) label.textContent = formatSpecLabel(index + 1);
    const deleteBtn = group.querySelector('.spec-delete');
    if (deleteBtn) deleteBtn.classList.toggle('is-hidden', index === 0);
    const addBtn = group.querySelector('.spec-add');
    if (addBtn) addBtn.classList.toggle('is-hidden', false);
    const actions = group.querySelector('.spec-title-actions');
    if (actions && addBtn && deleteBtn) {
      actions.innerHTML = '';
      if (index === 0) {
        actions.append(addBtn);
      } else {
        actions.append(deleteBtn, addBtn);
      }
    }
  });
};

const loadItems = () => {
  const raw = localStorage.getItem(STORAGE_KEY);
  state.items = raw ? JSON.parse(raw) : [];
  state.items = state.items.map((item) => {
    if (item.specs && Array.isArray(item.specs)) return item;
    const details = Array.isArray(item.details) ? item.details : [];
    const legacyText = typeof item.specText === 'string' ? item.specText : '';
    const specs = details.length
      ? details.map((name) => ({ name, text: legacyText }))
      : legacyText
        ? [{ name: '', text: legacyText }]
        : [{ name: '', text: '' }];
    return { ...item, specs };
  });
};

const saveItems = () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.items));
};

const pruneChecked = () => {
  const now = Date.now();
  const limit = 72 * 60 * 60 * 1000;
  state.items = state.items.filter((item) => {
    if (!item.checked || !item.checkedAt) return true;
    return now - item.checkedAt < limit;
  });
};

const setAccordionState = (accordion, isOpen) => {
  const header = accordion.querySelector('[data-action="toggle-section"]');
  const body = accordion.querySelector('.accordion-body');
  const indicator = accordion.querySelector('.accordion-indicator');
  body.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
  header.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  accordion.classList.toggle('is-collapsed', !isOpen);
  accordion.classList.toggle('is-open', isOpen);
  if (indicator) indicator.textContent = isOpen ? '-' : '+';
};

const createSpecGroup = (index) => {
  const group = document.createElement('div');
  group.className = 'spec-group';
  group.dataset.specGroup = 'true';

  const nameRow = document.createElement('div');
  nameRow.className = 'field-row';
  nameRow.dataset.specRow = 'true';
  const nameTitle = document.createElement('div');
  nameTitle.className = 'spec-title';
  const nameLabel = document.createElement('label');
  nameLabel.className = 'field-label';
  nameLabel.textContent = formatSpecLabel(index);
  nameLabel.setAttribute('for', `spec-name-${index}`);
  const nameDelete = document.createElement('button');
  nameDelete.type = 'button';
  nameDelete.className = 'ghost-btn spec-delete';
  nameDelete.dataset.action = 'remove-spec';
  nameDelete.textContent = '削除';
  const nameAdd = document.createElement('button');
  nameAdd.type = 'button';
  nameAdd.className = 'ghost-btn spec-add';
  nameAdd.dataset.action = 'add-spec';
  nameAdd.textContent = '＋';
  const titleActions = document.createElement('div');
  titleActions.className = 'spec-title-actions';
  titleActions.append(nameAdd, nameDelete);
  nameTitle.append(nameLabel, titleActions);
  const nameInputWrap = document.createElement('div');
  nameInputWrap.className = 'field-input spec-inline';
  const nameInput = document.createElement('input');
  nameInput.id = `spec-name-${index}`;
  nameInput.name = 'specName';
  nameInput.type = 'text';
  nameInput.placeholder = '例：サイズ・色';
  const nameHistory = document.createElement('input');
  nameHistory.className = 'spec-history';
  nameHistory.setAttribute('list', 'historyDetails');
  nameHistory.id = `historyDetail-${index}`;
  nameHistory.placeholder = '履歴';
  const nameEditBtn = document.createElement('button');
  nameEditBtn.type = 'button';
  nameEditBtn.className = 'ghost-btn';
  nameEditBtn.dataset.action = 'open-history';
  nameEditBtn.dataset.target = 'historyDetails';
  nameEditBtn.innerHTML = '<span></span>';
  nameEditBtn.classList.add('icon-lines');
  const nameUnit = document.createElement('select');
  nameUnit.id = `spec-unit-${index}`;
  nameUnit.name = 'specUnit';
  nameUnit.setAttribute('aria-label', '単位');
  nameUnit.innerHTML = `
    <option value="">単位</option>
    <option value="mm">mm</option>
    <option value="cm">cm</option>
    <option value="m">m</option>
    <option value="W">W</option>
    <option value="g">g</option>
    <option value="kg">kg</option>
    <option value="ml">ml</option>
    <option value="l">l</option>
  `;
  nameInputWrap.append(nameInput, nameHistory, nameEditBtn, nameUnit);
  nameRow.append(nameTitle, nameInputWrap);

  const textRow = document.createElement('div');
  textRow.className = 'field-row spec-row';
  const textLabel = document.createElement('label');
  textLabel.className = 'field-label';
  textLabel.textContent = '';
  textLabel.setAttribute('for', `spec-text-${index}`);
  const textInputWrap = document.createElement('div');
  textInputWrap.className = 'field-input';
  const textArea = document.createElement('textarea');
  textArea.id = `spec-text-${index}`;
  textArea.name = 'specText';
  textArea.rows = 1;
  textArea.placeholder = '内容・備考';
  textInputWrap.append(textArea);
  textRow.append(textLabel, textInputWrap);

  group.append(nameRow, textRow);
  return group;
};

const collectHistoryValues = () => {
  const names = new Set();
  const details = new Set();
  const places = new Set();

  state.items.forEach((item) => {
    if (item.name) names.add(item.name);
    (item.specs || []).forEach((spec) => {
      if (spec.name) details.add(spec.name);
    });
    if (item.place) places.add(item.place);
  });

  return {
    names: Array.from(names),
    details: Array.from(details),
    places: Array.from(places),
  };
};

const getHistoryValues = (target) => {
  const { names, details, places } = collectHistoryValues();
  if (target === 'historyNames') return names;
  if (target === 'historyDetails') return details;
  if (target === 'historyPlaces') return places;
  return [];
};

const closeInlineHistories = () => {
  document.querySelectorAll('.inline-history[aria-hidden="false"]').forEach((panel) => {
    panel.setAttribute('aria-hidden', 'true');
    const row = panel.previousElementSibling;
    const button = row?.querySelector('[data-action="open-history"]');
    if (button) {
      button.innerHTML = '<span></span>';
      button.classList.add('icon-lines');
    }
  });
};

const renderInlineHistory = (container, values, target) => {
  container.innerHTML = '';
  const body = document.createElement('div');
  body.className = 'inline-history-body';
  if (!values.length) {
    const empty = document.createElement('div');
    empty.className = 'inline-history-empty';
    empty.textContent = '保存された内容がありません';
    body.append(empty);
  } else {
    const list = document.createElement('ul');
    list.className = 'inline-history-list';
    values.forEach((value) => {
      const li = document.createElement('li');
      li.className = 'inline-history-row';
      const check = document.createElement('input');
      check.type = 'checkbox';
      check.className = 'inline-history-check';
      check.dataset.value = value;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'inline-history-item';
      btn.dataset.action = 'select-inline-history';
      btn.dataset.value = value;
      btn.dataset.target = target;
      btn.textContent = value;
      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'ghost-btn inline-history-edit';
      editBtn.dataset.action = 'edit-inline-history';
      editBtn.dataset.value = value;
      editBtn.dataset.target = target;
      editBtn.innerHTML = '<span></span>';
      editBtn.classList.add('icon-lines');
      li.append(check, btn, editBtn);
      list.appendChild(li);
    });
    body.appendChild(list);
  }
  const actions = document.createElement('div');
  actions.className = 'inline-history-actions';
  actions.innerHTML = `
    <button type="button" class="ghost-btn" data-action="inline-check-all" data-target="${target}">すべてをチェックする</button>
    <button type="button" class="ghost-btn" data-action="inline-remove-checked" data-target="${target}">チェックした項目を削除</button>
  `;
  body.appendChild(actions);
  container.appendChild(body);
};

const updateHistoryValue = (target, oldValue, newValue) => {
  if (!newValue || oldValue === newValue) return;
  state.items = state.items.map((item) => {
    if (target === 'historyNames') {
      return item.name === oldValue ? { ...item, name: newValue } : item;
    }
    if (target === 'historyPlaces') {
      return item.place === oldValue ? { ...item, place: newValue } : item;
    }
    if (target === 'historyDetails') {
      const specs = (item.specs || []).map((spec) => (spec.name === oldValue ? { ...spec, name: newValue } : spec));
      return { ...item, specs };
    }
    return item;
  });
};

const removeHistoryValues = (target, values) => {
  if (!values.length) return;
  if (target === 'historyNames') {
    state.items = state.items.filter((item) => !values.includes(item.name));
    return;
  }
  if (target === 'historyPlaces') {
    state.items = state.items.map((item) => (values.includes(item.place) ? { ...item, place: '' } : item));
    return;
  }
  if (target === 'historyDetails') {
    state.items = state.items.map((item) => {
      const specs = (item.specs || []).filter((spec) => !values.includes(spec.name));
      return { ...item, specs };
    });
  }
};

const startInlineEdit = (row, target, oldValue) => {
  if (!row || row.dataset.editing === 'true') return;
  row.dataset.editing = 'true';
  const valueBtn = row.querySelector('.inline-history-item');
  const editBtn = row.querySelector('.inline-history-edit');
  if (!valueBtn || !editBtn) return;

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'inline-history-input';
  input.value = oldValue;
  valueBtn.style.display = 'none';
  row.insertBefore(input, editBtn);
  editBtn.textContent = '保存';
  editBtn.classList.remove('icon-lines');

  const finish = (shouldSave) => {
    if (row.dataset.editing !== 'true') return;
    const newValue = input.value.trim();
    if (shouldSave && newValue) {
      updateHistoryValue(target, oldValue, newValue);
      saveItems();
      buildHistory();
      renderList();
      const container = row.closest('.inline-history');
      if (container) renderInlineHistory(container, getHistoryValues(target), target);
      return;
    }
    row.dataset.editing = 'false';
    valueBtn.style.display = '';
    input.remove();
    editBtn.innerHTML = '<span></span>';
    editBtn.classList.add('icon-lines');
  };

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      finish(true);
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      finish(false);
    }
  });

  input.addEventListener('blur', () => finish(true));
  input.focus();
  input.select();
};

const toggleInlineHistory = (button) => {
  const target = button.dataset.target;
  if (!target) return;
  const row = button.closest('.field-row');
  if (!row) return;
  let container = row.nextElementSibling;
  if (!container || !container.classList.contains('inline-history') || container.dataset.target !== target) {
    container = document.createElement('div');
    container.className = 'inline-history';
    container.dataset.target = target;
    container.dataset.align = row.dataset.specRow === 'true' ? 'full' : 'indent';
    container.setAttribute('aria-hidden', 'true');
    row.parentNode.insertBefore(container, row.nextSibling);
  }
  const isOpen = container.getAttribute('aria-hidden') === 'false';
  closeInlineHistories();
  if (isOpen) return;
  renderInlineHistory(container, getHistoryValues(target), target);
  container.setAttribute('aria-hidden', 'false');
  button.textContent = '閉る';
};

const resetForm = () => {
  els.registerForm.reset();
  const extraGroups = Array.from(els.specFields.querySelectorAll('[data-spec-group]')).slice(1);
  extraGroups.forEach((group) => group.remove());
  state.editId = null;
  updateSpecLabels();
  undoStack.length = 0;
  registerInputs(els.registerForm);
  registerImages = [];
  registerImageNames = [];
  if (els.registerImageNames) els.registerImageNames.innerHTML = '';
  if (els.registerImageClear) els.registerImageClear.classList.add('is-hidden');
  const nameRow = els.registerImageClear?.closest('.image-filenames-row');
  if (nameRow) nameRow.classList.add('is-hidden');
};

const readSpecs = () => {
  const groups = Array.from(els.specFields.querySelectorAll('[data-spec-group]'));
  return groups.map((group) => {
    const name = group.querySelector('input[name="specName"]')?.value.trim() || '';
    const text = group.querySelector('textarea[name="specText"]')?.value.trim() || '';
    const unit = group.querySelector('select[name="specUnit"]')?.value || '';
    return { name, text, unit };
  }).filter((spec) => spec.name || spec.text);
};

const buildHistory = () => {
  const { names, details, places } = collectHistoryValues();
  if (els.historyList) els.historyList.innerHTML = '';

  if (els.historyList) {
    state.items.forEach((item) => {
      const li = document.createElement('li');
      li.className = 'history-item';
      li.innerHTML = `
        <label>
          <input type="checkbox" data-history-id="${item.id}" />
          ${item.name}
        </label>
      <button class="ghost-btn icon-lines" type="button" data-action="load-item" data-id="${item.id}"><span></span></button>
      `;
      els.historyList.appendChild(li);
    });
  }

  const fillDatalist = (el, values) => {
    el.innerHTML = '';
    values.forEach((value) => {
      const option = document.createElement('option');
      option.value = value;
      el.appendChild(option);
    });
  };

  fillDatalist(els.historyNames, names);
  fillDatalist(els.historyDetails, details);
  fillDatalist(els.historyPlaces, places);
};

const formatDue = (item) => {
  if (!item.dueDate) return '日付';
  return item.dueDate;
};

const sortItems = (items) => {
  const list = [...items];
  if (state.sortMode === 'priority') {
    const order = { high: 0, mid: 1, low: 2, '': 3 };
    list.sort((a, b) => {
      const diff = order[a.priority] - order[b.priority];
      if (diff !== 0) return diff;
      const aHas = Boolean(a.dueDate);
      const bHas = Boolean(b.dueDate);
      if (aHas !== bHas) return aHas ? -1 : 1;
      return (a.dueDate || '').localeCompare(b.dueDate || '');
    });
  } else if (state.sortMode === 'due') {
    list.sort((a, b) => {
      const aHas = Boolean(a.dueDate);
      const bHas = Boolean(b.dueDate);
      if (aHas !== bHas) return aHas ? -1 : 1;
      return (a.dueDate || '').localeCompare(b.dueDate || '');
    });
  } else {
    list.sort((a, b) => b.createdAt - a.createdAt);
  }
  return list;
};

const renderList = () => {
  els.listContainer.innerHTML = '';
  const activeItems = state.items.filter((item) => !item.checked);
  updatePlaceFilterOptions(activeItems);
  const sorted = sortItems(activeItems);

  if (state.filterScope === 'all') {
    renderGroup('', sorted, false);
  } else if (state.filterScope === 'place') {
    const filtered = state.placeFilter === 'all'
      ? sorted
      : sorted.filter((item) => (item.place || '未設定') === state.placeFilter);
    const groups = groupBy(filtered, (item) => item.place || '未設定');
    Object.entries(groups).forEach(([key, items]) => {
      renderGroup(key, items, true);
    });
  }

  const checkedItems = state.items.filter((item) => item.checked);
  if (checkedItems.length) {
    renderGroup(`購入済み (72時間後に自動消去)`, checkedItems, false, true, true);
  }
};

const updatePlaceFilterOptions = (items) => {
  if (!els.placeFilter) return;
  const values = Array.from(new Set(items.map((item) => item.place || '未設定')))
    .sort((a, b) => a.localeCompare(b, 'ja'));
  if (state.placeFilter !== 'all' && !values.includes(state.placeFilter)) {
    state.placeFilter = 'all';
  }
  els.placeFilter.innerHTML = '';
  const allOption = document.createElement('option');
  allOption.value = 'all';
  allOption.textContent = 'すべて';
  els.placeFilter.appendChild(allOption);
  const divider = document.createElement('option');
  divider.disabled = true;
  divider.textContent = '────────';
  els.placeFilter.appendChild(divider);
  values.forEach((value) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    els.placeFilter.appendChild(option);
  });
  els.placeFilter.value = state.placeFilter;
  const isPlaceView = state.filterScope === 'place';
  els.placeFilter.classList.toggle('is-hidden', !isPlaceView);
};

const renderGroup = (title, items, showMap, isChecked = false, showCheckedActions = false) => {
  const group = document.createElement('div');
  group.className = 'list-group';
  let header = null;
  if (title && !(showMap && title === '未設定')) {
    header = document.createElement('div');
    header.className = 'group-header';
    header.innerHTML = `
      <div class="group-title">
        <h3>${title}</h3>
        ${showMap ? `<input class="group-edit-input" type="text" value="${title}" data-place="${title}" aria-label="どこでを編集" />` : ''}
      </div>
      ${showMap ? `<button class="ghost-btn icon-lines" data-action="edit-place" data-place="${title}"><span></span></button>` : ''}
    `;
  }
  const list = document.createElement('ul');
  list.className = 'item-list';

  items.forEach((item) => {
    const li = document.createElement('li');
    li.className = 'item';
    const dueBadge = item.dueDate ? `<span class="badge">${formatDue(item)}</span>` : `<span class="badge is-empty"></span>`;
    const hasImages = Array.isArray(item.images) && item.images.length > 0;
    const hasUrl = Boolean((item.url || '').trim());
    const icons = `
      <span class="item-icons">
        ${hasImages ? `
          <span class="item-icon" aria-label="画像あり" title="画像あり">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="3" y="5" width="18" height="14" rx="2" ry="2" fill="none" stroke="currentColor" stroke-width="2"/>
              <circle cx="9" cy="10" r="2" fill="currentColor"/>
              <path d="M3 17l5-5 4 4 3-3 6 6" fill="none" stroke="currentColor" stroke-width="2"/>
            </svg>
          </span>
        ` : ''}
        ${hasUrl ? `
          <span class="item-icon" aria-label="URLあり" title="URLあり">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="4" y="5" width="16" height="14" rx="2" ry="2" fill="none" stroke="currentColor" stroke-width="2"/>
              <path d="M8 9h8M8 12h8M8 15h5" fill="none" stroke="currentColor" stroke-width="2"/>
            </svg>
          </span>
        ` : ''}
      </span>
    `;
    li.innerHTML = `
      <input type="checkbox" ${item.checked ? 'checked' : ''} data-action="toggle" data-id="${item.id}" />
      <div class="item-main">
        <span class="item-name priority-${item.priority}">${item.name} x ${item.qty}</span>
        <div class="item-meta-inline">
          ${dueBadge}
          ${hasImages || hasUrl ? icons : ''}
          <button class="menu-btn" data-action="open-detail" data-id="${item.id}">≡</button>
        </div>
      </div>
    `;
    if (isChecked) li.style.opacity = '0.5';
    list.appendChild(li);
  });

  if (header) {
    group.append(header);
  }
  group.append(list);
  if (showMap) {
    const actions = document.createElement('div');
    actions.className = 'group-actions-bottom';
    actions.innerHTML = `<button class="ghost-btn" data-action="check-group" data-place="${title}">すべてをチェックする</button>`;
    group.append(actions);
  } else if (!isChecked && title === '' && state.filterScope === 'all') {
    const actions = document.createElement('div');
    actions.className = 'group-actions-bottom';
    actions.innerHTML = `<button class="ghost-btn" data-action="check-all-global">すべてをチェックする</button>`;
    group.append(actions);
  } else if (showCheckedActions) {
    const actions = document.createElement('div');
    actions.className = 'group-actions-bottom';
    actions.innerHTML = `<button class="ghost-btn" data-action="clear-checked">すべて削除</button>`;
    group.append(actions);
  }
  els.listContainer.appendChild(group);
};

const groupBy = (items, getKey) => {
  return items.reduce((acc, item) => {
    const key = getKey(item);
    acc[key] = acc[key] || [];
    acc[key].push(item);
    return acc;
  }, {});
};

const fillForm = (item) => {
  resetForm();
  els.itemName.value = item.name;
  els.itemQty.value = item.qty;
  if (els.itemUnit) els.itemUnit.value = item.unit;
  const specs = item.specs && item.specs.length ? item.specs : [{ name: '', text: '' }];
  specs.forEach((spec, index) => {
    if (index > 0) {
      const group = createSpecGroup(index + 1);
      els.specFields.appendChild(group);
    }
    const group = els.specFields.querySelectorAll('[data-spec-group]')[index];
    if (!group) return;
    const nameInput = group.querySelector('input[name="specName"]');
    const textArea = group.querySelector('textarea[name="specText"]');
    const unitSelect = group.querySelector('select[name="specUnit"]');
    if (nameInput) nameInput.value = spec.name || '';
    if (textArea) textArea.value = spec.text || '';
    if (unitSelect) unitSelect.value = spec.unit || '';
  });
  updateSpecLabels();
  els.itemPlace.value = item.place;
  els.itemDueDate.value = item.dueDate || '';
  els.itemDueTime.value = item.dueTime || '';
  const prioritySelect = els.registerForm.querySelector('[name="priority"]');
  if (prioritySelect) prioritySelect.value = item.priority || '';
  els.itemUrl.value = item.url || '';
  state.editId = item.id;
  setAccordionState(els.registerAccordion, true);
  setAccordionState(els.listAccordion, true);
  registerInputs(els.registerForm);
};

const openDialog = (item) => {
  if (els.dialogTitleInput) {
    els.dialogTitleInput.value = item.name || '';
    els.dialogTitleInput.style.display = 'block';
    els.dialogTitleInput.readOnly = true;
    lastValues.set(els.dialogTitleInput, els.dialogTitleInput.value);
  }
  const editBtn = els.itemDialog?.querySelector('[data-action="edit-item"]');
  if (editBtn) {
    editBtn.innerHTML = '<span></span>';
    editBtn.classList.add('icon-lines');
  }
  const deleteBtn = els.itemDialog?.querySelector('[data-action="delete-item"]');
  if (deleteBtn) deleteBtn.textContent = '削除';
  els.itemDialog.dataset.editing = 'false';
  const mediaActions = els.itemDialog?.querySelector('.media-actions');
  if (mediaActions) mediaActions.classList.add('hidden');
  const specLine = (item.specs || [])
    .map((spec) => {
      const text = spec.text || '未設定';
      const unit = spec.unit ? ` ${spec.unit}` : '';
      return `【${spec.name || '未設定'}】 ${text}${unit}`;
    })
    .join('<br>') || '未設定';
  const truncateText = (text, max = 30) => {
    if (!text) return '';
    return text.length > max ? `${text.slice(0, max)}…` : text;
  };
  const urls = (item.url || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const urlHtml = urls.length
    ? `<div class="detail-url-list">${urls.map((u) => {
      const display = truncateText(u, 30);
      return `<div><a href="${u}" target="_blank" rel="noopener">${display}</a></div>`;
    }).join('')}</div>`
    : '未設定';
  els.dialogContent.innerHTML = `
    <div class="detail-row"><span class="detail-label">数量</span><span class="detail-sep">:</span><span class="detail-value">${item.qty}${item.unit || ''}</span></div>
    <div class="detail-row"><span class="detail-label">内容</span><span class="detail-sep">:</span><span class="detail-value">${specLine}</span></div>
    <div class="detail-row"><span class="detail-label">どこで</span><span class="detail-sep">:</span><span class="detail-value">${item.place || '未設定'}</span></div>
    <div class="detail-row"><span class="detail-label">いつまで</span><span class="detail-sep">:</span><span class="detail-value">${item.dueDate || '未設定'} ${item.dueTime || ''}</span></div>
    <div class="detail-row"><span class="detail-label">優先度</span><span class="detail-sep">:</span><span class="detail-value">${priorityLabel[item.priority]}</span></div>
    <div class="detail-row"><span class="detail-label">比較URL</span><span class="detail-sep">:</span><span class="detail-value">${urlHtml}</span></div>
  `;
  els.itemDialog.dataset.editing = 'false';
  if (els.imagePreview) {
    els.imagePreview.innerHTML = '';
    (item.images || []).forEach((src) => {
      const wrap = document.createElement('div');
      wrap.className = 'preview-item';
      wrap.innerHTML = `<img src="${src}" alt="${item.name}の画像" />`;
      els.imagePreview.appendChild(wrap);
    });
  }
  els.itemDialog.dataset.itemId = item.id;
  els.itemDialog.showModal();
};

const renderDialogEdit = (item) => {
  const specs = (item.specs && item.specs.length) ? item.specs : [{ name: '', text: '' }];
  const specsHtml = specs.map((spec, index) => `
      <div class="dialog-spec-row" data-spec-index="${index}">
        <input type="text" name="editSpecName" value="${spec.name || ''}" placeholder="仕様・規格" />
        <input type="text" name="editSpecText" value="${spec.text || ''}" placeholder="内容" />
        <select name="editSpecUnit" aria-label="単位">
          <option value="">単位</option>
          <option value="mm" ${spec.unit === 'mm' ? 'selected' : ''}>mm</option>
          <option value="cm" ${spec.unit === 'cm' ? 'selected' : ''}>cm</option>
          <option value="m" ${spec.unit === 'm' ? 'selected' : ''}>m</option>
          <option value="W" ${spec.unit === 'W' ? 'selected' : ''}>W</option>
          <option value="g" ${spec.unit === 'g' ? 'selected' : ''}>g</option>
          <option value="kg" ${spec.unit === 'kg' ? 'selected' : ''}>kg</option>
          <option value="ml" ${spec.unit === 'ml' ? 'selected' : ''}>ml</option>
          <option value="l" ${spec.unit === 'l' ? 'selected' : ''}>l</option>
        </select>
      </div>
    `).join('');
  undoStack.length = 0;
  if (els.dialogTitleInput) {
    els.dialogTitleInput.value = item.name || '';
    els.dialogTitleInput.style.display = 'block';
    els.dialogTitleInput.readOnly = false;
    lastValues.set(els.dialogTitleInput, els.dialogTitleInput.value);
  }
  const mediaActions = els.itemDialog?.querySelector('.media-actions');
  if (mediaActions) mediaActions.classList.remove('hidden');
  const currentQty = Number(item.qty) || 1;
  const qtyOptions = Array.from({ length: 99 }, (_, index) => {
    const value = index + 1;
    return `<option value="${value}" ${value === currentQty ? 'selected' : ''}>${value}</option>`;
  }).join('');
  els.dialogContent.innerHTML = `
    <label class="dialog-field">
      <span>数量</span>
      <select name="editQty" aria-label="数量">
        ${qtyOptions}
      </select>
    </label>
    <label class="dialog-field">
      <span>内容</span>
      <div class="dialog-specs">
        ${specsHtml}
      </div>
    </label>
    <label class="dialog-field">
      <span>どこで</span>
      <input type="text" name="editPlace" value="${item.place || ''}" />
    </label>
    <label class="dialog-field">
      <span>いつまで</span>
      <div class="dialog-inline">
        <input type="date" name="editDueDate" value="${item.dueDate || ''}" />
        <input type="time" name="editDueTime" value="${item.dueTime || ''}" />
      </div>
    </label>
    <label class="dialog-field">
      <span>優先度</span>
      <select name="editPriority">
        <option value="high" ${item.priority === 'high' ? 'selected' : ''}>高</option>
        <option value="mid" ${item.priority === 'mid' ? 'selected' : ''}>中</option>
        <option value="low" ${item.priority === 'low' ? 'selected' : ''}>低</option>
      </select>
    </label>
    <label class="dialog-field">
      <span>比較URL</span>
      <textarea name="editUrl" rows="2" placeholder="https://">${item.url || ''}</textarea>
    </label>
  `;
  registerInputs(els.dialogContent);
  if (els.dialogTitleInput) registerInputs(els.itemDialog);
  if (els.imagePreview) {
    els.imagePreview.innerHTML = '';
    (item.images || []).forEach((src, index) => {
      const wrap = document.createElement('div');
      wrap.className = 'preview-item';
      wrap.innerHTML = `<img src="${src}" alt="${item.name}の画像" />`;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'preview-remove';
      btn.dataset.action = 'remove-image';
      btn.dataset.index = String(index);
      btn.textContent = '×';
      wrap.appendChild(btn);
      els.imagePreview.appendChild(wrap);
    });
  }
};

const registerInputs = (root) => {
  if (!root) return;
  root.querySelectorAll('input, textarea, select').forEach((el) => {
    if (el.type === 'checkbox' || el.type === 'radio' || el.type === 'file') return;
    lastValues.set(el, el.value);
  });
};

const recordChange = (el) => {
  if (!lastValues.has(el)) lastValues.set(el, el.value);
  const prev = lastValues.get(el);
  if (el.value === prev) return;
  recordUndoEntry({ el, value: prev });
  lastValues.set(el, el.value);
};

const applyUndo = () => {
  while (undoStack.length) {
    const entry = undoStack.pop();
    if (entry.type === 'check') {
      const item = state.items.find((i) => i.id === entry.id);
      if (!item) continue;
      item.checked = entry.checked;
      item.checkedAt = entry.checked ? (entry.checkedAt || Date.now()) : null;
      saveItems();
      renderList();
      return true;
    }
    if (entry.type === 'check-bulk') {
      entry.items.forEach((prev) => {
        const item = state.items.find((i) => i.id === prev.id);
        if (!item) return;
        item.checked = prev.checked;
        item.checkedAt = prev.checked ? (prev.checkedAt || Date.now()) : null;
      });
      saveItems();
      renderList();
      return true;
    }
    const el = entry.el;
    if (!el || !document.contains(el)) continue;
    el.value = entry.value;
    lastValues.set(el, entry.value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.focus();
    return true;
  }
  return false;
};

if (els.itemDialog) {
  els.itemDialog.addEventListener('click', (event) => {
    if (suppressDialogClose) return;
    const returnBtn = document.getElementById('returnBtn');
    if (returnBtn) {
      const rect = returnBtn.getBoundingClientRect();
      const isOnReturn =
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom;
      if (isOnReturn) {
        applyUndo();
        return;
      }
    }
    if (event.target === els.itemDialog) {
      els.itemDialog.close();
    }
  });
  els.itemDialog.addEventListener('close', () => {
    if (els.imageViewer?.open) closeImageViewer();
  });
}

const addImagesToItem = (files) => {
  const itemId = els.itemDialog?.dataset.itemId;
  if (!itemId || !files?.length) return;
  const item = state.items.find((i) => i.id === itemId);
  if (!item) return;
  const editing = els.itemDialog?.dataset.editing === 'true';
  const readers = Array.from(files).map((file) => new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  }));
  Promise.all(readers).then((results) => {
    const images = results.filter(Boolean);
    item.images = [...(item.images || []), ...images];
    saveItems();
    buildHistory();
    renderList();
    if (editing) {
      renderDialogEdit(item);
      const editBtn = els.itemDialog?.querySelector('[data-action="edit-item"]');
      if (editBtn) {
        editBtn.textContent = '保存';
        editBtn.classList.remove('icon-lines');
      }
      const deleteBtn = els.itemDialog?.querySelector('[data-action="delete-item"]');
      if (deleteBtn) deleteBtn.textContent = 'キャンセル';
      if (els.dialogTitleInput) els.dialogTitleInput.readOnly = false;
    } else {
      openDialog(item);
    }
  });
};

const addImagesToRegister = (files) => {
  if (!files?.length) return;
  const names = Array.from(files).map((file) => file.name).filter(Boolean);
  registerImageNames = [...registerImageNames, ...names];
  if (els.registerImageNames) {
    els.registerImageNames.innerHTML = registerImageNames.map((name) => `<div>${name}</div>`).join('');
  }
  if (els.registerImageClear) {
    els.registerImageClear.classList.toggle('is-hidden', registerImageNames.length === 0);
  }
  const nameRow = els.registerImageClear?.closest('.image-filenames-row');
  if (nameRow) nameRow.classList.toggle('is-hidden', registerImageNames.length === 0);
  const readers = Array.from(files).map((file) => new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  }));
  Promise.all(readers).then((results) => {
    const images = results.filter(Boolean);
    registerImages = [...registerImages, ...images];
  });
};

let viewerState = {
  scale: 1,
  startScale: 1,
  translateX: 0,
  translateY: 0,
  startX: 0,
  startY: 0,
  pointers: new Map(),
  startDistance: 0,
};

const updateViewerTransform = () => {
  if (!els.imageViewerImg) return;
  els.imageViewerImg.style.transform = `translate3d(${viewerState.translateX}px, ${viewerState.translateY}px, 0) scale(${viewerState.scale})`;
};

const openImageViewer = (src) => {
  if (!els.imageViewer || !els.imageViewerImg) return;
  viewerState = {
    scale: 1,
    startScale: 1,
    translateX: 0,
    translateY: 0,
    startX: 0,
    startY: 0,
    pointers: new Map(),
    startDistance: 0,
  };
  els.imageViewerImg.src = src;
  if (els.itemDialog) {
    els.itemDialog.classList.add('is-hidden');
    els.itemDialog.classList.add('is-obscured');
  }
  els.imageViewer.showModal();
  updateViewerTransform();
};

const closeImageViewer = () => {
  if (!els.imageViewer) return;
  els.imageViewer.close();
  if (els.imageViewerImg) els.imageViewerImg.src = '';
  if (els.itemDialog) {
    els.itemDialog.classList.remove('is-hidden');
    els.itemDialog.classList.remove('is-obscured');
  }
};

const getDistance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

if (els.imageViewer) {
  els.imageViewer.addEventListener('close', () => {
    if (els.imageViewerImg) els.imageViewerImg.src = '';
  });
  els.imageViewer.addEventListener('click', (event) => {
    if (event.target === els.imageViewer) {
      closeImageViewer();
    }
  });
}

if (els.imageViewerImg) {
  els.imageViewerImg.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    els.imageViewerImg.setPointerCapture(event.pointerId);
    viewerState.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (viewerState.pointers.size === 1) {
      viewerState.startX = event.clientX - viewerState.translateX;
      viewerState.startY = event.clientY - viewerState.translateY;
    }
    if (viewerState.pointers.size === 2) {
      const [p1, p2] = Array.from(viewerState.pointers.values());
      viewerState.startDistance = getDistance(p1, p2);
      viewerState.startScale = viewerState.scale;
    }
  });

  els.imageViewerImg.addEventListener('pointermove', (event) => {
    if (!viewerState.pointers.has(event.pointerId)) return;
    viewerState.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (viewerState.pointers.size === 1) {
      const p = viewerState.pointers.get(event.pointerId);
      viewerState.translateX = p.x - viewerState.startX;
      viewerState.translateY = p.y - viewerState.startY;
      updateViewerTransform();
    } else if (viewerState.pointers.size === 2) {
      const [p1, p2] = Array.from(viewerState.pointers.values());
      const distance = getDistance(p1, p2);
      const scale = viewerState.startScale * (distance / viewerState.startDistance);
      viewerState.scale = Math.min(Math.max(scale, 1), 4);
      updateViewerTransform();
    }
  });

  const endPointer = (event) => {
    if (!viewerState.pointers.has(event.pointerId)) return;
    viewerState.pointers.delete(event.pointerId);
  };

  els.imageViewerImg.addEventListener('pointerup', endPointer);
  els.imageViewerImg.addEventListener('pointercancel', endPointer);
  els.imageViewerImg.addEventListener('pointerleave', endPointer);
}

document.addEventListener('click', (event) => {
  const img = event.target.closest('.media-preview img');
  if (img) openImageViewer(img.src);
});

if (els.imagePicker) {
  els.imagePicker.addEventListener('change', (event) => {
    addImagesToItem(event.target.files);
    event.target.value = '';
  });
}

if (els.filePicker) {
  els.filePicker.addEventListener('change', (event) => {
    addImagesToItem(event.target.files);
    event.target.value = '';
  });
}

if (els.cameraPicker) {
  els.cameraPicker.addEventListener('change', (event) => {
    addImagesToItem(event.target.files);
    event.target.value = '';
  });
}

if (els.registerImagePhoto) {
  els.registerImagePhoto.addEventListener('change', (event) => {
    addImagesToRegister(event.target.files);
    event.target.value = '';
  });
}

if (els.registerImageFile) {
  els.registerImageFile.addEventListener('change', (event) => {
    addImagesToRegister(event.target.files);
    event.target.value = '';
  });
}

if (els.registerImageCamera) {
  els.registerImageCamera.addEventListener('change', (event) => {
    addImagesToRegister(event.target.files);
    event.target.value = '';
  });
}

if (els.registerImageClear) {
  els.registerImageClear.addEventListener('click', () => {
    registerImages = [];
    registerImageNames = [];
    if (els.registerImageNames) els.registerImageNames.innerHTML = '';
    if (els.registerImagePhoto) els.registerImagePhoto.value = '';
    if (els.registerImageFile) els.registerImageFile.value = '';
    if (els.registerImageCamera) els.registerImageCamera.value = '';
    els.registerImageClear.classList.add('is-hidden');
    const nameRow = els.registerImageClear.closest('.image-filenames-row');
    if (nameRow) nameRow.classList.add('is-hidden');
  });
}

const init = () => {
  loadItems();
  pruneChecked();
  saveItems();
  buildHistory();
  renderList();
  setAccordionState(els.registerAccordion, false);
  setAccordionState(els.listAccordion, true);
};

document.addEventListener('click', (event) => {
  if (event.target.closest('[data-action="toggle-section"]')) {
    const accordion = event.target.closest('.accordion');
    const body = accordion.querySelector('.accordion-body');
    const isOpen = body.getAttribute('aria-hidden') !== 'true';
    setAccordionState(accordion, !isOpen);
  }
});

document.addEventListener('input', (event) => {
  const el = event.target;
  if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) return;
  if (el.type === 'checkbox' || el.type === 'radio' || el.type === 'file') return;
  recordChange(el);
});

document.addEventListener('change', (event) => {
  const el = event.target;
  if (!(el instanceof HTMLSelectElement)) return;
  recordChange(el);
});

document.addEventListener('focusin', (event) => {
  const el = event.target;
  if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement)) return;
  if (el.type === 'checkbox' || el.type === 'radio' || el.type === 'file') return;
  if (!lastValues.has(el)) lastValues.set(el, el.value);
});

els.registerForm.addEventListener('click', (event) => {
  const action = event.target.dataset.action;
  if (action === 'open-history') {
    toggleInlineHistory(event.target);
  }
  if (action === 'add-spec') {
    const count = els.specFields.querySelectorAll('[data-spec-group]').length + 1;
    if (count > 10) return;
    const group = createSpecGroup(count);
    els.specFields.appendChild(group);
    updateSpecLabels();
  }
  if (action === 'remove-spec') {
    const group = event.target.closest('[data-spec-group]');
    if (group && els.specFields.querySelectorAll('[data-spec-group]').length > 1) {
      group.remove();
      updateSpecLabels();
    }
  }
});

els.registerForm.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter') return;
  const el = event.target;
  if (el instanceof HTMLTextAreaElement) return;
  event.preventDefault();
});

const returnBtn = document.getElementById('returnBtn');
if (returnBtn) {
  const updateReturnBtnOffset = () => {
    const visualViewport = window.visualViewport;
    if (!visualViewport) return;
    const keyboardHeight = Math.max(0, window.innerHeight - visualViewport.height - visualViewport.offsetTop);
    const base = 20;
    const extra = keyboardHeight > 0 ? keyboardHeight + 12 : 0;
    returnBtn.style.bottom = `${base + extra}px`;
  };

  updateReturnBtnOffset();
  window.visualViewport?.addEventListener('resize', updateReturnBtnOffset);
  window.visualViewport?.addEventListener('scroll', updateReturnBtnOffset);
  window.addEventListener('resize', updateReturnBtnOffset);

  returnBtn.addEventListener('pointerdown', () => {
    suppressDialogClose = true;
    setTimeout(() => {
      suppressDialogClose = false;
    }, 250);
  });
  returnBtn.addEventListener('click', () => {
    if (applyUndo()) return;
    if (els.itemDialog?.open) return;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

if (els.itemDialog) {
  els.itemDialog.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    const el = event.target;
    if (el instanceof HTMLTextAreaElement) return;
    event.preventDefault();
  });
}

els.historyName.addEventListener('change', (event) => {
  if (event.target.value) {
    els.itemName.value = event.target.value;
    event.target.value = '';
  }
});

els.historyPlace.addEventListener('change', (event) => {
  if (event.target.value) {
    els.itemPlace.value = event.target.value;
    event.target.value = '';
  }
});

document.addEventListener('change', (event) => {
  if (event.target.id && event.target.id.startsWith('historyDetail')) {
    const index = Number(event.target.id.split('-')[1] || 1) - 1;
    const groups = els.specFields.querySelectorAll('[data-spec-group]');
    const nameInput = groups[index]?.querySelector('input[name="specName"]');
    if (nameInput) nameInput.value = event.target.value;
    event.target.value = '';
  }
});

document.addEventListener('click', (event) => {
  const btn = event.target.closest('[data-action="select-inline-history"]');
  if (!btn) return;
  const value = btn.dataset.value || '';
  const target = btn.dataset.target;
  const container = btn.closest('.inline-history');
  if (target === 'historyNames') {
    els.itemName.value = value;
  }
  if (target === 'historyPlaces') {
    els.itemPlace.value = value;
  }
  if (target === 'historyDetails') {
    const group = container?.closest('[data-spec-group]');
    const nameInput = group?.querySelector('input[name="specName"]');
    if (nameInput) nameInput.value = value;
  }
  if (container) {
    container.setAttribute('aria-hidden', 'true');
    const row = container.previousElementSibling;
    const button = row?.querySelector('[data-action="open-history"]');
    if (button) {
      button.innerHTML = '<span></span>';
      button.classList.add('icon-lines');
    }
  }
});

document.addEventListener('click', (event) => {
  const action = event.target.dataset.action;
  if (action === 'edit-inline-history') {
    const target = event.target.dataset.target;
    const oldValue = event.target.dataset.value || '';
    const row = event.target.closest('.inline-history-row');
    if (row?.dataset.editing === 'true') {
      const input = row.querySelector('.inline-history-input');
      if (input) input.blur();
      return;
    }
    startInlineEdit(row, target, oldValue);
  }
  if (action === 'inline-check-all') {
    const container = event.target.closest('.inline-history');
    if (!container) return;
    const checks = Array.from(container.querySelectorAll('.inline-history-check'));
    const shouldCheck = checks.some((checkbox) => !checkbox.checked);
    checks.forEach((checkbox) => {
      checkbox.checked = shouldCheck;
    });
  }
  if (action === 'inline-remove-checked') {
    const target = event.target.dataset.target;
    const container = event.target.closest('.inline-history');
    if (!container) return;
    const values = Array.from(container.querySelectorAll('.inline-history-check:checked'))
      .map((checkbox) => checkbox.dataset.value)
      .filter(Boolean);
    removeHistoryValues(target, values);
    saveItems();
    buildHistory();
    renderList();
    if (container) renderInlineHistory(container, getHistoryValues(target), target);
  }
});

if (els.historyAccordion) {
  els.historyAccordion.addEventListener('click', (event) => {
    const action = event.target.dataset.action;
    if (action === 'toggle-accordion') {
      const body = els.historyAccordion.querySelector('.accordion-body');
      const isHidden = body.getAttribute('aria-hidden') === 'true';
      body.setAttribute('aria-hidden', isHidden ? 'false' : 'true');
    }
    if (action === 'load-item') {
      const item = state.items.find((i) => i.id === event.target.dataset.id);
      if (item) fillForm(item);
    }
    if (action === 'check-all') {
      state.items.forEach((item) => {
        item.checked = true;
        item.checkedAt = Date.now();
      });
      saveItems();
      renderList();
    }
    if (action === 'remove-checked') {
      state.items = state.items.filter((item) => !item.checked);
      saveItems();
      buildHistory();
      renderList();
    }
  });
}

if (els.historyList) {
  els.historyList.addEventListener('change', (event) => {
    const id = event.target.dataset.historyId;
    if (!id) return;
    const item = state.items.find((i) => i.id === id);
    if (item) {
      item.checked = event.target.checked;
      item.checkedAt = event.target.checked ? Date.now() : null;
      saveItems();
      renderList();
    }
  });
}

els.registerForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const name = els.itemName.value.trim();
  if (!name) return;
  const specs = readSpecs();
  const existing = state.editId ? state.items.find((item) => item.id === state.editId) : null;
  const newItem = {
    id: state.editId || crypto.randomUUID(),
    name,
    qty: Number(els.itemQty.value || 1),
    unit: els.itemUnit ? els.itemUnit.value : '',
    specs,
    place: els.itemPlace.value.trim(),
    dueDate: els.itemDueDate.value,
    dueTime: els.itemDueTime.value,
    priority: els.registerForm.querySelector('[name="priority"]')?.value || '',
    url: els.itemUrl.value.trim(),
    createdAt: Date.now(),
    checked: false,
    checkedAt: null,
    images: state.editId ? (existing?.images || []) : registerImages,
  };

  if (state.editId) {
    state.items = state.items.map((item) => (item.id === state.editId ? { ...item, ...newItem } : item));
  } else {
    state.items.unshift(newItem);
  }

  saveItems();
  buildHistory();
  renderList();
  resetForm();
  setAccordionState(els.registerAccordion, false);
  setAccordionState(els.listAccordion, true);
});

els.segments.forEach((segment) => {
  segment.addEventListener('click', () => {
    if (segment.dataset.scope) {
      document.querySelectorAll('[data-scope]').forEach((btn) => btn.classList.remove('is-active'));
      segment.classList.add('is-active');
      state.filterScope = segment.dataset.scope;
    }
    if (segment.dataset.sort) {
      document.querySelectorAll('[data-sort]').forEach((btn) => btn.classList.remove('is-active'));
      segment.classList.add('is-active');
      state.sortMode = segment.dataset.sort;
    }
    renderList();
  });
});

if (els.sortBy) {
  els.sortBy.addEventListener('change', (event) => {
    state.sortBy = event.target.value;
    renderList();
  });
}

if (els.placeFilter) {
  els.placeFilter.addEventListener('change', (event) => {
    state.placeFilter = event.target.value;
    renderList();
  });
}


els.listContainer.addEventListener('click', (event) => {
  const action = event.target.dataset.action;
  if (action === 'open-detail') {
    const item = state.items.find((i) => i.id === event.target.dataset.id);
    if (item) openDialog(item);
  }
  if (action === 'edit-place') {
    const header = event.target.closest('.group-header');
    const input = header?.querySelector('.group-edit-input');
    if (!input) return;
    const isEditing = header.classList.toggle('is-editing');
    if (isEditing) {
      input.focus();
      input.select();
      event.target.textContent = '保存';
      event.target.classList.remove('icon-lines');
      return;
    }
    const oldPlace = input.dataset.place || '';
    const currentLabel = oldPlace || '未設定';
    const trimmed = input.value.trim();
    const newPlace = trimmed === '未設定' ? '' : trimmed;
    state.items = state.items.map((item) => {
      if ((item.place || '未設定') === currentLabel) {
        return { ...item, place: newPlace };
      }
      return item;
    });
    saveItems();
    buildHistory();
    renderList();
  }
  if (action === 'check-group') {
    const place = event.target.dataset.place || '未設定';
    const now = Date.now();
    const targets = state.items.filter((item) => (item.place || '未設定') === place);
    recordUndoEntry({
      type: 'check-bulk',
      items: targets.map((item) => ({
        id: item.id,
        checked: item.checked,
        checkedAt: item.checkedAt,
      })),
    });
    targets.forEach((item) => {
      item.checked = true;
      item.checkedAt = now;
    });
    saveItems();
    renderList();
  }
  if (action === 'check-all-global') {
    const now = Date.now();
    recordUndoEntry({
      type: 'check-bulk',
      items: state.items.map((item) => ({
        id: item.id,
        checked: item.checked,
        checkedAt: item.checkedAt,
      })),
    });
    state.items.forEach((item) => {
      item.checked = true;
      item.checkedAt = now;
    });
    saveItems();
    renderList();
  }
  if (action === 'clear-checked') {
    state.items = state.items.filter((item) => !item.checked);
    saveItems();
    buildHistory();
    renderList();
  }
});

els.listContainer.addEventListener('change', (event) => {
  if (event.target.dataset.action === 'toggle') {
    const item = state.items.find((i) => i.id === event.target.dataset.id);
    if (!item) return;
    recordUndoEntry({
      type: 'check',
      id: item.id,
      checked: item.checked,
      checkedAt: item.checkedAt,
    });
    item.checked = event.target.checked;
    item.checkedAt = event.target.checked ? Date.now() : null;
    saveItems();
    renderList();
  }
});

els.itemDialog.addEventListener('click', (event) => {
  const action = event.target.dataset.action;
  const itemId = els.itemDialog.dataset.itemId;
  const item = state.items.find((i) => i.id === itemId);
  if (!item) return;
  if (action === 'edit-item') {
    const editing = els.itemDialog.dataset.editing === 'true';
    if (!editing) {
      els.itemDialog.dataset.editing = 'true';
      renderDialogEdit(item);
      event.target.textContent = '保存';
      event.target.classList.remove('icon-lines');
      const deleteBtn = els.itemDialog.querySelector('[data-action="delete-item"]');
      if (deleteBtn) deleteBtn.textContent = 'キャンセル';
      if (els.dialogTitleInput) els.dialogTitleInput.readOnly = false;
      return;
    }
    const name = els.dialogTitleInput?.value || item.name || '';
    const qty = Number(els.itemDialog.querySelector('[name="editQty"]')?.value || 1);
    const specNames = Array.from(els.itemDialog.querySelectorAll('[name="editSpecName"]'));
    const specTexts = Array.from(els.itemDialog.querySelectorAll('[name="editSpecText"]'));
    const specUnits = Array.from(els.itemDialog.querySelectorAll('[name="editSpecUnit"]'));
    const specs = specNames.map((input, index) => {
      const name = input.value.trim();
      const text = specTexts[index]?.value.trim() || '';
      const unit = specUnits[index]?.value || '';
      return { name, text, unit };
    }).filter((spec) => spec.name || spec.text);
    const place = els.itemDialog.querySelector('[name="editPlace"]')?.value || '';
    const dueDate = els.itemDialog.querySelector('[name="editDueDate"]')?.value || '';
    const dueTime = els.itemDialog.querySelector('[name="editDueTime"]')?.value || '';
    const priority = els.itemDialog.querySelector('[name="editPriority"]')?.value || 'mid';
    const url = els.itemDialog.querySelector('[name="editUrl"]')?.value || '';
    const updated = { ...item, name: name.trim(), qty, specs, place: place.trim(), dueDate, dueTime, priority, url: url.trim() };
    state.items = state.items.map((i) => (i.id === itemId ? updated : i));
    saveItems();
    buildHistory();
    renderList();
    els.itemDialog.dataset.editing = 'false';
    const editBtn = els.itemDialog.querySelector('[data-action="edit-item"]');
    if (editBtn) {
      editBtn.innerHTML = '<span></span>';
      editBtn.classList.add('icon-lines');
    }
    const deleteBtn = els.itemDialog.querySelector('[data-action="delete-item"]');
    if (deleteBtn) deleteBtn.textContent = '削除';
    if (els.dialogTitleInput) els.dialogTitleInput.readOnly = true;
    openDialog(updated);
  }
  if (action === 'delete-item') {
    const editing = els.itemDialog.dataset.editing === 'true';
    if (editing) {
      els.itemDialog.dataset.editing = 'false';
      const editBtn = els.itemDialog.querySelector('[data-action="edit-item"]');
      if (editBtn) {
        editBtn.innerHTML = '<span></span>';
        editBtn.classList.add('icon-lines');
      }
      const deleteBtn = els.itemDialog.querySelector('[data-action="delete-item"]');
      if (deleteBtn) deleteBtn.textContent = '削除';
      if (els.dialogTitleInput) {
        els.dialogTitleInput.readOnly = true;
      }
      openDialog(item);
      return;
    }
    state.items = state.items.filter((i) => i.id !== itemId);
    saveItems();
    buildHistory();
    renderList();
    els.itemDialog.close();
  }
  if (action === 'remove-image') {
    const index = Number(event.target.dataset.index);
    const images = item.images || [];
    if (!Number.isNaN(index)) {
      item.images = images.filter((_, i) => i !== index);
      saveItems();
      buildHistory();
      renderList();
      const editing = els.itemDialog.dataset.editing === 'true';
      if (editing) {
        renderDialogEdit(item);
        const editBtn = els.itemDialog.querySelector('[data-action="edit-item"]');
        if (editBtn) {
          editBtn.textContent = '保存';
          editBtn.classList.remove('icon-lines');
        }
        const deleteBtn = els.itemDialog.querySelector('[data-action="delete-item"]');
        if (deleteBtn) deleteBtn.textContent = 'キャンセル';
        if (els.dialogTitleInput) els.dialogTitleInput.readOnly = false;
      } else {
        openDialog(item);
      }
    }
  }
});

init();
