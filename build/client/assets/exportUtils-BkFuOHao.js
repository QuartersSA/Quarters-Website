import{L as b}from"./dateUtils-PSFgQZQ-.js";if(typeof window<"u"){const t={};globalThis.process??={};const n=globalThis.process.env??{};globalThis.process.env=new Proxy(Object.assign({},t,n),{get(o,e){return e in o?o[e]:void 0},has(){return!0}})}function m(t,n,o,e){const r=o.map(a=>a.header).join("</th><th>"),s=t.map(a=>`<tr>${o.map(d=>{const i=d.accessor(a);return`<td>${(d.format?d.format(i,a):i)??""}</td>`}).join("")}</tr>`).join(""),l=new Date().toLocaleDateString(b),c=`
    <html xmlns:x="urn:schemas-microsoft-com:office:excel" dir="rtl">
      <head>
        <meta charset="UTF-8">
        <style>
          table { 
            border-collapse: collapse; 
            width: 100%; 
            font-family: Arial, sans-serif;
            direction: rtl;
          }
          th { 
            background-color: #0f172a; 
            color: white; 
            padding: 12px; 
            text-align: right;
            border: 1px solid #ddd;
            font-weight: bold;
          }
          td { 
            padding: 10px; 
            border: 1px solid #ddd;
            text-align: right;
          }
          tr:nth-child(even) { 
            background-color: #f9f9f9; 
          }
          .header {
            margin-bottom: 20px;
            text-align: center;
          }
          .header h1 {
            color: #0f172a;
            margin: 10px 0;
          }
          .header p {
            color: #666;
            margin: 5px 0;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${e}</h1>
          <p>تاريخ الإنشاء: ${l}</p>
        </div>
        <table>
          <thead>
            <tr><th>${r}</th></tr>
          </thead>
          <tbody>
            ${s}
          </tbody>
        </table>
      </body>
    </html>
  `,p=new Blob([c],{type:"application/vnd.ms-excel;charset=utf-8;"});f(p,`${n}.xls`)}function x(t,n,o,e){const r=window.open("","_blank");if(!r){alert("الرجاء السماح بفتح النوافذ المنبثقة للتصدير");return}const s=o.map(a=>a.header).join("</th><th>"),l=t.map(a=>`<tr>${o.map(d=>{const i=d.accessor(a);return`<td>${(d.format?d.format(i,a):i)??""}</td>`}).join("")}</tr>`).join(""),c=new Date().toLocaleDateString(b,{year:"numeric",month:"long",day:"numeric",hour:"2-digit",minute:"2-digit"}),p=`
    <!DOCTYPE html>
    <html dir="rtl">
      <head>
        <meta charset="UTF-8">
        <title>${e}</title>
        <style>
          @media print {
            @page {
              size: A4 landscape;
              margin: 15mm;
            }
            body {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .no-print {
              display: none !important;
            }
          }
          
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            padding: 20px;
            background: #f5f5f5;
            direction: rtl;
          }
          
          .header {
            background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
            color: white;
            padding: 30px;
            border-radius: 10px;
            margin-bottom: 30px;
            text-align: center;
          }
          
          .header h1 {
            font-size: 28px;
            margin-bottom: 10px;
            font-weight: bold;
          }
          
          .header p {
            font-size: 14px;
            opacity: 0.9;
          }
          
          .stats {
            display: flex;
            justify-content: center;
            gap: 20px;
            margin: 20px 0;
          }
          
          .stat-card {
            background: rgba(255, 255, 255, 0.1);
            padding: 15px 25px;
            border-radius: 8px;
            text-align: center;
          }
          
          .stat-card .label {
            font-size: 12px;
            opacity: 0.8;
            margin-bottom: 5px;
          }
          
          .stat-card .value {
            font-size: 24px;
            font-weight: bold;
          }
          
          table {
            width: 100%;
            border-collapse: collapse;
            background: white;
            border-radius: 10px;
            overflow: hidden;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          }
          
          thead {
            background: #0f172a;
            color: white;
          }
          
          th {
            padding: 15px;
            text-align: right;
            font-weight: bold;
            font-size: 14px;
            border-bottom: 2px solid #14b8a6;
          }
          
          td {
            padding: 12px 15px;
            text-align: right;
            border-bottom: 1px solid #e5e7eb;
            font-size: 13px;
          }
          
          tr:nth-child(even) {
            background-color: #f9fafb;
          }
          
          tr:hover {
            background-color: #f1f5f9;
          }
          
          .footer {
            margin-top: 30px;
            text-align: center;
            color: #666;
            font-size: 12px;
            padding: 20px;
          }
          
          .print-button {
            position: fixed;
            top: 20px;
            left: 20px;
            background: #14b8a6;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 8px;
            cursor: pointer;
            font-size: 16px;
            font-weight: bold;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            z-index: 1000;
          }
          
          .print-button:hover {
            background: #0d9488;
          }
          
          @media print {
            body {
              background: white;
              padding: 0;
            }
            .header {
              border-radius: 0;
            }
            table {
              box-shadow: none;
            }
          }
        </style>
      </head>
      <body>
        <button class="print-button no-print" onclick="window.print()">
          🖨️ طباعة / حفظ PDF
        </button>
        
        <div class="header">
          <h1>${e}</h1>
          <p>تاريخ الإنشاء: ${c}</p>
          <div class="stats">
            <div class="stat-card">
              <div class="label">إجمالي السجلات</div>
              <div class="value">${t.length}</div>
            </div>
          </div>
        </div>
        
        <table>
          <thead>
            <tr><th>${s}</th></tr>
          </thead>
          <tbody>
            ${l}
          </tbody>
        </table>
        
        <div class="footer">
          <p>تم الإنشاء بواسطة نظام إدارة المخزون</p>
          <p>© ${new Date().getFullYear()} - جميع الحقوق محفوظة</p>
        </div>
      </body>
    </html>
  `;r.document.write(p),r.document.close(),r.onload=()=>{setTimeout(()=>{r.focus()},250)}}function f(t,n){const o=URL.createObjectURL(t),e=document.createElement("a");e.href=o,e.download=n,document.body.appendChild(e),e.click(),document.body.removeChild(e),URL.revokeObjectURL(o)}function u(t){return{Daily:"يومي",Weekly:"أسبوعي",Transfer:"تحويل",Receipt:"وارد",Opening:"مخزون افتتاحي"}[t]||t}function w(t){return{Admin:"مدير",Employee:"موظف"}[t]||t}function y(t){return t?new Date(t).toLocaleString(b,{year:"numeric",month:"short",day:"numeric",hour:"2-digit",minute:"2-digit",timeZone:"Asia/Riyadh"}):"-"}export{x as a,w as b,u as c,m as e,y as f};
