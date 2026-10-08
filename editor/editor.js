(function () {
  'use strict';

  const model = window.StajPilotSongs;
  const fileCodec = window.StajPilotSongFile;
  const STORAGE_KEY = 'stajpilot-song-editor-draft-v1';
  const AMP_OPTIONS = [
    { id: 0, name: 'NONE', image: null },
    { id: 1, name: 'AURORA', image: 'amps/stajpilot_01_aurora.png' },
    { id: 2, name: 'FORGE', image: 'amps/stajpilot_02_forge.png' },
    { id: 3, name: 'VELVET', image: 'amps/stajpilot_03_velvet.png' },
    { id: 4, name: 'VECTOR', image: 'amps/stajpilot_04_vector.png' },
    { id: 5, name: 'ATELIER', image: 'amps/stajpilot_05_atelier_v2.png' },
  ];
  const $ = (id) => document.getElementById(id);
  const elements = {
    list: $('bank-list'), search: $('bank-search'), count: $('song-count'),
    selectedBank: $('selected-bank'), songName: $('song-name'),
    slotRows: $('slot-rows'), status: $('save-status'),
    dialog: $('action-dialog'), dialogTitle: $('dialog-title'),
    dialogMessage: $('dialog-message'), dialogError: $('dialog-error'),
    targetLabel: $('target-label'), targetBank: $('target-bank'),
    dialogCancel: $('dialog-cancel'), dialogConfirm: $('dialog-confirm'),
    importFile: $('import-file'),
    ampDialog: $('amp-dialog'), ampPosition: $('amp-dialog-position'),
    ampSourceNote: $('amp-source-note'),
    ampStrip: $('amp-strip'), ampSelectedName: $('amp-selected-name'),
    ampPrevious: $('amp-previous'), ampNext: $('amp-next'),
  };

  let banks = model.emptyBanks();
  let slotAmpImages = null;
  let rigAmpImages = null;
  let selectedBank = 1;
  let filter = 'all';
  let lastExported = null;
  let storageAvailable = true;
  let pendingAction = null;
  let ampPickerSlot = null;
  let ampPickerIndex = 0;
  let pickerAmpOptions = AMP_OPTIONS;
  let ampScrollFrame = null;

  function library() {
    return { banks, slotAmpImages, rigAmpImages };
  }

  function documentText() {
    return JSON.stringify(model.exportLibrary(library()));
  }

  function countSongs(list = banks) {
    return list.filter(model.isPopulated).length;
  }

  function hasLibraryData() {
    return countSongs() > 0 || slotAmpImages !== null || rigAmpImages !== null;
  }

  function cloneSong(song) {
    return { ...song, slots: song.slots.map((slot) => ({ ...slot })) };
  }

  function loadDraft() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      ({ banks, slotAmpImages, rigAmpImages } =
        model.parseLibrary(saved.document, { allowLong: true }));
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
        document: model.exportLibrary(library()), selectedBank, lastExported,
      }));
    } catch (error) {
      storageAvailable = false;
      console.warn('Song draft could not be saved:', error);
    }
  }

  function updateStatus() {
    const lengthError = model.firstLengthError(banks);
    const unexported = hasLibraryData() && documentText() !== lastExported;
    elements.status.classList.toggle('warning', Boolean(lengthError) || unexported || !storageAvailable);
    elements.status.textContent = !storageAvailable
      ? 'Browser draft unavailable - export a Song file'
      : lengthError
        ? lengthError
      : unexported
        ? 'Unexported edits - saved in this browser'
        : 'Browser draft saved';
    elements.count.textContent = `${countSongs()} / ${model.BANK_COUNT} banks`;
  }

  function afterChange() {
    persist();
    updateStatus();
    renderBankList();
  }

  function renderBankList() {
    const previousScroll = elements.list.scrollTop;
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
    elements.list.scrollTop = previousScroll;
    if (!elements.list.children.length) {
      const empty = document.createElement('p');
      empty.className = 'bank-empty-search';
      empty.textContent = 'No matching banks';
      elements.list.append(empty);
    }
  }

  function revealSelectedBank() {
    elements.list.querySelector(`button[data-bank="${selectedBank}"]`)
      ?.scrollIntoView({ block: 'nearest' });
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
      for (const field of ['name', 'subName']) {
        const label = document.createElement('label');
        const input = document.createElement('input');
        input.type = 'text';
        input.dataset.slot = String(index);
        input.dataset.field = field;
        input.setAttribute('aria-label', `Slot ${index + 1} ${field === 'subName' ? 'sub name' : 'name'}`);
        const limit = field === 'name' ? model.SLOT_NAME_LIMIT : model.SLOT_SUBNAME_LIMIT;
        input.autocomplete = 'off';
        input.placeholder = field === 'name' ? 'Name (25)' : 'Sub (13)';
        input.title = `Maximum ${limit} characters`;
        input.setAttribute('aria-invalid', String(model.graphemeLength(slot[field]) > limit));
        input.value = String(slot[field]);
        label.append(input);
        row.append(label);
      }
      const imageId = slotAmpImages?.[model.slotPosition(selectedBank, index)] || 0;
      const option = AMP_OPTIONS.find((entry) => entry.id === imageId);
      const ampButton = document.createElement('button');
      ampButton.type = 'button';
      ampButton.className = 'amp-choose';
      ampButton.dataset.ampSlot = String(index);
      ampButton.setAttribute('aria-label', `Choose amp image for bank ${selectedBank}, slot ${index + 1}`);
      if (option?.image) {
        const preview = document.createElement('img');
        preview.src = option.image;
        preview.alt = '';
        preview.loading = 'lazy';
        ampButton.append(preview);
      }
      const ampName = document.createElement('span');
      ampName.textContent = option?.name || (imageId ? `IMAGE ${imageId}` : 'NONE');
      ampButton.append(ampName);
      row.append(ampButton);
      fragment.append(row);
    });
    elements.slotRows.replaceChildren(fragment);
    $('duplicate-button').disabled = !model.isPopulated(song);
    $('clear-button').disabled = !model.isPopulated(song);
  }

  function selectBank(bank) {
    selectedBank = bank;
    renderEditor();
    renderBankList();
    revealSelectedBank();
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
    $('duplicate-button').disabled = !populated;
    $('clear-button').disabled = !populated;
  }

  function buildAmpCarousel() {
    const slides = pickerAmpOptions.map((option, index) => {
      const slide = document.createElement('div');
      slide.className = 'amp-slide';
      slide.dataset.ampIndex = String(index);
      slide.setAttribute('role', 'option');
      slide.setAttribute('aria-label', option.name);
      if (option.image) {
        const image = document.createElement('img');
        image.src = option.image;
        image.alt = option.name;
        image.loading = 'lazy';
        slide.append(image);
      } else {
        const empty = document.createElement('span');
        empty.className = 'amp-none';
        empty.textContent = option.id ? option.name : 'NO IMAGE';
        slide.append(empty);
      }
      return slide;
    });
    elements.ampStrip.replaceChildren(...slides);
  }

  function ampStep() {
    const first = elements.ampStrip.firstElementChild;
    if (!first) return 0;
    const gap = Number.parseFloat(getComputedStyle(elements.ampStrip).columnGap) || 0;
    return first.getBoundingClientRect().width + gap;
  }

  function updateAmpSelection(index) {
    ampPickerIndex = Math.max(0, Math.min(index, pickerAmpOptions.length - 1));
    const option = pickerAmpOptions[ampPickerIndex];
    elements.ampSelectedName.textContent = option.id ? `${option.id}  ${option.name}` : 'NONE';
    elements.ampPrevious.disabled = ampPickerIndex === 0;
    elements.ampNext.disabled = ampPickerIndex === pickerAmpOptions.length - 1;
    for (const [slideIndex, slide] of [...elements.ampStrip.children].entries()) {
      slide.setAttribute('aria-selected', String(slideIndex === ampPickerIndex));
    }
  }

  function scrollToAmp(index, behavior = 'smooth') {
    updateAmpSelection(index);
    elements.ampStrip.scrollTo({ left: ampPickerIndex * ampStep(), behavior });
  }

  function openAmpPicker(slotIndex) {
    ampPickerSlot = slotIndex;
    elements.ampSourceNote.hidden = slotAmpImages !== null;
    const imageId = slotAmpImages?.[model.slotPosition(selectedBank, slotIndex)] || 0;
    pickerAmpOptions = AMP_OPTIONS.some((option) => option.id === imageId)
      ? AMP_OPTIONS
      : [...AMP_OPTIONS, { id: imageId, name: `IMAGE ${imageId}`, image: null }];
    buildAmpCarousel();
    const index = pickerAmpOptions.findIndex((option) => option.id === imageId);
    elements.ampPosition.textContent = `BANK ${String(selectedBank).padStart(3, '0')} · SLOT ${slotIndex + 1}`;
    elements.ampDialog.showModal();
    requestAnimationFrame(() => scrollToAmp(index, 'auto'));
  }

  function applyAmpSelection() {
    if (ampPickerSlot === null) return;
    const position = model.slotPosition(selectedBank, ampPickerSlot);
    const nextImage = pickerAmpOptions[ampPickerIndex].id;
    const currentImage = slotAmpImages?.[position] || 0;
    if (nextImage !== currentImage) {
      if (slotAmpImages === null) slotAmpImages = {};
      if (nextImage) slotAmpImages[position] = nextImage;
      else delete slotAmpImages[position];
      renderEditor();
      afterChange();
    }
    elements.ampDialog.close();
  }

  function download(contents, filename) {
    const blob = new Blob([contents], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  function completeExport(contents) {
    const date = new Date().toISOString().slice(0, 10);
    download(contents, `StajPilot_Songs_${date}.stajpilot`);
    lastExported = documentText();
    persist();
    updateStatus();
  }

  async function exportSongs() {
    let contents;
    try {
      contents = await fileCodec.encode(model.exportLibrary(library()));
    } catch (error) {
      showDialog(null, 'Export failed', error.message, 'Close');
      return;
    }
    const lengthError = model.firstLengthError(banks);
    if (lengthError) {
      showDialog({ kind: 'export', contents }, 'Long slot text',
        `${lengthError} You can still download a backup, but this file will not match the app's input limits. ` +
        'Do not edit Song backup files manually; changes may prevent import.', 'Export backup');
      return;
    }
    showDialog({ kind: 'export', contents }, 'Export Song backup?',
      'Use this editor to make changes. Editing a backup file manually can make it impossible to import.',
      'Export backup');
  }

  function showDialog(action, title, message, confirmLabel, withTarget = false) {
    pendingAction = action;
    elements.dialogTitle.textContent = title;
    elements.dialogMessage.textContent = message;
    elements.dialogCancel.textContent = action?.kind === 'import' || action?.kind === 'clearAll'
      ? 'No' : 'Cancel';
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
      showDialog(null, 'Import failed', 'The Song file is too large.', 'Close');
      return;
    }
    try {
      const incoming = model.parseLibrary(await fileCodec.decode(await file.text()));
      const imageNote = incoming.slotAmpImages === null
        ? 'This file has no slot image assignments; the current assignments will stay.'
        : 'Slot image assignments from this file will replace the current assignments.';
      showDialog({ kind: 'import', incoming }, 'Replace song library?',
        `${countSongs(incoming.banks)} songs found. This will replace the song list in this browser. ` +
        `${imageNote} Continue?`,
        'Yes');
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
    if (action.kind === 'duplicate') {
      if (!Number.isInteger(target) || target < 1 || target > model.BANK_COUNT || target === selectedBank) {
        dialogError('Choose a different bank between 1 and 125.');
        return;
      }
    }

    if (action.kind === 'export') {
      completeExport(action.contents);
    } else if (action.kind === 'import' || action.kind === 'clearAll') {
      if (action.kind === 'import') {
        const keptExistingImages =
          (action.incoming.slotAmpImages === null && slotAmpImages !== null) ||
          (action.incoming.rigAmpImages === null && rigAmpImages !== null);
        banks = action.incoming.banks;
        slotAmpImages = action.incoming.slotAmpImages ?? slotAmpImages;
        rigAmpImages = action.incoming.rigAmpImages ?? rigAmpImages;
        lastExported = keptExistingImages ? null : documentText();
      } else {
        banks = model.emptyBanks();
        slotAmpImages = {};
        rigAmpImages = {};
        lastExported = null;
      }
      selectedBank = action.kind === 'import'
        ? banks.findIndex(model.isPopulated) + 1 || 1 : 1;
    } else if (action.kind === 'duplicate') {
      if (banks[target - 1]) {
        dialogError(`Bank ${target} already has a song. Choose an empty bank.`);
        return;
      }
      banks[target - 1] = cloneSong({ ...banks[selectedBank - 1], bank: target });
      slotAmpImages = model.copySlotImages(slotAmpImages, selectedBank, target);
      selectedBank = target;
    } else if (action.kind === 'clear') {
      banks[selectedBank - 1] = null;
      slotAmpImages = model.clearSlotImages(slotAmpImages, selectedBank);
    }
    pendingAction = null;
    elements.dialog.close();
    renderEditor();
    afterChange();
    revealSelectedBank();
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
  $('clear-all-button').addEventListener('click', () => showDialog(
    { kind: 'clearAll' }, 'Create a new library?',
    'This will clear all songs and amp image assignments in this browser. Continue?',
    'Yes'));
  $('import-button').addEventListener('click', () => elements.importFile.click());
  elements.importFile.addEventListener('change', () => {
    readImport(elements.importFile.files[0]);
    elements.importFile.value = '';
  });
  $('export-button').addEventListener('click', exportSongs);
  $('duplicate-button').addEventListener('click', () => showDialog({ kind: 'duplicate' },
    'Duplicate song', 'Choose an empty destination bank.', 'Duplicate', true));
  $('clear-button').addEventListener('click', () => showDialog({ kind: 'clear' },
    'Clear this bank?', `Bank ${selectedBank} will become empty. Continue?`, 'Clear bank'));
  $('dialog-cancel').addEventListener('click', () => elements.dialog.close());
  elements.dialogConfirm.addEventListener('click', confirmAction);
  elements.dialog.addEventListener('close', () => { pendingAction = null; });

  $('song-name').addEventListener('input', () => {
    editField('songName', elements.songName.value);
  });
  elements.slotRows.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-amp-slot]');
    if (button) openAmpPicker(Number(button.dataset.ampSlot));
  });
  elements.ampStrip.addEventListener('click', (event) => {
    const slide = event.target.closest('[data-amp-index]');
    if (slide) scrollToAmp(Number(slide.dataset.ampIndex));
  });
  elements.ampStrip.addEventListener('scroll', () => {
    if (ampScrollFrame !== null) return;
    ampScrollFrame = requestAnimationFrame(() => {
      ampScrollFrame = null;
      const step = ampStep();
      if (step) updateAmpSelection(Math.round(elements.ampStrip.scrollLeft / step));
    });
  });
  elements.ampStrip.addEventListener('wheel', (event) => {
    if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
      event.preventDefault();
      elements.ampStrip.scrollLeft += event.deltaY;
    }
  }, { passive: false });
  elements.ampPrevious.addEventListener('click', () => scrollToAmp(ampPickerIndex - 1));
  elements.ampNext.addEventListener('click', () => scrollToAmp(ampPickerIndex + 1));
  $('amp-select').addEventListener('click', applyAmpSelection);
  $('amp-cancel').addEventListener('click', () => elements.ampDialog.close());
  $('amp-dialog-close').addEventListener('click', () => elements.ampDialog.close());
  elements.ampDialog.addEventListener('close', () => { ampPickerSlot = null; });
  elements.ampDialog.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    scrollToAmp(ampPickerIndex + (event.key === 'ArrowRight' ? 1 : -1));
  });
  window.addEventListener('resize', () => {
    if (elements.ampDialog.open) scrollToAmp(ampPickerIndex, 'auto');
  });
  function commitSlotText(input) {
    if (!input.matches('input[type="text"]')) return;
    const limit = input.dataset.field === 'name'
      ? model.SLOT_NAME_LIMIT : model.SLOT_SUBNAME_LIMIT;
    const value = model.truncateGraphemes(input.value, limit);
    if (input.value !== value) input.value = value;
    input.setAttribute('aria-invalid', 'false');
    editField(input.dataset.field, value, Number(input.dataset.slot));
  }
  elements.slotRows.addEventListener('input', (event) => {
    if (!event.isComposing) commitSlotText(event.target);
  });
  elements.slotRows.addEventListener('compositionend', (event) => commitSlotText(event.target));
  window.addEventListener('beforeunload', (event) => {
    if (hasLibraryData() && documentText() !== lastExported) event.preventDefault();
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

  buildAmpCarousel();
  loadDraft();
  renderEditor();
  renderBankList();
  updateStatus();
})();
