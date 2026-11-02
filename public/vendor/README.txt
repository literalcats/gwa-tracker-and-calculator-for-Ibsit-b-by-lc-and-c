Put the Excel library file in THIS folder:

    xlsx.full.min.js        (SheetJS, version 0.20.3 or newer)

Download it in your browser (right click -> Save link as...):
    https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js

Keep the file name exactly xlsx.full.min.js, then redeploy.

Why is this needed? An .xlsx file is a zipped bundle of XML files; this library builds and reads it
so Excel export/import can run inside the browser (and offline). The JSON backup does not need it.
Until the file is here, the Excel buttons show a "library file is missing" message.
SheetJS is licensed under Apache-2.0.
