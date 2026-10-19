const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync('index.html', 'utf8');
const scripts = [...source.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
scripts.forEach(code => new vm.Script(code));
const elements = new Map();
function element(key = '') {
  if (elements.has(key)) return elements.get(key);
  const classes = new Set();
  const node = {value:'',innerHTML:'',textContent:'',style:{},dataset:{},disabled:false,
    classList:{add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x),toggle(x,on){if(on ?? !classes.has(x))classes.add(x);else classes.delete(x)}},
    append(){},prepend(){},after(){},remove(){},appendChild(){},insertAdjacentHTML(){},addEventListener(){},setAttribute(){},focus(){},click(){},
    querySelector:selector=>element(key+' '+selector),querySelectorAll:()=>[],closest:selector=>element(key+' parent '+selector)};
  Object.defineProperty(node,'parentElement',{get:()=>element(key+' parent')});
  Object.defineProperty(node,'previousElementSibling',{get:()=>element(key+' previous')});
  elements.set(key,node);return node;
}
const storage = new Map();
const context = vm.createContext({console,Date,Math,JSON,Number,String,Array,Object,Set,Map,Blob,URL,
  document:{getElementById:element,querySelector:s=>element(s),querySelectorAll:()=>[],createElement:t=>element('new'+Math.random()),head:element('head'),body:element('body'),documentElement:element('html'),addEventListener(){}},
  localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},
  setTimeout:()=>1,clearTimeout(){},setInterval:()=>1,clearInterval(){},confirm:()=>true,innerWidth:1200,addEventListener(){}});
context.window=context;
vm.runInContext(scripts[0].replace(/\(function boot\(\)\{[\s\S]*?\}\)\(\);/, ''),context);
vm.runInContext(scripts[1],context);
const run=code=>vm.runInContext(code,context);
function fill(values){for(const [id,value] of Object.entries(values))element(id).value=String(value)}
fill({entryTitle:'测试账目',entryQty:10,entryUnit:'下',entryQuick:5,entryNote:'日常记录',entryTag:'__default__',entryInterest:'no'});
run('openEntryModal()');
fill({entryTitle:'测试账目',entryQty:10,entryUnit:'下',entryQuick:5,entryNote:'日常记录',entryTag:'__default__',entryInterest:'no'});
run('saveEntry()');
assert.equal(run('state.entries.length'),1);
assert.equal(run('state.entries[0].unit'),'下');
run("openPayModal(state.entries[0].id,'repay')");
assert.equal(element('payAmount').value,5);
fill({payAmount:11});run('savePay()');assert.equal(run('state.entries[0].quantity'),10);
fill({payAmount:5,payNote:'已完成'});run('savePay()');
assert.equal(run('state.entries[0].quantity'),5);
assert.equal(run('state.entries[0].history[0].before'),10);
assert.equal(run('state.entries[0].history[0].note'),'已完成');
run('undoAction()');assert.equal(run('state.entries[0].quantity'),10);assert.equal(run('state.entries[0].history.length'),0);
run('openEntryModal(state.entries[0].id)');fill({entryQty:0});run('saveEntry()');assert.equal(run('state.entries[0].quantity'),0);
run('deleteEntry(state.entries[0].id)');assert.equal(run('state.entries.length'),0);run('undoAction()');assert.equal(run('state.entries.length'),1);
run('openEditor()');fill({recTitle:'测试日记',recContent:'自动保存内容',recDate:'2026-10-19',recTags:'日常，心情'});run('persistDraft();persistDraft()');
assert.equal(run('state.drafts.length'),1);assert.equal(run('state.drafts[0].tags.length'),2);
run('closeEditor()');assert.equal(run('state.drafts.length'),1);
run("resumeDraft(state.drafts[0].id,{closest:()=>({remove(){}})})");run('submitRecord()');
assert.equal(run('state.records.length'),1);assert.equal(run('state.drafts.length'),0);assert.equal(run('state.records[0].tags[1]'),'心情');
run('undoAction()');assert.equal(run('state.records.length'),0);assert.equal(run('state.drafts.length'),1);
assert.throws(()=>run('validateBackup({})'));
assert.throws(()=>run("validateBackup({entries:[{id:'bad',quantity:-1}],records:[],drafts:[],tags:[]})"));
assert.equal(run('validateBackup(snapshot()).entries.length'),1);
run("openPayModal(state.entries[0].id,'add')");fill({payAmount:3});run('savePay();renderPersonal()');
assert.match(element('statGrid').innerHTML,/3 下/);
assert.match(element('boardData').innerHTML,/\+3 下/);
context.FileReader=class{readAsText(file){this.result=file.content;this.onload()}};
const backup=JSON.parse(run('JSON.stringify(snapshot())'));
backup.entries[0].quantity=77;
backup.entries.push({id:'imported',title:'导入账目',quantity:2,unit:'次',createdAt:1,history:[]});
context.testFile={size:100,content:JSON.stringify(backup)};
run('importData({target:{files:[testFile],value:""}})');
assert.equal(run('state.entries.length'),1,'preview must not mutate data');
const latestButton=selector=>[...elements.entries()].filter(([key])=>key.endsWith(selector)).at(-1)[1];
latestButton('[data-merge]').onclick();
assert.equal(run('state.entries.length'),2);
assert.equal(run('state.entries[0].quantity'),3,'merge must retain existing IDs');
run('undoAction()');assert.equal(run('state.entries.length'),1);
run('importData({target:{files:[testFile],value:""}})');latestButton('[data-replace]').onclick();
assert.equal(run('state.entries[0].quantity'),77);
assert.ok([...storage.keys()].some(k=>k.endsWith('_beforeImport')),'import recovery copy must persist');
run('undoAction()');assert.equal(run('state.entries[0].quantity'),3);
run('openEditor()');fill({recTitle:'独立草稿'});run('persistDraft()');
const draftCount=run('state.drafts.length');run('undoAction()');assert.equal(run('state.drafts.length'),draftCount,'undo must preserve unrelated autosaved drafts');
assert.throws(()=>run("validateBackup({entries:[],records:[{id:'bad',type:'diary',date:'2026-10-19',tags:{}}],drafts:[],tags:[]})"));
run("openEditor()");fill({recTitle:'存储失败测试'});
run("localStorage.setItem=()=>{throw Error('quota')};persistDraft()");
assert.doesNotMatch(element('autoSaveStatus').textContent,/已自动保存/);
run('closeEditor()');assert.equal(run("document.getElementById('editorOverlay').classList.contains('show')"),true,'storage failure must keep editor open');
console.log('PASS: syntax, units, shortcuts, excess repayment, history, undo, zero balance, deletion undo, draft recovery/submission, import preview/merge/replace/recovery/validation, unit statistics, preservation of unrelated drafts, storage failure.');
