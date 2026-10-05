(function () {
  'use strict';

  const model = window.StajPilotSongs;
  const STORAGE_KEY = 'stajpilot-song-editor-draft-v1';
  const $ = (id) => document.getElementById(id);
  const elements = {
    list: $('bank-list'), search: $('bank-search'), count: $('song-count'),
    selectedBank: $('selected-bank'), songName: $('song-name'),
    slotRows: $('slot-rows'), status: $('save-status'), undo: $('undo-button'),
    dialog: $('action-dialog'), dialogTitle: $('dialog-title'),
    dialogMessage: $('dialog-message'), dialogError: $('dialog-error'),
    targetLabel: $('target-label'), targetBank: $('target-bank'),
    dialogConfirm: $('dialog-confirm'), importFile: $('import-file'),
  };

  let banks = model.emptyBanks();
  let selectedBank = 1;
  let filter = 'all';
  let undoStack = [];
  let lastExported = null;
  let storageAvailable = true;
  let pendingAction = null;
  let activeEdit = null;

  function documentText(list = banks) {
    return JSON.stringify(model.exportDocument(list));
  }

  function countSongs(list = banks) {
    return list.filter(model.isPopulated).length;
  }

  function cloneSong(song) {
    return { ...song, slots: song.slots.map((slot) => ({ ...slot })) };
  }

  function loadDraft() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      banks = model.parseDocument(saved.document);
      selectedBank = Number.isInteger(saved.selectedBank) &&
        saved.selectedBank >= 1 && saved.selectedBank <= model.BANK_COUNT
        ? saved.selectedBank : 1;
      lastExported = typeof saved.lastExported === 'string' ? saved.lastExported : null;
    } catch (error) {
      storageAvailable = false;
      console.warn('Song draft could not be restored:', error);
    }
  }

  function persist() {
    if (!storageAvailable) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        document: model.exportDocument(banks), selectedBank, lastExported,
      }));
    } catch (error) {
      storageAvailable = false;
      console.warn('Song draft could not be saved:', error);
    }
  }

  function updateStatus() {
    const unexported = countSongs() > 0 && documentText() !== lastExported;
    elements.status.classList.toggle('warning', unexported || !storageAvailable);
    elements.status.textContent = !storageAvailable
      ? 'Browser draft unavailable - export a JSON backup'
      : unexported
        ? 'Unexported edits - saved in this browser'
        : 'Browser draft saved';
    elements.count.textContent = `${countSongs()} / ${model.BANK_COUNT} banks`;
    elements.undo.disabled = undoStack.length === 0;
  }

  function pushUndo() {
    undoStack.push({ document: model.exportDocument(banks), selectedBank });
    if (undoStack.length > 40) undoStack.shift();
    elements.undo.disabled = false;
  }

  function captureEdit(input) {
    if (activeEdit === input) return;
    pushUndo();
    activeEdit = input;
  }

  function afterChange() {
    persist();
    updateStatus();
    renderBankList();
  }

  function renderBankList() {
    const query = elements.search.value.trim().toLocaleLowerCase();
    const fragment = document.createDocumentFragment();
    for (let index = 0; index < model.BANK_COUNT; index++) {
      const bank = index + 1;
      const song = banks[index];
      if (filter === 'filled' && !model.isPopulated(song)) continue;
      const title = song?.songName || (song ? 'Untitled song' : 'Empty bank');
      if (query && !String(bank).includes(query) &&
          !title.toLocaleLowerCase().includes(query)) continue;

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'bank-item';
      button.setAttribute('role', 'option');
      button.setAttribute('aria-selected', String(bank === selectedBank));
      button.tabIndex = bank === selectedBank ? 0 : -1;
      button.dataset.bank = String(bank);
      const number = document.createElement('span');
      number.className = 'bank-number';
      number.textContent = String(bank).padStart(3, '0');
      const name = document.createElement('span');
      name.className = `bank-title${song ? '' : ' empty'}`;
      name.textContent = title;
      button.append(number, name);
      fragment.append(button);
    }
    elements.list.replaceChildren(fragment);
    if (!elements.list.children.length) {
      const empty = document.createElement('p');
      empty.className = 'bank-empty-search';
      empty.textContent = 'No matching banks';
      elements.list.append(empty);
    }
  }

  function renderEditor() {
    const song = banks[selectedBank - 1] || model.emptySong(selectedBank);
    elements.selectedBank.textContent = String(selectedBank).padStart(3, '0');
    elements.songName.value = song.songName;
    const fragment = document.createDocumentFragment();
    song.slots.forEach((slot, index) => {
      const row = document.createElement('div');
      row.className = 'slot-row';
      const number = document.createElement('span');
      number.className = 'slot-number';
      number.textContent = String(index + 1).padStart(2, '0');
      row.append(number);
      for (const [field, type] of [['name', 'text'], ['subName', 'text'], ['ampImage', 'number']]) {
        const label = document.createElement('label');
        const input = document.createElement('input');
        input.type = type;
        input.dataset.slot = String(index);
        input.dataset.field = field;
        input.setAttribute('aria-label', `Slot ${index + 1} ${field === 'subName' ? 'sub name' : field === 'ampImage' ? 'amp image' : 'name'}`);
        if (type === 'number') {
          input.min = '1';
          input.max = '100';
          input.step = '1';
          input.inputMode = 'numeric';
        } else {
          input.maxLength = 200;
          input.autocomplete = 'off';
          input.placeholder = field === 'name' ? 'Name' : 'Sub name';
        }
        input.value = String(slot[field]);
        label.append(input);
        row.append(label);
      }
      fragment.append(row);
    });
    elements.slotRows.replaceChildren(fragment);
    $('move-button').disabled = !model.isPopulated(song);
    $('duplicate-button').disabled = !model.isPopulated(song);
    $('clear-button').disabled = !model.isPopulated(song);
  }

  function selectBank(bank) {
    activeEdit = null;
    selectedBank = bank;
    renderEditor();
    renderBankList();
    persist();
  }

  function editField(field, value, slotIndex = null) {
    const song = banks[selectedBank - 1]
      ? cloneSong(banks[selectedBank - 1])
      : model.emptySong(selectedBank);
    if (slotIndex === null) song.songName = value;
    else song.slots[slotIndex][field] = value;
    banks[selectedBank - 1] = model.isPopulated(song) ? song : null;
    afterChange();
    const populated = model.isPopulated(banks[selectedBank - 1]);
    $('move-button').disabled = !populated;
    $('duplicate-button').disabled = !populated;
    $('clear-button').disabled = !populated;
  }

  function download(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2) + '\n'], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  function exportSongs() {
    const date = new Date().toISOString().slice(0, 10);
    download(model.exportDocument(banks), `StajPilot_Songs_${date}.json`);
    lastExported = documentText();
    persist();
    updateStatus();
  }

  function showDialog(action, title, message, confirmLabel, withTarget = false) {
    pendingAction = action;
    elements.dialogTitle.textContent = title;
    elements.dialogMessage.textContent = message;
    elements.dialogConfirm.textContent = confirmLabel;
    elements.dialogError.hidden = true;
    elements.targetLabel.hidden = !withTarget;
    elements.targetBank.hidden = !withTarget;
    elements.targetBank.value = '';
    elements.dialog.showModal();
    if (withTarget) elements.targetBank.focus();
  }

  function dialogError(message) {
    elements.dialogError.textContent = message;
    elements.dialogError.hidden = false;
  }

  async function readImport(file) {
    if (!file) return;
    if (file.size > 2_000_000) {
      showDialog(null, 'Import failed', 'The JSON file is too large.', 'Close');
      return;
    }
    try {
      const incoming = model.parseDocument(JSON.parse(await file.text()));
      showDialog({ kind: 'import', incoming }, 'Replace song library?',
        `${countSongs(incoming)} songs found. This replaces all 125 banks. Your current library will be downloaded as a backup first.`, 'Back up and replace');
    } catch (error) {
      showDialog(null, 'Import failed', error.message, 'Close');
    }
  }

  function confirmAction() {
    if (!pendingAction) {
      elements.dialog.close();
      return;
    }
    const action = pendingAction;
    const target = Number(elements.targetBank.value);
    if (action.kind === 'move' || action.kind === 'duplicate') {
      if (!Number.isInteger(target) || target < 1 || target > model.BANK_COUNT || target === selectedBank) {
        dialogError('Choose a different bank between 1 and 125.');
        return;
      }
    }

    if (action.kind === 'import' || action.kind === 'clearAll') {
      if (countSongs()) {
        const date = new Date().toISOString().slice(0, 10);
        download(model.exportDocument(banks), `StajPilot_Songs_Backup_${date}.json`);
      }
      pushUndo();
      banks = action.kind === 'import' ? action.incoming : model.emptyBanks();
      selectedBank = action.kind === 'import'
        ? banks.findIndex(model.isPopulated) + 1 || 1 : 1;
      lastExported = action.kind === 'import' ? documentText() : null;
    } else if (action.kind === 'move') {
      pushUndo();
      banks = model.moveBank(banks, selectedBank, target);
      selectedBank = target;
    } else if (action.kind === 'duplicate') {
      if (banks[target - 1]) {
        dialogError(`Bank ${target} already has a song. Choose an empty bank.`);
        return;
      }
      pushUndo();
      banks[target - 1] = cloneSong({ ...banks[selectedBank - 1], bank: target });
      selectedBank = target;
    } else if (action.kind === 'clear') {
      pushUndo();
      banks[selectedBank - 1] = null;
    }
    pendingAction = null;
    elements.dialog.close();
    renderEditor();
    afterChange();
  }

  function undo() {
    const previous = undoStack.pop();
    if (!previous) return;
    activeEdit = null;
    banks = model.parseDocument(previous.document);
    selectedBank = previous.selectedBank;
    renderEditor();
    afterChange();
  }

  elements.list.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-bank]');
    if (button) {
      selectBank(Number(button.dataset.bank));
      elements.list.querySelector(`button[data-bank="${selectedBank}"]`)?.focus();
    }
  });
  elements.list.addEventListener('keydown', (event) => {
    const options = [...elements.list.querySelectorAll('button[data-bank]')];
    const current = options.findIndex((option) => Number(option.dataset.bank) === selectedBank);
    const next = event.key === 'ArrowDown' ? Math.min(current + 1, options.length - 1)
      : event.key === 'ArrowUp' ? Math.max(current - 1, 0)
        : event.key === 'Home' ? 0
          : event.key === 'End' ? options.length - 1 : -1;
    if (next < 0 || !options[next]) return;
    event.preventDefault();
    selectBank(Number(options[next].dataset.bank));
    elements.list.querySelector(`button[data-bank="${selectedBank}"]`)?.focus();
  });
  elements.search.addEventListener('input', renderBankList);
  elements.search.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowDown') return;
    const first = elements.list.querySelector('button[data-bank]');
    if (!first) return;
    event.preventDefault();
    selectBank(Number(first.dataset.bank));
    elements.list.querySelector(`button[data-bank="${selectedBank}"]`)?.focus();
  });
  for (const [id, value] of [['filter-all', 'all'], ['filter-filled', 'filled']]) {
    $(id).addEventListener('click', () => {
      filter = value;
      for (const [buttonId, buttonValue] of [['filter-all', 'all'], ['filter-filled', 'filled']]) {
        $(buttonId).classList.toggle('active', buttonValue === filter);
        $(buttonId).setAttribute('aria-pressed', String(buttonValue === filter));
      }
      renderBankList();
    });
  }
  $('new-button').addEventListener('click', () => {
    let index = banks.findIndex((song, i) => i >= selectedBank - 1 && !song);
    if (index < 0) index = banks.findIndex((song) => !song);
    if (index < 0) {
      showDialog(null, 'Library full', 'All 125 banks are occupied.', 'Close');
      return;
    }
    selectBank(index + 1);
    elements.songName.focus();
  });
  $('clear-all-button').addEventListener('click', () => showDialog({ kind: 'clearAll' },
    'Create a new library?', 'The current library will be downloaded as a backup before all banks are cleared.', 'Back up and clear'));
  $('import-button').addEventListener('click', () => elements.importFile.click());
  elements.importFile.addEventListener('change', () => {
    readImport(elements.importFile.files[0]);
    elements.importFile.value = '';
  });
  $('export-button').addEventListener('click', exportSongs);
  elements.undo.addEventListener('click', undo);
  $('move-button').addEventListener('click', () => showDialog({ kind: 'move' },
    'Move song', 'Songs between the two banks will shift by one position.', 'Move', true));
  $('duplicate-button').addEventListener('click', () => showDialog({ kind: 'duplicate' },
    'Duplicate song', 'Choose an empty destination bank.', 'Duplicate', true));
  $('clear-button').addEventListener('click', () => showDialog({ kind: 'clear' },
    'Clear this bank?', `Bank ${selectedBank} will become empty. You can undo this action.`, 'Clear bank'));
  $('dialog-cancel').addEventListener('click', () => elements.dialog.close());
  elements.dialogConfirm.addEventListener('click', confirmAction);
  elements.dialog.addEventListener('close', () => { pendingAction = null; });

  $('song-name').addEventListener('input', () => {
    captureEdit(elements.songName);
    editField('songName', elements.songName.value);
  });
  $('song-name').addEventListener('blur', () => { activeEdit = null; });
  elements.slotRows.addEventListener('focusout', (event) => {
    if (activeEdit === event.target) activeEdit = null;
  });
  elements.slotRows.addEventListener('input', (event) => {
    const input = event.target;
    if (input.matches('input[type="text"]')) {
      captureEdit(input);
      editField(input.dataset.field, input.value, Number(input.dataset.slot));
    }
  });
  elements.slotRows.addEventListener('change', (event) => {
    const input = event.target;
    if (!input.matches('input[type="number"]')) return;
    const value = Number(input.value);
    if (!Number.isInteger(value) || value < 1 || value > 100) {
      input.value = String((banks[selectedBank - 1] || model.emptySong(selectedBank))
        .slots[Number(input.dataset.slot)].ampImage);
      return;
    }
    captureEdit(input);
    editField('ampImage', value, Number(input.dataset.slot));
  });
  window.addEventListener('beforeunload', (event) => {
    if (countSongs() && documentText() !== lastExported) event.preventDefault();
  });
  document.addEventListener('dragover', (event) => {
    if (event.dataTransfer && Array.from(event.dataTransfer.types).includes('Files')) {
      event.preventDefault();
    }
  });
  document.addEventListener('drop', (event) => {
    if (!event.dataTransfer?.files.length) return;
    event.preventDefault();
    readImport(event.dataTransfer.files[0]);
  });

  loadDraft();
  renderEditor();
  renderBankList();
  updateStatus();
})();
