/* ---------- App initialization & helpers ---------- */

/* simple helper to store / retrieve */
const store = {
  get(k){ return JSON.parse(localStorage.getItem(k) || "null"); },
  set(k,v){ localStorage.setItem(k, JSON.stringify(v)); }
};

/* initial seeds */
if(!store.get("schemas")) store.set("schemas", [
  { name: "Customer", fields: [
      { name: "CustomerID", type: "id", identity:true },
      { name: "email", type: "string" },
      { name: "firstName", type: "string" },
      { name: "lastName", type: "string" }
    ]
  }
]);
if(!store.get("profiles")) store.set("profiles", [
  { CustomerID: "1001", email:"peter@example.com", firstName:"Peter", lastName:"Parker" },
  { CustomerID: "1002", email:"bruce@example.com", firstName:"Bruce", lastName:"Wayne" },
  { CustomerID: "1003", email:"diana@example.com", firstName:"Diana", lastName:"Prince" }
]);
if(!store.get("segments")) store.set("segments", []);
if(!store.get("journeys")) store.set("journeys", []);

/* theme */
function applyTheme(){
  document.documentElement.classList.toggle('dark', !!store.get('dark'));
  document.documentElement.classList.toggle('aep-theme', !!store.get('aep'));
}
applyTheme();

/* ---------- Routing (sidebar buttons) ---------- */
const navBtns = document.querySelectorAll('.nav');
const pages = document.querySelectorAll('.page');
function showPage(name){
  pages.forEach(p => p.classList.toggle('visible', p.id === name));
  navBtns.forEach(b => b.classList.toggle('active', b.dataset.page === name));
  renderAll();
}
navBtns.forEach(b => b.addEventListener('click', ()=> showPage(b.dataset.page)));
document.getElementById('gotoSchemas').addEventListener('click', ()=> showPage('schemas'));
document.getElementById('gotoIngest').addEventListener('click', ()=> showPage('ingestion'));

/* theme toggles */
document.getElementById('toggleDark').onclick = () => {
  store.set('dark', !store.get('dark'));
  applyTheme();
};
document.getElementById('toggleAep').onclick = () => {
  store.set('aep', !store.get('aep'));
  applyTheme();
};

/* JSON modal */
const jsonModal = document.getElementById('jsonModal');
const jsonContent = document.getElementById('jsonContent');
document.getElementById('closeJson').onclick = ()=> jsonModal.classList.add('hidden');

/* ---------- Schema editor: add field row template ---------- */
function makeFieldRow(field = {name:'', type:'string', identity:false}) {
  const div = document.createElement('div');
  div.className = 'field-row';
  div.innerHTML = `
    <input class="fname" placeholder="Field name" value="${escapeHtml(field.name)}" />
    <select class="ftype">
      <option value="string">string</option>
      <option value="number">number</option>
      <option value="id">id</option>
    </select>
    <label class="identity"><input type="checkbox" class="fidentity" ${field.identity ? 'checked':''}/> identity</label>
    <button class="remove btn red small">X</button>
  `;
  div.querySelector('.ftype').value = field.type || 'string';
  div.querySelector('.remove').onclick = ()=> div.remove();
  return div;
}

/* helper escape for prefilled values */
function escapeHtml(s){ return (s||'').replace(/"/g,'&quot;').replace(/</g,'&lt;'); }

/* add field button */
document.getElementById('addFieldBtn').addEventListener('click', ()=>{
  document.getElementById('fieldsContainer').appendChild(makeFieldRow());
});

/* cancel edit */
document.getElementById('cancelEdit').addEventListener('click', ()=>{
  document.getElementById('schemaName').value='';
  document.getElementById('fieldsContainer').innerHTML='';
  document.getElementById('schemaEditorTitle').textContent = 'Create / Edit Schema';
});

/* Save schema */
document.getElementById('saveSchemaBtn').addEventListener('click', ()=>{
  const name = document.getElementById('schemaName').value.trim();
  if(!name) return alert('Schema name required');

  const rows = [...document.querySelectorAll('#fieldsContainer .field-row')];
  const fields = rows.map(r => {
    return {
      name: r.querySelector('.fname').value.trim(),
      type: r.querySelector('.ftype').value,
      identity: r.querySelector('.fidentity').checked
    };
  });

  if(fields.length===0) return alert('Add at least one field');
  if(fields.some(f=>!f.name)) return alert('All fields must have a name');

  // ensure only one identity flagged — if multiple, keep the first
  let foundId=false;
  fields.forEach(f=>{
    if(f.identity){
      if(!foundId){ foundId=true; f.type='id'; }
      else { f.identity=false; if(f.type==='id') f.type='string'; }
    }
  });

  let schemas = store.get('schemas') || [];
  const idx = schemas.findIndex(s=>s.name===name);
  if(idx>=0) schemas[idx].fields = fields;
  else schemas.push({ name, fields });

  store.set('schemas', schemas);
  renderAll();
  alert('Schema saved');
});

/* render schemas list with working Edit/Delete event listeners (no inline onclick) */
function renderSchemasTable(){
  const table = document.getElementById('schemasTable');
  const schemas = store.get('schemas') || [];
  if(!schemas.length){
    table.innerHTML = '<tr><td>No schemas</td></tr>'; return;
  }
  let html = '<tr><th>Name</th><th>Fields</th><th>Actions</th></tr>';
  schemas.forEach((s,idx)=>{
    html += `<tr data-idx="${idx}">
      <td>${s.name}</td>
      <td>${s.fields.map(f=>$renderFieldSummary(f)).join(', ')}</td>
      <td>
        <button class="editSchema btn green" data-name="${s.name}">Edit</button>
        <button class="deleteSchema btn red" data-name="${s.name}">Delete</button>
      </td>
    </tr>`;
  });
  table.innerHTML = html;

  // attach listeners
  table.querySelectorAll('.editSchema').forEach(b=>{
    b.addEventListener('click', (e)=>{
      const name = e.currentTarget.dataset.name;
      loadSchemaForEdit(name);
    });
  });
  table.querySelectorAll('.deleteSchema').forEach(b=>{
    b.addEventListener('click', (e)=>{
      const name = e.currentTarget.dataset.name;
      if(!confirm('Delete schema '+name+' ?')) return;
      const schemas = store.get('schemas').filter(s=>s.name!==name);
      store.set('schemas', schemas);
      renderAll();
    });
  });
}
function $renderFieldSummary(f){
  return `${f.name}${f.identity ? ' (id)' : ''}${!f.identity ? ' ('+f.type+')':''}`;
}

/* load schema into editor */
function loadSchemaForEdit(name){
  const s = (store.get('schemas')||[]).find(x=>x.name===name);
  if(!s) return;
  document.getElementById('schemaEditorTitle').textContent = `Edit Schema — ${s.name}`;
  document.getElementById('schemaName').value = s.name;
  const cont = document.getElementById('fieldsContainer'); cont.innerHTML='';
  s.fields.forEach(f => cont.appendChild(makeFieldRow(f)));
}

/* ---------- Ingestion: generate profiles ---------- */
function populateIngestSelect(){
  const sel = document.getElementById('ingestSchemaSelect');
  const schemas = store.get('schemas') || [];
  sel.innerHTML = schemas.map(s=>`<option value="${s.name}">${s.name}</option>`).join('');
}

/* generate example value by type */
function genValue(type, name, i){
  if(type==='string') return `${name}_${Math.random().toString(36).slice(2,8)}`;
  if(type==='number') return Math.floor(Math.random()*10000);
  if(type==='id') return Date.now().toString() + '_' + Math.floor(Math.random()*1000);
  return '';
}

document.getElementById('generateProfiles').addEventListener('click', ()=>{
  const schemaName = document.getElementById('ingestSchemaSelect').value;
  const count = Math.max(1, parseInt(document.getElementById('profileCount').value) || 1);
  const schema = (store.get('schemas')||[]).find(s=>s.name===schemaName);
  if(!schema) return alert('Choose schema');

  const profiles = store.get('profiles') || [];
  for(let i=0;i<count;i++){
    const p = {};
    schema.fields.forEach(f=>{
      p[f.name] = genValue(f.type||'string', f.name, i);
    });
    profiles.push(p);
  }
  store.set('profiles', profiles);
  renderAll();
  alert(`${count} profiles generated`);
});

document.getElementById('clearProfiles').addEventListener('click', ()=>{
  if(!confirm('Clear all profiles?')) return;
  store.set('profiles', []);
  renderAll();
});

/* ---------- Profiles table & JSON viewer ---------- */
function renderProfilesTable(targetId='profilesTable', compact=false){
  const table = document.getElementById(targetId);
  const profiles = store.get('profiles') || [];
  if(!profiles.length){ table.innerHTML = '<tr><td>No profiles</td></tr>'; return; }
  const keys = Object.keys(profiles[0]);
  let html = `<tr>${keys.map(k=>`<th>${k}</th>`).join('')}</tr>`;
  html += profiles.map(p => `<tr>${keys.map(k=>`<td>${escapeHtml(String(p[k]||''))}</td>`).join('')}</tr>`).join('');
  table.innerHTML = html;
}
document.getElementById('viewProfilesJSON').addEventListener('click', ()=>{
  const j = store.get('profiles') || [];
  jsonContent.textContent = JSON.stringify(j, null, 2);
  jsonModal.classList.remove('hidden');
});

/* ---------- Segments ---------- */
function populateSegmentFieldOptions(){
  const select = document.getElementById('segmentField');
  const fields = allFieldNames();
  select.innerHTML = fields.map(f=>`<option value="${f}">${f}</option>`).join('');
}
function allFieldNames(){
  const schemas = store.get('schemas')||[];
  const set = new Set();
  schemas.forEach(s => s.fields.forEach(f => set.add(f.name)));
  return [...set];
}

document.getElementById('createSegment').addEventListener('click', ()=>{
  const name = document.getElementById('segmentName').value.trim();
  const field = document.getElementById('segmentField').value;
  const value = document.getElementById('segmentValue').value.trim();
  if(!name || !field || !value) return alert('All fields required');

  const segs = store.get('segments') || [];
  segs.push({ name, field, value });
  store.set('segments', segs);
  renderAll();
});

/* ---------- Segments table ---------- */
function renderSegmentsTable(){
  const t = document.getElementById('segmentsTable');
  const segs = store.get('segments') || [];
  if(!segs.length) { t.innerHTML = '<tr><td>No segments</td></tr>'; return; }
  let html = '<tr><th>Name</th><th>Rule</th><th>Actions</th></tr>';
  segs.forEach((s, idx)=> {
    html += `<tr>
      <td>${s.name}</td>
      <td>${s.field} = ${s.value}</td>
      <td><button class="deleteSeg btn red" data-idx="${idx}">Delete</button></td>
    </tr>`;
  });
  t.innerHTML = html;
  t.querySelectorAll('.deleteSeg').forEach(b=>{
    b.addEventListener('click', (e)=>{
      const idx = +e.currentTarget.dataset.idx;
      const seg = store.get('segments'); seg.splice(idx,1); store.set('segments', seg); renderAll();
    });
  });
}

/* ---------- Journeys simulator (simple) ---------- */
function populateJourneySelectors(){
  const profSel = document.getElementById('journeyProfileSelect');
  const segSel = document.getElementById('journeySegmentSelect');
  const profiles = store.get('profiles') || [];
  profSel.innerHTML = profiles.map((p,i)=>`<option value="${i}">${Object.values(p).slice(0,2).join(' — ') || 'Profile '+i}</option>`).join('');
  segSel.innerHTML = `<option value="">— none —</option>` + (store.get('segments')||[]).map((s,i)=>`<option value="${i}">${s.name}</option>`).join('');
}

let journeyInterval = null;

document.getElementById('startJourney').addEventListener('click', ()=>{
  const profIdx = document.getElementById('journeyProfileSelect').value;
  if(profIdx==='') return alert('Pick a profile');
  const profile = (store.get('profiles')||[])[+profIdx];
  const segmentIdx = document.getElementById('journeySegmentSelect').value;
  const segment = segmentIdx === '' ? null : (store.get('segments')||[])[+segmentIdx];

  // Basic simulation steps log
  const logEl = document.getElementById('journeyLog');
  logEl.innerHTML = '';
  const steps = [
    `Started journey for profile: ${JSON.stringify(profile, null, 0)}`,
    'Evaluate segments...',
    segment ? `Profile matches segment "${segment.name}"? ${profile[segment.field] == segment.value}` : 'No segment applied',
    'Send email (simulated)',
    'Wait 2s (simulated)',
    'Complete'
  ];

  let i=0;
  journeyInterval = setInterval(()=>{
    if(i>=steps.length){ clearInterval(journeyInterval); journeyInterval=null; renderActiveJourneys(); return; }
    const el = document.createElement('div'); el.textContent = `• ${steps[i]}`; logEl.appendChild(el); logEl.scrollTop = logEl.scrollHeight;
    i++;
  }, 700);

  // record to active journeys store
  const j = store.get('journeys') || [];
  j.push({ startedAt: Date.now(), profilePreview: Object.values(profile).slice(0,2).join(' — ')});
  store.set('journeys', j);
  renderActiveJourneys();
});

document.getElementById('stopJourney').addEventListener('click', ()=>{
  if(journeyInterval) clearInterval(journeyInterval);
  journeyInterval = null;
});

/* render active journeys */
function renderActiveJourneys(){
  const t = document.getElementById('journeysTable');
  const j = store.get('journeys') || [];
  if(!j.length){ t.innerHTML='<tr><td>No active journeys</td></tr>'; return; }
  let html = '<tr><th>Started</th><th>Profile</th></tr>';
  j.forEach(item=>{
    const d = new Date(item.startedAt).toLocaleString();
    html += `<tr><td>${d}</td><td>${escapeHtml(item.profilePreview)}</td></tr>`;
  });
  t.innerHTML = html;
}

/* ---------- Export data ---------- */
document.getElementById('exportData').addEventListener('click', ()=>{
  const data = { schemas: store.get('schemas')||[], profiles: store.get('profiles')||[], segments: store.get('segments')||[] };
  const blob = new Blob([JSON.stringify(data,null,2)], { type:'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'aep_ajo_export.json'; a.click();
});

/* ---------- Utilities & render orchestration ---------- */
function renderQuickStats(){
  const stats = document.getElementById('quickStats');
  const sCount = (store.get('schemas')||[]).length;
  const pCount = (store.get('profiles')||[]).length;
  const segCount = (store.get('segments')||[]).length;
  stats.innerHTML = `Schemas: ${sCount}<br/>Profiles: ${pCount}<br/>Segments: ${segCount}`;
}

function renderAll(){
  renderSchemasTable();
  populateIngestSelect();
  renderProfilesTable('profilesTable');
  renderProfilesTable('profilesTableMain');
  populateSegmentFieldOptions();
  renderSegmentsTable();
  populateJourneySelectors();
  renderActiveJourneys();
  renderQuickStats();
}

/* escape helper for profile display */
function escapeHtml(s){
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;');
}

/* initial render */
renderAll();

/* ensure default page visible */
showPage(document.querySelector('.nav.active').dataset.page);

/* ---------- Search small utility for profiles in topbar (optional) ---------- */
document.getElementById('searchProfiles').addEventListener('input', (e)=>{
  const q = e.target.value.toLowerCase();
  const profiles = store.get('profiles') || [];
  const filtered = profiles.filter(p => Object.values(p).some(v=>String(v).toLowerCase().includes(q)));
  jsonContent.textContent = JSON.stringify(filtered, null, 2);
  jsonModal.classList.remove('hidden');
});