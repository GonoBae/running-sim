if(location.pathname==='/admin'||location.pathname.startsWith('/admin/')){
  import('./admin').then(m=>m.mountAdmin()).catch(error=>{document.body.textContent=`관리자 화면을 열지 못했습니다: ${String(error)}`;});
}else{
  import('./main').catch(error=>{const status=document.getElementById('status');if(status)status.textContent=`설정을 읽지 못했습니다. 저장 데이터를 확인하세요. ${String(error)}`;});
}
