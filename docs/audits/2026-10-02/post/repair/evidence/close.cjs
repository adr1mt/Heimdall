const {app,BrowserWindow,dialog}=require('electron');const fs=require('node:fs');const cp=require('node:child_process');const {syncBuiltinESMExports}=require('node:module');
const root='/tmp/heimdall-repair/close-'+process.argv[2];fs.mkdirSync(root+'/profile',{recursive:true});fs.mkdirSync(root+'/project',{recursive:true});
app.setPath('userData',root+'/profile');
fs.writeFileSync(root+'/profile/settings.json',JSON.stringify({enginePath:'/mnt/datos/Applications/Claude/Heimdall/bin/heimdall'}));
fs.writeFileSync(root+'/profile/classes.json',JSON.stringify({classes:[{id:'audit',name:'Ficticia',columns:['wait'],students:[{id:'fast',name:'Ficticio rapido',host:'127.1.2.3',port:'2201',user:'alumno',fields:{wait:'0'}},{id:'slow',name:'Ficticio lento',host:'127.1.2.3',port:'2201',user:'alumno',fields:{wait:'30'}}]}]}));
fs.writeFileSync(root+'/project/examen.yaml','examen: Cierre ficticio\nversion: 1\nhosts: [host1]\ngrupos:\n  - grupo: G\n    comprobaciones:\n      - id: c\n        en: host1\n        cmd: ["sleep", "${alumno.wait}"]\n        exit_code: 0\n');
const original=cp.spawn;cp.spawn=function(...args){const c=original.apply(this,args);if(args[0]==='/mnt/datos/Applications/Claude/Heimdall/bin/heimdall' && args[1][0]==='run'){fs.writeFileSync(root+'/engine.pid',String(c.pid));c.on('close',(code,signal)=>fs.writeFileSync(root+'/engine-close.json',JSON.stringify({code,signal})));}return c};syncBuiltinESMExports();
process.on('unhandledRejection',e=>{console.error(e);app.exit(1)});
import('/mnt/datos/Applications/Claude/Heimdall/gui/out/main/index.js').then(async()=>{
 await app.whenReady();for(let i=0;i<100&&!BrowserWindow.getAllWindows().length;i++)await new Promise(r=>setTimeout(r,50));
 const win=BrowserWindow.getAllWindows()[0];
 if(win.webContents.isLoading())await new Promise(r=>win.webContents.once('did-finish-load',r));
 await new Promise(r=>setTimeout(r,200));win.hide();
 await win.webContents.executeJavaScript(`window.heimdall.onRunEvent(e=>{if(e.event==='student.end'&&e.student_id==='fast')setTimeout(()=>window.heimdall.openExternal('https://audit-close.invalid'),100)});true`);
 // Catch this isolated signal without launching a browser; request the same
 // real app.quit path Ctrl+Q takes, with all production before-quit handlers.
 const {shell}=require('electron');shell.openExternal=async()=>{console.log('QUIT_WHILE_RUNNING');app.quit()};
 await win.webContents.executeJavaScript(`window.heimdall.startRun({examPath:${JSON.stringify(root+'/project/examen.yaml')},classId:'audit',secrets:{AULA_PASSWORD:'HEIMDALL_SECRET_TEST_12345'}})`);
 setTimeout(()=>{console.log('PROBE_TIMEOUT');app.exit(2)},15000).unref();
});
