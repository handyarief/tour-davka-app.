/* ==========================================================================
   MODUL 5: MANAJEMEN BIAYA & ALOKASI BIAYA
   ========================================================================== */
function renderCostsMaster() {
    renderCategoryTags();
}

function renderCategoryTags() {
    const container = document.getElementById('cost-category-tags');
    container.innerHTML = '';
    db.categories.forEach(cat => {
        const tag = document.createElement('div');
        tag.className = 'tag';
        tag.innerHTML = `
            ${escapeHTML(cat)} 
            <button type="button" class="tag-btn-del" onclick="deleteCategory('${escapeHTML(cat)}')">&times;</button>
        `;
        container.appendChild(tag);
    });
    
    const optHtml = db.categories.map(c => `<option value="${escapeHTML(c)}">${escapeHTML(c)}</option>`).join('');
    document.getElementById('cost-shared-category').innerHTML = optHtml;
}

document.getElementById('form-add-category').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('new-category-name');
    const val = input.value.trim();
    if(val && !db.categories.includes(val)) {
        // UPDATE: Tambahkan error handling
        const { error } = await supabaseClient.from('categories').upsert([{ name: val }]);
        if (error) {
            showToast('Gagal menambahkan kategori: ' + error.message, 'danger');
            return;
        }

        db.categories.push(val);
        input.value = '';
        renderCategoryTags();
        saveData();
    }
});

window.deleteCategory = async function(cat) {
    if(confirm(`Hapus kategori "${cat}"?`)) {
        // UPDATE: Tambahkan error handling
        const { error } = await supabaseClient.from('categories').delete().eq('name', cat);
        if (error) {
            showToast('Gagal menghapus kategori: ' + error.message, 'danger');
            return;
        }

        db.categories = db.categories.filter(c => c !== cat);
        renderCategoryTags();
        saveData();
    }
}

document.getElementById('btn-open-cost-individual').addEventListener('click', () => prepareIndividualCostForm(null));

function prepareIndividualCostForm(preselectedId) {
    document.getElementById('form-cost-ind').reset();
    document.getElementById('cost-ind-id').value = '';
    
    const familySelect = document.getElementById('cost-ind-family');
    const partSelect = document.getElementById('cost-ind-participant');
    const dynamicContainer = document.getElementById('cost-ind-dynamic-container');
    
    familySelect.innerHTML = '<option value="">-- Pilih Keluarga --</option>';
    partSelect.innerHTML = '<option value="">-- Pilih Peserta --</option>';
    partSelect.disabled = true;
    
    const activeParticipants = db.participants.filter(p => p.status === 'Aktif');
    const families = [...new Set(activeParticipants.map(p => p.family))].sort();
    
    families.forEach(f => {
        familySelect.innerHTML += `<option value="${escapeHTML(f)}">${escapeHTML(f)}</option>`;
    });

    dynamicContainer.innerHTML = '';
    addCostRow(); 
    calculateIndTotal();
    
    if (preselectedId) {
        const p = activeParticipants.find(x => x.id === preselectedId);
        if (p) {
            familySelect.value = p.family;
            familySelect.dispatchEvent(new Event('change')); 
            partSelect.value = preselectedId;
        }
    }
    openModal('modal-cost-individual');
}

document.getElementById('cost-ind-family').addEventListener('change', function(e) {
    const family = e.target.value;
    const partSelect = document.getElementById('cost-ind-participant');
    partSelect.innerHTML = '<option value="">-- Pilih Peserta --</option>';
    
    if (family) {
        const members = db.participants.filter(p => p.family === family && p.status === 'Aktif')
                                       .sort((a,b) => a.name.localeCompare(b.name));
        members.forEach(m => {
            partSelect.innerHTML += `<option value="${m.id}">${escapeHTML(m.name)}</option>`;
        });
        partSelect.disabled = false;
    } else {
        partSelect.disabled = true;
    }
});

function addCostRow() {
    const container = document.getElementById('cost-ind-dynamic-container');
    const rowId = 'row-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
    
    let catOptions = '';
    db.categories.forEach(c => {
        catOptions += `<option value="${escapeHTML(c)}">${escapeHTML(c)}</option>`;
    });

    const rowHTML = `
        <div class="dynamic-row cost-dynamic-row" id="${rowId}">
            <div class="form-group">
                <label>Kategori Biaya</label>
                <select class="form-control cost-ind-cat-input" required>
                    ${catOptions}
                </select>
            </div>
            <div class="form-group col-price">
                <label>Harga (Rp)</label>
                <input type="text" inputmode="numeric" class="form-control cost-ind-price-input rp-input" required placeholder="Rp. 0" autocomplete="off">
            </div>
            <div class="form-group col-action">
                <button type="button" class="btn btn-outline-danger btn-sm w-100" onclick="removeCostRow('${rowId}')">&times; Hapus</button>
            </div>
        </div>
    `;
    container.insertAdjacentHTML('beforeend', rowHTML);
    
    const newInputs = container.querySelectorAll(`#${rowId} .cost-ind-price-input`);
    newInputs.forEach(inp => {
        inp.addEventListener('input', calculateIndTotal);
    });
}

document.getElementById('btn-add-cost-row').addEventListener('click', addCostRow);

window.removeCostRow = function(rowId) {
    const row = document.getElementById(rowId);
    if(row) row.remove();
    calculateIndTotal();
}

function calculateIndTotal() {
    let sum = 0;
    const inputs = document.querySelectorAll('#cost-ind-dynamic-container .cost-ind-price-input');
    inputs.forEach(inp => {
        sum += parseRpInput(inp.value);
    });
    document.getElementById('cost-ind-total-sum').textContent = formatRp(sum);
}

document.getElementById('form-cost-ind').addEventListener('submit', async (e) => {
    e.preventDefault();
    const familyVal = document.getElementById('cost-ind-family').value;
    const pId = document.getElementById('cost-ind-participant').value;
    
    if(!familyVal || !pId) {
        showToast('Silakan pilih Keluarga dan Peserta terlebih dahulu!', 'warning');
        return;
    }
    
    const rows = document.querySelectorAll('#cost-ind-dynamic-container .dynamic-row');
    if(rows.length === 0) {
        showToast('Minimal harus ada 1 kategori biaya!', 'danger');
        return;
    }
    
    let newCosts = [];
    rows.forEach(row => {
        const catEl = row.querySelector('.cost-ind-cat-input');
        const priceEl = row.querySelector('.cost-ind-price-input');
        if (!catEl || !priceEl) return;

        const cat = catEl.value;
        const price = parseRpInput(priceEl.value);
        
        if (cat && price > 0) {
            newCosts.push({
                id: generateId('CST'),
                participantId: pId,
                category: cat,
                price: price,
                qty: 1, 
                total: price,
                notes: "" 
            });
        }
    });
    
    if (newCosts.length > 0) {
        const { error } = await supabaseClient.from('costs').insert(newCosts);
        if (error) {
            showToast('Gagal menyimpan biaya ke Supabase: ' + error.message, 'danger');
            return;
        }
        db.costs.push(...newCosts);
        showToast(`Berhasil menambahkan ${newCosts.length} rincian biaya ke cloud.`);
        closeModal('modal-cost-individual');
        refreshAll();
    }
});

/* --------------------------------------------------------------------------
   INPUT BIAYA KELUARGA (MULTI-PESERTA DALAM 1 KELUARGA)
   -------------------------------------------------------------------------- */
let selectedFamilyCostParticipants = [];

const btnOpenCostFamily = document.getElementById('btn-open-cost-family');
if (btnOpenCostFamily) {
    btnOpenCostFamily.addEventListener('click', () => prepareFamilyCostForm());
}

function prepareFamilyCostForm() {
    document.getElementById('form-cost-fam').reset();
    selectedFamilyCostParticipants = [];

    const familySelect = document.getElementById('cost-fam-family');
    const partSelect = document.getElementById('cost-fam-participant');
    const dynamicContainer = document.getElementById('cost-fam-dynamic-container');

    familySelect.innerHTML = '<option value="">-- Pilih Keluarga --</option>';
    partSelect.innerHTML = '<option value="">-- Pilih Peserta --</option>';
    partSelect.disabled = true;

    const activeParticipants = db.participants.filter(p => p.status === 'Aktif');
    const families = [...new Set(activeParticipants.map(p => p.family))].sort();

    families.forEach(f => {
        familySelect.innerHTML += `<option value="${escapeHTML(f)}">${escapeHTML(f)}</option>`;
    });

    renderSelectedFamilyCostParticipants();
    dynamicContainer.innerHTML = '';
    addFamilyCostRow();
    calculateFamCostTotal();

    openModal('modal-cost-family');
}

document.getElementById('cost-fam-family').addEventListener('change', function(e) {
    const family = e.target.value;
    selectedFamilyCostParticipants = [];
    populateFamilyCostParticipantDropdown(family);
    renderSelectedFamilyCostParticipants();
    calculateFamCostTotal();
});

function populateFamilyCostParticipantDropdown(family) {
    const partSelect = document.getElementById('cost-fam-participant');
    partSelect.innerHTML = '<option value="">-- Pilih Peserta --</option>';

    if (family) {
        const members = db.participants
            .filter(p => p.family === family && p.status === 'Aktif')
            .sort((a, b) => a.name.localeCompare(b.name, 'id', { sensitivity: 'base' }));

        const unselectedMembers = members.filter(m => !selectedFamilyCostParticipants.includes(m.id));

        if (unselectedMembers.length > 1) {
            partSelect.innerHTML += `<option value="__ALL__">-- Pilih Semua Anggota (${unselectedMembers.length} Orang) --</option>`;
        }

        unselectedMembers.forEach(m => {
            partSelect.innerHTML += `<option value="${m.id}">${escapeHTML(m.name)}</option>`;
        });

        partSelect.disabled = unselectedMembers.length === 0;
        if (unselectedMembers.length === 0 && members.length > 0) {
            partSelect.innerHTML = '<option value="">-- Semua anggota telah dipilih --</option>';
        }
    } else {
        partSelect.disabled = true;
    }
}

document.getElementById('cost-fam-participant').addEventListener('change', function(e) {
    const val = e.target.value;
    const family = document.getElementById('cost-fam-family').value;
    if (!val || !family) return;

    if (val === '__ALL__') {
        const members = db.participants
            .filter(p => p.family === family && p.status === 'Aktif')
            .sort((a, b) => a.name.localeCompare(b.name, 'id', { sensitivity: 'base' }));
        members.forEach(m => {
            if (!selectedFamilyCostParticipants.includes(m.id)) {
                selectedFamilyCostParticipants.push(m.id);
            }
        });
    } else {
        if (!selectedFamilyCostParticipants.includes(val)) {
            selectedFamilyCostParticipants.push(val);
        }
    }

    populateFamilyCostParticipantDropdown(family);
    renderSelectedFamilyCostParticipants();
    calculateFamCostTotal();
});

function renderSelectedFamilyCostParticipants() {
    const container = document.getElementById('cost-fam-selected-list');
    if (!container) return;
    container.innerHTML = '';

    selectedFamilyCostParticipants.forEach(pId => {
        const p = db.participants.find(x => x.id === pId);
        if (p) {
            const tag = document.createElement('div');
            tag.className = 'tag';
            tag.innerHTML = `
                ${escapeHTML(p.name)}
                <button type="button" class="tag-btn-del" onclick="removeSelectedFamilyParticipant('${p.id}')">&times;</button>
            `;
            container.appendChild(tag);
        }
    });
}

window.removeSelectedFamilyParticipant = function(pId) {
    selectedFamilyCostParticipants = selectedFamilyCostParticipants.filter(id => id !== pId);
    const family = document.getElementById('cost-fam-family').value;
    populateFamilyCostParticipantDropdown(family);
    renderSelectedFamilyCostParticipants();
    calculateFamCostTotal();
};

function addFamilyCostRow() {
    const container = document.getElementById('cost-fam-dynamic-container');
    const rowId = 'fam-row-' + Date.now() + '-' + Math.floor(Math.random() * 1000);

    let catOptions = '';
    db.categories.forEach(c => {
        catOptions += `<option value="${escapeHTML(c)}">${escapeHTML(c)}</option>`;
    });

    const rowHTML = `
        <div class="dynamic-row cost-dynamic-row" id="${rowId}">
            <div class="form-group">
                <label>Kategori Biaya</label>
                <select class="form-control cost-fam-cat-input" required>
                    ${catOptions}
                </select>
            </div>
            <div class="form-group col-price">
                <label>Harga (Rp)</label>
                <input type="text" inputmode="numeric" class="form-control cost-fam-price-input rp-input" required placeholder="Rp. 0" autocomplete="off">
            </div>
            <div class="form-group col-action">
                <button type="button" class="btn btn-outline-danger btn-sm w-100" onclick="removeFamilyCostRow('${rowId}')">&times; Hapus</button>
            </div>
        </div>
    `;
    container.insertAdjacentHTML('beforeend', rowHTML);

    const newInputs = container.querySelectorAll(`#${rowId} .cost-fam-price-input`);
    newInputs.forEach(inp => {
        inp.addEventListener('input', calculateFamCostTotal);
    });
}

document.getElementById('btn-add-cost-fam-row').addEventListener('click', addFamilyCostRow);

window.removeFamilyCostRow = function(rowId) {
    const row = document.getElementById(rowId);
    if (row) row.remove();
    calculateFamCostTotal();
};

function calculateFamCostTotal() {
    let sumPerPerson = 0;
    const inputs = document.querySelectorAll('#cost-fam-dynamic-container .cost-fam-price-input');
    inputs.forEach(inp => {
        sumPerPerson += parseRpInput(inp.value);
    });

    const count = selectedFamilyCostParticipants.length;
    const totalEl = document.getElementById('cost-fam-total-sum');
    if (count > 1) {
        totalEl.textContent = `${formatRp(sumPerPerson * count)} (${count} Peserta x ${formatRp(sumPerPerson)})`;
    } else {
        totalEl.textContent = formatRp(sumPerPerson);
    }
}

document.getElementById('form-cost-fam').addEventListener('submit', async (e) => {
    e.preventDefault();
    const familyVal = document.getElementById('cost-fam-family').value;

    if (!familyVal || selectedFamilyCostParticipants.length === 0) {
        showToast('Silakan pilih Keluarga dan minimal 1 Peserta terlebih dahulu!', 'warning');
        return;
    }

    const rows = document.querySelectorAll('#cost-fam-dynamic-container .dynamic-row');
    if (rows.length === 0) {
        showToast('Minimal harus ada 1 kategori biaya!', 'danger');
        return;
    }

    let costItems = [];
    rows.forEach(row => {
        const catEl = row.querySelector('.cost-fam-cat-input');
        const priceEl = row.querySelector('.cost-fam-price-input');
        if (!catEl || !priceEl) return;

        const cat = catEl.value;
        const price = parseRpInput(priceEl.value);

        if (cat && price > 0) {
            costItems.push({ category: cat, price: price });
        }
    });

    if (costItems.length === 0) {
        showToast('Silakan isi harga biaya dengan benar!', 'warning');
        return;
    }

    let newCosts = [];
    selectedFamilyCostParticipants.forEach(pId => {
        costItems.forEach(item => {
            newCosts.push({
                id: generateId('CST'),
                participantId: pId,
                category: item.category,
                price: item.price,
                qty: 1,
                total: item.price,
                notes: ""
            });
        });
    });

    if (newCosts.length > 0) {
        const { error } = await supabaseClient.from('costs').insert(newCosts);
        if (error) {
            showToast('Gagal menyimpan biaya keluarga ke Supabase: ' + error.message, 'danger');
            return;
        }
        db.costs.push(...newCosts);
        showToast(`Berhasil menambahkan biaya ke ${selectedFamilyCostParticipants.length} anggota keluarga.`);
        closeModal('modal-cost-family');
        refreshAll();
    }
});

window.deleteCost = async function(id, isFromDetail = false) {
    confirmAction('Hapus Biaya', 'Hapus komponen tagihan ini dari peserta?', async () => {
        // UPDATE: Tambahkan error handling
        const { error } = await supabaseClient.from('costs').delete().eq('id', id);
        if (error) {
            showToast('Gagal menghapus biaya dari cloud: ' + error.message, 'danger');
            return;
        }

        db.costs = db.costs.filter(c => c.id !== id);
        showToast('Biaya berhasil dihapus.');
        refreshAll();
    });
}

document.getElementById('btn-open-cost-shared').addEventListener('click', () => {
    document.getElementById('form-cost-shared').reset();
    document.getElementById('cost-shared-search').value = '';
    document.getElementById('shared-allocated-sum').textContent = 'Rp0';
    document.getElementById('shared-diff-alert').style.display = 'none';
    
    renderSharedParticipantTable();
    openModal('modal-cost-shared');
});

function renderSharedParticipantTable() {
    const tbody = document.querySelector('#table-shared-participants tbody');
    tbody.innerHTML = '';
    const active = db.participants.filter(p => p.status === 'Aktif');
    
    active.forEach(p => {
        const tr = document.createElement('tr');
        tr.style.display = 'none';
        tr.innerHTML = `
            <td><input type="checkbox" class="chk-shared" data-id="${p.id}" value="${p.id}"></td>
            <td>${escapeHTML(p.name)}</td>
            <td>${escapeHTML(p.family)}</td>
            <td><input type="text" inputmode="numeric" class="form-control input-sm shared-input rp-input" data-id="${p.id}" value="Rp. 0" readonly autocomplete="off"></td>
        `;
        tbody.appendChild(tr);
    });
    
    document.getElementById('chk-all-shared').checked = false;
    attachSharedEvents();
}

function attachSharedEvents() {
    document.getElementById('chk-all-shared').addEventListener('change', (e) => {
        const isChecked = e.target.checked;
        const visibleRows = document.querySelectorAll('#table-shared-participants tbody tr:not([style*="display: none"]) .chk-shared');
        visibleRows.forEach(chk => { chk.checked = isChecked; });
        calculateSharedSplit();
    });
    
    document.querySelectorAll('.chk-shared').forEach(chk => {
        chk.addEventListener('change', calculateSharedSplit);
    });
    
    document.getElementById('cost-shared-total').addEventListener('input', calculateSharedSplit);
    
    document.getElementById('cost-shared-method').addEventListener('change', (e) => {
        const isManual = e.target.value === 'manual';
        document.querySelectorAll('.shared-input').forEach(input => {
            input.readOnly = !isManual;
        });
        calculateSharedSplit();
    });
    
    document.querySelectorAll('.shared-input').forEach(input => {
        input.addEventListener('input', calculateSharedManualSum);
    });
    
    document.getElementById('cost-shared-search').addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase().trim();
        const rows = document.querySelectorAll('#table-shared-participants tbody tr');
        rows.forEach(row => {
            const checkbox = row.querySelector('.chk-shared');
            const isChecked = checkbox && checkbox.checked;
            const text = row.children[1].textContent.toLowerCase() + " " + row.children[2].textContent.toLowerCase();
            
            if (isChecked) {
                row.style.display = ''; 
            } else if (term === '') {
                row.style.display = 'none'; 
            } else {
                row.style.display = text.includes(term) ? '' : 'none';
            }
        });
    });
}

function calculateSharedSplit() {
    const method = document.getElementById('cost-shared-method').value;
    if(method === 'manual') {
        calculateSharedManualSum();
        return;
    }
    
    const totalInput = parseRpInput(document.getElementById('cost-shared-total').value);
    const checkedBoxes = Array.from(document.querySelectorAll('.chk-shared:checked'));
    const count = checkedBoxes.length;
    
    document.querySelectorAll('.shared-input').forEach(i => i.value = 'Rp. 0');
    
    if (count > 0 && totalInput > 0) {
        const base = Math.floor(totalInput / count);
        const remainder = totalInput % count;
        
        checkedBoxes.forEach((chk, idx) => {
            const input = document.querySelector(`.shared-input[data-id="${chk.value}"]`);
            const shareVal = base + (idx < remainder ? 1 : 0);
            input.value = formatRpInput(shareVal, true);
        });
    }
    calculateSharedManualSum();
}

function calculateSharedManualSum() {
    let sum = 0;
    document.querySelectorAll('.chk-shared').forEach(chk => {
        const input = document.querySelector(`.shared-input[data-id="${chk.value}"]`);
        if (chk.checked) {
            sum += parseRpInput(input.value);
        } else {
            input.value = 'Rp. 0'; 
        }
    });
    
    document.getElementById('shared-allocated-sum').textContent = formatRp(sum);
    const targetTotal = parseRpInput(document.getElementById('cost-shared-total').value);
    const alertBox = document.getElementById('shared-diff-alert');
    
    if (sum !== targetTotal && targetTotal > 0) {
        alertBox.style.display = 'block';
        alertBox.textContent = `Selisih: ${formatRp(Math.abs(targetTotal - sum))} (Harus pas!)`;
    } else {
        alertBox.style.display = 'none';
    }
}

document.getElementById('form-cost-shared').addEventListener('submit', async (e) => {
    e.preventDefault();
    const targetTotal = parseRpInput(document.getElementById('cost-shared-total').value);
    let sum = 0;
    const allocs = [];
    
    document.querySelectorAll('.chk-shared:checked').forEach(chk => {
        const input = document.querySelector(`.shared-input[data-id="${chk.value}"]`);
        const val = parseRpInput(input.value);
        if (val > 0) {
            sum += val;
            allocs.push({ pId: chk.value, amount: val });
        }
    });
    
    if (allocs.length === 0 || sum !== targetTotal) {
        showToast('Total alokasi harus pas dengan Total Biaya!', 'danger');
        return;
    }
    
    const cat = document.getElementById('cost-shared-category').value;
    let newCosts = allocs.map(a => ({
        id: generateId('CST'),
        participantId: a.pId,
        category: cat,
        price: a.amount,
        qty: 1,
        total: a.amount,
        notes: 'Biaya Bersama'
    }));

    // UPDATE: Tambahkan error handling
    const { error } = await supabaseClient.from('costs').insert(newCosts);
    if (error) {
        showToast('Gagal membagi dan menyimpan biaya: ' + error.message, 'danger');
        return;
    }

    db.costs.push(...newCosts);
    showToast(`Berhasil membagi biaya ke ${allocs.length} peserta.`);
    closeModal('modal-cost-shared');
    refreshAll();
});
