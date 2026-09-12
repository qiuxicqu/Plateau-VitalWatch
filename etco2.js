(function(){
  "use strict";

  var initialEtco2={"P-001":28,"P-008":34,"P-012":36,"P-004":38,"P-017":37,"P-006":35,"P-019":39,"P-011":34,"P-003":38,"P-015":37};

  function byId(id){return document.getElementById(id)}
  function peopleList(){return window.people||[]}
  function etco2For(p){
    if(p.etco2!=null)return Number(p.etco2);
    p.etco2=initialEtco2[p.id]||36;
    return p.etco2;
  }
  function trendText(value){return value<30?"↓ 8 / 30min":value<35?"↓ 4 / 30min":"稳定 / 30min"}
  function etco2Class(value){return value<30?"etco2-danger":value<35?"etco2-watch":""}
  function etco2Markup(p,compact){
    var value=etco2For(p), cls=etco2Class(value);
    if(compact)return '<div class="etco2-mini"><span>EtCO₂</span><b>'+value+'</b></div>';
    return '<div class="human-vital human-vital-etco2 '+cls+'"><span>EtCO₂ 呼气末 CO₂</span><strong>'+value+'<small>mmHg</small></strong><em>'+trendText(value)+'</em></div>';
  }
  function ensureOverviewVital(p){
    var container=document.querySelector(".human-vitals");
    if(!container)return;
    var node=container.querySelector(".human-vital-etco2");
    if(!node){container.insertAdjacentHTML("beforeend",etco2Markup(p,false));node=container.querySelector(".human-vital-etco2");}
    if(node){var value=etco2For(p);node.className="human-vital human-vital-etco2 "+etco2Class(value);node.querySelector("strong").innerHTML=value+"<small>mmHg</small>";node.querySelector("em").textContent=trendText(value)}
  }
  function ensureModalMetric(p){
    var container=document.querySelector(".modal-metrics");
    if(!container)return;
    var node=byId("modal-etco2");
    if(!node){container.insertAdjacentHTML("beforeend",'<div class="metric-tile metric-etco2"><span>EtCO₂ 呼气末 CO₂</span><strong id="modal-etco2">--<small>mmHg</small></strong><em>趋势读取中</em></div>');node=byId("modal-etco2");}
    if(node){var value=etco2For(p),tile=node.closest(".metric-tile");tile.className="metric-tile metric-etco2 "+(value<30?"etco2-danger":"");node.innerHTML=value+"<small>mmHg</small>";tile.querySelector("em").textContent=trendText(value)}
  }
  function enhanceOverviewRows(){
    var list=document.querySelectorAll("#overview-people-list .people-row");
    list.forEach(function(row){
      var p=peopleList().find(function(item){return item.id===row.dataset.person});
      if(!p)return;
      var vitals=row.querySelector(".people-row-vitals");
      if(vitals&&!vitals.querySelector(".etco2-mini"))vitals.insertAdjacentHTML("beforeend",etco2Markup(p,true));
      var mini=vitals&&vitals.querySelector(".etco2-mini");
      if(mini){var value=etco2For(p);mini.className="etco2-mini "+(value<30?"text-red":"");mini.querySelector("b").textContent=value+" mmHg"}
    });
  }
  function enhancePeopleCards(){
    document.querySelectorAll("#people-grid .person-card").forEach(function(card){
      var p=peopleList().find(function(item){return item.id===card.dataset.person});
      var vitals=card.querySelector(".person-card-vitals");
      if(!p||!vitals)return;
      if(!vitals.querySelector(".etco2-mini"))vitals.insertAdjacentHTML("beforeend",etco2Markup(p,true));
      var mini=vitals.querySelector(".etco2-mini"),value=etco2For(p);mini.className="etco2-mini "+(value<30?"text-red":"");mini.querySelector("b").textContent=value+" mmHg";
    });
  }
  function enhanceRiskFactors(p){
    var factors=document.querySelector(".detail-factors");
    if(!factors)return;
    var node=factors.querySelector(".etco2-factor"),value=etco2For(p);
    if(!node){node=document.createElement("div");node.className="etco2-factor";factors.appendChild(node)}
    node.innerHTML="<span>EtCO₂ 呼气末 CO₂</span><b class='"+(value<30?"red":value<35?"amber":"green")+"'>"+(value<30?"偏低":value<35?"关注":"正常")+"</b>";
  }
  function enhanceRecommendation(){
    var items=document.querySelectorAll("#person-modal .recommendation li");
    if(items.length>1)items[1].textContent="原地休息并持续监测 SpO₂、HR 与 EtCO₂";
  }
  function syncAll(p){ensureOverviewVital(p);ensureModalMetric(p);enhanceOverviewRows();enhancePeopleCards();enhanceRiskFactors(p);enhanceRecommendation()}

  peopleList().forEach(function(p){if(p.etco2==null)p.etco2=initialEtco2[p.id]||36});
  if(window.alerts&&window.alerts[0])window.alerts[0].detail="SpO₂ 82% · HR 118 bpm · EtCO₂ 28 mmHg";

  var originalApply=window.applyNews2Risk;
  if(typeof originalApply==="function")window.applyNews2Risk=function(p){var result=originalApply(p),spo2=Number(p.spo2);p.etco2=spo2<=82?27:spo2<=86?30:spo2<=91?34:38;return result};
  var originalOverview=window.renderOverviewPeople;
  if(typeof originalOverview==="function")window.renderOverviewPeople=function(){originalOverview();syncAll(peopleList()[0]||{});};
  var originalPeopleGrid=window.renderPeopleGrid;
  if(typeof originalPeopleGrid==="function")window.renderPeopleGrid=function(filter){originalPeopleGrid(filter);enhancePeopleCards();};
  var originalUpdateModal=window.updatePersonModal;
  if(typeof originalUpdateModal==="function")window.updatePersonModal=function(p){ensureModalMetric(p);originalUpdateModal(p);syncAll(p);};
  var originalSyncRisk=window.syncRiskLabels;
  if(typeof originalSyncRisk==="function")window.syncRiskLabels=function(p){originalSyncRisk(p);syncAll(p);};
  var originalOpenEvent=window.openEvent;
  if(typeof originalOpenEvent==="function")window.openEvent=function(index){var result=originalOpenEvent(index),a=(window.alerts||[])[index]||(window.alerts||[])[0],p=peopleList().find(function(item){return item.id===a.id})||peopleList()[0],content=byId("event-detail-content");if(content&&p){var old=content.querySelector(".etco2-event-block");if(old)old.remove();var block=document.createElement("div");block.className="event-detail-block etco2-event-block";block.innerHTML="<span>呼吸末二氧化碳</span><strong>EtCO₂ "+etco2For(p)+" mmHg · "+(etco2For(p)<30?"偏低，建议结合呼吸状态复核":"在当前演示阈值内")+"</strong>";content.appendChild(block)}return result};

  if(typeof window.renderAlerts==="function")window.renderAlerts();
  if(typeof window.renderOverviewPeople==="function")window.renderOverviewPeople();else syncAll(peopleList()[0]||{});
})();
