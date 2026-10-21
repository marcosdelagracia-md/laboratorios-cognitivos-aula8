import {auth,db} from './firebase-client.js';
import {onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import {doc,onSnapshot,setDoc} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

const PROFESSOR_UID='TXh88MO29fVS0jMLeCLcBLLxx172';
const LABS=[['wasi','WASI'],['fdt','FDT'],['ravlt','RAVLT'],['d2r','d2-R'],['tmt','Trilhas (TMT)'],['tol','Torre de Londres']];
const root=document.getElementById('labReleaseControls');
const status=document.getElementById('labReleaseStatus');
const initial=Object.fromEntries(LABS.map(([id])=>[id,false]));
let permissions={...initial};
let unsubscribe=null;
let saving=false;
function authorized(){const u=auth.currentUser;return !!u&&!u.isAnonymous&&u.uid===PROFESSOR_UID;}
function render(){
 root.replaceChildren();
 for(const [id,label] of LABS){
  const row=document.createElement('div');row.className='release-row';
  const title=document.createElement('strong');title.textContent=label;
  const state=document.createElement('span');state.textContent=permissions[id]?'Liberado':'Bloqueado';state.className=permissions[id]?'release-state open':'release-state';
  const button=document.createElement('button');button.type='button';button.textContent=permissions[id]?'Bloquear':'Liberar';
  button.disabled=saving||!authorized();button.className=permissions[id]?'release-block':'release-open';
  button.addEventListener('click',async()=>{
   if(!authorized()||saving)return;
   const next=!permissions[id];
   if(!confirm(`${next?'Liberar':'Bloquear'} ${label} para os alunos?`))return;
   saving=true;render();status.textContent='Salvando alteração...';
   try{
    // Atualização pontual: não altera as permissões dos demais laboratórios.
    await setDoc(doc(db,'settings','labs'),{[id]:next},{merge:true});
    status.textContent=`${label}: ${next?'liberado':'bloqueado'} com sucesso.`;
   }catch(error){status.textContent='Não foi possível salvar: '+error.message;}
   finally{saving=false;render();}
  });
  row.append(title,state,button);root.append(row);
 }
}
onAuthStateChanged(auth,user=>{
 if(unsubscribe){unsubscribe();unsubscribe=null;}
 if(!user||user.isAnonymous||user.uid!==PROFESSOR_UID){
  root.replaceChildren();status.textContent='Entre como professor para gerenciar os laboratórios.';return;
 }
 status.textContent='Consultando as liberações...';
 unsubscribe=onSnapshot(doc(db,'settings','labs'),snapshot=>{
  const values=snapshot.exists()?snapshot.data():{};
  permissions=Object.fromEntries(LABS.map(([id])=>[id,values[id]===true]));
  render();status.textContent='As alterações são salvas no Firebase.';
 },error=>{root.replaceChildren();status.textContent='Falha ao carregar liberações: '+error.message;});
});
