/* ==========================================================================
   MODUL 6: PEMBAYARAN KAS & ALOKASI
   ========================================================================== */
function renderPayments() {
    const tbody = document.querySelector('#table-payments tbody');
    tbody.innerHTML = '';
    
    const sorted = [...db.payments].sort((a,b) => new Date(b.date) - new Date(a.date));
    
    sorted.forEach(pay => {
        const sumAlloc = pay.allocations ? pay.allocations.reduce((s, a) => s + a.amount, 0) : 0;
        const unalloc = pay.amount - sumAlloc;
        
        const tr = document.createElement('tr');
        if (unalloc > 0) tr.classList.add('bg-warning-light');
        
        tr.innerHTML = `
            <td>${formatDate(pay.date)}</td>
            <td><strong>${escapeHTML(pay.name)}</strong></td>
            <td class="text-success text-bold">${formatRp(pay.amount)}</td>
            <td>
                <button class="btn btn-sm btn-outline-primary" onclick="editPaymentAllocation('${pay.id}')">Edit / Alokasi</button>
                <button class="btn btn-sm btn-danger ml-10" onclick="deletePayment('${pay.id}')">Hapus</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

document.getElementById('filter-payment').addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    const rows = document.querySelectorAll('#table-payments tbody tr');
    rows.forEach(row => {
        const text = row.children[1].textContent.toLowerCase();
        row.style.display = text.includes(term) ? '' : 'none';
    });
});

document.getElementById('pay-method').addEventListener('change', function(e) {
    const bankDetails = document.getElementById('pay-bank-details');
    if (this.value === 'Tunai') {
        bankDetails.style.display = 'none';
    } else {
        bankDetails.style.display = '';
    }
});

document.getElementById('btn-add-payment').addEventListener('click', () => {
    document.getElementById('form-payment').reset();
    document.getElementById('pay-id').value = '';
    document.getElementById('pay-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('payment-form-title').textContent = 'Penerimaan Uang Baru';
    
    const families = [...new Set(db.participants.map(p => p.family))].sort();
    const selectName = document.getElementById('pay-name');
    selectName.innerHTML = '<option value="">-- Pilih Keluarga / Grup --</option>';
    families.forEach(f => {
        selectName.innerHTML += `<option value="${escapeHTML(f)}">${escapeHTML(f)}</option>`;
    });

    const selectFilterFamily = document.getElementById('pay-filter-family');
    selectFilterFamily.innerHTML = '<option value="none">None</option>';
    selectFilterFamily.innerHTML += '<option value="">Semua Keluarga</option>';
    families.forEach(f => {
        selectFilterFamily.innerHTML += `<option value="${escapeHTML(f)}">${escapeHTML(f)}</option>`;
    });
    selectFilterFamily.value = 'none';

    document.getElementById('pay-method').dispatchEvent(new Event('change'));
    renderPaymentAllocTable();
    updatePaymentSummary();
    openModal('modal-payment-form');
});

document.getElementById('pay-filter-family').addEventListener('change', (e) => {
    const term = e.target.value;
    const rows = document.querySelectorAll('#table-pay-allocation tbody tr');
    rows.forEach(row => {
        const checkbox = row.querySelector('.chk-alloc');
        const isChecked = checkbox && checkbox.checked;
        const rowFamily = row.getAttribute('data-family');
        
        if (isChecked) {
            row.style.display = ''; 
        } else if (term === 'none') {
            row.style.display = 'none';
        } else if (term === '') {
            row.style.display = '';
        } else {
            row.style.display = (rowFamily === term) ? '' : 'none';
        }
    });
});

function renderPaymentAllocTable(existingAllocations = []) {
    const tbody = document.querySelector('#table-pay-allocation tbody');
    tbody.innerHTML = '';
    
    const active = db.participants.filter(p => p.status === 'Aktif');
    const filterVal = document.getElementById('pay-filter-family').value;
    
    active.forEach(p => {
        const stats = calcParticipantStats(p.id);
        const existing = existingAllocations.find(a => a.participantId === p.id);
        const allocVal = existing ? existing.amount : 0;
        const isChecked = allocVal > 0 ? 'checked' : '';
        // Jika sedang edit transaksi yang sudah punya alokasi untuk peserta ini, tambahkan kembali allocVal ke sisa dasar agar akurat
        const baseRemaining = Math.max(0, stats.rawSisa + allocVal);
        
        const tr = document.createElement('tr');
        tr.setAttribute('data-family', p.family);
        
        if (allocVal > 0) {
            tr.style.display = ''; 
        } else if (filterVal === 'none') {
            tr.style.display = 'none';
        } else if (filterVal === '') {
            tr.style.display = '';
        } else {
            tr.style.display = (p.family === filterVal) ? '' : 'none';
        }

        tr.innerHTML = `
            <td><input type="checkbox" class="chk-alloc" data-id="${p.id}" data-need="${baseRemaining}" ${isChecked}></td>
            <td>${escapeHTML(p.name)}<br><small class="text-muted">${escapeHTML(p.family)}</small></td>
            <td>${formatRp(stats.rawSisa)}</td>
            <td><input type="number" class="form-control input-sm alloc-input" data-id="${p.id}" value="${allocVal}" readonly step="1"></td>
        `;
        tbody.appendChild(tr);
    });
    attachPaymentEvents();
}

function attachPaymentEvents() {
    document.getElementById('pay-amount').addEventListener('input', () => {
        if(document.getElementById('pay-alloc-method').value === 'rata') calculateAllocSplit();
        updatePaymentSummary();
    });
    
    document.getElementById('chk-all-alloc').addEventListener('change', (e) => {
        const isChecked = e.target.checked;
        const visibleRows = document.querySelectorAll('#table-pay-allocation tbody tr:not([style*="display: none"]) .chk-alloc');
        visibleRows.forEach(chk => { chk.checked = isChecked; });
        calculateAllocSplit();
    });
    
    document.querySelectorAll('.chk-alloc').forEach(chk => {
        chk.addEventListener('change', calculateAllocSplit);
    });
    
    document.getElementById('pay-alloc-method').addEventListener('change', (e) => {
        const isManual = e.target.value === 'manual';
        document.querySelectorAll('.alloc-input').forEach(input => {
            input.readOnly = !isManual;
        });
        calculateAllocSplit();
    });
    
    document.querySelectorAll('.alloc-input').forEach(input => {
        input.addEventListener('input', updatePaymentSummary);
    });
}

function calculateAllocSplit() {
    const method = document.getElementById('pay-alloc-method').value;
    if(method === 'manual') {
        updatePaymentSummary();
        return;
    }
    
    const totalReceived = parseFloat(document.getElementById('pay-amount').value) || 0;
    const checkedBoxes = Array.from(document.querySelectorAll('.chk-alloc:checked'));
    const count = checkedBoxes.length;
    
    document.querySelectorAll('.alloc-input').forEach(i => i.value = 0);
    
    if (count > 0 && totalReceived > 0) {
        // Distribusi sinkron terhadap tagihan peserta terpilih:
        // Prioritaskan menutup sisa tagihan tiap peserta secara proporsional agar tidak ada anggota keluarga
        // yang berstatus kurang bayar sementara anggota lain kelebihan bayar
        const needs = checkedBoxes.map(chk => Math.max(0, parseFloat(chk.getAttribute('data-need')) || 0));
        const totalNeed = needs.reduce((sum, val) => sum + val, 0);

        if (totalNeed > 0 && totalReceived >= totalNeed) {
            // Uang diterima cukup atau lebih dari total tagihan peserta terpilih:
            // Lunasi tagihan masing-masing peserta, lalu kelebihan bayarnya dibagi rata
            const excess = totalReceived - totalNeed;
            const baseExcess = Math.floor(excess / count);
            const remExcess = excess % count;

            checkedBoxes.forEach((chk, idx) => {
                const input = document.querySelector(`.alloc-input[data-id="${chk.getAttribute('data-id')}"]`);
                input.value = needs[idx] + baseExcess + (idx < remExcess ? 1 : 0);
            });
        } else if (totalNeed > 0 && totalReceived < totalNeed) {
            // Pembayaran cicilan kolektif: bagi proporsional sesuai porsi tagihan masing-masing
            let allocatedSoFar = 0;
            const rawShares = needs.map(n => Math.floor((n / totalNeed) * totalReceived));
            allocatedSoFar = rawShares.reduce((s, v) => s + v, 0);
            let remainder = totalReceived - allocatedSoFar;

            checkedBoxes.forEach((chk, idx) => {
                const input = document.querySelector(`.alloc-input[data-id="${chk.getAttribute('data-id')}"]`);
                const add = remainder > 0 ? 1 : 0;
                if (remainder > 0) remainder--;
                input.value = rawShares[idx] + add;
            });
        } else {
            // Jika semua peserta terpilih belum memiliki tagihan, bagi rata murni
            const base = Math.floor(totalReceived / count);
            const remainder = totalReceived % count;
            
            checkedBoxes.forEach((chk, idx) => {
                const input = document.querySelector(`.alloc-input[data-id="${chk.getAttribute('data-id')}"]`);
                input.value = base + (idx < remainder ? 1 : 0); 
            });
        }
    }
    updatePaymentSummary();
}

function updatePaymentSummary() {
    const received = parseFloat(document.getElementById('pay-amount').value) || 0;
    let allocated = 0;
    
    document.querySelectorAll('.chk-alloc').forEach(chk => {
        const input = document.querySelector(`.alloc-input[data-id="${chk.getAttribute('data-id')}"]`);
        if (chk.checked) {
            allocated += parseFloat(input.value) || 0;
        } else {
            input.value = 0;
        }
    });
    
    const unallocated = received - allocated;
    document.getElementById('summary-pay-received').textContent = formatRp(received);
    document.getElementById('summary-pay-allocated').textContent = formatRp(allocated);
    
    const unallocElem = document.getElementById('summary-pay-unallocated');
    unallocElem.textContent = formatRp(unallocated);
    unallocElem.className = unallocated === 0 ? 'text-success text-bold' : (unallocated > 0 ? 'text-warning text-bold' : 'text-danger text-bold');
    
    const errorBox = document.getElementById('pay-alloc-error');
    if (unallocated < 0) errorBox.style.display = 'block';
    else errorBox.style.display = 'none';
}

document.getElementById('form-payment').addEventListener('submit', async (e) => {
    e.preventDefault();
    const received = parseFloat(document.getElementById('pay-amount').value) || 0;
    const allocMethod = document.getElementById('pay-alloc-method').value || 'manual';
    
    let allocatedSum = 0;
    const allocs = [];
    document.querySelectorAll('.chk-alloc:checked').forEach(chk => {
        const pId = chk.getAttribute('data-id');
        const val = parseFloat(document.querySelector(`.alloc-input[data-id="${pId}"]`).value) || 0;
        if (val > 0) {
            allocatedSum += val;
            allocs.push({
                participantId: pId,
                amount: val,
                allocMethod: allocMethod
            });
        }
    });
    
    if (allocatedSum > received) {
        showToast('Total alokasi melebihi uang diterima!', 'danger');
        return;
    }
    
    const data = {
        date: document.getElementById('pay-date').value,
        name: document.getElementById('pay-name').value.trim(),
        amount: received,
        method: document.getElementById('pay-method').value,
        ref: document.getElementById('pay-bank-name') ? document.getElementById('pay-bank-name').value.trim() : "",
        notes: document.getElementById('pay-bank-acc') ? document.getElementById('pay-bank-acc').value.trim() : "",
        allocations: allocs
    };
    
    const id = document.getElementById('pay-id').value;
    if (id) {
        data.id = id;
        const index = db.payments.findIndex(x => x.id === id);
        
        const { error } = await supabaseClient.from('payments').upsert([data]);
        if (error) {
            showToast('Gagal memperbarui transaksi: ' + error.message, 'danger');
            return;
        }

        db.payments[index] = data;
        showToast('Data pembayaran diperbarui.');
    } else {
        data.id = generateId('PAY');
        
        const { error } = await supabaseClient.from('payments').insert([data]);
        if (error) {
            showToast('Gagal mencatat transaksi kas: ' + error.message, 'danger');
            return;
        }

        db.payments.push(data);
        showToast('Penerimaan kas berhasil dicatat.');
    }
    
    closeModal('modal-payment-form');
    refreshAll();
});

window.editPaymentAllocation = function(id) {
    const pay = db.payments.find(x => x.id === id);
    if(!pay) return;
    
    const families = [...new Set(db.participants.map(p => p.family))].sort();
    const selectName = document.getElementById('pay-name');
    selectName.innerHTML = '<option value="">-- Pilih Keluarga / Grup --</option>';
    families.forEach(f => {
        selectName.innerHTML += `<option value="${escapeHTML(f)}">${escapeHTML(f)}</option>`;
    });

    const selectFilterFamily = document.getElementById('pay-filter-family');
    selectFilterFamily.innerHTML = '<option value="none">None</option>';
    selectFilterFamily.innerHTML += '<option value="">Semua Keluarga</option>';
    families.forEach(f => {
        selectFilterFamily.innerHTML += `<option value="${escapeHTML(f)}">${escapeHTML(f)}</option>`;
    });
    selectFilterFamily.value = '';

    document.getElementById('pay-id').value = pay.id;
    document.getElementById('pay-date').value = pay.date;
    document.getElementById('pay-name').value = pay.name;
    document.getElementById('pay-amount').value = pay.amount;
    document.getElementById('pay-method').value = pay.method;
    document.getElementById('pay-bank-name').value = pay.ref || '';
    document.getElementById('pay-bank-acc').value = pay.notes || '';
    document.getElementById('payment-form-title').textContent = 'Edit Transaksi & Alokasi';
    
    const savedMethod = (pay.allocations && pay.allocations.length > 0 && pay.allocations[0].allocMethod)
        ? pay.allocations[0].allocMethod
        : 'manual';
    document.getElementById('pay-alloc-method').value = savedMethod;
    document.getElementById('pay-method').dispatchEvent(new Event('change'));
    
    renderPaymentAllocTable(pay.allocations);
    const isManual = savedMethod === 'manual';
    document.querySelectorAll('.alloc-input').forEach(input => input.readOnly = !isManual);
    updatePaymentSummary();
    openModal('modal-payment-form');
}

window.deletePayment = async function(id) {
    confirmAction('Hapus Transaksi Penerimaan', 'Hapus penerimaan kas ini dari database cloud?', async () => {
        const { error } = await supabaseClient.from('payments').delete().eq('id', id);
        if (error) {
            showToast('Gagal menghapus transaksi: ' + error.message, 'danger');
            return;
        }

        db.payments = db.payments.filter(p => p.id !== id);
        showToast('Transaksi berhasil dihapus.');
        refreshAll();
    });
}
