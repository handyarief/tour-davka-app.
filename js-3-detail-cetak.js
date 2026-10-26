/* ==========================================================================
   MODUL 4: DETAIL PESERTA & CETAK RINGKASAN (JPEG)
   ========================================================================== */
let currentDetailId = null;

window.openParticipantDetail = function(id) {
    currentDetailId = id;
    document.querySelectorAll('.view-section').forEach(v => v.classList.remove('active'));
    document.getElementById('view-participant-detail').classList.add('active');
    document.getElementById('page-title').textContent = 'Detail Peserta';
    
    document.querySelectorAll('.nav-link').forEach(nav => nav.classList.remove('active'));
    
    // REVISI 1: Manfaatkan History PushState agar mendukung tombol BACK pada Handphone
    history.pushState({ view: 'detail', id: id }, '', '#detail');
    
    renderDetailParticipant(id);
}

// REVISI 1: Event listener tombol back pada browser / hardware Android back button
window.addEventListener('popstate', (e) => {
    if (currentDetailId !== null) {
        currentDetailId = null;
        document.getElementById('view-participant-detail').classList.remove('active');
        document.getElementById('view-participants').classList.add('active');
        document.querySelector('[data-target="view-participants"]').classList.add('active');
        document.getElementById('page-title').textContent = 'Peserta & Keluarga';
    }
});

function renderDetailParticipant(id) {
    if(!id) return;
    const p = db.participants.find(x => x.id === id);
    if(!p) return;

    const stats = calcParticipantStats(id);

    document.getElementById('detail-part-name').textContent = p.name;
    document.getElementById('detail-part-family').textContent = p.family;
    document.getElementById('detail-part-id').textContent = p.id;
    
    const badge = document.getElementById('detail-part-status-badge');
    badge.textContent = stats.status;
    badge.className = `badge ${stats.badgeClass}`;

    document.getElementById('detail-total-tagihan').textContent = formatRp(stats.totalTagihan);
    document.getElementById('detail-total-dibayar').textContent = formatRp(stats.totalDibayar);
    
    if (stats.kelebihan > 0) {
        document.getElementById('detail-sisa-tagihan').textContent = `+${formatRp(stats.kelebihan)} (Lebih)`;
        document.getElementById('detail-sisa-tagihan').className = 'stat-value text-info';
    } else {
        document.getElementById('detail-sisa-tagihan').textContent = formatRp(stats.sisa);
        document.getElementById('detail-sisa-tagihan').className = 'stat-value text-danger';
    }

    const tbodyCosts = document.querySelector('#table-detail-costs tbody');
    tbodyCosts.innerHTML = '';
    const pCosts = db.costs.filter(c => c.participantId === id);
    pCosts.forEach(c => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${escapeHTML(c.category)}</td>
            <td>${formatRp(c.price)}</td>
            <td>${c.qty}</td>
            <td><strong>${formatRp(c.total)}</strong></td>
            <td>${escapeHTML(c.notes || '-')}</td>
            <td>
                <button class="btn btn-sm btn-outline-secondary" onclick="openEditCostModal('${c.id}')">Edit</button>
                <button class="btn btn-sm btn-danger ml-5" onclick="deleteCost('${c.id}', true)">&times;</button>
            </td>
        `;
        tbodyCosts.appendChild(tr);
    });
    document.getElementById('detail-sum-costs').textContent = formatRp(stats.totalTagihan);

    const tbodyPays = document.querySelector('#table-detail-payments tbody');
    tbodyPays.innerHTML = '';
    let hasPayment = false;
    db.payments.forEach(pay => {
        if(pay.allocations) {
            const alloc = pay.allocations.find(a => a.participantId === id);
            if(alloc) {
                hasPayment = true;
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${formatDate(pay.date)}</td>
                    <td class="text-success text-bold">${formatRp(alloc.amount)}</td>
                    <td>${escapeHTML(pay.method)}</td>
                    <td>${escapeHTML(pay.notes || '-')}</td>
                `;
                tbodyPays.appendChild(tr);
            }
        }
    });
    if(!hasPayment) tbodyPays.innerHTML = '<tr><td colspan="4" class="text-center">Belum ada riwayat pembayaran.</td></tr>';
}

window.openEditCostModal = function(costId) {
    const cost = db.costs.find(c => c.id === costId);
    if(!cost) return;

    const catSelect = document.getElementById('edit-cost-cat');
    catSelect.innerHTML = '';
    db.categories.forEach(cat => {
        catSelect.innerHTML += `<option value="${escapeHTML(cat)}">${escapeHTML(cat)}</option>`;
    });

    document.getElementById('edit-cost-id').value = cost.id;
    document.getElementById('edit-cost-cat').value = cost.category;
    document.getElementById('edit-cost-price').value = cost.price;
    document.getElementById('edit-cost-notes').value = cost.notes || '';

    openModal('modal-edit-cost');
};

document.getElementById('form-edit-cost').addEventListener('submit', async (e) => {
    e.preventDefault();
    const costId = document.getElementById('edit-cost-id').value;
    const newCat = document.getElementById('edit-cost-cat').value;
    const newPrice = parseFloat(document.getElementById('edit-cost-price').value) || 0;
    const newNotes = document.getElementById('edit-cost-notes').value.trim();

    const costIndex = db.costs.findIndex(c => c.id === costId);
    if(costIndex > -1) {
        const updatedCost = {
            ...db.costs[costIndex],
            category: newCat,
            price: newPrice,
            total: newPrice * (db.costs[costIndex].qty || 1),
            notes: newNotes
        };

        const { error } = await supabaseClient.from('costs').upsert([updatedCost]);
        if (error) {
            showToast('Gagal memperbarui rincian biaya: ' + error.message, 'danger');
            return;
        }

        db.costs[costIndex] = updatedCost;
        showToast('Rincian biaya berhasil diperbarui.');
        closeModal('modal-edit-cost');
        refreshAll();
    }
});

document.getElementById('btn-add-cost-from-detail').addEventListener('click', () => {
    prepareIndividualCostForm(currentDetailId);
});

const getPrintStyles = () => `
    <style>
        .print-wrap { width: 800px; margin: 0 auto; padding: 20px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #ffffff; color: #334155; box-sizing: border-box; }
        .print-header { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 10px; margin-bottom: 15px; }
        .print-header h2 { margin: 0; color: #0f172a; font-size: 20px; text-transform: uppercase; }
        .print-header p { margin: 5px 0 0; font-size: 14px; color: #64748b; }
        .print-info { width: 100%; margin-bottom: 15px; font-size: 14px; }
        .print-info td { padding: 4px 0; }
        .print-table { width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 12px; }
        .print-table th, .print-table td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; }
        .print-table th { background-color: #f1f5f9; font-weight: bold; color: #0f172a; }
        .print-table tr:nth-child(even) { background-color: #f8fafc; }
        .text-right { text-align: right !important; }
        .text-center { text-align: center !important; }
        .text-success { color: #16a34a; font-weight: bold; }
        .text-danger { color: #dc2626; font-weight: bold; }
        .text-info { color: #0284c7; font-weight: bold; }
        .text-bold { font-weight: bold; }
        .print-summary { background: #f8fafc; padding: 15px; border: 1px solid #cbd5e1; border-radius: 8px; }
        .print-summary p { margin: 5px 0; font-size: 14px; }
        .print-footer { margin-top: 20px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px dashed #cbd5e1; padding-top: 10px; }
    </style>
`;

document.getElementById('btn-print-individual').addEventListener('click', () => {
    const p = db.participants.find(x => x.id === currentDetailId);
    const stats = calcParticipantStats(p.id);
    const pCosts = db.costs.filter(c => c.participantId === p.id);
    
    let html = getPrintStyles() + `<div class="print-wrap">`;
    html += `
        <div class="print-header">
            <h2>RINGKASAN PEMBAYARAN</h2>
            <p>TOUR DAVKA TRAVEL</p>
        </div>
        <table class="print-info">
            <tr><td style="width: 120px;"><strong>Nama Peserta</strong></td><td>: ${escapeHTML(p.name)}</td></tr>
            <tr><td><strong>Keluarga/Grup</strong></td><td>: ${escapeHTML(p.family)}</td></tr>
            <tr><td><strong>Status</strong></td><td>: <strong>${stats.status}</strong></td></tr>
        </table>
        
        <div class="text-bold" style="margin-bottom: 5px; font-size:14px;">A. Rincian Biaya</div>
        <table class="print-table">
            <thead>
                <tr>
                    <th>Deskripsi Kategori</th>
                    <th class="text-right">Total Biaya (Rp)</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    if(pCosts.length === 0) {
        html += `<tr><td colspan="2" class="text-center text-muted">Belum ada tagihan biaya</td></tr>`;
    } else {
        pCosts.forEach(c => {
            let noteStr = c.notes ? `<br><small style="color:#64748b;">${escapeHTML(c.notes)}</small>` : '';
            html += `<tr>
                <td>${escapeHTML(c.category)} ${c.qty > 1 ? `(${c.qty}x)` : ''}${noteStr}</td>
                <td class="text-right">${formatRp(c.total)}</td>
            </tr>`;
        });
    }
    
    html += `</tbody></table>`;
    html += `<div class="text-bold" style="margin-bottom: 5px; font-size:14px;">B. Riwayat Pembayaran</div>
        <table class="print-table">
            <thead>
                <tr>
                    <th>Tanggal</th>
                    <th class="text-right">Nominal (Rp)</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    let payCount = 0;
    db.payments.forEach(pay => {
        if(pay.allocations) {
            const alloc = pay.allocations.find(a => a.participantId === p.id);
            if(alloc) {
                html += `<tr>
                    <td>${formatDate(pay.date)}</td>
                    <td class="text-right text-success">${formatRp(alloc.amount)}</td>
                </tr>`;
                payCount++;
            }
        }
    });
    if(payCount === 0) html += `<tr><td colspan="2" class="text-center text-muted">Belum ada riwayat pembayaran</td></tr>`;
    html += `</tbody></table>`;
    
    html += `
        <div class="print-summary">
            <p>Total Tagihan: <span style="float:right;">${formatRp(stats.totalTagihan)}</span></p>
            <p>Total Dibayar: <span style="float:right;" class="text-success">${formatRp(stats.totalDibayar)}</span></p>
            <hr style="border:0; border-top:1px solid #cbd5e1; margin:10px 0;">
    `;
    
    if(stats.kelebihan > 0) {
        html += `<p class="text-bold">Kelebihan Bayar: <span style="float:right;" class="text-info">${formatRp(stats.kelebihan)}</span></p>`;
    } else {
        html += `<p class="text-bold">Sisa Harus Dibayar: <span style="float:right;" class="text-danger">${formatRp(stats.sisa)}</span></p>`;
    }
    
    html += `</div>
        <div class="print-footer">Dicetak otomatis oleh Sistem Manajemen Davka Travel</div>
    </div>`;

    document.getElementById('ringkasan-print-area').innerHTML = html;
    openModal('modal-ringkasan');
});

document.getElementById('btn-print-family').addEventListener('click', () => {
    const p = db.participants.find(x => x.id === currentDetailId);
    const fStats = calcFamilyStats(p.family);
    
    let html = getPrintStyles() + `<div class="print-wrap">`;
    html += `
        <div class="print-header">
            <h2>RINGKASAN KELUARGA</h2>
            <p>TOUR DAVKA TRAVEL</p>
        </div>
        <table class="print-info">
            <tr><td style="width: 150px;"><strong>Nama Keluarga/Grup</strong></td><td>: ${escapeHTML(p.family)}</td></tr>
            <tr><td><strong>Jumlah Anggota</strong></td><td>: ${fStats.members.length} Orang</td></tr>
        </table>
        
        <table class="print-table">
            <thead>
                <tr>
                    <th>No</th>
                    <th>Nama Peserta</th>
                    <th class="text-right">Tagihan</th>
                    <th class="text-right">Dibayar</th>
                    <th class="text-right">Sisa/Lebih</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    fStats.members.forEach((m, idx) => {
        const stats = calcParticipantStats(m.id);
        let sisaStr = stats.kelebihan > 0 ? `<span class="text-info">+${formatRp(stats.kelebihan)}</span>` : `<span class="text-danger">${formatRp(stats.sisa)}</span>`;
        html += `<tr>
            <td class="text-center">${idx+1}</td>
            <td><strong>${escapeHTML(m.name)}</strong><br><small style="color:#64748b;">${stats.status}</small></td>
            <td class="text-right">${formatRp(stats.totalTagihan)}</td>
            <td class="text-right text-success">${formatRp(stats.totalDibayar)}</td>
            <td class="text-right">${sisaStr}</td>
        </tr>`;
    });
    
    html += `</tbody></table>`;
    html += `
        <div class="print-summary" style="margin-top:20px;">
            <p><strong>TOTAL KELUARGA:</strong></p>
            <p>Total Tagihan: <span style="float:right;">${formatRp(fStats.totalTagihan)}</span></p>
            <p>Total Dibayar: <span style="float:right;" class="text-success">${formatRp(fStats.totalDibayar)}</span></p>
            <hr style="border:0; border-top:1px solid #cbd5e1; margin:10px 0;">
    `;
    
    if(fStats.kelebihan > 0) {
        html += `<p class="text-bold" style="font-size:16px;">Total Kelebihan: <span style="float:right;" class="text-info">${formatRp(fStats.kelebihan)}</span></p>`;
    } else {
        html += `<p class="text-bold" style="font-size:16px;">TOTAL SISA DIBAYAR: <span style="float:right;" class="text-danger">${formatRp(fStats.sisa)}</span></p>`;
    }
    
    html += `</div>
        <div class="print-footer">Dicetak otomatis oleh Sistem Manajemen Davka Travel</div>
    </div>`;

    document.getElementById('ringkasan-print-area').innerHTML = html;
    openModal('modal-ringkasan');
});

// REVISI 3: Render JPEG kini presisi, utuh, tanpa terpotong
document.getElementById('btn-download-jpeg').addEventListener('click', async () => {
    const btn = document.getElementById('btn-download-jpeg');
    const printArea = document.getElementById('ringkasan-print-area');
    const targetEl = printArea.querySelector('.print-wrap') || printArea;

    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Memproses...';

    try {
        if (typeof html2canvas === 'function') {
            const canvas = await html2canvas(targetEl, {
                scale: 2,
                backgroundColor: '#ffffff',
                useCORS: true,
                logging: false,
                onclone: (clonedDoc) => {
                    const clonedWrap = clonedDoc.querySelector('.print-wrap');
                    if (clonedWrap) {
                        clonedWrap.style.width = '800px';
                        clonedWrap.style.margin = '0';
                        clonedWrap.style.transform = 'none'; // Proteksi menghindari efek skala aneh
                    }
                }
            });

            const jpegUrl = canvas.toDataURL('image/jpeg', 0.95);
            const link = document.createElement('a');
            link.download = `Ringkasan_Pembayaran_${Date.now()}.jpg`;
            link.href = jpegUrl;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            showToast('Berhasil mengunduh gambar JPEG!');
        } else {
            throw new Error('Library html2canvas belum siap.');
        }
    } catch (err) {
        console.error('Download JPEG Error:', err);
        showToast('Gagal memproses gambar.', 'danger');
    } finally {
        btn.disabled = false;
        btn.textContent = originalText;
    }
});
