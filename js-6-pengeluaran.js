/* ==========================================================================
   MODUL 7: PENGELUARAN OPERASIONAL
   ========================================================================== */
function renderExpenses() {
    const tbody = document.querySelector('#table-expenses tbody');
    tbody.innerHTML = '';
    
    const categories = [...new Set(db.expenses.map(e => e.category))].sort();
    const catSelect = document.getElementById('filter-expense-category');
    catSelect.innerHTML = '<option value="">Semua Kategori</option>';
    categories.forEach(c => catSelect.innerHTML += `<option value="${escapeHTML(c)}">${escapeHTML(c)}</option>`);
    
    let totalEx = 0;
    const sorted = [...db.expenses].sort((a,b) => new Date(b.date) - new Date(a.date));
    
    sorted.forEach(e => {
        totalEx += e.amount;
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${formatDate(e.date)}</td>
            <td><span class="badge badge-secondary">${escapeHTML(e.category)}</span></td>
            <td>${escapeHTML(e.desc)}</td>
            <td>${escapeHTML(e.vendor)}</td>
            <td class="text-danger text-bold">${formatRp(e.amount)}</td>
            <td>
                <button class="btn btn-sm btn-outline-secondary" onclick="editExpense('${e.id}')">Edit</button>
                <button class="btn btn-sm btn-danger ml-10" onclick="deleteExpense('${e.id}')">&times;</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
    document.getElementById('expense-total-display').textContent = formatRp(totalEx);
}

document.getElementById('filter-expense').addEventListener('input', applyExpenseFilter);
document.getElementById('filter-expense-category').addEventListener('change', applyExpenseFilter);

function applyExpenseFilter() {
    const term = document.getElementById('filter-expense').value.toLowerCase();
    const cat = document.getElementById('filter-expense-category').value;
    const rows = document.querySelectorAll('#table-expenses tbody tr');
    let filteredTotal = 0;
    
    rows.forEach(row => {
        const text = row.children[2].textContent.toLowerCase() + " " + row.children[3].textContent.toLowerCase();
        const rowCat = row.children[1].textContent;
        const amountStr = row.children[4].textContent.replace(/[^0-9]/g, '');
        
        const matchText = text.includes(term);
        const matchCat = cat === '' || rowCat === cat;
        
        if (matchText && matchCat) {
            row.style.display = '';
            filteredTotal += parseInt(amountStr) || 0;
        } else {
            row.style.display = 'none';
        }
    });
    document.getElementById('expense-total-display').textContent = formatRp(filteredTotal);
}

document.getElementById('btn-add-expense').addEventListener('click', () => {
    document.getElementById('form-expense').reset();
    document.getElementById('exp-id').value = '';
    document.getElementById('exp-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('expense-form-title').textContent = 'Catat Pengeluaran Baru';
    openModal('modal-expense-form');
});

document.getElementById('form-expense').addEventListener('submit', async (e) => {
    e.preventDefault();
    const expAmount = parseRpInput(document.getElementById('exp-amount').value);
    if (expAmount <= 0) {
        showToast('Nominal pengeluaran harus lebih dari Rp. 0!', 'warning');
        return;
    }

    const data = {
        date: document.getElementById('exp-date').value,
        category: document.getElementById('exp-category').value,
        desc: document.getElementById('exp-desc').value.trim(),
        vendor: document.getElementById('exp-vendor').value.trim(),
        amount: expAmount,
        method: document.getElementById('exp-method').value,
        ref: "",
        notes: ""
    };
    
    const id = document.getElementById('exp-id').value;
    if (id) {
        data.id = id;
        const index = db.expenses.findIndex(x => x.id === id);
        
        // UPDATE: Tambahkan error handling
        const { error } = await supabaseClient.from('expenses').upsert([data]);
        if (error) {
            showToast('Gagal memperbarui pengeluaran: ' + error.message, 'danger');
            return;
        }

        db.expenses[index] = data;
        showToast('Data pengeluaran diperbarui.');
    } else {
        data.id = generateId('EXP');
        
        // UPDATE: Tambahkan error handling
        const { error } = await supabaseClient.from('expenses').insert([data]);
        if (error) {
            showToast('Gagal mencatat pengeluaran: ' + error.message, 'danger');
            return;
        }

        db.expenses.push(data);
        showToast('Pengeluaran berhasil dicatat.');
    }
    
    closeModal('modal-expense-form');
    refreshAll();
});

window.editExpense = function(id) {
    const e = db.expenses.find(x => x.id === id);
    if(!e) return;
    document.getElementById('exp-id').value = e.id;
    document.getElementById('exp-date').value = e.date;
    document.getElementById('exp-category').value = e.category;
    document.getElementById('exp-desc').value = e.desc;
    document.getElementById('exp-vendor').value = e.vendor;
    document.getElementById('exp-amount').value = formatRpInput(e.amount);
    document.getElementById('exp-method').value = e.method;
    
    document.getElementById('expense-form-title').textContent = 'Edit Pengeluaran';
    openModal('modal-expense-form');
}

window.deleteExpense = async function(id) {
    confirmAction('Hapus Pengeluaran', 'Hapus pengeluaran ini dari cloud?', async () => {
        // UPDATE: Tambahkan error handling
        const { error } = await supabaseClient.from('expenses').delete().eq('id', id);
        if (error) {
            showToast('Gagal menghapus pengeluaran: ' + error.message, 'danger');
            return;
        }

        db.expenses = db.expenses.filter(e => e.id !== id);
        showToast('Pengeluaran dihapus.');
        refreshAll();
    });
}
