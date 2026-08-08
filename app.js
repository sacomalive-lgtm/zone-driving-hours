
const KEY="zoneDrivingHoursEntriesV1", SETTINGS="zoneDrivingHoursSettingsV1";
const zones=["Zone 1","Zone 2","Zone 3"];
let entries=JSON.parse(localStorage.getItem(KEY)||"[]");
let settings=JSON.parse(localStorage.getItem(SETTINGS)||"{}");
let currentZone="Zone 1", editingId=null;

const $=id=>document.getElementById(id);
function save(){localStorage.setItem(KEY,JSON.stringify(entries)); renderAll();}
function pad(n){return String(n).padStart(2,"0")}
function dateISO(d){return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`}
function parseDate(s){const [y,m,d]=s.split("-").map(Number);return new Date(y,m-1,d)}
function minutesText(m){m=Math.round(m||0);return `${Math.floor(m/60)}h ${pad(m%60)}m`}
function dayType(s){const n=parseDate(s).getDay();return n===0?"Sunday":n===6?"Saturday":"Mon-Fri"}
function dutyKey(zone,day,duty){return DUTIES.find(x=>x.zone===zone&&x.day===day&&x.duty===duty)}
function defaultCycle(){return settings.cycleStart || "2026-08-10"}
function cycleInfo(dateStr){
  const start=parseDate(defaultCycle()), d=parseDate(dateStr);
  const diff=Math.floor((d-start)/86400000);
  const cycleIndex=Math.floor(diff/35);
  const cycleStart=new Date(start); cycleStart.setDate(cycleStart.getDate()+cycleIndex*35);
  const dayIndex=Math.max(0,diff-cycleIndex*35);
  return {start:cycleStart,index:Math.floor(dayIndex/7)+1,dayIndex};
}
function showScreen(name){
  document.querySelectorAll(".screen").forEach(s=>s.classList.remove("active"));
  $(name).classList.add("active");
  document.querySelectorAll(".nav button").forEach(b=>b.classList.toggle("active",b.dataset.screen===name));
  renderAll();
}
function newEntry(date=dateISO(new Date())){
  editingId=null; $("entryDate").value=date;
  $("lateBreak").value=""; $("lateFinish").value=""; $("notes").value="";
  $("deleteBtn").classList.add("hidden");
  window.selections={};
  updateEntryUI(); showScreen("entry");
}
function loadEntry(e){
  editingId=e.id; $("entryDate").value=e.date; $("lateBreak").value=e.lateBreak||""; $("lateFinish").value=e.lateFinish||""; $("notes").value=e.notes||"";
  window.selections={...(e.duties||{})}; $("deleteBtn").classList.remove("hidden"); updateEntryUI(); showScreen("entry");
}
function updateEntryUI(){
  const date=$("entryDate").value, rest=window.rest===true || (editingId && entries.find(e=>e.id===editingId)?.status==="Rest Day");
  const selections=window.selections||{};
  $("entryTitle").textContent=new Date(date+"T12:00:00").toLocaleDateString(undefined,{weekday:"long",day:"numeric",month:"short"});
  const wrap=$("zoneSelections"); wrap.innerHTML="";
  zones.forEach(z=>{
    if(selections[z]){
      const d=dutyKey(z,dayType(date),selections[z]);
      wrap.innerHTML+=`<div class="selection"><div><strong>${z}</strong><br>${selections[z]}${d?` · ${minutesText(d.total)}`:""}</div><button onclick="chooseZone('${z}')">Change</button></div>`;
    }
  });
  $("status").textContent=rest?"REST DAY":Object.keys(selections).length?Object.keys(selections).map(z=>z+" "+selections[z]).join(" · "):"No duty selected";
  $("status").className="status"+(rest?" rest":"");
  $("todayTotal").textContent=rest?"0h 00m":minutesText(Object.values(selections).reduce((sum,d)=>{const x=dutyKey("", "", "");return sum},0));
  let total=0;
  if(!rest) zones.forEach(z=>{if(selections[z]){const d=dutyKey(z,dayType(date),selections[z]); if(d) total+=d.total}});
  const ot=(+($("lateBreak").value||0))+(+($("lateFinish").value||0));
  $("todayTotal").textContent=minutesText(rest?0:total+ot);
}
function chooseZone(z){currentZone=z;$("modalTitle").textContent=`${z} duty · ${dayType($("entryDate").value)}`;$("dutySearch").value="";renderDutyList();$("modal").classList.remove("hidden")}
function renderDutyList(){
  const day=dayType($("entryDate").value), q=$("dutySearch").value.trim().toLowerCase();
  const arr=DUTIES.filter(d=>d.zone===currentZone&&d.day===day&&(!q||d.duty.toLowerCase().includes(q))).sort((a,b)=>a.duty.localeCompare(b.duty,undefined,{numeric:true}));
  $("dutyList").innerHTML=arr.map(d=>`<button class="dutyOption" onclick="pickDuty('${d.duty.replace(/'/g,"\\'")}')"><span><strong>${d.duty}</strong><br><small>${d.start} → ${d.finish}</small></span><strong>${minutesText(d.total)}</strong></button>`).join("")||`<div class="empty">No duties found</div>`;
}
function pickDuty(duty){window.selections[currentZone]=duty;window.rest=false;$("modal").classList.add("hidden");updateEntryUI()}
function setRest(){window.rest=true;window.selections={};updateEntryUI()}
function saveEntry(){
  const date=$("entryDate").value;if(!date)return;
  const lateBreak=+($("lateBreak").value||0), lateFinish=+($("lateFinish").value||0);
  const status=window.rest?"Rest Day":Object.keys(window.selections||{}).length?"Worked":"";
  if(!status){alert("Select a Zone duty or Rest Day.");return}
  const item={id:editingId||crypto.randomUUID(),date,status,duties:{...(window.selections||{})},lateBreak,lateFinish,notes:$("notes").value.trim()};
  if(editingId){entries=entries.map(e=>e.id===editingId?item:e)}else entries.push(item);
  entries.sort((a,b)=>a.date.localeCompare(b.date));save();showScreen("home");
}
function totalsFor(start){
  const s=dateISO(start), end=new Date(start);end.setDate(end.getDate()+34);const e=dateISO(end);
  const es=entries.filter(x=>x.date>=s&&x.date<=e);
  let driving=0,ot=0,rest=0;
  es.forEach(x=>{const o=(x.lateBreak||0)+(x.lateFinish||0);if(x.status==="Rest Day"){rest++;return}ot+=o;zones.forEach(z=>{if(x.duties?.[z]){const d=dutyKey(z,dayType(x.date),x.duties[z]);if(d)driving+=d.total}});driving+=o});
  return {driving,ot,rest};
}
function renderHome(){
  const today=dateISO(new Date()), ci=cycleInfo(today), t=totalsFor(ci.start);
  $("cycleTotal").textContent=minutesText(t.driving);
  const end=new Date(ci.start);end.setDate(end.getDate()+34);
  $("cycleDates").textContent=`${ci.start.toLocaleDateString()} – ${end.toLocaleDateString()}`;
  const weekStart=new Date(ci.start);weekStart.setDate(weekStart.getDate()+(ci.index-1)*7);
  const wt=totalsForWeek(weekStart);$("weekTotal").textContent=minutesText(wt.driving);$("otTotal").textContent=minutesText(t.ot);$("restCount").textContent=t.rest;
}
function totalsForWeek(start){const end=new Date(start);end.setDate(end.getDate()+6);const es=entries.filter(x=>{const d=parseDate(x.date);return d>=start&&d<=end});let driving=0,ot=0;es.forEach(x=>{if(x.status==="Rest Day")return;const o=(x.lateBreak||0)+(x.lateFinish||0);ot+=o;zones.forEach(z=>{if(x.duties?.[z]){const d=dutyKey(z,dayType(x.date),x.duties[z]);if(d)driving+=d.total}});driving+=o});return{driving,ot}}
function renderSummary(){
  const ci=cycleInfo(dateISO(new Date()));let html="";
  for(let w=1;w<=5;w++){const s=new Date(ci.start);s.setDate(s.getDate()+(w-1)*7);const e=new Date(s);e.setDate(e.getDate()+6);const t=totalsForWeek(s);
    html+=`<div class="week"><div class="weekHead"><strong>Week ${w}</strong><span>${s.toLocaleDateString()} – ${e.toLocaleDateString()}</span></div><div class="weekTotal">${minutesText(t.driving)}</div><div class="mini">Overtime counted: ${minutesText(t.ot)}</div></div>`;
  }
  $("weeks").innerHTML=html;
}
function renderHistory(){
  if(!entries.length){$("historyList").innerHTML='<div class="empty">No entries yet.</div>';return}
  $("historyList").innerHTML=[...entries].reverse().map(e=>{
    const zonesText=e.status==="Rest Day"?"Rest Day":zones.filter(z=>e.duties?.[z]).map(z=>`${z}: ${e.duties[z]}`).join(" · ");
    const ot=(e.lateBreak||0)+(e.lateFinish||0);
    return `<button class="historyItem" style="width:100%;text-align:left;border:0" onclick='loadEntry(${JSON.stringify(e).replace(/'/g,"&#39;")})'><div class="historyTop"><span>${parseDate(e.date).toLocaleDateString(undefined,{weekday:"short",day:"numeric",month:"short"})}</span><span class="tag">${e.status}</span></div><div>${zonesText}</div><div class="mini">OT: ${minutesText(ot)}${e.notes?" · "+e.notes:""}</div></button>`;
  }).join("");
}
function renderAll(){renderHome();if($("summary").classList.contains("active"))renderSummary();if($("history").classList.contains("active"))renderHistory();updateEntryUI()}
$("todayBtn").onclick=()=>newEntry();
$("summaryBtn").onclick=()=>showScreen("summary");
$("historyBtn").onclick=()=>showScreen("history");
$("settingsBtn").onclick=()=>{ $("cycleStart").value=defaultCycle(); showScreen("settings") };
$("saveSettings").onclick=()=>{settings.cycleStart=$("cycleStart").value||defaultCycle();localStorage.setItem(SETTINGS,JSON.stringify(settings));showScreen("home")};
$("clearData").onclick=()=>{if(confirm("Delete all entries stored on this device?")){entries=[];save();showScreen("home")}};
$("saveBtn").onclick=saveEntry;
$("deleteBtn").onclick=()=>{if(editingId&&confirm("Delete this entry?")){entries=entries.filter(e=>e.id!==editingId);save();showScreen("history")}};
$("restBtn").onclick=setRest;
$("entryDate").onchange=()=>{window.selections={};window.rest=false;updateEntryUI()};
$("lateBreak").oninput=updateEntryUI;$("lateFinish").oninput=updateEntryUI;
$("dutySearch").oninput=renderDutyList;$("closeModal").onclick=()=>$("modal").classList.add("hidden");
$("modal").onclick=e=>{if(e.target.id==="modal")$("modal").classList.add("hidden")};
document.querySelectorAll("[data-back]").forEach(b=>b.onclick=()=>showScreen("home"));
document.querySelectorAll(".nav button").forEach(b=>b.onclick=()=>{if(b.dataset.screen==="entry")newEntry();else showScreen(b.dataset.screen)});
document.querySelectorAll(".zoneBtn").forEach(b=>b.onclick=()=>chooseZone(b.dataset.zone));
if("serviceWorker" in navigator)navigator.serviceWorker.register("sw.js").catch(()=>{});
window.rest=false;window.selections={};$("entryDate").value=dateISO(new Date());$("cycleStart").value=defaultCycle();renderAll();
