var scripts=require('./scripts.json');
// minimal stubs
var store={};
global.window={};
global.document={getElementById:function(){return {style:{},classList:{toggle:function(){},add:function(){},remove:function(){}},setAttribute:function(){},getAttribute:function(){return null;},innerHTML:'',textContent:'',appendChild:function(){},querySelectorAll:function(){return [];}};},
  querySelectorAll:function(){return {forEach:function(){}};},addEventListener:function(){}};
global.location={hash:'#home'};
global.alert=function(){};global.setTimeout=function(){};global.clearInterval=function(){};global.requestAnimationFrame=function(){};
global.window.addEventListener=function(){};global.window.scrollTo=function(){};
var errs=0;
scripts.forEach(function(s,i){ try{ eval(s); }catch(e){ errs++; if(errs<=6) console.log('script#'+i+' ERROR:', e.message.slice(0,80)); } });
console.log('--- after loading all scripts in order ---');
console.log('window._oninit keys:', global.window._oninit?Object.keys(global.window._oninit):'(undefined)');
