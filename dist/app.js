'use strict';
const $=id=>document.getElementById(id), C=VeilCore;
const SAMPLE=`INTERNAL — VENDOR DUE DILIGENCE MEMO
Fictional example for demonstration only

Prepared by: Maya Tan
Email: maya.tan@example.com
Contact number: +65 8123 4567
NRIC: S1234567D

Officer: Daniel Goh
Email: daniel.goh@example.com
NRIC: S7654321B

Employee: Priya Nair
Contact number: +65 9234 5678

Applicant: Wei Ming Ong
NRIC: S2468013C

Project: Project Firefly
Vendor under review: Meridian Systems
Estimated budget: S$125,000
Vendor deposit already paid: S$18,500
Contingency reserve: S$40,000

Background
Tan opened the review after Meridian Systems flagged a delay on Project Firefly. Goh cross-checked the vendor's compliance file and confirmed the numbers Ong submitted last week. Nair will handle the outstanding paperwork once Goh signs off, and Ong has agreed to resubmit the missing invoices by Friday.

Site visit
During the site visit, Tan and Wei Ming Ong walked the warehouse floor with the vendor's operations lead. Ong raised a concern about the contingency reserve being too small for a project of this size; Tan agreed to escalate the point to Goh before the next steering meeting.

Next steps
Nair will circulate the compliance checklist to the review team. Goh will finalise the risk memo. Tan will confirm the briefing agenda with Priya Nair and Daniel Goh before the deadline.

Classification and release decisions remain with the document owner.`;
const SAMPLE_COMPARE=`Subject: Vendor briefing — Meridian Systems

Hi team,

Following up after the call with Maya Tan and Wei Ming Ong. They'll send the finalised numbers once Project Firefly is approved internally; the vendor has already been told the budget is around S$125,000, with a contingency of S$40,000 held back.

Meridian Systems can start within two weeks of signoff. Let me know if Priya Nair or Daniel Goh need anything else from us before the compliance review.

Thanks,
Alex`;
const SAMPLE_COMPARE2=`Meeting notes — Firefly kickoff follow-up

Attendees: Maya Tan, Daniel Goh, Priya Nair, Wei Ming Ong

- Tan confirmed the S$125,000 budget is locked for now; the S$18,500 deposit has already gone out, and the S$40,000 contingency is under review.
- Goh flagged two vendors, including Meridian Systems, that still need reference checks before Project Firefly can move to signoff.
- Ong will resend the missing invoices; Nair will circulate the compliance checklist by Friday.
- Action: loop in the finance team before the next update.`;
let state={text:'',filename:'',entities:[],terms:[],view:'original',mode:'labels',fictional:false,selectedNode:null,compare:null,aiUsed:false};let toastTimer;let importBusy=false;
let ai={endpoint:'http://localhost:1234/v1/chat/completions',key:'',model:'gemma-4-e4b-it'};
const BRAIN_KEY='veil.brain.v1';
// Local, on-device memory of previously-resolved "is this publicly known?" verdicts, keyed by lowercased term. Never transmitted — only read to skip re-asking the AI endpoint about a term it already answered, and written after a fresh answer.
function loadBrain(){try{return JSON.parse(localStorage.getItem(BRAIN_KEY)||'{}');}catch{return {};}}
function saveBrain(store){try{localStorage.setItem(BRAIN_KEY,JSON.stringify(store));}catch{}}
function brainLookup(term){return loadBrain()[term.toLowerCase()];}
function brainRemember(term,verdict,note,source){const store=loadBrain();store[term.toLowerCase()]={verdict,note:note||'',checkedAt:new Date().toISOString(),source:source||''};saveBrain(store);}
function brainClear(){saveBrain({});}
const brainMeta={public:{icon:'✓',label:'Public',cls:'public'},not_public:{icon:'⚠',label:'Not public',cls:'not-public'},unsure:{icon:'?',label:'Unsure',cls:'unsure'}};
// Hand-rolled force layout for the relationship graph — repulsion + edge springs + a slow constant rotation, so the cluster drifts and settles like a living network instead of a fixed diagram. No graphing library: this graph's click-to-select, mask-connected and compare-leak coloring are already bespoke, and pulling in a renderer would mean re-hosting all of that against its API instead of just animating the existing SVG.
let graphState=null,graphPos=new Map(),graphRaf=null,graphRotation=0,graphEls=null;
function seedGraphPos(index,total){const a=(index/Math.max(total,1))*Math.PI*2-Math.PI/2,R=90;return {x:160+R*Math.cos(a),y:150+R*Math.sin(a),vx:0,vy:0};}
// The physics sim runs in its own compact coordinate space (unchanged from before, still centered on 160,150) — this only stretches X for display, so the graph can render much wider than the 320px-viewBox it was cramped into, without re-tuning any of the already-validated force/damping constants.
function graphScreenX(x){return 320+(x-160)*2;}
function stopGraphSim(){if(graphRaf){cancelAnimationFrame(graphRaf);graphRaf=null;}}
function stepGraphSim(){
 const {shown,shownEdges}=graphState;const sel=state.selectedNode;const CX=160,CY=150;
 for(let i=0;i<shown.length;i++)for(let j=i+1;j<shown.length;j++){
  const a=graphPos.get(shown[i].id),b=graphPos.get(shown[j].id);
  let dx=a.x-b.x,dy=a.y-b.y,d2=dx*dx+dy*dy;if(d2<1)d2=1;const d=Math.sqrt(d2),f=420/d2,fx=(dx/d)*f,fy=(dy/d)*f;
  if(shown[i].id!==sel){a.vx+=fx;a.vy+=fy;}
  if(shown[j].id!==sel){b.vx-=fx;b.vy-=fy;}
 }
 for(const e of shownEdges){
  const a=graphPos.get(e.a),b=graphPos.get(e.b);if(!a||!b)continue;
  const rest=e.strong?52:95;let dx=b.x-a.x,dy=b.y-a.y,d=Math.sqrt(dx*dx+dy*dy)||1;
  const k=(e.strong?0.02:0.006)*(d-rest),fx=(dx/d)*k,fy=(dy/d)*k;
  if(e.a!==sel){a.vx+=fx;a.vy+=fy;}
  if(e.b!==sel){b.vx-=fx;b.vy-=fy;}
 }
 graphRotation+=0.0018;const cos=Math.cos(0.0018),sin=Math.sin(0.0018);
 for(const n of shown){
  const p=graphPos.get(n.id);
  if(n.id===sel){p.vx=0;p.vy=0;continue;}
  p.vx+=(CX-p.x)*0.0025;p.vy+=(CY-p.y)*0.0025;p.vx*=0.86;p.vy*=0.86;p.x+=p.vx;p.y+=p.vy;
  const rx=p.x-CX,ry=p.y-CY;p.x=CX+rx*cos-ry*sin;p.y=CY+rx*sin+ry*cos;
  const dist=Math.hypot(p.x-CX,p.y-CY),max=125;if(dist>max){const s=max/dist;p.x=CX+(p.x-CX)*s;p.y=CY+(p.y-CY)*s;}
 }
}
function startGraphSim(){if(graphRaf)return;const tick=()=>{stepGraphSim();applyGraphPositions();graphRaf=requestAnimationFrame(tick);};graphRaf=requestAnimationFrame(tick);}
// Builds the SVG DOM once per structural change (entities/decisions/selection/compare) and caches element refs, so the animation loop can move existing elements by attribute alone — never rebuild innerHTML. Rebuilding every frame destroys and recreates the node elements, so a click's mousedown and mouseup land on two different, already-replaced DOM nodes and the browser drops the click entirely; the same churn also steals keyboard focus off a node the instant it's set.
function buildGraphDOM(){
 if(!graphState)return;
 const {shown,shownEdges,leakIds,alsoIds,totalNodes,cap,brainSeen}=graphState;
 const DCX=320,DCY=150;const color={pending:'#d5ae60',mask:'#5a9a64',keep:'#8a97a0'};const sel=state.selectedNode;const sx=graphScreenX;
 let svg='<svg viewBox="0 0 640 300" width="100%" style="width:100%;max-width:900px;height:auto;display:block;margin:0 auto" role="img" aria-label="Detail relationship diagram">';
 svg+='<ellipse cx="320" cy="150" rx="260" ry="130" fill="none" stroke="#e3e9e4" stroke-width="1"/><ellipse cx="320" cy="150" rx="170" ry="85" fill="none" stroke="#e3e9e4" stroke-width="1"/><ellipse cx="320" cy="150" rx="80" ry="40" fill="none" stroke="#e3e9e4" stroke-width="1"/>';
 for(const e of shownEdges){const p1=graphPos.get(e.a),p2=graphPos.get(e.b);if(!p1||!p2)continue;const active=sel&&(e.a===sel||e.b===sel);svg+='<line class="edge-line" data-a="'+e.a+'" data-b="'+e.b+'" x1="'+sx(p1.x)+'" y1="'+p1.y+'" x2="'+sx(p2.x)+'" y2="'+p2.y+'" stroke="'+(active?'#23614d':e.strong?'#a9c2b6':'#e9eee9')+'" stroke-width="'+(active?2.5:e.strong?Math.min(1+e.weight,4):1)+'" '+(e.strong?'':'stroke-dasharray="2 2"')+'/>';}
 if(state.compare){for(const n of shown){if(!leakIds.has(n.id)&&!alsoIds.has(n.id))continue;const p=graphPos.get(n.id);const isLeak=leakIds.has(n.id);const active=n.id===sel;svg+='<line class="compare-line-hit" data-target="'+n.id+'" x1="'+DCX+'" y1="'+DCY+'" x2="'+sx(p.x)+'" y2="'+p.y+'" stroke="transparent" stroke-width="14" style="cursor:pointer"/><line class="compare-line" data-target="'+n.id+'" x1="'+DCX+'" y1="'+DCY+'" x2="'+sx(p.x)+'" y2="'+p.y+'" stroke="'+(isLeak?'#b23b3b':'#a1791f')+'" stroke-width="'+(active?3:isLeak?2:1.3)+'" '+(isLeak?'':'stroke-dasharray="3 3"')+' opacity="0.9" style="pointer-events:none"/>';}}
 for(const n of shown){const p=graphPos.get(n.id);const active=n.id===sel;const seen=brainSeen.has(n.id);svg+='<g tabindex="0" role="button" data-node="'+n.id+'" aria-label="Select '+C.escapeHtml(n.label)+(seen?' (seen in an earlier document)':'')+'" style="cursor:pointer">'+(seen?'<circle class="node-halo" cx="'+sx(p.x)+'" cy="'+p.y+'" r="'+(active?18:12)+'" fill="none" stroke="#7c8c85" stroke-width="1" stroke-dasharray="2 2" opacity="0.7"/>':'')+'<circle class="node-glow" cx="'+sx(p.x)+'" cy="'+p.y+'" r="'+(active?14:8)+'" fill="'+(color[n.decision]||'#d5ae60')+'" opacity="'+(active?0.16:0)+'"/><circle class="node-dot" cx="'+sx(p.x)+'" cy="'+p.y+'" r="'+(active?10:7)+'" fill="'+(color[n.decision]||'#d5ae60')+'" stroke="'+(active?'#183b2c':'#fff')+'" stroke-width="1.5"/><text class="node-label" x="'+sx(p.x)+'" y="'+(p.y-14)+'" font-size="9" text-anchor="middle" fill="'+(active?'#183b2c':'#52695b')+'">'+C.escapeHtml(n.label.length>16?n.label.slice(0,15)+'…':n.label)+'</text></g>';}
 if(state.compare){const fname=state.compare.filename.length>22?state.compare.filename.slice(0,21)+'…':state.compare.filename;const compareActive=sel==='__compare__';svg+='<g tabindex="0" role="button" data-node="__compare__" aria-label="Select to see how this compares against '+C.escapeHtml(state.compare.filename)+'" style="cursor:pointer"><circle cx="'+DCX+'" cy="'+DCY+'" r="'+(compareActive?18:15)+'" fill="#f3f6f4" stroke="'+(compareActive?'#183b2c':'#8a97a0')+'" stroke-width="'+(compareActive?2:1.5)+'"/><text x="'+DCX+'" y="'+(DCY+5)+'" font-size="13" text-anchor="middle" fill="#52695b">▤</text><text x="'+DCX+'" y="'+(DCY+29)+'" font-size="8.5" text-anchor="middle" fill="#7c8c85">'+C.escapeHtml(fname)+'</text></g>';}
 svg+='</svg>';
 let note='<p class="small muted">'+(totalNodes>cap?'Showing the '+cap+' most connected details of '+totalNodes+'. ':'')+'Solid lines are directly related — mentioned in the same sentence, or a name with its own contact detail; faint dashed lines just mean they appear somewhere in the same document. A dashed ring means Veil recognises that term from an earlier document’s public-knowledge check — select it to see which one.</p>';
 if(state.compare){note+='<p class="small muted">The <strong>▤</strong> icon in the middle is your comparison document. ';if(leakIds.size)note+='<span style="color:#b23b3b">A red line</span> means that detail is masked here but still visible there. ';if(alsoIds.size)note+='<span style="color:#a1791f">A dashed amber line</span> means it appears there and isn’t decided here yet. ';if(!leakIds.size&&!alsoIds.size)note+='No lines to it yet — nothing detected here also appears there. ';note+='</p>';}
 $('graph-svg').innerHTML=svg+note;
 const root=$('graph-svg').querySelector('svg');
 graphEls={nodes:new Map(),compareLines:root?[...root.querySelectorAll('.compare-line,.compare-line-hit')]:[]};
 if(!root)return;
 shown.forEach(n=>{const g=root.querySelector('g[data-node="'+n.id+'"]');if(!g)return;graphEls.nodes.set(n.id,{halo:g.querySelector('.node-halo'),glow:g.querySelector('.node-glow'),dot:g.querySelector('.node-dot'),label:g.querySelector('.node-label')});});
 graphEls.edges=shownEdges.map(e=>({a:e.a,b:e.b,el:root.querySelector('.edge-line[data-a="'+e.a+'"][data-b="'+e.b+'"]')}));
}
// Animation tick: move already-built elements by attribute only, no innerHTML touch, so clicks and keyboard focus survive across frames.
function applyGraphPositions(){
 if(!graphEls||!graphState)return;
 const sx=graphScreenX;
 for(const n of graphState.shown){
  const p=graphPos.get(n.id),refs=graphEls.nodes.get(n.id);if(!p||!refs)continue;
  const dx=sx(p.x);
  if(refs.halo){refs.halo.setAttribute('cx',dx);refs.halo.setAttribute('cy',p.y);}
  if(refs.glow){refs.glow.setAttribute('cx',dx);refs.glow.setAttribute('cy',p.y);}
  if(refs.dot){refs.dot.setAttribute('cx',dx);refs.dot.setAttribute('cy',p.y);}
  if(refs.label){refs.label.setAttribute('x',dx);refs.label.setAttribute('y',p.y-14);}
 }
 for(const e of graphEls.edges){
  if(!e.el)continue;const p1=graphPos.get(e.a),p2=graphPos.get(e.b);if(!p1||!p2)continue;
  e.el.setAttribute('x1',sx(p1.x));e.el.setAttribute('y1',p1.y);e.el.setAttribute('x2',sx(p2.x));e.el.setAttribute('y2',p2.y);
 }
 for(const el of graphEls.compareLines){
  const p=graphPos.get(el.getAttribute('data-target'));if(!p)continue;
  el.setAttribute('x2',sx(p.x));el.setAttribute('y2',p.y);
 }
}
function renderGraphActions(){
 const sel=state.selectedNode;
 if(!sel||!graphState){$('graph-actions').innerHTML='';return;}
 if(sel==='__compare__'){
  if(!state.compare){state.selectedNode=null;$('graph-actions').innerHTML='';return;}
  const matches=C.crossDocumentMatches(state.entities,state.compare.text);
  const leaked=matches.filter(e=>e.decision==='mask');
  const notMasked=matches.filter(e=>e.decision!=='mask');
  const link=e=>'<a href="#" data-focus="'+e.id+'">'+C.escapeHtml(e.value)+'</a>';
  let html='<p class="small">Comparing against <strong>'+C.escapeHtml(state.compare.filename)+'</strong></p>';
  if(!matches.length)html+='<p class="small muted">No details detected here also appear there.</p>';
  else{
   if(leaked.length)html+='<p class="small" style="color:#b23b3b">'+leaked.length+' masked detail'+(leaked.length===1?'':'s')+' still visible there: '+leaked.map(link).join(', ')+'</p>';
   if(notMasked.length)html+='<p class="small" style="color:#a1791f">'+notMasked.length+' not masked, also present there: '+notMasked.map(link).join(', ')+'</p>';
  }
  html+='<button id="open-compare-panel" class="button compact secondary">Open comparison panel</button>';
  $('graph-actions').innerHTML=html;
  return;
 }
 const entity=state.entities.find(e=>e.id===sel);
 if(!entity){state.selectedNode=null;$('graph-actions').innerHTML='';return;}
 const connected=graphState.shownEdges.filter(e=>e.strong&&(e.a===sel||e.b===sel)).map(e=>e.a===sel?e.b:e.a);
 const names=connected.map(id=>state.entities.find(e=>e.id===id)?.value).filter(Boolean);
 const known=brainLookup(entity.value);
 const memoryLine=known?'<p class="small muted">Public-knowledge check: <strong>'+(brainMeta[known.verdict]||brainMeta.unsure).label+'</strong>'+(known.source?' — seen in “'+C.escapeHtml(known.source)+'”':'')+(known.note?' ('+C.escapeHtml(known.note)+')':'')+'</p>':'';
 const compareLine=!state.compare?'':graphState.leakIds.has(sel)?'<p class="small" style="color:#b23b3b">Masked here, but still visible in “'+C.escapeHtml(state.compare.filename)+'”. <a href="#" data-view-compare="'+sel+'">View in document</a></p>':graphState.alsoIds.has(sel)?'<p class="small" style="color:#a1791f">Not masked, and also present in “'+C.escapeHtml(state.compare.filename)+'”. <a href="#" data-view-compare="'+sel+'">View in document</a></p>':'';
 $('graph-actions').innerHTML='<p class="small">Selected: <strong>'+C.escapeHtml(entity.value)+'</strong>'+(names.length?' · directly tied to '+names.map(n=>C.escapeHtml(n)).join(', '):' · nothing else is directly tied to it')+'</p>'+memoryLine+compareLine+'<button id="mask-connected" class="button compact primary">Mask this'+(connected.length?' + '+connected.length+' connected':'')+'</button> <button id="focus-connected" class="button compact secondary">Show in list</button>';
}
function updatePrivacyBadge(){const badge=$('privacy-badge');badge.classList.toggle('active',!!state.aiUsed);$('privacy-text').textContent=state.aiUsed?'Sent to your AI endpoint this session':'Processed on this device';}
function status(message,error=false){$('status').textContent=message;$('status').className='status show'+(error?' error':'');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('status').className='status',5500);}
function scan(text,name,fictional=false){if(!text.trim())return status('Add some text before starting a review.',true);if(text.length>200000)return status('This prototype supports up to 200,000 characters. Use a smaller document.',true);state={text,filename:name,entities:C.detect(text),terms:[],view:'original',mode:'labels',fictional,selectedNode:null,compare:null,aiUsed:false};refreshLinked();stopGraphSim();graphPos=new Map();graphState=null;graphEls=null;$('exclude-input').value='';$('exclude-status').textContent='';$('exclude-panel').hidden=true;$('toggle-exclude').setAttribute('aria-expanded','false');updatePrivacyBadge();$('clear-compare').hidden=true;$('compare-input').value='';$('review-confirm').checked=false;$('replacement').value='labels';$('filter').value='all';$('import-view').hidden=true;$('review-view').hidden=false;$('filename').textContent=name;$('doc-meta').textContent=text.length.toLocaleString()+' characters · '+(fictional?'Fictional demonstration':'Processed in this browser');$('example-badge').hidden=!fictional;$('step-import').className='step complete';$('step-review').className='step current';$('step-export').className='step';render();window.scrollTo({top:0,behavior:'instant'});return true;}
// A linked mention only ever comes from a name the reviewer already marked "mask" (see core.js linkedMentions), so it defaults to mask too — a missed re-mention is worse than a wrong one, and it's still shown and reversible in the findings list.
function refreshLinked(){const old=new Map(state.entities.filter(e=>e.linked).map(e=>[e.value.toLowerCase()+'|'+e.linkedTo,e.decision]));state.entities=state.entities.filter(e=>!e.linked);const extra=C.linkedMentions(state.text,state.entities);for(const e of extra)e.decision=old.get(e.value.toLowerCase()+'|'+e.linkedTo)||'mask';state.entities=state.entities.concat(extra);}
function render(){renderDocument();renderFindings();renderSummary();renderTerms();renderRisk();renderGraph();renderLeaks();}
function renderDocument(){const preview=state.view==='preview';$('tab-original').classList.toggle('selected',!preview);$('tab-preview').classList.toggle('selected',preview);$('tab-original').setAttribute('aria-selected',String(!preview));$('tab-preview').setAttribute('aria-selected',String(preview));$('paper-label').textContent=preview?'EDITED TEXT PREVIEW':'SOURCE DOCUMENT';$('preview-status').textContent=preview?(state.entities.some(e=>e.decision==='pending')?'Pending suggestions shown masked':'Your current review decisions'):'Select a highlight to review';
 if(preview){const ops=C.operations(state.entities,true);let out='',cursor=0;for(const o of ops){out+=C.escapeHtml(state.text.slice(cursor,o.start))+'<span class="replacement">'+C.escapeHtml(state.mode==='remove'?'[REMOVED]':o.entity.placeholder)+'</span>';cursor=o.end;}out+=C.escapeHtml(state.text.slice(cursor));$('document-content').innerHTML=out;}else{const all=state.entities.flatMap(e=>e.ranges.map(r=>({...r,e}))).sort((a,b)=>a.start-b.start||b.end-a.end);let cursor=0,out='';for(const o of all){if(o.start<cursor)continue;out+=C.escapeHtml(state.text.slice(cursor,o.start))+'<mark tabindex="0" role="button" data-entity="'+o.e.id+'" class="'+(o.e.decision==='keep'?'kept':o.e.decision==='mask'?'masked':'')+'" aria-label="Review '+C.escapeHtml(o.e.value)+'">'+C.escapeHtml(state.text.slice(o.start,o.end))+'</mark>';cursor=o.end;}out+=C.escapeHtml(state.text.slice(cursor));$('document-content').innerHTML=out;}}
const types={person:'Name',email:'Email address',phone:'Phone number',id:'Identity number',amount:'Monetary value',custom:'Custom term',instruction:'Instruction match'};
function renderFindings(){const items=state.entities.filter(e=>$('filter').value==='all'||e.type===$('filter').value);$('findings-list').innerHTML=items.length?items.map(e=>`<div class="finding" id="finding-${e.id}"><div class="finding-top"><span class="category">${types[e.type]}</span><span class="decision-badge">${e.ranges.length} occurrence${e.ranges.length===1?'':'s'} · ${e.decision==='pending'?'Review needed':e.decision==='mask'?'Mask':'Keep'}</span></div><div class="finding-value">${C.escapeHtml(e.value)}</div><p>${e.reason}</p><div class="finding-actions"><span class="replacement-hint">${C.escapeHtml(e.placeholder)}</span><div class="decision-buttons"><button data-id="${e.id}" data-decision="mask" aria-label="Mask ${C.escapeHtml(e.value)}" aria-pressed="${e.decision==='mask'}" class="${e.decision==='mask'?'active-mask':''}">Mask</button><button data-id="${e.id}" data-decision="keep" aria-label="Keep ${C.escapeHtml(e.value)}" aria-pressed="${e.decision==='keep'}" class="${e.decision==='keep'?'active-keep':''}">Keep</button></div></div></div>`).join(''):'<div class="empty-findings">'+(state.entities.length?'No suggestions in this category.':'No pattern matches found. Read the whole document and add custom terms before deciding whether it is ready.')+'</div>';}
function renderSummary(){const pending=state.entities.filter(e=>e.decision==='pending').length;$('count-found').textContent=state.entities.length;$('count-occurrences').textContent=state.entities.reduce((a,e)=>a+e.ranges.length,0);$('count-pending').textContent=pending;const ready=pending===0&&$('review-confirm').checked;$('export-text').disabled=!ready;$('export-report').disabled=!ready;$('export-hint').textContent=pending?'Review '+pending+' remaining suggestion'+(pending===1?'':'s')+'.':!$('review-confirm').checked?'Read all text, then confirm your review.':'Review complete. Follow your organisation’s sharing rules.';$('step-export').className=ready?'step current':'step';$('step-review').className=ready?'step complete':'step current';}
function renderTerms(){$('custom-terms').innerHTML=state.terms.map((t,i)=>`<span class="custom-chip">${C.escapeHtml(t)}<button data-remove="${i}" aria-label="Remove custom term ${C.escapeHtml(t)}">×</button></span>`).join('');}
function rescan(){const old=new Map(state.entities.map(e=>[e.type+'|'+e.value.toLowerCase(),e.decision]));state.entities=C.detect(state.text,state.terms);for(const e of state.entities)e.decision=old.get(e.type+'|'+e.value.toLowerCase())||'pending';refreshLinked();$('review-confirm').checked=false;render();}
function renderRisk(){const findings=C.residualRisk(state.text,state.entities);const el=$('risk-banner');if(!findings.length){el.hidden=true;el.innerHTML='';return;}el.hidden=false;const shown=findings.slice(0,4);el.innerHTML='<strong>'+findings.length+' spot'+(findings.length===1?'':'s')+' where kept details combine.</strong><ul>'+shown.map(f=>'<li>'+f.types.join(' + ')+' kept together</li>').join('')+'</ul>'+(findings.length>shown.length?'<p class="small muted">+'+(findings.length-shown.length)+' more</p>':'')+'<p class="small muted">These pairs are directly related — mentioned in the same sentence, or a name with its own contact detail — so together they might still narrow this document to a specific person or matter. Review before exporting.</p>';}
function selectNode(id){state.selectedNode=state.selectedNode===id?null:id;renderGraph();}
async function scanWithAi(){
 if(!state.text)return status('Load a document first.',true);
 if(!ai.endpoint)return status('Enter an endpoint URL first.',true);
 const sentences=C.unscannedSentences(state.text,state.entities);
 if(!sentences.length)return status('No unlabeled text left to scan — every sentence already has a detected detail in it.');
 const numbered=sentences.map((s,i)=>(i+1)+'. '+state.text.slice(s.start,s.end).trim()).join('\n');
 const body={model:ai.model||'gemma-4-e4b-it',temperature:0,messages:[
  {role:'system',content:'You spot unlabeled person names in short text snippets. Given numbered sentences, return ONLY a JSON array like [{"i":2,"name":"Alex Wong"}] for every sentence that contains a person\'s full name that is not already obviously labeled. Copy each name exactly as it appears, character for character. Return [] if none. No other text, no explanation.'},
  {role:'user',content:numbered}
 ]};
 $('scan-ai').disabled=true;$('ai-status').textContent='Sending '+sentences.length+' unlabeled sentence'+(sentences.length===1?'':'s')+' to the AI endpoint…';
 try{
  const res=await fetch(ai.endpoint,{method:'POST',headers:{'Content-Type':'application/json',...(ai.key?{'Authorization':'Bearer '+ai.key}:{})},body:JSON.stringify(body)});
  state.aiUsed=true;updatePrivacyBadge();
  if(!res.ok)throw new Error('The endpoint returned HTTP '+res.status+'.');
  const data=await res.json();
  const content=data.choices?.[0]?.message?.content||'';
  let parsed=[];
  try{parsed=JSON.parse(content);}catch{const m=content.match(/\[[\s\S]*\]/);if(m){try{parsed=JSON.parse(m[0]);}catch{}}}
  const results=(Array.isArray(parsed)?parsed:[]).map(r=>({i:(r.i??r.index)-1,name:r.name??r.value}));
  const verified=C.verifyAiNames(state.text,sentences,results);
  const extra=C.aiCandidates(state.text,verified,state.entities);
  if(!extra.length){$('ai-status').textContent='The endpoint returned no names it was confident enough about, or none survived verification against the text.';}
  else{state.entities=state.entities.concat(extra);refreshLinked();$('filter').value='all';render();$('ai-status').textContent='';status(extra.length+' possible name'+(extra.length===1?'':'s')+' suggested — review before masking, same as any other suggestion.');}
 }catch(err){$('ai-status').textContent='';status('AI scan failed: '+(err.message||'could not reach the endpoint')+'. The rest of Veil keeps working without it.',true);}
 finally{$('scan-ai').disabled=false;}
}
function renderBrainMemoryInfo(){const el=$('brain-memory-info');if(!el)return;const n=Object.keys(loadBrain()).length;el.textContent=n?n+' term'+(n===1?'':'s')+' remembered on this device.':'Nothing remembered yet.';}
// Orchestrates the public-knowledge check: known terms resolve instantly from local memory (never re-asked), only genuinely new terms go to the AI endpoint, one bare word at a time. Results surface in the graph itself — a dashed ring on the node, full detail when you select it — rather than a separate trace list, since the graph already shows which terms Veil recognises.
async function runBrainCheck(){
 if(!state.text)return status('Load a document first.',true);
 const candidates=C.publicCheckCandidates(state.entities);
 if(!candidates.length)return status('No names or custom terms to check yet.');
 const toQuery=candidates.filter(c=>!brainLookup(c.value));
 if(!toQuery.length){status('All '+candidates.length+' term'+(candidates.length===1?'':'s')+' already known from memory — select a node in the graph to see them.');renderGraph();return;}
 if(!ai.endpoint)return status('Enter an endpoint URL in the AI panel above to check the '+toQuery.length+' unfamiliar term'+(toQuery.length===1?'':'s')+'.',true);
 $('check-brain').disabled=true;
 let checked=0,failed=0;
 for(let i=0;i<toQuery.length;i++){
  const c=toQuery[i];
  status('Checking “'+c.value+'” ('+(i+1)+'/'+toQuery.length+')…');
  try{
   const body={model:ai.model||'gemma-4-e4b-it',temperature:0,messages:[
    {role:'system',content:'You judge whether a single word or short phrase refers to something specific and publicly documented — e.g. a well-known public company, a famous public figure, or a project that has been publicly announced. A false "public" answer is far worse than a false "not_public" one: it could cause someone to leave sensitive information unmasked. So only answer "public" when you are highly confident you can identify this exact entity as genuinely, verifiably public. If you are not certain, or it could plausibly be a private individual, an internal project, or a non-public organisation, answer "not_public" or "unsure" instead of guessing. You are given no other context and must not guess at any document it might come from. Reply with ONLY a JSON object like {"verdict":"public"} or {"verdict":"not_public"} or {"verdict":"unsure"}, optionally with a short "note" field explaining your confidence. No other text.'},
    {role:'user',content:c.value}
   ]};
   const res=await fetch(ai.endpoint,{method:'POST',headers:{'Content-Type':'application/json',...(ai.key?{'Authorization':'Bearer '+ai.key}:{})},body:JSON.stringify(body)});
   state.aiUsed=true;updatePrivacyBadge();
   if(!res.ok)throw new Error('HTTP '+res.status);
   const data=await res.json();
   const content=data.choices?.[0]?.message?.content||'';
   let parsed={};
   try{parsed=JSON.parse(content);}catch{const m=content.match(/\{[\s\S]*\}/);if(m){try{parsed=JSON.parse(m[0]);}catch{}}}
   const allowed=new Set(['public','not_public','unsure']);
   const verdict=allowed.has(parsed.verdict)?parsed.verdict:'unsure';
   const note=typeof parsed.note==='string'?parsed.note.slice(0,200):'';
   brainRemember(c.value,verdict,note,state.filename);
   checked++;
  }catch(err){failed++;}
 }
 $('check-brain').disabled=false;
 renderBrainMemoryInfo();
 renderGraph();
 status('Checked '+checked+' term'+(checked===1?'':'s')+(failed?', '+failed+' failed — try again':'')+'. Select a node in the graph to see its result.',!!failed&&!checked);
}
// Lets the reviewer describe, in their own words, something that must not appear — not a pattern, a topic. Every sentence is checked against it and, on doubt, included: a missed match is worse than a false alarm here, same as the rest of Veil's AI-assisted suggestions, nothing is masked without the reviewer's own decision.
async function scanInstruction(){
 const instruction=$('exclude-input').value.trim();
 if(!instruction)return status('Describe what you don’t want in the text first.',true);
 if(!state.text)return status('Load a document first.',true);
 if(!ai.endpoint)return status('Enter an AI endpoint URL in one of the panels above first.',true);
 const sentences=C.splitSentences(state.text);
 if(!sentences.length)return status('Nothing to check yet.',true);
 const numbered=sentences.map((s,i)=>(i+1)+'. '+state.text.slice(s.start,s.end).trim()).join('\n');
 const body={model:ai.model||'gemma-4-e4b-it',temperature:0,messages:[
  {role:'system',content:'Given a user\'s instruction describing information they do not want to appear, and numbered sentences from a document, return ONLY a JSON array of the sentence numbers that relate to that instruction, even indirectly or partially. A missed relevant sentence is worse than flagging an unrelated one, so include a sentence whenever there is a reasonable chance it relates. Return [] if none relate. No other text.'},
  {role:'user',content:'Instruction: '+instruction+'\n\nSentences:\n'+numbered}
 ]};
 $('scan-exclude').disabled=true;$('exclude-status').textContent='Checking '+sentences.length+' sentence'+(sentences.length===1?'':'s')+' against your instruction…';
 try{
  const res=await fetch(ai.endpoint,{method:'POST',headers:{'Content-Type':'application/json',...(ai.key?{'Authorization':'Bearer '+ai.key}:{})},body:JSON.stringify(body)});
  state.aiUsed=true;updatePrivacyBadge();
  if(!res.ok)throw new Error('The endpoint returned HTTP '+res.status+'.');
  const data=await res.json();
  const content=data.choices?.[0]?.message?.content||'';
  let parsed=[];
  try{parsed=JSON.parse(content);}catch{const m=content.match(/\[[\s\S]*\]/);if(m){try{parsed=JSON.parse(m[0]);}catch{}}}
  const indices=[...new Set((Array.isArray(parsed)?parsed:[]).map(Number).filter(n=>Number.isInteger(n)&&n>=1&&n<=sentences.length))];
  if(!indices.length){$('exclude-status').textContent='No sentences matched that instruction.';}
  else{
   let n=state.entities.filter(e=>e.type==='instruction').length;
   const extra=indices.map(i=>{n++;const s=sentences[i-1];return {id:'instr'+n,type:'instruction',value:state.text.slice(s.start,s.end).trim(),placeholder:'[INSTRUCTION '+n+']',reason:'Matches your instruction: “'+instruction+'”',ranges:[{start:s.start,end:s.end}],decision:'mask'};});
   state.entities=state.entities.concat(extra);refreshLinked();$('filter').value='all';render();
   $('exclude-status').textContent='';status(extra.length+' sentence'+(extra.length===1?'':'s')+' matched and masked — review each in the findings list, same as any other suggestion.');
  }
 }catch(err){$('exclude-status').textContent='';status('Instruction scan failed: '+(err.message||'could not reach the endpoint')+'.',true);}
 finally{$('scan-exclude').disabled=false;}
}
function loadCompare(text,filename){if(!text||!text.trim())return status('Paste or choose a document to compare against.',true);state.compare={text,filename:filename||'Comparison document'};$('clear-compare').hidden=false;render();status('Compared against '+state.compare.filename+'.');}
function renderLeaks(){const el=$('leak-banner');if(!state.compare){el.hidden=true;el.innerHTML='';return;}const matches=C.crossDocumentMatches(state.entities,state.compare.text);const leaked=matches.filter(e=>e.decision==='mask');const pending=matches.filter(e=>e.decision!=='mask');el.hidden=false;if(!matches.length){el.innerHTML='<strong>None of these details showed up in '+C.escapeHtml(state.compare.filename)+'.</strong><p class="small muted">This only checks literal matches — different spellings, initials or nicknames would not be caught.</p>';return;}
 let html='';
 if(leaked.length)html+='<strong>'+leaked.length+' masked detail'+(leaked.length===1?'':'s')+' still appear'+(leaked.length===1?'s':'')+' in the clear in '+C.escapeHtml(state.compare.filename)+' — masking it here did not stop that.</strong><ul>'+leaked.map(l=>'<li>'+C.escapeHtml(l.value)+' ('+(types[l.type]||l.type)+')</li>').join('')+'</ul>';
 else html+='<strong>Nothing you\'ve masked so far leaks into '+C.escapeHtml(state.compare.filename)+'.</strong>';
 if(pending.length)html+='<p class="small muted">Not masked (undecided or kept), and also present there: '+pending.map(p=>C.escapeHtml(p.value)).join(', ')+'.</p>';
 html+='<p class="small muted">Anyone who sees both documents could still connect them through these details. Veil’s own pattern check might not have flagged these on their own in the second document — this only works because you already told Veil they matter here.</p>';
 el.innerHTML=html;}
function renderGraph(){const panel=$('graph-panel');if(panel.hidden){stopGraphSim();return;}renderBrainMemoryInfo();const {nodes,edges}=C.coOccurrence(state.text,state.entities);if(!nodes.length){stopGraphSim();graphState=null;graphEls=null;$('graph-svg').innerHTML='<p class="small muted">No details detected yet.</p>';$('graph-actions').innerHTML='';return;}
 const matches=state.compare?C.crossDocumentMatches(state.entities,state.compare.text):[];
 const leakIds=new Set(matches.filter(e=>e.decision==='mask').map(e=>e.id));
 const alsoIds=new Set(matches.filter(e=>e.decision!=='mask').map(e=>e.id));
 const cap=14;const strength=id=>edges.filter(e=>e.a===id||e.b===id).reduce((s,e)=>s+e.weight,0);const shown=[...nodes].sort((a,b)=>strength(b.id)-strength(a.id)).slice(0,cap);const shownIds=new Set(shown.map(n=>n.id));const shownEdges=edges.filter(e=>shownIds.has(e.a)&&shownIds.has(e.b));
 const kept=new Map();shown.forEach((n,i)=>kept.set(n.id,graphPos.get(n.id)||seedGraphPos(i,shown.length)));graphPos=kept;
 const brain=loadBrain();
 graphState={shown,shownEdges,leakIds,alsoIds,totalNodes:nodes.length,cap,brainSeen:new Set(shown.filter(n=>brain[n.label.toLowerCase()]).map(n=>n.id))};
 renderGraphActions();buildGraphDOM();startGraphSim();
}
function addCustom(){const term=$('custom-input').value.trim();if(!term)return status('Enter the exact term you want to protect.',true);if(state.terms.some(t=>t.toLowerCase()===term.toLowerCase()))return status('That custom term is already on your list.');if(!C.detect(state.text,[term]).some(e=>e.type==='custom'))return status('That exact term was not found as a complete word or phrase. Check its spelling.',true);state.terms.push(term);$('custom-input').value='';$('filter').value='all';rescan();const custom=state.entities.find(e=>e.type==='custom'&&e.value===term);if(custom)focusFinding(custom.id);status('Custom term added. Review all of its occurrences together.');}
function focusFinding(id){$('filter').value='all';renderFindings();const node=$('finding-'+id);if(node){const list=$('findings-list');list.scrollTop=node.offsetTop-list.offsetTop;node.classList.add('flash');node.querySelector('button')?.focus({preventScroll:true});setTimeout(()=>node.classList.remove('flash'),1800);}}
async function importFile(file){if(!file||importBusy)return;if(file.size>8*1024*1024)return status('Choose a file smaller than 8 MB.',true);const ext=file.name.split('.').pop().toLowerCase();if(!['txt','md','docx','pdf'].includes(ext))return status('Supported files: TXT, Markdown, DOCX and PDFs with selectable text.',true);importBusy=true;$('analyse-paste').disabled=true;$('load-sample').disabled=true;status('Reading the document on this device…');try{let text='';if(ext==='txt'||ext==='md')text=await file.text();if(ext==='docx'){if(!window.mammoth)throw new Error('The Word reader could not load. Paste the document text instead.');const result=await mammoth.extractRawText({arrayBuffer:await file.arrayBuffer()});text=result.value;}if(ext==='pdf'){const pdfjs=await import('./vendor/pdf.mjs');pdfjs.GlobalWorkerOptions.workerSrc=new URL('./vendor/pdf.worker.mjs',location.href).href;const pdf=await pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false,useSystemFonts:true}).promise;if(pdf.numPages>100){await pdf.destroy();throw new Error('Use a PDF with 100 pages or fewer.');}const pages=[];for(let p=1;p<=pdf.numPages;p++){const page=await pdf.getPage(p);const tc=await page.getTextContent();pages.push(tc.items.map(i=>i.str+(i.hasEOL?'\n':' ')).join(''));}await pdf.destroy();text=pages.join('\n\n');if(text.trim().length<20)throw new Error('No usable text was found. Scanned PDFs need OCR first; paste the resulting text here.');}if(text.includes('\u0000'))throw new Error('This file does not look like plain text. Try a supported document format.');if(scan(text,file.name))status('Document loaded. Review suggestions and unmarked text.');}catch(err){status(err.message||'Could not read this document. Paste its text instead.',true);}finally{importBusy=false;$('analyse-paste').disabled=false;$('load-sample').disabled=false;$('file-input').value='';}}
function download(content,type,name){const blob=new Blob([content],{type});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);}
function ready(){if(state.entities.some(e=>e.decision==='pending')||!$('review-confirm').checked){status('Complete every decision and confirm your full review before exporting.',true);return false;}return true;}
function exportText(){if(!ready())return;download(C.redact(state.text,state.entities,state.mode),'text/plain;charset=utf-8','veil-edited-document.txt');status('Edited text exported. The original file was not changed.');}
function exportReport(){if(!ready())return;const masked=state.entities.filter(e=>e.decision==='mask');const kept=state.entities.filter(e=>e.decision==='keep');const rows=Object.keys(types).map(type=>{const m=masked.filter(e=>e.type===type),k=kept.filter(e=>e.type===type);return '<tr><td>'+types[type]+'</td><td>'+m.length+'</td><td>'+m.reduce((a,e)=>a+e.ranges.length,0)+'</td><td>'+k.length+'</td></tr>';}).join('');const html='<!doctype html><html lang="en"><meta charset="utf-8"><title>Veil review record</title><style>body{max-width:850px;margin:60px auto;padding:0 25px;font:16px/1.65 system-ui;color:#183b2c}h1{font-size:36px}table{border-collapse:collapse;width:100%;margin:30px 0}th,td{text-align:left;border-bottom:1px solid #ccd9cf;padding:12px}p{color:#52695b}</style><h1>Veil · Review record</h1><p>Created '+C.escapeHtml(new Date().toISOString())+'</p><p>The reviewer confirmed that the whole document was checked. This is a summary of decisions, not an approval to share or a change of classification.</p><table><thead><tr><th>Category</th><th>Masked details</th><th>Masked occurrences</th><th>Kept details</th></tr></thead><tbody>'+rows+'</tbody></table><p>Replacement style: '+(state.mode==='labels'?'Consistent category labels':'Removal markers')+'. Original values, document text and the original filename are deliberately excluded from this record.</p><p>Detection uses patterns and reviewer-added terms. Missed sensitive details and indirect identification remain possible.</p></html>';download(html,'text/html;charset=utf-8','veil-review-record.html');status('Review record exported without original values or document content.');}
$('load-sample').addEventListener('click',()=>scan(SAMPLE,'Vendor due diligence memo · example',true));$('analyse-paste').addEventListener('click',()=>scan($('paste-input').value,'Pasted document'));$('file-input').addEventListener('change',e=>importFile(e.target.files[0]));$('dropzone').addEventListener('dragover',e=>{e.preventDefault();$('dropzone').classList.add('dragover');});$('dropzone').addEventListener('dragleave',()=>$('dropzone').classList.remove('dragover'));$('dropzone').addEventListener('drop',e=>{e.preventDefault();$('dropzone').classList.remove('dragover');importFile(e.dataTransfer.files[0]);});$('new-document').addEventListener('click',()=>{if(importBusy)return;if(state.text&&!confirm('Clear this review and start a new document?'))return;state={text:'',entities:[],terms:[],view:'original',mode:'labels',selectedNode:null,compare:null,aiUsed:false};updatePrivacyBadge();$('paste-input').value='';$('risk-banner').hidden=true;$('leak-banner').hidden=true;$('graph-svg').innerHTML='';$('graph-actions').innerHTML='';$('compare-input').value='';$('clear-compare').hidden=true;$('ai-status').textContent='';stopGraphSim();graphPos=new Map();graphState=null;graphEls=null;$('exclude-input').value='';$('exclude-status').textContent='';$('exclude-panel').hidden=true;$('toggle-exclude').setAttribute('aria-expanded','false');$('review-view').hidden=true;$('import-view').hidden=false;$('step-import').className='step current';$('step-review').className='step';$('step-export').className='step';$('document-content').textContent='';$('findings-list').textContent='';$('filename').textContent='';$('custom-input').value='';$('review-confirm').checked=false;});$('tab-original').addEventListener('click',()=>{state.view='original';renderDocument();});$('tab-preview').addEventListener('click',()=>{state.view='preview';renderDocument();});$('filter').addEventListener('change',renderFindings);$('findings-list').addEventListener('click',e=>{const btn=e.target.closest('[data-decision]');if(!btn)return;const entity=state.entities.find(x=>x.id===btn.dataset.id);entity.decision=btn.dataset.decision;$('review-confirm').checked=false;refreshLinked();render();});$('mask-all').addEventListener('click',()=>{state.entities.forEach(e=>e.decision='mask');$('review-confirm').checked=false;refreshLinked();render();status('All suggestions set to mask. Read the entire document before exporting.');});$('add-custom').addEventListener('click',addCustom);$('custom-input').addEventListener('keydown',e=>{if(e.key==='Enter')addCustom();});$('custom-terms').addEventListener('click',e=>{const btn=e.target.closest('[data-remove]');if(btn){state.terms.splice(Number(btn.dataset.remove),1);rescan();}});$('document-content').addEventListener('click',e=>{const mark=e.target.closest('[data-entity]');if(mark)focusFinding(mark.dataset.entity);});$('document-content').addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.dataset.entity){e.preventDefault();focusFinding(e.target.dataset.entity);}});$('replacement').addEventListener('change',()=>{state.mode=$('replacement').value;$('review-confirm').checked=false;renderDocument();renderSummary();});$('review-confirm').addEventListener('change',renderSummary);$('export-text').addEventListener('click',exportText);$('export-report').addEventListener('click',exportReport);$('about').addEventListener('click',()=>$('about-dialog').showModal());$('close-about').addEventListener('click',()=>$('about-dialog').close());$('about-done').addEventListener('click',()=>$('about-dialog').close());
$('toggle-graph').addEventListener('click',()=>{const panel=$('graph-panel');panel.hidden=!panel.hidden;$('toggle-graph').setAttribute('aria-expanded',String(!panel.hidden));$('toggle-graph').textContent=panel.hidden?'Show how details connect ▾':'Hide how details connect ▴';if(panel.hidden)stopGraphSim();else renderGraph();});
function openCompareNode(){const panel=$('compare-panel');panel.hidden=false;$('toggle-compare').setAttribute('aria-expanded','true');$('toggle-compare').textContent='Hide document comparison ▴';panel.scrollIntoView({block:'center',behavior:'smooth'});}
function highlightInText(text,term){const esc=term.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');const re=new RegExp('\\b'+esc+'\\b','gi');let out='',cursor=0,m;while((m=re.exec(text))){out+=C.escapeHtml(text.slice(cursor,m.index))+'<mark>'+C.escapeHtml(m[0])+'</mark>';cursor=m.index+m[0].length;}return out+C.escapeHtml(text.slice(cursor));}
// Shows the actual comparison document you loaded, with the clicked detail highlighted in place — the same document behind the leak/also-present lines in the graph, not a separate mockup.
function openCompareDocPreview(entityId){
 if(!state.compare)return;
 const entity=state.entities.find(e=>e.id===entityId);
 if(!entity)return;
 $('compare-doc-title').textContent=state.compare.filename;
 $('compare-doc-content').innerHTML=highlightInText(state.compare.text,entity.value);
 $('compare-doc-dialog').showModal();
 $('compare-doc-content').querySelector('mark')?.scrollIntoView({block:'center'});
}
$('graph-svg').addEventListener('click',e=>{const g=e.target.closest('[data-node]');if(g){selectNode(g.dataset.node);return;}const line=e.target.closest('[data-target]');if(line){selectNode(line.dataset.target);openCompareDocPreview(line.dataset.target);}});
$('close-compare-doc').addEventListener('click',()=>$('compare-doc-dialog').close());
$('graph-svg').addEventListener('keydown',e=>{const g=e.target.closest('[data-node]');if(g&&(e.key==='Enter'||e.key===' ')){e.preventDefault();selectNode(g.dataset.node);}});
$('graph-actions').addEventListener('click',e=>{if(e.target.id==='mask-connected'){const sel=state.selectedNode;if(!sel)return;const {edges}=C.coOccurrence(state.text,state.entities);const ids=new Set([sel,...edges.filter(ed=>ed.strong&&(ed.a===sel||ed.b===sel)).map(ed=>ed.a===sel?ed.b:ed.a)]);state.entities.forEach(en=>{if(ids.has(en.id))en.decision='mask';});$('review-confirm').checked=false;refreshLinked();render();status('Masked the selected detail and everything directly tied to it.');}if(e.target.id==='focus-connected'){if(state.selectedNode)focusFinding(state.selectedNode);}if(e.target.id==='open-compare-panel'){openCompareNode();}const focusLink=e.target.closest('[data-focus]');if(focusLink){e.preventDefault();focusFinding(focusLink.dataset.focus);}const viewLink=e.target.closest('[data-view-compare]');if(viewLink){e.preventDefault();openCompareDocPreview(viewLink.dataset.viewCompare);}});
$('toggle-compare').addEventListener('click',()=>{const panel=$('compare-panel');panel.hidden=!panel.hidden;$('toggle-compare').setAttribute('aria-expanded',String(!panel.hidden));$('toggle-compare').textContent=panel.hidden?'Compare with another document ▾':'Hide document comparison ▴';});
$('load-compare-sample').addEventListener('click',()=>{$('compare-input').value=SAMPLE_COMPARE;loadCompare(SAMPLE_COMPARE,'Vendor briefing email · example');});
$('load-compare-sample2').addEventListener('click',()=>{$('compare-input').value=SAMPLE_COMPARE2;loadCompare(SAMPLE_COMPARE2,'Meeting notes · example');});
$('analyse-compare').addEventListener('click',()=>loadCompare($('compare-input').value,'Pasted comparison document'));
$('compare-file').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;const ext=file.name.split('.').pop().toLowerCase();if(!['txt','md'].includes(ext))return status('The comparison slot supports TXT or Markdown. Paste other formats as text instead.',true);const text=await file.text();$('compare-input').value=text;loadCompare(text,file.name);$('compare-file').value='';});
$('clear-compare').addEventListener('click',()=>{state.compare=null;$('compare-input').value='';$('clear-compare').hidden=true;render();status('Comparison cleared.');});
$('toggle-ai').addEventListener('click',()=>{const panel=$('ai-panel');panel.hidden=!panel.hidden;$('toggle-ai').setAttribute('aria-expanded',String(!panel.hidden));});
$('ai-endpoint').addEventListener('input',()=>{ai.endpoint=$('ai-endpoint').value.trim();});
$('ai-key').addEventListener('input',()=>{ai.key=$('ai-key').value;});
$('ai-model').addEventListener('input',()=>{ai.model=$('ai-model').value.trim();});
$('scan-ai').addEventListener('click',scanWithAi);
$('check-brain').addEventListener('click',runBrainCheck);
$('brain-forget-all').addEventListener('click',()=>{if(!confirm('Forget all remembered public-knowledge terms on this device?'))return;brainClear();renderBrainMemoryInfo();renderGraph();status('Brain memory cleared.');});
$('toggle-exclude').addEventListener('click',()=>{const panel=$('exclude-panel');panel.hidden=!panel.hidden;$('toggle-exclude').setAttribute('aria-expanded',String(!panel.hidden));});
$('scan-exclude').addEventListener('click',scanInstruction);
$('exclude-input').addEventListener('keydown',e=>{if(e.key==='Enter')scanInstruction();});

