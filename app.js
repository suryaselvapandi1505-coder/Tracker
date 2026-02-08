(function () {
  const STORAGE_KEY = 'supplierPartsTracker';

  const defaultData = () => ({
    suppliers: [
      { id: 'supplier1', name: 'Supplier 1' }
    ],
    projects: [],
    lineItems: []
  });

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultData();
      const data = JSON.parse(raw);
      if (!data.suppliers || !Array.isArray(data.suppliers)) data.suppliers = defaultData().suppliers;
      if (!data.projects) data.projects = [];
      if (!data.lineItems) data.lineItems = [];
      return data;
    } catch (_) {
      return defaultData();
    }
  }

  function save(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  function migrateProjectsToLineCounts(data) {
    var changed = false;
    data.projects.forEach(function (proj) {
      if (proj.totalLineItems === undefined || proj.received === undefined) {
        if (proj.totalLineItems === undefined) {
          var items = (data.lineItems || []).filter(function (l) { return l.projectId === proj.id; });
          proj.totalLineItems = items.length;
          proj.received = items.filter(function (l) { return l.status === 'received'; }).length;
          changed = true;
        }
        if (proj.received === undefined) { proj.received = 0; changed = true; }
        if (proj.totalLineItems === undefined) { proj.totalLineItems = 0; changed = true; }
      }
    });
    if (changed) save(data);
  }

  function id() {
    return 'id-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9);
  }

  let state = load();
  migrateProjectsToLineCounts(state);
  let currentSupplierId = null;

  const dashboard = document.getElementById('dashboard');
  const supplierDetail = document.getElementById('supplier-detail');
  const supplierCards = document.getElementById('supplier-cards');
  const projectsList = document.getElementById('projects-list');
  const supplierDetailTitle = document.getElementById('supplier-detail-title');
  const backBtn = document.getElementById('back-to-dashboard');
  const exportExcelBtn = document.getElementById('export-excel');
  const addProjectBtn = document.getElementById('add-project');
  const addProjectForm = document.getElementById('add-project-form');
  const newProjectCode = document.getElementById('new-project-code');
  const newProjectName = document.getElementById('new-project-name');
  const saveProjectBtn = document.getElementById('save-project');
  const cancelProjectBtn = document.getElementById('cancel-project');
  const addSupplierBtn = document.getElementById('add-supplier');
  const addSupplierForm = document.getElementById('add-supplier-form');
  const newSupplierName = document.getElementById('new-supplier-name');
  const saveSupplierBtn = document.getElementById('save-supplier');
  const cancelSupplierBtn = document.getElementById('cancel-supplier');
  const searchProjectsInput = document.getElementById('search-projects');
  const statusFilterSelect = document.getElementById('status-filter');

  function showDashboard() {
    dashboard.classList.remove('hidden');
    supplierDetail.classList.add('hidden');
    currentSupplierId = null;
    if (addSupplierForm) addSupplierForm.classList.add('hidden');
    renderDashboard();
  }

  function showSupplierDetail(supplierId) {
    currentSupplierId = supplierId;
    dashboard.classList.add('hidden');
    supplierDetail.classList.remove('hidden');
    addProjectForm.classList.add('hidden');
    if (addSupplierForm) addSupplierForm.classList.add('hidden');
    renderSupplierDetail();
  }

  function getSupplierTotals(supplierId) {
    const projects = getProjectsForSupplier(supplierId);
    var total = 0, received = 0;
    projects.forEach(function (p) {
      var n = Number(p.totalLineItems) || 0, r = Number(p.received) || 0;
      total += n;
      received += r;
    });
    return { total: total, received: received, pending: total - received };
  }

  function renderDashboard() {
    supplierCards.innerHTML = '';
    state.suppliers.forEach(function (s) {
      const t = getSupplierTotals(s.id);
      const receivedPct = t.total ? Math.round((t.received / t.total) * 100) : 0;
      const pendingPct = t.total ? Math.round((t.pending / t.total) * 100) : 0;

      const card = document.createElement('div');
      card.className = 'supplier-card';
      card.dataset.supplierId = s.id;
      const nameEl = document.createElement('p');
      nameEl.className = 'supplier-name';
      nameEl.textContent = s.name;
      nameEl.setAttribute('contenteditable', 'true');
      nameEl.dataset.supplierId = s.id;
      card.appendChild(nameEl);
      const statsEl = document.createElement('p');
      statsEl.className = 'supplier-card-stats';
      statsEl.innerHTML = 'Received: <span class="stat-received">' + receivedPct + '%</span> &nbsp;|&nbsp; Pending: <span class="stat-pending">' + pendingPct + '%</span>';
      card.appendChild(statsEl);
      card.addEventListener('click', function (e) {
        if (e.target === nameEl || e.target === statsEl) return;
        showSupplierDetail(s.id);
      });
      nameEl.addEventListener('click', function (e) { e.stopPropagation(); });
      statsEl.addEventListener('click', function (e) { e.stopPropagation(); });
      nameEl.addEventListener('blur', function () {
        const sup = state.suppliers.find(function (x) { return x.id === s.id; });
        if (sup) {
          sup.name = nameEl.textContent.trim() || s.name;
          save(state);
        }
      });
      nameEl.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') nameEl.blur();
      });
	const deleteSupplierBtn = document.createElement('button');
deleteSupplierBtn.textContent = 'Delete Supplier';
deleteSupplierBtn.className = 'btn btn-danger';

deleteSupplierBtn.addEventListener('click', function (e) {
  e.stopPropagation();

  if (!confirm('Delete this supplier and all projects?')) return;
	state.projects = state.projects.filter(function (p) {
    return p.supplierId !== s.id;
  });
	 state.suppliers = state.suppliers.filter(function (sup) {
    return sup.id !== s.id;
  });

  save(state);
  renderDashboard();
});

card.appendChild(deleteSupplierBtn);

      supplierCards.appendChild(card);
    });
  }

  function getSupplier(id) {
    return state.suppliers.find(function (s) { return s.id === id; });
  }

  function getProjectsForSupplier(supplierId) {
    return state.projects.filter(function (p) { return p.supplierId === supplierId; });
  }

  function renderSupplierDetail() {
    const supplier = getSupplier(currentSupplierId);
    if (!supplier) {
      showDashboard();
      return;
    }
    supplierDetailTitle.textContent = supplier.name;
    supplierDetailTitle.dataset.supplierId = supplier.id;
    supplierDetailTitle.classList.add('supplier-name-editable');
    supplierDetailTitle.setAttribute('contenteditable', 'true');

    projectsList.innerHTML = '';
    var allProjects = getProjectsForSupplier(currentSupplierId);
    var searchText = (searchProjectsInput && searchProjectsInput.value) ? searchProjectsInput.value.trim().toLowerCase() : '';
    var statusFilter = (statusFilterSelect && statusFilterSelect.value) ? statusFilterSelect.value : 'all';
    var projects = allProjects.filter(function (proj) {
      if (searchText) {
        var code = (proj.projectCode || '').toLowerCase();
        var name = (proj.projectName || '').toLowerCase();
        if (code.indexOf(searchText) === -1 && name.indexOf(searchText) === -1) return false;
      }
      if (statusFilter === 'received') {
        var r = Number(proj.received) || 0;
        if (r <= 0) return false;
      } else if (statusFilter === 'pending') {
        var tot = Number(proj.totalLineItems) || 0;
        var rec = Number(proj.received) || 0;
        if (tot - rec <= 0) return false;
      }
      return true;
    });
    if (projects.length === 0) {
      projectsList.innerHTML = '<p class="empty-state">' + (allProjects.length === 0 ? 'No projects yet. Click "Add project" to add one.' : 'No projects match your search or filter.') + '</p>';
    } else {
      projects.forEach(function (proj) {
        var total = Number(proj.totalLineItems) || 0;
        var received = Number(proj.received) || 0;
        var pending = Math.max(0, total - received);
        var receivedPct = total ? Math.round((received / total) * 100) : 0;
        var pendingPct = total ? Math.round((pending / total) * 100) : 0;

        const card = document.createElement('div');
        card.className = 'project-card';
        card.innerHTML =
          '<h4>' + escapeHtml(proj.projectCode) + ' – ' + escapeHtml(proj.projectName) + '</h4>';
        const summaryTable = document.createElement('table');
        summaryTable.className = 'line-items-table summary-table editable-cols';
        summaryTable.innerHTML =
          '<thead><tr><th>No. of Line items</th><th>Received</th><th>Pending</th><th>Status</th></tr></thead>' +
          '<tbody><tr>' +
          '<td><input type="number" min="0" class="editable-num" data-project-id="' + escapeHtml(proj.id) + '" data-field="totalLineItems" value="' + total + '"></td>' +
          '<td><input type="number" min="0" class="editable-num" data-project-id="' + escapeHtml(proj.id) + '" data-field="received" value="' + received + '"></td>' +
          '<td class="readonly-cell">' + pending + '</td>' +
          '<td class="status-cell">' +
          '<span class="status-with-dot status-received"><span class="dot dot-green"></span> ' + receivedPct + '% Received</span> ' +
          '<span class="status-with-dot status-pending"><span class="dot dot-red"></span> ' + pendingPct + '% Pending</span>' +
          '</td>' +
          '</tr></tbody>';
        summaryTable.querySelectorAll('.editable-num').forEach(function (input) {
          input.addEventListener('change', function () {
            var projId = input.dataset.projectId;
            var field = input.dataset.field;
            var val = parseInt(input.value, 10);
            if (isNaN(val) || val < 0) val = 0;
            var p = state.projects.find(function (x) { return x.id === projId; });
            if (p) {
              if (field === 'totalLineItems') {
                p.totalLineItems = val;
                if ((Number(p.received) || 0) > val) p.received = val;
              } else if (field === 'received') {
                var max = Number(p.totalLineItems) || 0;
                if (val > max) val = max;
                p.received = val;
              }
              save(state);
              renderSupplierDetail();
            }
          });
        });
        card.appendChild(summaryTable);
        const deleteBtn = document.createElement('button');
deleteBtn.textContent = 'Delete Project';
deleteBtn.className = 'btn btn-danger delete-project';
deleteBtn.dataset.projectId = proj.id;

deleteBtn.addEventListener('click', function () {
  if (!confirm('Are you sure you want to delete this project?')) return;

  state.projects = state.projects.filter(function (p) {
    return p.id !== proj.id;
  });

  save(state);
  renderSupplierDetail();
});

card.appendChild(deleteBtn);

projectsList.appendChild(card);
      });
    }

    supplierDetailTitle.onblur = function () {
      const sup = getSupplier(currentSupplierId);
      if (sup) {
        sup.name = supplierDetailTitle.textContent.trim() || sup.name;
        save(state);
      }
    };
  }

  function escapeHtml(s) {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  backBtn.addEventListener('click', showDashboard);

  if (searchProjectsInput) searchProjectsInput.addEventListener('input', function () { renderSupplierDetail(); });
  if (statusFilterSelect) statusFilterSelect.addEventListener('change', function () { renderSupplierDetail(); });

  addProjectBtn.addEventListener('click', function () {
    newProjectCode.value = '';
    newProjectName.value = '';
    addProjectForm.classList.remove('hidden');
  });

  cancelProjectBtn.addEventListener('click', function () {
    addProjectForm.classList.add('hidden');
  });

  saveProjectBtn.addEventListener('click', function () {
    const code = newProjectCode.value.trim();
    const name = newProjectName.value.trim();
    if (!code || !name) return;
    state.projects.push({
      id: id(),
      supplierId: currentSupplierId,
      projectCode: code,
      projectName: name,
      totalLineItems: 0,
      received: 0
    });
    save(state);
    addProjectForm.classList.add('hidden');
    newProjectCode.value = '';
    newProjectName.value = '';
    renderSupplierDetail();
  });

  if (addSupplierBtn && addSupplierForm) {
    addSupplierBtn.addEventListener('click', function () {
      newSupplierName.value = '';
      addSupplierForm.classList.remove('hidden');
    });
    if (cancelSupplierBtn) cancelSupplierBtn.addEventListener('click', function () {
      addSupplierForm.classList.add('hidden');
    });
    if (saveSupplierBtn && newSupplierName) saveSupplierBtn.addEventListener('click', function () {
      const name = newSupplierName.value.trim();
      if (!name) return;
      state.suppliers.push({ id: id(), name: name });
      save(state);
      addSupplierForm.classList.add('hidden');
      newSupplierName.value = '';
      renderDashboard();
    });
  }

  var importExcelInput = document.getElementById('import-excel-input');
  if (importExcelInput) {
    importExcelInput.addEventListener('change', function () {
      var file = this.files && this.files[0];
      if (!file || typeof XLSX === 'undefined') {
        this.value = '';
        return;
      }
      var reader = new FileReader();
      reader.onload = function (e) {
        try {
          var wb = XLSX.read(e.target.result, { type: 'arraybuffer' });
          var firstSheet = wb.SheetNames[0];
          var ws = wb.Sheets[firstSheet];
          var data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
          if (!data.length) { alert('Excel file is empty.'); return; }
          var headers = data[0].map(function (h) { return String(h || '').toLowerCase().trim(); });
          var col = function (name) {
            var i = headers.indexOf(name);
            if (i >= 0) return i;
            var alt = name.replace(/\./g, '').replace(/\s+/g, ' ');
            for (var j = 0; j < headers.length; j++) {
              if (headers[j].replace(/\s+/g, ' ').indexOf(alt) !== -1) return j;
            }
            return -1;
          };
          var idxCode = col('project code') >= 0 ? col('project code') : col('projectcode');
          var idxName = col('project name') >= 0 ? col('project name') : col('projectname');
          var idxTotal = col('no. of line items') >= 0 ? col('no. of line items') : (col('no of line items') >= 0 ? col('no of line items') : col('line items'));
          var idxReceived = col('received');
          var idxPending = col('pending');
          if (idxCode < 0 || idxName < 0) {
            alert('Excel must have "Project code" and "Project name" columns.');
            return;
          }
	if (!confirm('Importing will delete existing projects for this supplier. Continue?')) {
  importExcelInput.value = '';
  return;
}

state.projects = state.projects.filter(function(p){
  return p.supplierId !== currentSupplierId;
});

          var added = 0;
          for (var r = 1; r < data.length; r++) {
            var row = data[r];
            var code = String(row[idxCode] != null ? row[idxCode] : '').trim();
            var name = String(row[idxName] != null ? row[idxName] : '').trim();
            if (!code && !name) continue;
            var total = idxTotal >= 0 ? parseInt(row[idxTotal], 10) : NaN;
            var received = idxReceived >= 0 ? parseInt(row[idxReceived], 10) : 0;
            if (isNaN(received)) received = 0;
            if (isNaN(total) && idxPending >= 0) {
              var pendingVal = parseInt(row[idxPending], 10);
              if (!isNaN(pendingVal)) total = received + pendingVal;
            }
            if (isNaN(total)) total = 0;
            if (received > total) received = total;
            state.projects.push({
              id: id(),
              supplierId: currentSupplierId,
              projectCode: code || 'Imported',
              projectName: name || 'Imported',
              totalLineItems: total,
              received: received
            });
            added++;
          }
          save(state);
          renderSupplierDetail();
          alert('Imported ' + added + ' project(s).');
        } catch (err) {
          alert('Could not read Excel: ' + (err.message || 'Unknown error'));
        }
        importExcelInput.value = '';
      };
      reader.readAsArrayBuffer(file);
    });
  }

  exportExcelBtn.addEventListener('click', function () {
    if (typeof XLSX === 'undefined') {
      alert('Excel library not loaded.');
      return;
    }
    const supplier = getSupplier(currentSupplierId);
    if (!supplier) return;
    const projects = getProjectsForSupplier(currentSupplierId);
    const rows = [];
    rows.push(['Project Code', 'Project Name', 'No. of Line items', 'Received', 'Pending']);
    projects.forEach(function (proj) {
      var total = Number(proj.totalLineItems) || 0;
      var received = Number(proj.received) || 0;
      var pending = Math.max(0, total - received);
      rows.push([proj.projectCode, proj.projectName, total, received, pending]);
    });
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Status');
    const safeName = (supplier.name || 'Supplier').replace(/[^\w\s-]/g, '') || 'Supplier';
    XLSX.writeFile(wb, safeName + '_status.xlsx');
  });

  var mobileAppLink = document.getElementById('mobile-app-link');
  var installPrompt = document.getElementById('install-prompt');
  var installUrlEl = document.getElementById('install-url');
  var installClose = document.getElementById('install-close');
  if (mobileAppLink && installPrompt && installUrlEl) {
    mobileAppLink.addEventListener('click', function (e) {
      e.preventDefault();
      var url = window.location.href;
      installUrlEl.textContent = url;
      installPrompt.classList.remove('hidden');
    });
  }
  if (installClose && installPrompt) {
    installClose.addEventListener('click', function () {
      installPrompt.classList.add('hidden');
    });
  }

  showDashboard();
})();
