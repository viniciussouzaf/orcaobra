"use strict";
/* ============ UTIL ============ */
const $=(s,r=document)=>r.querySelector(s);
const uid=()=>Math.random().toString(36).slice(2,9)+Date.now().toString(36).slice(-4);
const money=v=>'R$ '+(+v||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
const num=v=>(+v||0).toLocaleString('pt-BR',{maximumFractionDigits:2});
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const today=()=>new Date().toISOString().slice(0,10);
const fdate=d=>d?d.split('-').reverse().join('/'):'—';
const pct=v=>(isFinite(v)?v:0).toFixed(1).replace('.',',')+'%';

/* ============ BANCO (localStorage) ============ */
const KEY='orcaobra_db_v3';
let mem=null;
const SERV0=[['Alvenaria (levantar parede)','m²'],['Chapisco','m²'],['Emboço / Reboco','m²'],['Contrapiso','m²'],['Assentamento de piso','m²'],['Assentamento de revestimento (azulejo)','m²'],['Rejuntamento','m²'],['Pintura interna','m²'],['Pintura externa','m²'],['Massa corrida','m²'],['Demolição','m²'],['Ponto hidráulico','ponto'],['Ponto elétrico','ponto'],['Forro de gesso','m²'],['Telhado (mão de obra)','m²'],['Muro','m'],['Laje','m²'],['Impermeabilização','m²'],['Limpeza final','serviço']];
const MAT0=[['Cimento CP II 50 kg','Cimento','saco'],['Cal hidratada 20 kg','Cimento','saco'],['Areia média','Areia','m³'],['Areia fina','Areia','m³'],['Brita 1','Brita','m³'],['Tijolo 8 furos','Tijolos','milheiro'],['Bloco de concreto','Blocos','un'],['Argamassa AC-II 20 kg','Argamassa','saco'],['Rejunte','Argamassa','kg'],['Piso cerâmico','Pisos','m²'],['Revestimento cerâmico','Revestimentos','m²'],['Tinta acrílica 18 L','Tintas','lata'],['Massa corrida 25 kg','Tintas','lata'],['Tubo PVC 100 mm','Tubos','barra'],['Fio 2,5 mm','Elétrica','rolo'],['Vergalhão 8 mm','Ferragens','barra']];
function fresh(){
  return {seq:1,config:{nome:'Fernando',tel:'',diaria:0,hora:0,modo:'diaria',margem:20,validade:15},
    clientes:[],fornecedores:[],equipe:[],equipamentos:[],ferramentas:[],veiculos:[],orcamentos:[],obras:[],
    servicos:SERV0.map(([nome,unidade])=>({id:uid(),nome,unidade,categoria:'',preco:0})),
    materiais:MAT0.map(([nome,categoria,unidade])=>({id:uid(),nome,categoria,unidade,preco:0,hist:[]}))};
}
let db;
function load(){try{const r=localStorage.getItem(KEY);db=r?JSON.parse(r):fresh();}catch(e){db=mem||fresh();}
  const b=fresh();Object.keys(b).forEach(k=>{if(db[k]==null)db[k]=b[k];});db.config=Object.assign(b.config,db.config);}
function save(){mem=db;try{localStorage.setItem(KEY,JSON.stringify(db));}catch(e){}}
load();

/* ============ CÁLCULO ============ */
const GROUPS={materiais:'Materiais',fernando:'Seu trabalho',equipe:'Ajudantes',terceiros:'Terceiros',equipamentos:'Equipamentos',ferramentas:'Ferramentas',transporte:'Transporte',alimentacao:'Alimentação',hospedagem:'Hospedagem',outros:'Outros gastos'};
const CATG={material:'materiais',ajudante:'equipe',profissional:'terceiros',equipamento:'equipamentos',ferramenta:'ferramentas',transporte:'transporte',alimentacao:'alimentacao',hospedagem:'hospedagem',outro:'outros'};
const NODIAS=['material','transporte','outro'];
const rowTotal=i=>(+i.qtd||0)*(NODIAS.includes(i.cat)?1:(+i.dias||1))*(+i.valor||0);
function calc(o){
  const G={};Object.keys(GROUPS).forEach(k=>G[k]=0);
  const cli=[];let semPreco=0;
  const SOASE=['transporte','alimentacao','hospedagem'];
  (o.itens||[]).forEach(i=>{
    if(i.payer==='cliente'){cli.push(i);return;}
    if(SOASE.includes(i.cat)&&i.payer!=='eu')return;
    const eqProprio=(i.cat==='equipamento'||i.cat==='ferramenta')&&i.payer==='eu';
    if(!(+i.valor>0)&&!eqProprio)semPreco++;
    let g=CATG[i.cat];if(i.payer==='terceiro')g='terceiros';
    let t=rowTotal(i);if(i.cat==='material'&&i.payer==='eu')t*=1+(+o.perdas||0)/100;
    G[g]+=t;
  });
  const f=o.fernando||{};
  G.fernando=f.trabalha?((f.modo==='diaria'||f.modo==='hora')?(+f.valor||0)*(+f.qtd||0):(+f.valor||0)):0;
  const oper=Object.keys(G).filter(k=>k!=='fernando').reduce((s,k)=>s+G[k],0);
  const total=oper+G.fernando,preco=+o.preco||0,lucro=preco-total,prazo=+o.prazo||0;
  const m=+o.margemDes||0;
  return {G,oper,total,preco,lucro,margem:preco?lucro/preco*100:0,prazo,lucroDia:prazo?lucro/prazo:0,
    bolso:G.fernando+lucro,bolsoDia:prazo?(G.fernando+lucro)/prazo:0,minimo:total,
    sugerido:m<100?total/(1-m/100):total,cli,semPreco,
    ref:(o.servicos||[]).reduce((s,x)=>s+(+x.qtd||0)*(+x.preco||0),0)};
}
function radar(o,c){
  const L=[],add=(n,t)=>L.push({n,t});
  if(c.preco>0&&c.preco<c.total)add('risk',`O preço está ${money(c.total-c.preco)} abaixo do custo total: você terá prejuízo.`);
  if(!c.preco)add('warn','Você ainda não informou quanto vai cobrar.');
  else if(c.preco>=c.total&&c.margem<15)add('warn',`Margem de lucro baixa (${pct(c.margem)}). Um imprevisto pode acabar com ela.`);
  if(!(o.servicos||[]).length)add('warn','Nenhum serviço foi listado.');
  if(!c.prazo)add('warn','Prazo não informado: o lucro por dia não pode ser calculado.');
  if(!(o.fernando&&o.fernando.trabalha))add('warn','Você não incluiu o seu próprio trabalho no custo.');
  else if(!c.G.fernando)add('warn','O valor do seu trabalho está zerado.');
  if(c.semPreco)add('warn',`${c.semPreco} item(ns) que você paga estão sem preço.`);
  if(o.matMode!=='cliente'&&!(o.itens||[]).some(i=>i.cat==='material'))add('warn','Nenhum material lançado. Se o cliente compra tudo, marque isso no passo Materiais.');
  if(!o.semTransp&&!(o.itens||[]).some(i=>i.cat==='transporte'))add('warn','Transporte não considerado. Se não tem custo, marque no passo Transporte.');
  if(!c.G.materiais&&o.matMode==='eu'&&(o.itens||[]).some(i=>i.cat==='material'))add('warn','Materiais sem valor.');
  if(!L.length)add('ok','Tudo certo: nenhum ponto de atenção encontrado.');
  const nivel=L.some(x=>x.n==='risk')?'risk':L.some(x=>x.n==='warn')?'warn':'ok';
  return {L,nivel};
}
const NIVEL={ok:'🟢 OK',warn:'🟡 Atenção',risk:'🔴 Risco de prejuízo'};
const totReal=ob=>(ob.lancs||[]).reduce((s,x)=>s+(+x.valor||0),0);

/* ============ CADASTROS (definição) ============ */
const UN=['un','m','m²','m³','kg','saco','lata','barra','rolo','milheiro','ponto','dia','hora','serviço'];
const CAD={
 clientes:{t:'Clientes',s:'cliente',ico:'👥',f:[['nome','Nome completo','text',1],['tel','Telefone / WhatsApp','tel'],['email','E-mail','email'],['docto','CPF / CNPJ','text'],['endereco','Endereço','text'],['cidade','Cidade','text'],['obs','Observações','area']],sub:x=>[x.tel,x.cidade].filter(Boolean).join(' · ')||'sem contato',rt:x=>db.orcamentos.filter(o=>o.clienteId===x.id).length+' orç.'},
 materiais:{t:'Materiais',s:'material',ico:'🧱',f:[['nome','Nome do material','text',1],['categoria','Categoria','sel',0,['Cimento','Areia','Brita','Tijolos','Blocos','Argamassa','Revestimentos','Pisos','Tintas','Tubos','Conexões','Elétrica','Hidráulica','Ferragens','Madeira','Metais','Louças','Acabamento','Outros']],['marca','Marca','text'],['unidade','Unidade','sel',1,UN],['preco','Preço atual (R$)','num'],['fornecedor','Fornecedor','text'],['codSinapi','Código SINAPI (referência)','text'],['refSinapi','Preço de referência SINAPI (R$)','num'],['obs','Observações','area']],sub:x=>[x.categoria,x.unidade,x.fornecedor].filter(Boolean).join(' · '),rt:x=>x.preco?money(x.preco):'sem preço'},
 servicos:{t:'Serviços',s:'serviço',ico:'🛠️',f:[['nome','Nome do serviço','text',1],['categoria','Categoria','text'],['unidade','Unidade de cobrança','sel',1,UN],['preco','Meu preço de venda por unidade (R$)','num'],['obs','Composição / observações (ex.: cimento, areia, pedreiro + ajudante, betoneira)','area']],sub:x=>[x.categoria,'por '+(x.unidade||'un')].filter(Boolean).join(' · '),rt:x=>x.preco?money(x.preco):'—'},
 equipe:{t:'Mão de obra / Equipe',s:'profissional',ico:'👷',f:[['nome','Nome','text',1],['funcao','Função','sel',1,['Ajudante','Servente','Pedreiro','Azulejista','Pintor','Eletricista','Encanador','Gesseiro','Carpinteiro','Armador','Outro']],['tel','Telefone','tel'],['diaria','Valor da diária (R$)','num'],['hora','Valor da hora (R$)','num'],['empreitada','Valor por empreitada (R$)','num'],['obs','Observações','area']],sub:x=>[x.funcao,x.tel].filter(Boolean).join(' · '),rt:x=>x.diaria?money(x.diaria)+'/dia':'—'},
 equipamentos:{t:'Equipamentos',s:'equipamento',ico:'⚙️',f:[['nome','Nome','text',1],['categoria','Categoria','sel',0,['Betoneira','Andaime','Compactador','Gerador','Compressor','Máquina de corte','Equipamento de pintura','Outros']],['marca','Marca / modelo','text'],['posse','Próprio ou alugado?','sel',1,['Próprio','Alugado']],['preco','Custo por dia (R$) — aluguel ou desgaste','num'],['fornecedor','Locadora / fornecedor','text'],['codSinapi','Código SINAPI (referência)','text'],['obs','Observações','area']],sub:x=>[x.posse,x.categoria,x.fornecedor].filter(Boolean).join(' · '),rt:x=>x.preco?money(x.preco)+'/dia':'—'},
 ferramentas:{t:'Ferramentas',s:'ferramenta',ico:'🔨',f:[['nome','Nome','text',1],['categoria','Categoria','text'],['posse','Própria ou alugada?','sel',1,['Própria','Alugada']],['preco','Custo por dia (R$)','num'],['fornecedor','Fornecedor','text'],['codSinapi','Código SINAPI (referência)','text'],['obs','Observações','area']],sub:x=>[x.posse,x.categoria].filter(Boolean).join(' · '),rt:x=>x.preco?money(x.preco)+'/dia':'—'},
 fornecedores:{t:'Fornecedores',s:'fornecedor',ico:'🏪',f:[['nome','Nome / Razão social','text',1],['docto','CNPJ','text'],['tel','Telefone / WhatsApp','tel'],['email','E-mail','email'],['cidade','Cidade','text'],['cats','Categorias fornecidas','text'],['obs','Observações','area']],sub:x=>[x.tel,x.cidade].filter(Boolean).join(' · ')||'sem contato',rt:()=>''},
 veiculos:{t:'Transporte / Veículos',s:'veículo',ico:'🚚',f:[['nome','Veículo','text',1],['tipo','Tipo','sel',0,['Carro','Moto','Caminhonete','Caminhão','Outro']],['comb','Combustível','sel',0,['Gasolina','Etanol','Diesel','Flex','Elétrico']],['custoKm','Custo estimado por km (R$)','num'],['cap','Capacidade','text'],['obs','Observações','area']],sub:x=>[x.tipo,x.comb].filter(Boolean).join(' · '),rt:x=>x.custoKm?money(x.custoKm)+'/km':'—'}
};

/* ============ SHELL / ROUTER ============ */
let ROUTE='home';let PARAMS={};
function go(r,p={}){if(typeof p==='string')p={id:p};ROUTE=r;PARAMS=p;location.hash='#'+r+(p.id?'/'+p.id:'');render();window.scrollTo(0,0);}
window.addEventListener('hashchange',()=>{const h=location.hash.replace('#','');const[r,id]=h.split('/');if(r){ROUTE=r;PARAMS=id?{id}:{};render();}});

function toast(msg){const t=$('#toast');t.textContent=msg;t.hidden=false;clearTimeout(toast._t);toast._t=setTimeout(()=>t.hidden=true,2200);}
function closeSheet(){$('#sheetwrap').hidden=true;$('#sheet').innerHTML='';}
function openSheet(html){$('#sheet').innerHTML=html;$('#sheetwrap').hidden=false;}
$('#sheetwrap').addEventListener('click',e=>{if(e.target.id==='sheetwrap')closeSheet();});

function confirmDel(label,fn){
  openSheet(`<h2>Excluir ${esc(label)}?</h2><p class="sub">Essa ação não pode ser desfeita.</p>
  <div class="btns" style="margin-top:16px"><button class="btn ghost" onclick="closeSheet()">Cancelar</button>
  <button class="btn red" id="_delok">Excluir</button></div>`);
  $('#_delok').onclick=()=>{fn();closeSheet();};
}

const NAVI=[['home','⌂','Início'],['orcamentos','📄','Orçamentos'],['obras','🏗️','Obras'],['mais','⚙️','Mais']];
function renderNav(){
  $('#nav').innerHTML=NAVI.map(([r,i,l])=>`<button class="${ROUTE===r||(ROUTE==='cad'&&r==='mais')||(ROUTE==='obra'&&r==='obras')||(ROUTE==='orcamento'&&r==='orcamentos')?'on':''}" onclick="go('${r}')"><i>${i}</i>${l}</button>`).join('');
}
function renderTop(){
  const back=!['home','orcamentos','obras','mais'].includes(ROUTE);
  $('#top').innerHTML=`${back?`<button class="ib" onclick="history.back()">←</button>`:''}
  <h1>${back?TITLE||'ORÇAOBRA':'<span class="logo">ORÇAOBRA</span>'}</h1>
  <button class="ib" onclick="go('busca')">🔎</button>`;
}
let TITLE='';

/* ============ CRUD GENÉRICO (cadastros) ============ */
function listCad(key){
  const c=CAD[key];TITLE=c.t;
  const rows=db[key];
  const html=`<div class="card"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
    <h2>${c.t}</h2><button class="btn acc" onclick="formCad('${key}')">+ Novo</button></div>
    <p class="sub">${rows.length} cadastrado(s)</p></div>
    ${rows.length?rows.map(x=>`<button class="li" onclick="formCad('${key}','${x.id}')">
      <div class="ic">${c.ico}</div><div class="tx"><b>${esc(x.nome)}</b><span>${esc(c.sub(x))}</span></div>
      <div class="rt">${esc(c.rt(x))}</div></button>`).join(''):
      `<div class="empty"><i>${c.ico}</i><b>Nada por aqui ainda</b><p>Cadastre o primeiro ${c.s}.</p></div>`}`;
  $('#main').innerHTML=html;
}
function fieldHtml([key,label,type,req,opts],val=''){
  if(type==='area')return `<div class="f"><label>${label}</label><textarea class="in" rows="2" data-k="${key}">${esc(val)}</textarea></div>`;
  if(type==='sel')return `<div class="f"><label>${label}</label><select class="in" data-k="${key}">
    <option value="">Selecionar…</option>${opts.map(o=>`<option ${val===o?'selected':''}>${o}</option>`).join('')}</select></div>`;
  const it=type==='num'?'number':type==='tel'?'tel':type==='email'?'email':'text';
  return `<div class="f"><label>${label}</label><input class="in" type="${it}" ${type==='num'?'step="0.01" min="0"':''} data-k="${key}" value="${esc(val)}"></div>`;
}
function formCad(key,id){
  const c=CAD[key];const editing=!!id;const item=editing?db[key].find(x=>x.id===id):{};TITLE=(editing?'Editar ':'Novo ')+c.s;
  const temSinapi=c.f.some(fd=>fd[0]==='codSinapi');
  $('#main').innerHTML=`
    ${temSinapi?`<div class="card"><button class="btn ghost block" id="_sinapiBtn">🔎 Buscar no SINAPI (preenche nome, unidade e código)</button></div>`:''}
    <div class="card">
    ${c.f.map(fd=>fieldHtml(fd,item[fd[0]]||'')).join('')}
    ${temSinapi&&item.codSinapi?`<p class="sub" style="margin:-4px 0 10px">Código ${esc(item.codSinapi)} — <a href="${sinapiLink(item.codSinapi,item.nome)}" target="_blank" rel="noopener">ver preço atualizado no Buscador SINAPI ↗</a></p>`:''}
    <div class="btns">
      <button class="btn block" id="_save">${editing?'Salvar alterações':'Cadastrar'}</button>
      ${editing?`<button class="btn red block" id="_del">Excluir</button>`:''}
    </div></div>`;
  if(temSinapi)$('#_sinapiBtn').onclick=()=>openSinapiSearch(r=>{
    const setv=(k,v)=>{const el=$(`#main [data-k="${k}"]`);if(el)el.value=v;};
    setv('nome',r.description);setv('codSinapi',r.code);
    const u=sinapiUnit(r.unit);if(u)setv('unidade',u);
    toast('Preenchido a partir do SINAPI — confira o preço no link após salvar.');
  });
  $('#_save').onclick=()=>{
    const o=editing?item:{id:uid()};
    $('#main').querySelectorAll('[data-k]').forEach(el=>{o[el.dataset.k]=el.type==='number'?(+el.value||0):el.value.trim();});
    if(!o.nome){toast('Preencha o nome.');return;}
    if(!editing)db[key].push(o);
    save();toast('Salvo!');go(key==='clientes'?'clientes':key);
  };
  if(editing)$('#_del').onclick=()=>confirmDel(item.nome,()=>{db[key]=db[key].filter(x=>x.id!==id);save();go(key);});
}
function pickerSheet(key,cb,{allowNew=true,extraLabel}={}){
  const c=CAD[key];
  openSheet(`<h2>Selecionar ${c.s}</h2>
    <input class="in" id="_pq" placeholder="Buscar ${c.s}…" style="margin:10px 0">
    <div id="_plist"></div>
    ${allowNew?`<button class="btn block acc" style="margin-top:10px" id="_pnew">+ Cadastrar novo ${c.s}</button>`:''}`);
  function draw(q){
    const rows=db[key].filter(x=>norm(x.nome).includes(norm(q)));
    $('#_plist').innerHTML=rows.length?rows.map(x=>`<button class="li" data-id="${x.id}">
      <div class="ic">${c.ico}</div><div class="tx"><b>${esc(x.nome)}</b><span>${esc(c.sub(x))}</span></div></button>`).join('')
      :`<p class="sub" style="padding:10px 0">Nada encontrado.</p>`;
    $('#_plist').querySelectorAll('[data-id]').forEach(b=>b.onclick=()=>{cb(db[key].find(x=>x.id===b.dataset.id));closeSheet();});
  }
  draw('');$('#_pq').oninput=e=>draw(e.target.value);
  if(allowNew)$('#_pnew').onclick=()=>{closeSheet();quickNew(key,cb);};
}
function quickNew(key,cb){
  const c=CAD[key];
  openSheet(`<h2>Novo ${c.s}</h2>${c.f.slice(0,3).map(fd=>fieldHtml(fd)).join('')}
    <div class="btns"><button class="btn block" id="_qsave">Cadastrar e usar</button></div>`);
  $('#_qsave').onclick=()=>{
    const o={id:uid()};$('#sheet').querySelectorAll('[data-k]').forEach(el=>{o[el.dataset.k]=el.type==='number'?(+el.value||0):el.value.trim();});
    if(!o.nome){toast('Preencha o nome.');return;}
    db[key].push(o);save();cb(o);closeSheet();toast('Cadastrado!');
  };
}

/* ============ BUSCA SINAPI (catálogo oficial CEF/IBGE, via api pública sinpres) ============ */
const SINAPI_UNIT_MAP={KG:'kg',M:'m','M2':'m²','M²':'m²','M3':'m³','M³':'m³',UN:'un',UNID:'un',H:'hora',HORA:'hora',SC:'saco',SACO:'saco',L:'lata',LATA:'lata',BARRA:'barra',ROLO:'rolo',MILHEIRO:'milheiro',PONTO:'ponto'};
function sinapiUnit(u){return SINAPI_UNIT_MAP[String(u||'').toUpperCase()]||'';}
async function sinapiFetch(q){
  const ctrl=new AbortController();const t=setTimeout(()=>ctrl.abort(),7000);
  try{
    const r=await fetch('https://api.sinpres.com.br/api/v1/sectors/civil-construction/items?search='+encodeURIComponent(q)+'&limit=15',{signal:ctrl.signal});
    clearTimeout(t);if(!r.ok)throw new Error('http '+r.status);
    const j=await r.json();return j.data||[];
  }catch(e){clearTimeout(t);throw e;}
}
function openSinapiSearch(cb){
  openSheet(`<h2>🔎 Buscar no SINAPI</h2>
    <p class="sub">Catálogo oficial (Caixa/IBGE) de materiais, equipamentos e mão de obra. Preenche nome, unidade e código — o preço de hoje no seu estado você confere com um clique no Buscador SINAPI.</p>
    <input class="in" id="_sq" placeholder="Nome ou código (ex: cimento, betoneira, 3410)" style="margin:10px 0">
    <div id="_sres"><p class="sub">Digite ao menos 3 letras…</p></div>`);
  let timer;
  $('#_sq').oninput=e=>{
    clearTimeout(timer);const q=e.target.value.trim();
    if(q.length<3){$('#_sres').innerHTML='<p class="sub">Digite ao menos 3 letras…</p>';return;}
    $('#_sres').innerHTML='<p class="sub">Buscando…</p>';
    timer=setTimeout(async()=>{
      try{
        const items=await sinapiFetch(q);
        if(!items.length){$('#_sres').innerHTML='<p class="sub">Nada encontrado. Tente outro termo, ou busque direto no <a href="https://buscadorsinapi.com.br/insumos" target="_blank" rel="noopener">Buscador SINAPI ↗</a>.</p>';return;}
        $('#_sres').innerHTML=items.map(it=>`<button class="li" data-code="${it.code}" data-desc="${esc(it.description)}" data-unit="${esc(it.unit||'')}">
          <div class="ic">🧱</div><div class="tx"><b>${esc(it.description)}</b><span>Código ${it.code} · ${esc(it.unit||'—')}</span></div></button>`).join('');
        $('#_sres').querySelectorAll('[data-code]').forEach(b=>b.onclick=()=>{
          cb({code:b.dataset.code,description:b.dataset.desc,unit:b.dataset.unit});closeSheet();
        });
      }catch(err){
        $('#_sres').innerHTML=`<p class="sub">Não consegui buscar agora (sem conexão com o serviço). Busque direto no <a href="https://buscadorsinapi.com.br/insumos" target="_blank" rel="noopener">Buscador SINAPI ↗</a> e digite o preço manualmente.</p>`;
      }
    },450);
  };
}
function sinapiLink(codigo,nome){
  return `https://buscadorsinapi.com.br/insumos?busca=${encodeURIComponent(codigo||nome||'')}`;
}

/* ============ HOME ============ */
function renderHome(){
  TITLE='';
  const os=db.orcamentos,obs=db.obras;
  const valorOrcado=os.reduce((s,o)=>s+calc(o).preco,0);
  const lucroPrev=os.reduce((s,o)=>s+calc(o).lucro,0);
  const andamento=obs.filter(o=>o.status==='Em andamento').length;
  const ultimos=[...os].sort((a,b)=>b.criado-a.criado).slice(0,5);
  $('#main').innerHTML=`
  <div class="card hero"><h2>Olá, ${esc(db.config.nome||'Fernando')}! 👋</h2><p class="sub">Vamos preparar seu próximo orçamento.</p></div>
  <div class="short">
    <button onclick="go('orcamento-novo')"><i>＋</i>Novo<br>Orçamento</button>
    <button onclick="go('clientes')"><i>👥</i>Clientes</button>
    <button onclick="go('materiais')"><i>🧱</i>Materiais</button>
    <button onclick="go('servicos')"><i>🛠️</i>Serviços</button>
  </div>
  <div class="g3" style="margin-bottom:12px">
    <div class="stat"><span>Orçamentos</span><b>${os.length}</b></div>
    <div class="stat"><span>Obras em andamento</span><b>${andamento}</b></div>
    <div class="stat"><span>Valor orçado</span><b>${money(valorOrcado)}</b></div>
  </div>
  <div class="g3" style="margin-bottom:16px">
    <div class="stat"><span>Lucro previsto</span><b>${money(lucroPrev)}</b></div>
    <div class="stat"><span>Custo previsto</span><b>${money(os.reduce((s,o)=>s+calc(o).total,0))}</b></div>
    <div class="stat"><span>Lucro realizado</span><b>${money(obs.filter(o=>o.status==='Concluída').reduce((s,o)=>{const or=db.orcamentos.find(x=>x.id===o.orcamentoId);return s+((or?calc(or).preco:0)-totReal(o));},0))}</b></div>
  </div>
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
    <h2>Últimos orçamentos</h2>${os.length>5?`<button class="btn ghost" onclick="go('orcamentos')">Ver todos</button>`:''}
  </div>
  ${ultimos.length?ultimos.map(o=>orcRow(o)).join(''):
   `<div class="empty"><i>📋</i><b>Nenhum orçamento ainda</b><p>Crie seu primeiro orçamento para começar.</p></div>`}`;
}
function orcRow(o){
  const c=calc(o);const cli=db.clientes.find(x=>x.id===o.clienteId);
  const r=radar(o,c);
  return `<button class="li" onclick="go('orcamento','${o.id}')"><div class="ic">📄</div>
    <div class="tx"><b>${esc(o.nomeObra||'Orçamento')}</b><span>${esc(cli?cli.nome:'—')} · <span class="badge ${r.nivel}">${NIVEL[r.nivel]}</span></span></div>
    <div class="rt">${money(c.preco)}</div></button>`;
}

/* ============ ORÇAMENTOS (lista) ============ */
function renderOrcamentos(){
  TITLE='Orçamentos';
  const os=[...db.orcamentos].sort((a,b)=>b.criado-a.criado);
  $('#main').innerHTML=`<div class="card" style="display:flex;justify-content:space-between;align-items:center">
    <h2>${os.length} orçamento(s)</h2><button class="btn acc" onclick="go('orcamento-novo')">+ Novo</button></div>
    ${os.length?os.map(orcRow).join(''):`<div class="empty"><i>📄</i><b>Nenhum orçamento</b></div>`}`;
}

/* ============ OBRAS ============ */
const ST_OBRA=['Planejamento','Aguardando aprovação','Aprovada','Em andamento','Pausada','Concluída','Cancelada'];
function renderObras(){
  TITLE='Obras';
  const obs=[...db.obras].sort((a,b)=>b.criado-a.criado);
  $('#main').innerHTML=`<div class="card"><h2>${obs.length} obra(s)</h2><p class="sub">Uma obra nasce quando você aprova um orçamento.</p></div>
  ${obs.length?obs.map(o=>{
    const or=db.orcamentos.find(x=>x.id===o.orcamentoId);const c=or?calc(or):null;const cli=db.clientes.find(x=>x.id===o.clienteId);
    return `<button class="li" onclick="go('obra','${o.id}')"><div class="ic">🏗️</div>
    <div class="tx"><b>${esc(o.nome)}</b><span>${esc(cli?cli.nome:'—')} · <span class="badge">${o.status}</span></span></div>
    <div class="rt">${c?money(c.preco):''}</div></button>`;
  }).join(''):`<div class="empty"><i>🏗️</i><b>Nenhuma obra ainda</b><p>Aprove um orçamento para criar uma obra.</p></div>`}`;
}
function obraDetail(id){
  const o=db.obras.find(x=>x.id===id);TITLE=o.nome;
  const or=db.orcamentos.find(x=>x.id===o.orcamentoId);const c=or?calc(or):null;
  const cli=db.clientes.find(x=>x.id===o.clienteId);
  const real=totReal(o);
  const byCat={};Object.keys(GROUPS).forEach(k=>byCat[k]=0);
  (o.lancs||[]).forEach(l=>byCat[l.cat]=(byCat[l.cat]||0)+(+l.valor||0));
  const rowsCat=Object.keys(GROUPS).map(k=>{
    const orc=c?c.G[k]:0,rl=byCat[k]||0,dif=rl-orc;
    if(!orc&&!rl)return'';
    return `<tr><td>${GROUPS[k]}</td><td>${money(orc)}</td><td>${money(rl)}</td><td class="${dif>0?'over':'under'}">${dif>0?'+':''}${money(dif)}</td></tr>`;
  }).join('');
  $('#main').innerHTML=`
  <div class="card"><h2>${esc(o.nome)}</h2><p class="sub">${esc(cli?cli.nome:'—')} · ${esc(o.endereco||'')}</p>
    <div class="chips" style="margin-top:8px">${ST_OBRA.map(s=>`<span class="chip ${o.status===s?'on':''}" style="cursor:pointer" onclick="setObraStatus('${o.id}','${s}')">${s}</span>`).join('')}</div>
  </div>
  <div class="card"><h3>Orçado × Realizado</h3>
    <table class="tbl"><thead><tr><th>Categoria</th><th>Orçado</th><th>Realizado</th><th>Diferença</th></tr></thead>
    <tbody>${rowsCat||'<tr><td colspan="4" class="sub">Sem lançamentos ainda.</td></tr>'}</tbody></table>
    <div class="kv big" style="margin-top:8px"><span>Custo orçado</span><span>${c?money(c.total):'—'}</span></div>
    <div class="kv"><span>Custo real até agora</span><span>${money(real)}</span></div>
    <div class="kv"><span>Preço de venda</span><span>${c?money(c.preco):'—'}</span></div>
    <div class="kv big"><span>Lucro real (até agora)</span><span>${c?money(c.preco-real):'—'}</span></div>
    <div class="kv"><span>Margem prevista</span><span>${c?pct(c.margem):'—'}</span></div>
    <div class="kv"><span>Margem real (até agora)</span><span>${c&&c.preco?pct((c.preco-real)/c.preco*100):'—'}</span></div>
  </div>
  <div class="card"><div style="display:flex;justify-content:space-between;align-items:center"><h3>Gastos reais lançados</h3>
    <button class="btn ghost" onclick="addLanc('${o.id}')">+ Lançar gasto</button></div>
    ${(o.lancs||[]).length?o.lancs.map(l=>`<div class="kv"><span>${esc(GROUPS[l.cat]||l.cat)} — ${esc(l.desc||'')}</span><span>${money(l.valor)}
      <button class="btn ghost" style="padding:2px 8px;margin-left:6px" onclick="delLanc('${o.id}','${l.id}')">✕</button></span></div>`).join(''):
      '<p class="sub">Nenhum gasto lançado ainda.</p>'}
  </div>
  ${or?`<button class="btn ghost block" onclick="go('orcamento','${or.id}')">Ver orçamento original</button>`:''}`;
}
function setObraStatus(id,s){const o=db.obras.find(x=>x.id===id);o.status=s;save();obraDetail(id);}
function addLanc(obraId){
  openSheet(`<h2>Lançar gasto real</h2>
    <div class="f"><label>Categoria</label><select class="in" id="_lc">${Object.keys(GROUPS).map(k=>`<option value="${k}">${GROUPS[k]}</option>`).join('')}</select></div>
    <div class="f"><label>Descrição</label><input class="in" id="_ld" placeholder="Ex: cimento na loja X"></div>
    <div class="f"><label>Valor (R$)</label><input class="in" id="_lv" type="number" step="0.01" min="0"></div>
    <button class="btn block" id="_lok">Lançar</button>`);
  $('#_lok').onclick=()=>{
    const o=db.obras.find(x=>x.id===obraId);o.lancs=o.lancs||[];
    o.lancs.push({id:uid(),cat:$('#_lc').value,desc:$('#_ld').value.trim(),valor:+$('#_lv').value||0});
    save();closeSheet();obraDetail(obraId);
  };
}
function delLanc(obraId,lid){const o=db.obras.find(x=>x.id===obraId);o.lancs=o.lancs.filter(l=>l.id!==lid);save();obraDetail(obraId);}

/* ============ BUSCA GLOBAL ============ */
function renderBusca(){
  TITLE='Buscar';
  $('#main').innerHTML=`<input class="in" id="_bq" placeholder="Buscar clientes, obras, orçamentos, materiais…" style="margin-bottom:12px" autofocus><div id="_bres"></div>`;
  function draw(q){
    if(!q){$('#_bres').innerHTML='';return;}
    const out=[];
    const push=(ico,tit,sub,onclick)=>out.push(`<button class="li" onclick="${onclick}"><div class="ic">${ico}</div><div class="tx"><b>${esc(tit)}</b><span>${esc(sub)}</span></div></button>`);
    db.orcamentos.filter(o=>norm(o.nomeObra).includes(norm(q))).forEach(o=>push('📄',o.nomeObra,'Orçamento',`go('orcamento','${o.id}')`));
    db.obras.filter(o=>norm(o.nome).includes(norm(q))).forEach(o=>push('🏗️',o.nome,'Obra',`go('obra','${o.id}')`));
    ['clientes','materiais','servicos','equipe','equipamentos','ferramentas','fornecedores','veiculos'].forEach(key=>{
      db[key].filter(x=>norm(x.nome).includes(norm(q))).forEach(x=>push(CAD[key].ico,x.nome,CAD[key].t,`formCad('${key}','${x.id}')`));
    });
    $('#_bres').innerHTML=out.length?out.join(''):'<p class="sub">Nada encontrado.</p>';
  }
  $('#_bq').oninput=e=>draw(e.target.value);
}

/* ============ MAIS (config + menu de cadastros) ============ */
function renderMais(){
  TITLE='';
  const cfg=db.config;
  $('#main').innerHTML=`
  <div class="card"><h2>Cadastros</h2>
    ${Object.keys(CAD).map(k=>`<button class="li" onclick="go('${k}')"><div class="ic">${CAD[k].ico}</div>
      <div class="tx"><b>${CAD[k].t}</b><span>${db[k].length} cadastrado(s)</span></div><div class="rt">›</div></button>`).join('')}
  </div>
  <div class="card"><h3>Seu perfil</h3>
    <div class="f"><label>Seu nome</label><input class="in" id="_cn" value="${esc(cfg.nome)}"></div>
    <div class="f"><label>Valor padrão da diária (R$)</label><input class="in" type="number" id="_cd" value="${cfg.diaria||0}"></div>
    <div class="f"><label>Valor padrão da hora (R$)</label><input class="in" type="number" id="_ch" value="${cfg.hora||0}"></div>
    <div class="f"><label>Margem de lucro padrão (%)</label><input class="in" type="number" id="_cm" value="${cfg.margem||20}"></div>
    <div class="f"><label>Validade padrão da proposta (dias)</label><input class="in" type="number" id="_cv" value="${cfg.validade||15}"></div>
    <button class="btn block" id="_csave">Salvar perfil</button>
  </div>
  <div class="card"><h3>Dados</h3><p class="sub">Tudo fica salvo neste navegador (localStorage). Você pode exportar um backup em JSON.</p>
    <div class="btns"><button class="btn ghost" id="_exp">Exportar backup</button>
    <button class="btn ghost" id="_imp">Importar backup</button></div>
    <input type="file" id="_impf" accept="application/json" hidden></div>`;
  $('#_csave').onclick=()=>{cfg.nome=$('#_cn').value.trim()||'Fernando';cfg.diaria=+$('#_cd').value||0;cfg.hora=+$('#_ch').value||0;cfg.margem=+$('#_cm').value||0;cfg.validade=+$('#_cv').value||0;save();toast('Perfil salvo!');};
  $('#_exp').onclick=()=>{const a=document.createElement('a');a.href='data:application/json,'+encodeURIComponent(JSON.stringify(db));a.download='orcaobra-backup.json';a.click();};
  $('#_imp').onclick=()=>$('#_impf').click();
  $('#_impf').onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{db=JSON.parse(r.result);save();toast('Backup importado!');go('home');}catch(err){toast('Arquivo inválido.');}};r.readAsText(f);};
}

/* ============ WIZARD: NOVO ORÇAMENTO ============ */
let WZ=null,WSTEP=1;
function freshOrc(){
  const cfg=db.config;
  return {id:uid(),criado:Date.now(),clienteId:null,nomeObra:'',endereco:'',descricao:'',prazo:1,data:today(),validade:cfg.validade||15,
    servicos:[],matMode:'eu',perdas:0,itens:[],
    fernando:{trabalha:true,modo:cfg.modo||'diaria',valor:cfg.diaria||0,qtd:1},
    preco:0,margemDes:cfg.margem||20,status:'Rascunho'};
}
function orcamentoNovo(id){
  WZ=id?JSON.parse(JSON.stringify(db.orcamentos.find(o=>o.id===id))):freshOrc();
  if(!WZ.itens)WZ.itens=[];if(!WZ.servicos)WZ.servicos=[];
  ['transporte','alimentacao','hospedagem'].forEach(cat=>{
    if(!WZ.itens.some(i=>i.cat===cat))WZ.itens.push({id:uid(),cat,payer:cat==='transporte'?'eu':'nao',qtd:1,dias:1,valor:0,nome:GROUPS[cat]});
  });
  WSTEP=1;renderWizard();
}
function addItem(cat,extra){WZ.itens.push(Object.assign({id:uid(),cat,payer:'eu',qtd:1,dias:1,valor:0,nome:''},extra));}
function rmItem(id){WZ.itens=WZ.itens.filter(i=>i.id!==id);renderWizard();}
function singleItem(cat){return WZ.itens.find(i=>i.cat===cat);}
function setSingle(cat,patch){
  let it=singleItem(cat);
  if(!it){it={id:uid(),cat,payer:'cliente',qtd:1,dias:1,valor:0,nome:GROUPS[cat]};WZ.itens.push(it);}
  Object.assign(it,patch);
  if(it.payer==='cliente'||it.payer==='nao')it.valor=it.payer==='nao'?0:it.valor;
}

function itemRow(i,fields){ // fields: [[key,type,width]]
  return `<tr data-row="${i.id}">${fields.map(([k,t,w])=>{
    if(t==='txt')return `<td><input class="in" style="width:${w||110}px" data-id="${i.id}" data-field="${k}" value="${esc(i[k]||'')}"></td>`;
    if(t==='num')return `<td><input class="in" type="number" min="0" step="0.01" style="width:${w||80}px" data-id="${i.id}" data-field="${k}" value="${i[k]||0}"></td>`;
    if(t==='payer')return `<td><select class="in" style="width:${w||90}px" data-id="${i.id}" data-field="payer">
      <option value="eu" ${i.payer==='eu'?'selected':''}>Eu</option>
      <option value="cliente" ${i.payer==='cliente'?'selected':''}>Cliente</option>
      <option value="terceiro" ${i.payer==='terceiro'?'selected':''}>Terceiro</option></select></td>`;
    return '';
  }).join('')}<td data-total="${i.id}">${money(rowTotal(i))}</td>
  <td>${i.codSinapi?`<a href="${sinapiLink(i.codSinapi,i.nome)}" target="_blank" rel="noopener" title="Ver preço no SINAPI">🔗</a>`:''}</td>
  <td><button class="x" onclick="rmItem('${i.id}')">✕</button></td></tr>`;
}
function bindTables(){
  $('#main').querySelectorAll('tbody[data-arr]').forEach(tb=>{
    const arrName=tb.dataset.arr;
    ['input','change'].forEach(ev=>tb.addEventListener(ev,e=>{
      const el=e.target;if(!el.dataset.id)return;
      const arr=arrName==='itens'?WZ.itens:WZ.servicos;
      const it=arr.find(x=>x.id===el.dataset.id);if(!it)return;
      it[el.dataset.field]=el.type==='number'?(+el.value||0):el.value;
      const tot=tb.querySelector(`[data-total="${it.id}"]`);
      if(tot)tot.textContent=money(arrName==='itens'?rowTotal(it):(+it.qtd||0)*(+it.preco||0));
    }));
  });
}

function wstepHtml(s){
  const cli=WZ.clienteId&&db.clientes.find(x=>x.id===WZ.clienteId);
  if(s===1)return `<div class="card"><h3>1. Cliente e obra</h3>
    <div class="f"><label>Cliente</label>
      <button class="btn ghost block" style="justify-content:flex-start" id="_pickcli">${cli?'👤 '+esc(cli.nome)+' · trocar':'+ Selecionar / cadastrar cliente'}</button></div>
    <div class="f"><label>Nome da obra</label><input class="in" value="${esc(WZ.nomeObra)}" oninput="WZ.nomeObra=this.value" placeholder="Ex: Reforma apartamento 302"></div>
    <div class="f"><label>Endereço</label><input class="in" value="${esc(WZ.endereco)}" oninput="WZ.endereco=this.value"></div>
    <div class="f"><label>O que você vai fazer?</label><textarea class="in" rows="2" oninput="WZ.descricao=this.value">${esc(WZ.descricao)}</textarea></div>
    <div class="grid2">
      <div class="f"><label>Prazo estimado (dias)</label><input class="in" type="number" min="0" value="${WZ.prazo}" oninput="WZ.prazo=+this.value||0"></div>
      <div class="f"><label>Data</label><input class="in" type="date" value="${WZ.data}" oninput="WZ.data=this.value"></div>
    </div>
    <div class="f"><label>Validade da proposta (dias)</label><input class="in" type="number" min="0" value="${WZ.validade}" oninput="WZ.validade=+this.value||0"></div>
  </div>`;

  if(s===2)return `<div class="card"><h3>2. Serviços</h3><p class="sub">O que compõe essa obra? (referência de escopo e quantidade)</p>
    <div class="table-wrap"><table class="tbl"><thead><tr><th>Serviço</th><th>Un.</th><th>Qtd</th><th>Preço/un (ref.)</th><th></th><th></th></tr></thead>
    <tbody data-arr="servicos">${WZ.servicos.map(i=>`<tr data-row="${i.id}">
      <td><input class="in" data-id="${i.id}" data-field="nome" value="${esc(i.nome)}" style="width:150px"></td>
      <td><input class="in" data-id="${i.id}" data-field="unidade" value="${esc(i.unidade)}" style="width:55px"></td>
      <td><input class="in" type="number" min="0" data-id="${i.id}" data-field="qtd" value="${i.qtd}" style="width:65px"></td>
      <td><input class="in" type="number" min="0" data-id="${i.id}" data-field="preco" value="${i.preco}" style="width:80px"></td>
      <td data-total="${i.id}">${money((+i.qtd||0)*(+i.preco||0))}</td>
      <td><button class="x" onclick="WZ.servicos=WZ.servicos.filter(x=>x.id!=='${i.id}');renderWizard()">✕</button></td></tr>`).join('')}</tbody></table></div>
    <div class="btns"><button class="btn ghost" id="_addserv">+ Buscar serviço</button>
      <button class="btn ghost" onclick="WZ.servicos.push({id:uid(),nome:'',unidade:'m²',qtd:1,preco:0});renderWizard()">+ Serviço avulso</button></div>
  </div>`;

  if(s===3){
    const mats=WZ.itens.filter(i=>i.cat==='material');
    return `<div class="card"><h3>3. Materiais</h3><p class="sub">Como será o fornecimento dos materiais?</p>
    <div class="chips">${[['cliente','Cliente fornece tudo'],['eu','Eu forneço tudo'],['dividido','Dividimos'],['depende','Depende do serviço']].map(([v,l])=>
      `<span class="chip ${WZ.matMode===v?'on':''}" onclick="WZ.matMode='${v}';renderWizard()">${l}</span>`).join('')}</div>
    ${WZ.matMode!=='cliente'?`
    <div class="f" style="margin-top:10px"><label>Perda / desperdício estimado (%)</label><input class="in" type="number" min="0" value="${WZ.perdas}" oninput="WZ.perdas=+this.value||0" style="max-width:120px"></div>
    <div class="table-wrap"><table class="tbl"><thead><tr><th>Material</th><th>Qtd</th><th>Preço un.</th>${WZ.matMode!=='eu'?'<th>Paga</th>':''}<th></th><th></th><th></th></tr></thead>
    <tbody data-arr="itens">${mats.map(i=>itemRow(i,[['nome','txt',140],['qtd','num',55],['valor','num',80],...(WZ.matMode!=='eu'?[['payer','payer',85]]:[])])).join('')}</tbody></table></div>
    <button class="btn ghost" id="_addmat">+ Buscar no meu cadastro</button>
    <button class="btn ghost" id="_addmatSinapi">🔎 Buscar no SINAPI</button>`:'<p class="sub" style="margin-top:8px">Sem materiais por sua conta nesse orçamento.</p>'}
  </div>`;
  }

  if(s===4){const f=WZ.fernando;
    const modos={diaria:['Valor da diária (R$)','Quantos dias?'],hora:['Valor da hora (R$)','Quantas horas?'],empreitada:['Valor total da empreitada (R$)',null],fixo:['Valor fixo (R$)',null]};
    const[lv,lq]=modos[f.modo];
    return `<div class="card"><h3>4. Seu trabalho</h3>
    <div class="chips"><span class="chip ${f.trabalha?'on':''}" onclick="WZ.fernando.trabalha=true;renderWizard()">Vou trabalhar nessa obra</span>
      <span class="chip ${!f.trabalha?'on':''}" onclick="WZ.fernando.trabalha=false;renderWizard()">Não vou trabalhar</span></div>
    ${f.trabalha?`<div class="chips" style="margin-top:10px">${[['diaria','Diária'],['hora','Por hora'],['empreitada','Empreitada'],['fixo','Valor fixo']].map(([v,l])=>
      `<span class="chip ${f.modo===v?'on':''}" onclick="WZ.fernando.modo='${v}';renderWizard()">${l}</span>`).join('')}</div>
    <div class="grid2" style="margin-top:10px">
      <div class="f"><label>${lv}</label><input class="in" type="number" min="0" value="${f.valor}" oninput="WZ.fernando.valor=+this.value||0"></div>
      ${lq?`<div class="f"><label>${lq}</label><input class="in" type="number" min="0" value="${f.qtd}" oninput="WZ.fernando.qtd=+this.value||0"></div>`:''}
    </div>`:'<p class="sub" style="margin-top:8px">Nenhum custo do seu trabalho será considerado.</p>'}
  </div>`;
  }

  if(s===5){
    const aj=WZ.itens.filter(i=>i.cat==='ajudante'),pr=WZ.itens.filter(i=>i.cat==='profissional');
    return `<div class="card"><h3>5. Equipe</h3>
    <p class="sub">Ajudantes</p>
    <div class="table-wrap"><table class="tbl"><thead><tr><th>Nome</th><th>Diária</th><th>Dias</th><th></th><th></th></tr></thead>
    <tbody data-arr="itens">${aj.map(i=>itemRow(i,[['nome','txt',110],['valor','num',75],['dias','num',55]])).join('')}</tbody></table></div>
    <button class="btn ghost" id="_addaj">+ Adicionar ajudante</button>
    <p class="sub" style="margin-top:16px">Outros profissionais (eletricista, encanador, pintor…)</p>
    <div class="table-wrap"><table class="tbl"><thead><tr><th>Função</th><th>Valor combinado</th><th>Paga</th><th></th><th></th></tr></thead>
    <tbody data-arr="itens">${pr.map(i=>itemRow(i,[['nome','txt',120],['valor','num',85],['payer','payer',85]])).join('')}</tbody></table></div>
    <button class="btn ghost" id="_addpr">+ Adicionar profissional</button>
  </div>`;
  }

  if(s===6){
    const eq=WZ.itens.filter(i=>i.cat==='equipamento'||i.cat==='ferramenta');
    return `<div class="card"><h3>6. Equipamentos e ferramentas</h3>
    <p class="sub">De quem é, e quanto custa pra essa obra (aluguel/desgaste). R$ 0 se não quiser cobrar.</p>
    <div class="table-wrap"><table class="tbl"><thead><tr><th>Item</th><th>Paga</th><th>Custo/dia</th><th>Dias</th><th></th><th></th><th></th></tr></thead>
    <tbody data-arr="itens">${eq.map(i=>itemRow(i,[['nome','txt',120],['payer','payer',80],['valor','num',75],['dias','num',50]])).join('')}</tbody></table></div>
    <div class="btns"><button class="btn ghost" id="_addeq">+ Equipamento (cadastro)</button><button class="btn ghost" id="_addfe">+ Ferramenta (cadastro)</button></div>
    <div class="btns" style="margin-top:6px"><button class="btn ghost" id="_addeqSinapi">🔎 Equipamento no SINAPI</button><button class="btn ghost" id="_addfeSinapi">🔎 Ferramenta no SINAPI</button></div>
  </div>`;
  }

  if(s===7){
    const tr=singleItem('transporte')||{payer:'eu',valor:0},al=singleItem('alimentacao')||{payer:'nao',valor:0},ho=singleItem('hospedagem')||{payer:'nao',valor:0};
    const outros=WZ.itens.filter(i=>i.cat==='outro');
    const radio=(cat,val,opts)=>`<div class="chips">${opts.map(([v,l])=>`<span class="chip ${val===v?'on':''}" onclick="setSingle('${cat}',{payer:'${v}'});renderWizard()">${l}</span>`).join('')}</div>`;
    return `<div class="card"><h3>7. Transporte e outros gastos</h3>
    <p class="sub">Transporte — quem paga?</p>${radio('transporte',tr.payer,[['cliente','Cliente'],['eu','Eu'],['terceiro','Frete contratado']])}
    ${tr.payer!=='cliente'?`<div class="f" style="max-width:180px"><label>Custo estimado (R$)</label><input class="in" type="number" min="0" value="${tr.valor}" oninput="setSingle('transporte',{valor:+this.value||0})"></div>`:''}
    <p class="sub" style="margin-top:14px">Alimentação da equipe — quem paga?</p>${radio('alimentacao',al.payer,[['nao','Não haverá custo'],['eu','Eu'],['cliente','Cliente'],['cada','Cada um paga o seu']])}
    ${al.payer==='eu'?`<div class="f" style="max-width:180px"><label>Custo estimado (R$)</label><input class="in" type="number" min="0" value="${al.valor}" oninput="setSingle('alimentacao',{valor:+this.value||0})"></div>`:''}
    <p class="sub" style="margin-top:14px">Hospedagem — necessária?</p>${radio('hospedagem',ho.payer,[['nao','Não'],['eu','Sim, eu pago'],['cliente','Sim, cliente paga']])}
    ${ho.payer==='eu'?`<div class="f" style="max-width:180px"><label>Custo estimado (R$)</label><input class="in" type="number" min="0" value="${ho.valor}" oninput="setSingle('hospedagem',{valor:+this.value||0})"></div>`:''}
    <p class="sub" style="margin-top:14px">Outros gastos (entulho, EPI, taxas…)</p>
    <div class="table-wrap"><table class="tbl"><thead><tr><th>Descrição</th><th>Valor</th><th>Paga</th><th></th><th></th></tr></thead>
    <tbody data-arr="itens">${outros.map(i=>itemRow(i,[['nome','txt',130],['valor','num',80],['payer','payer',85]])).join('')}</tbody></table></div>
    <button class="btn ghost" onclick="addItem('outro',{payer:'eu'});renderWizard()">+ Adicionar gasto</button>
  </div>`;
  }

  if(s===8){
    const c=calc(WZ),r=radar(WZ,c);
    const rows=Object.keys(GROUPS).filter(k=>k!=='fernando'&&c.G[k]).map(k=>`<div class="kv"><span>${GROUPS[k]}</span><span>${money(c.G[k])}</span></div>`).join('');
    return `<div class="card"><h3>8. Preço e resultado</h3>
    <div class="grid2">
      <div class="f"><label>Quanto vai cobrar do cliente? (R$)</label><input class="in" type="number" min="0" id="_finPreco" value="${WZ.preco}"></div>
      <div class="f"><label>Margem desejada, se quiser sugestão (%)</label><input class="in" type="number" min="0" id="_finMargem" value="${WZ.margemDes}"></div>
    </div>
    <button class="btn ghost" id="_finUsarSug">Usar preço sugerido (${money(c.sugerido)})</button>
    <div class="btns" style="margin-top:10px"><button class="btn ghost" onclick="imprimirRascunho()">🖨️ Pré-visualizar / imprimir</button></div>
    </div>
    <div id="s8dyn">${step8Dyn(c,r,rows)}</div>`;
  }
}
function step8Dyn(c,r,rows){
  return `<div class="card">${rows}
      <div class="kv"><span>Custo operacional</span><span>${money(c.oper)}</span></div>
      <div class="kv big"><span>Remuneração do seu trabalho</span><span>${money(c.G.fernando)}</span></div>
      <div class="kv"><span>Custo total</span><span>${money(c.total)}</span></div>
      <div class="kv"><span>Valor mínimo recomendado</span><span>${money(c.minimo)}</span></div>
      <div class="kv big"><span>Lucro do negócio</span><span>${money(c.lucro)}</span></div>
      <div class="kv"><span>Margem</span><span>${pct(c.margem)}</span></div>
      <div class="kv"><span>Lucro por dia</span><span>${money(c.lucroDia)}</span></div>
      <div class="kv big" style="color:var(--brand)"><span>No seu bolso (trabalho + lucro)</span><span>${money(c.bolso)}</span></div>
    </div>
    ${r.L.map(x=>`<div class="radar ${x.n}">${x.n==='ok'?'🟢':x.n==='warn'?'🟡':'🔴'} <span>${esc(x.t)}</span></div>`).join('')}`;
}
function refreshStep8(){
  const c=calc(WZ),r=radar(WZ,c);
  const rows=Object.keys(GROUPS).filter(k=>k!=='fernando'&&c.G[k]).map(k=>`<div class="kv"><span>${GROUPS[k]}</span><span>${money(c.G[k])}</span></div>`).join('');
  const dyn=$('#s8dyn');if(dyn)dyn.innerHTML=step8Dyn(c,r,rows);
  const bn=$('#bar .bn');if(bn)bn.innerHTML=`<span>Lucro previsto<b>${money(c.lucro)}</b></span><span style="text-align:right">Margem<b>${pct(c.margem)}</b></span>`;
}
function imprimirRascunho(){
  const idx=db.orcamentos.findIndex(o=>o.id===WZ.id);
  if(idx>-1)db.orcamentos[idx]=JSON.parse(JSON.stringify(WZ));else db.orcamentos.push(JSON.parse(JSON.stringify(WZ)));
  save();
  const wasHiddenNav=$('#nav').style.display,wasHiddenBar=$('#bar').hidden;
  go('orcamento',WZ.id);
  setTimeout(()=>{window.print();},250);
}

function wireStep(s){
  bindTables();
  if(s===1)$('#_pickcli').onclick=()=>pickerSheet('clientes',c=>{WZ.clienteId=c.id;renderWizard();});
  if(s===2)$('#_addserv').onclick=()=>pickerSheet('servicos',x=>{WZ.servicos.push({id:uid(),nome:x.nome,unidade:x.unidade,qtd:1,preco:x.preco||0});renderWizard();});
  if(s===3&&$('#_addmat'))$('#_addmat').onclick=()=>pickerSheet('materiais',x=>{addItem('material',{nome:x.nome,ref:x.id,valor:x.preco||0,qtd:1,payer:WZ.matMode==='cliente'?'cliente':'eu',codSinapi:x.codSinapi||''});renderWizard();});
  if(s===3&&$('#_addmatSinapi'))$('#_addmatSinapi').onclick=()=>openSinapiSearch(r=>{
    addItem('material',{nome:r.description,valor:0,qtd:1,payer:WZ.matMode==='cliente'?'cliente':'eu',codSinapi:r.code});
    renderWizard();toast('Item adicionado — confira o preço no ícone 🔗 ao lado dele.');
  });
  if(s===5){$('#_addaj').onclick=()=>pickerSheet('equipe',x=>{addItem('ajudante',{nome:x.nome,ref:x.id,valor:x.diaria||0,qtd:1,dias:1,payer:'eu'});renderWizard();});
    $('#_addpr').onclick=()=>pickerSheet('equipe',x=>{addItem('profissional',{nome:x.funcao?x.funcao+' — '+x.nome:x.nome,ref:x.id,valor:x.empreitada||x.diaria||0,qtd:1,dias:1,payer:'eu'});renderWizard();});}
  if(s===6){$('#_addeq').onclick=()=>pickerSheet('equipamentos',x=>{addItem('equipamento',{nome:x.nome,ref:x.id,valor:x.preco||0,qtd:1,dias:1,payer:'eu',codSinapi:x.codSinapi||''});renderWizard();});
    $('#_addfe').onclick=()=>pickerSheet('ferramentas',x=>{addItem('ferramenta',{nome:x.nome,ref:x.id,valor:x.preco||0,qtd:1,dias:1,payer:'eu',codSinapi:x.codSinapi||''});renderWizard();});
    $('#_addeqSinapi').onclick=()=>openSinapiSearch(r=>{addItem('equipamento',{nome:r.description,valor:0,qtd:1,dias:1,payer:'eu',codSinapi:r.code});renderWizard();toast('Item adicionado — confira o preço no ícone 🔗 ao lado dele.');});
    $('#_addfeSinapi').onclick=()=>openSinapiSearch(r=>{addItem('ferramenta',{nome:r.description,valor:0,qtd:1,dias:1,payer:'eu',codSinapi:r.code});renderWizard();toast('Item adicionado — confira o preço no ícone 🔗 ao lado dele.');});
  }
  if(s===8){
    $('#_finPreco').oninput=e=>{WZ.preco=+e.target.value||0;refreshStep8();};
    $('#_finMargem').oninput=e=>{WZ.margemDes=+e.target.value||0;refreshStep8();};
    $('#_finUsarSug').onclick=()=>{WZ.preco=Math.round(calc(WZ).sugerido*100)/100;$('#_finPreco').value=WZ.preco;refreshStep8();};
  }
}
function wvalidate(s){
  if(s===1&&!WZ.nomeObra.trim()){toast('Dê um nome para a obra antes de continuar.');return false;}
  return true;
}
function renderWizard(){
  TITLE='Novo orçamento';
  $('#nav').style.display='none';$('#bar').hidden=false;
  const c=WSTEP===8?calc(WZ):null;
  $('#main').innerHTML=`<div class="steps">${Array.from({length:8},(_,i)=>`<i class="${i+1<WSTEP?'on':i+1===WSTEP?'cur':''}"></i>`).join('')}</div>
   <p class="sub" style="margin-bottom:10px">Passo ${WSTEP} de 8</p>${wstepHtml(WSTEP)}`;
  wireStep(WSTEP);
  $('#bar').innerHTML=`${c?`<div class="bn"><span>Lucro previsto<b>${money(c.lucro)}</b></span><span style="text-align:right">Margem<b>${pct(c.margem)}</b></span></div>`:''}
   <div class="bt">${WSTEP>1?`<button class="btn ghost" id="_wback">← Anterior</button>`:`<button class="btn ghost" id="_wexit">Sair</button>`}
   ${WSTEP<8?`<button class="btn acc" id="_wnext">Próximo →</button>`:`<button class="btn acc" id="_wsave">Salvar orçamento</button>`}</div>`;
  const nb=$('#_wnext');if(nb)nb.onclick=()=>{if(!wvalidate(WSTEP))return;WSTEP++;renderWizard();window.scrollTo(0,0);};
  const bb=$('#_wback');if(bb)bb.onclick=()=>{WSTEP--;renderWizard();window.scrollTo(0,0);};
  const ex=$('#_wexit');if(ex)ex.onclick=()=>{if(WZ.nomeObra&&WZ.nomeObra.trim()&&!confirm('Sair sem salvar este orçamento?'))return;go('home');};
  const sv=$('#_wsave');if(sv)sv.onclick=()=>saveOrcamento();
  renderTop();
}
function saveOrcamento(){
  if(!WZ.nomeObra.trim()){toast('Dê um nome para a obra.');WSTEP=1;renderWizard();return;}
  const idx=db.orcamentos.findIndex(o=>o.id===WZ.id);
  if(idx>-1)db.orcamentos[idx]=WZ;else db.orcamentos.push(WZ);
  save();$('#nav').style.display='';$('#bar').hidden=true;
  toast('Orçamento salvo!');go('orcamento',{id:WZ.id});
}

/* ============ ORÇAMENTO — DETALHE / PDF / APROVAR ============ */
function orcamentoDetail(id){
  const o=db.orcamentos.find(x=>x.id===id);
  if(!o){go('orcamentos');return;}
  TITLE=o.nomeObra||'Orçamento';
  const c=calc(o),r=radar(o,c);
  const cli=db.clientes.find(x=>x.id===o.clienteId);
  const obraLinked=db.obras.find(x=>x.orcamentoId===o.id);
  const servRows=(o.servicos||[]).map(s=>`<tr><td>${esc(s.nome)}</td><td class="r">${num(s.qtd)} ${esc(s.unidade)}</td></tr>`).join('');
  $('#main').innerHTML=`
   <div class="card" style="display:flex;justify-content:space-between;align-items:center;gap:8px">
     <div><h2>${esc(o.nomeObra)}</h2><p class="sub">${esc(cli?cli.nome:'Sem cliente')} · ${esc(o.endereco||'')}</p></div>
     <span class="badge ${r.nivel}">${NIVEL[r.nivel]}</span>
   </div>
   <div class="doc" id="_doc">
     <h1>ORÇAOBRA</h1><div class="lin"></div>
     <p><b>Cliente:</b> ${esc(cli?cli.nome:'—')}</p>
     <p><b>Obra:</b> ${esc(o.nomeObra)} — ${esc(o.endereco||'')}</p>
     <p><b>Data:</b> ${fdate(o.data)} &nbsp; <b>Validade:</b> ${o.validade||0} dias</p>
     ${o.descricao?`<p style="margin-top:8px">${esc(o.descricao)}</p>`:''}
     <table><thead><tr><th>Serviço</th><th class="r">Qtd</th></tr></thead><tbody>${servRows||'<tr><td colspan="2">—</td></tr>'}</tbody></table>
     <div class="tot">${money(c.preco)}</div>
   </div>
   <div class="btns noprint" style="margin:12px 0">
     <button class="btn ghost" onclick="window.print()">🖨️ Imprimir / PDF</button>
     <button class="btn ghost" onclick="orcamentoNovo('${o.id}')">✏️ Editar</button>
     <button class="btn ghost" onclick="duplicarOrc('${o.id}')">⧉ Duplicar</button>
     ${!obraLinked?`<button class="btn acc" onclick="aprovarOrc('${o.id}')">✅ Aprovar e criar obra</button>`:`<button class="btn ghost" onclick="go('obra','${obraLinked.id}')">🏗️ Ver obra</button>`}
     <button class="btn red" onclick="delOrc('${o.id}')">Excluir</button>
   </div>
   <div class="card noprint"><h3>Por dentro (só você vê)</h3>
     ${Object.keys(GROUPS).filter(k=>k!=='fernando'&&c.G[k]).map(k=>`<div class="kv"><span>${GROUPS[k]}</span><span>${money(c.G[k])}</span></div>`).join('')}
     <div class="kv"><span>Custo operacional</span><span>${money(c.oper)}</span></div>
     <div class="kv big"><span>Remuneração do seu trabalho</span><span>${money(c.G.fernando)}</span></div>
     <div class="kv"><span>Custo total</span><span>${money(c.total)}</span></div>
     <div class="kv big"><span>Lucro do negócio</span><span>${money(c.lucro)}</span></div>
     <div class="kv"><span>Margem</span><span>${pct(c.margem)}</span></div>
     <div class="kv"><span>Lucro por dia (prazo ${c.prazo||0}d)</span><span>${money(c.lucroDia)}</span></div>
     <div class="kv big" style="color:var(--brand)"><span>No seu bolso (trabalho + lucro)</span><span>${money(c.bolso)}</span></div>
   </div>
   <div class="noprint">${r.L.map(x=>`<div class="radar ${x.n}">${x.n==='ok'?'🟢':x.n==='warn'?'🟡':'🔴'} <span>${esc(x.t)}</span></div>`).join('')}</div>`;
}
function duplicarOrc(id){
  const o=JSON.parse(JSON.stringify(db.orcamentos.find(x=>x.id===id)));
  o.id=uid();o.criado=Date.now();o.nomeObra=o.nomeObra+' (cópia)';o.status='Rascunho';
  db.orcamentos.push(o);save();toast('Duplicado!');go('orcamento',o.id);
}
function aprovarOrc(id){
  const o=db.orcamentos.find(x=>x.id===id);
  const ob={id:uid(),criado:Date.now(),orcamentoId:o.id,clienteId:o.clienteId,nome:o.nomeObra,endereco:o.endereco,status:'Em andamento',lancs:[]};
  db.obras.push(ob);o.status='Aprovado';save();toast('Obra criada!');go('obra',ob.id);
}
function delOrc(id){confirmDel('este orçamento',()=>{db.orcamentos=db.orcamentos.filter(x=>x.id!==id);save();go('orcamentos');});}

/* ============ BOOT / DISPATCH ============ */
function render(){
  if(ROUTE==='orcamento-novo'){orcamentoNovo(PARAMS.id);renderNav();return;}
  $('#nav').style.display='';$('#bar').hidden=true;
  if(CAD[ROUTE])listCad(ROUTE);
  else if(ROUTE==='home')renderHome();
  else if(ROUTE==='orcamentos')renderOrcamentos();
  else if(ROUTE==='orcamento')orcamentoDetail(PARAMS.id);
  else if(ROUTE==='obras')renderObras();
  else if(ROUTE==='obra')obraDetail(PARAMS.id);
  else if(ROUTE==='busca')renderBusca();
  else if(ROUTE==='mais')renderMais();
  else renderHome();
  renderTop();renderNav();
}
(function boot(){
  const h=location.hash.replace('#','');
  if(h){const[r,id]=h.split('/');ROUTE=r||'home';PARAMS=id?{id}:{};}
  render();
})();
