import {auth,db} from './firebase-client.js';
import {signInAnonymously,onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import {doc,getDoc,runTransaction,serverTimestamp,updateDoc,onSnapshot} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
const lab=window.LAB_ID;
const $=id=>document.getElementById(id);
const slot=i=>'PSI'+String(i).padStart(3,'0');
let code=null,started=false,completed=false,registering=false,saving=false;
let released=false,applicationOpen=false,releaseLoaded=false,applicationLoaded=false,stopRelease=null,stopApplication=null;
function status(s,error=false){const el=$('portalStatus');if(!el)return;el.textContent=s;el.classList.toggle('error',error)}
function gate(){
 let overlay=document.getElementById('labAccessOverlay');
 if(!overlay){
  overlay=document.createElement('div');overlay.id='labAccessOverlay';
  overlay.setAttribute('role','status');overlay.setAttribute('aria-live','polite');
  overlay.style.cssText='position:fixed;inset:0;z-index:99999;background:#f5f2e9;color:#304232;display:flex;align-items:center;justify-content:center;padding:25px;font:19px/1.5 "Times New Roman",serif;text-align:center';
  overlay.innerHTML='<div style="max-width:580px;background:#fffefa;border:2px solid #b56d55;border-radius:18px;padding:30px"><h2 style="color:#4b5d4c">Laboratório bloqueado</h2><p id="labGateMessage">Aguarde a liberação pelo professor.</p><a href="index.html" style="color:#4b5d4c">← Voltar ao Menu Inicial</a></div>';
  document.body.appendChild(overlay);
 }
 const allowed=released&&applicationOpen&&releaseLoaded&&applicationLoaded&&auth.currentUser?.isAnonymous===true;
 overlay.style.display=allowed?'none':'flex';
 if(allowed){document.querySelector('.wrap')?.removeAttribute('inert');document.documentElement.classList.add('lab-authorized')}
 else{document.querySelector('.wrap')?.setAttribute('inert','');document.documentElement.classList.remove('lab-authorized')}
 const text=document.getElementById('labGateMessage');
 if(text)text.textContent=!applicationOpen?'A aplicação está fechada. Procure o professor.':'Aguarde a liberação pelo professor.';
 if(allowed && auth.currentUser?.isAnonymous && !started && !registering)void enroll(auth.currentUser);
}
function randomizedSlots(){const a=Array.from({length:60},(_,i)=>i+1);for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
async function enroll(user){
 if(registering||code||!released||!applicationOpen||!releaseLoaded||!applicationLoaded)return;
 registering=true;
 try{
  const settings=await getDoc(doc(db,'settings','application'));
  const labs=await getDoc(doc(db,'settings','labs'));
  if(!settings.exists()||settings.data().open!==true||!labs.exists()||labs.data()[lab]!==true)throw Error('Laboratório bloqueado. Aguarde a liberação pelo professor.');
  status('Identificando sua participação...');
  const sessionRef=doc(db,'studentSessions',user.uid);
  const prior=await getDoc(sessionRef);
  if(prior.exists()){
   const previous=prior.data().code;
   const p=await getDoc(doc(db,'participants',previous));
   if(!p.exists()||p.data().ownerUid!==user.uid)throw Error('Sessão desatualizada. Procure o professor.');
   code=previous;
  }else{
   for(const i of randomizedSlots()){
    const candidate=slot(i),participantRef=doc(db,'participants',candidate);
    try{
     const assigned=await runTransaction(db,async t=>{
      const session=await t.get(sessionRef);
      if(session.exists())return session.data().code;
      const occupied=await t.get(participantRef);
      if(occupied.exists())throw Error('vaga-ocupada');
      t.set(sessionRef,{code:candidate,createdAt:serverTimestamp()});
      t.set(participantRef,{ownerUid:user.uid,started:{},completed:{},createdAt:serverTimestamp()});
      return candidate;
     });
     code=assigned;break;
    }catch(e){if(e.code==='permission-denied'||e.message==='vaga-ocupada'||e.code==='aborted')continue;throw e}
   }
   if(!code)throw Error('Não foi possível reservar uma vaga. Pode haver 60 participantes registrados. Procure o professor.');
  }
  $('portalCodeLabel').textContent=code;
  await updateDoc(doc(db,'participants',code),{['started.'+lab]:serverTimestamp()});
  started=true;
  status('Código '+code+' ativo. Início registrado.');
  if(completed)await saveCompletion();
 }catch(e){status('Registro não realizado: '+(e.message||e),true)}
 finally{registering=false}
}
async function saveCompletion(){if(!started||!code||saving||!released||!applicationOpen||!releaseLoaded||!applicationLoaded)return;saving=true;try{
 const latest=await getDoc(doc(db,'settings','labs'));
 const app=await getDoc(doc(db,'settings','application'));
 if(!latest.exists()||latest.data()[lab]!==true||!app.exists()||app.data().open!==true)throw Error('O laboratório foi bloqueado antes do registro.');
 await updateDoc(doc(db,'participants',code),{['completed.'+lab]:serverTimestamp()});
 status('Atividade concluída e registrada: '+lab.toUpperCase()+' · '+code+'.');
}catch(e){status('Atividade concluída nesta página, mas não registrada: '+e.message,true)}finally{saving=false}}
window.labComplete=()=>{completed=true;void saveCompletion()};
// Oculta a atividade antes de confirmar as permissões do Firebase.
gate();
onAuthStateChanged(auth,u=>{
 if(stopRelease){stopRelease();stopRelease=null}
 if(stopApplication){stopApplication();stopApplication=null}
 released=false;applicationOpen=false;releaseLoaded=false;applicationLoaded=false;gate();
 if(!u){signInAnonymously(auth).catch(e=>status('Falha na autenticação: '+e.message,true));return}
 if(!u.isAnonymous){status('Este navegador está conectado como professor. Teste como aluno em janela anônima.',true);const t=document.getElementById('labGateMessage');if(t)t.textContent='Você está conectado como professor. Abra este laboratório em uma janela anônima para testar como aluno.';return}
 stopRelease=onSnapshot(doc(db,'settings','labs'),snap=>{releaseLoaded=true;released=snap.exists()&&snap.data()[lab]===true;gate()},e=>{releaseLoaded=false;released=false;gate();status('Falha ao consultar liberação: '+e.message,true)});
 stopApplication=onSnapshot(doc(db,'settings','application'),snap=>{applicationLoaded=true;applicationOpen=snap.exists()&&snap.data().open===true;gate()},e=>{applicationLoaded=false;applicationOpen=false;gate();status('Falha ao consultar aplicação: '+e.message,true)});
});
