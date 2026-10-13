/* Per-option presentation controls for both games and all categories. */
(() => {
  'use strict';
  const admin = document.getElementById('adminView');
  if (!admin) return;
  const trigger = document.createElement('button');
  trigger.type = 'button'; trigger.textContent = 'Avisos y colores de las opciones';
  trigger.style.cssText = 'margin:12px 0;padding:12px 18px;border:1px solid #8b2730;border-radius:12px;background:#210b0d;color:white;cursor:pointer';
  const panel = document.createElement('section'); panel.hidden = true;
  panel.style.cssText = 'background:#171112;border:1px solid #633039;border-radius:14px;padding:18px;margin:10px 0;color:white';
  const title = document.createElement('h3'); title.textContent = 'Personalizar cada opción';
  const help = document.createElement('p'); help.textContent = 'Aimbot, Hologramas y Extras de Free Fire Normal y MAX. El aviso aparece después de activar correctamente.';
  const feedback = document.createElement('p'); feedback.setAttribute('role','status');
  const rows = document.createElement('div');
  const refresh = document.createElement('button'); refresh.type='button'; refresh.textContent='Actualizar lista';
  panel.append(title, help, refresh, feedback, rows); admin.prepend(panel); admin.prepend(trigger);
  const auth = () => ({ Authorization: `Bearer ${sessionStorage.getItem('xitforgeAdminToken') || ''}` });
  async function load() {
    rows.replaceChildren(); feedback.textContent='Cargando opciones…';
    try {
      const response=await fetch('/api/admin/option-warnings',{headers:auth(),cache:'no-store'});
      if(!response.ok)throw new Error('No se pudo cargar la lista. Comprueba tu sesión.');
      const data=await response.json(); if(!data.ok||!Array.isArray(data.options))throw new Error('Respuesta no válida.');
      feedback.textContent=data.options.length?'':'Todavía no hay opciones.';
      for(const option of data.options){
        const row=document.createElement('div'); row.style.cssText='display:grid;gap:12px;margin:12px 0;padding:16px;border:1px solid #403033;border-radius:12px';
        const name=document.createElement('strong');
        name.textContent=`${option.name} · ${option.game==='freefire_max'?'Free Fire MAX':'Free Fire Normal'} · ${option.category==='aimbot'?'Aimbot':option.category==='holograma'?'Hologramas':'Extras'}`;
        const warningLabel=document.createElement('label'); warningLabel.textContent=' Mostrar aviso al activar';
        const enabled=document.createElement('input');enabled.type='checkbox';enabled.checked=option.warning_enabled===true;warningLabel.prepend(enabled);
        const messageLabel=document.createElement('label');messageLabel.textContent='Mensaje del aviso';
        const message=document.createElement('textarea');message.maxLength=500;message.rows=3;message.value=option.warning_message||'';
        message.placeholder='ANTES DE ENTRAR A LA CUENTA DARLE A DESACTIVAR';message.style.cssText='display:block;width:100%;box-sizing:border-box;margin-top:6px';messageLabel.append(message);
        const colorLabel=document.createElement('label');colorLabel.textContent='Color del punto ';
        const color=document.createElement('select');
        for(const [value,label] of [['green','Verde'],['yellow','Amarillo'],['red','Rojo']]){const item=document.createElement('option');item.value=value;item.textContent=label;color.append(item);}
        color.value=option.status_color||'green';colorLabel.append(color);
        const save=document.createElement('button');save.type='button';save.textContent='Guardar';
        save.addEventListener('click',async()=>{
          save.disabled=true;enabled.disabled=true;message.disabled=true;color.disabled=true;feedback.textContent='Guardando…';
          try{
            const result=await fetch(`/api/admin/options/${encodeURIComponent(option.id)}/warning`,{method:'PUT',headers:{...auth(),'Content-Type':'application/json'},body:JSON.stringify({enabled:enabled.checked,message:message.value,statusColor:color.value})});
            if(!result.ok||!(await result.json()).ok)throw new Error('No se pudieron guardar los cambios.');
            feedback.textContent='Cambios guardados.';
          }catch(error){feedback.textContent=error.message||'Error de conexión.';}finally{save.disabled=false;enabled.disabled=false;message.disabled=false;color.disabled=false;}
        });
        row.append(name,warningLabel,messageLabel,colorLabel,save);rows.append(row);
      }
    }catch(error){feedback.textContent=error.message||'Error de conexión.';}
  }
  trigger.addEventListener('click',()=>{panel.hidden=!panel.hidden;if(!panel.hidden)load();});refresh.addEventListener('click',load);
})();
