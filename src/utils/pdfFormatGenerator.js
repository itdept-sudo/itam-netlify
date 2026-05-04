import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export const generateAccessFormatPDF = async (user, request) => {
  try {
    // 1. Fetch the template PDF from the public folder
    const templateBytes = await fetch('/FT-SP-PP-001_Template.pdf').then(res => res.arrayBuffer());

    // 2. Load the PDF document
    const pdfDoc = await PDFDocument.load(templateBytes);
    const pages = pdfDoc.getPages();
    const page = pages[0];

    // 3. Embed a font
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const textSize = 10;
    const textColor = rgb(0, 0, 0); // Black for natural look

    // Extract data
    const nombre = user.full_name || `${user.first_name || ""} ${user.last_name_paternal || ""} ${user.last_name_maternal || ""}`.trim();
    const departamento = user.department || "N/A";
    const numEmpleado = user.employee_number || "N/A";
    const fechaReq = new Date(request.created_at).toLocaleDateString();
    const accesosVigentes = (request.requested_doors || []).join(", ");

    const fillField = (x, y, width, height, text, size = 10) => {
      // Draw white rectangle strictly over the placeholder text to hide it
      // Reduced padding to 0 so it doesn't accidentally cut the table borders
      page.drawRectangle({
        x: x,
        y: y,
        width: width,
        height: height,
        color: rgb(1, 1, 1),
      });
      // Draw the actual text slightly offset (1.5mm right, 1.5mm down)
      // 1.5 mm is approximately 4.25 points
      page.drawText(text, {
        x: x + 4.25,
        y: y - 4.25,
        size: size,
        font,
        color: textColor,
      });
    };

    const accessSize = accesosVigentes.length > 40 ? 8 : 10;
    const nameSize = nombre.length > 25 ? 8 : 10;

    // EXACT COORDINATES EXTRACTED FROM THE PDF TEMPLATE

    // <<Acceso Vigentes>> (First row)
    fillField(127.50, 465.98, 71.48, 8.00, accesosVigentes, accessSize);
    
    // <<Departamento>>
    fillField(597.00, 466.92, 55.41, 7.00, departamento);
    
    // <<Fecha>>
    fillField(597.00, 454.92, 32.49, 7.00, fechaReq);
    
    // <<Acceso Vigentes>> (Motivo)
    fillField(127.50, 441.98, 71.48, 8.00, accesosVigentes, accessSize);

    // <<Nombre>> (Requisitor)
    fillField(597.00, 365.42, 44.22, 8.00, nombre, nameSize);
    
    // <<Numero de Empleado>>
    fillField(597.00, 292.67, 88.16, 8.00, numEmpleado);

    // <<Acceso Vigentes>> (Seguridad Patrimonial)
    fillField(127.50, 243.92, 71.48, 8.00, accesosVigentes, accessSize);

    // 4. Serialize the PDF Document to bytes (a Uint8Array)
    const pdfBytes = await pdfDoc.save();

    // 5. Trigger download
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Formato_Acceso_${numEmpleado}_${fechaReq.replace(/\//g, '-')}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

  } catch (error) {
    console.error("Error generating PDF:", error);
    alert("Hubo un error al generar el PDF. Asegúrate de que FT-SP-PP-001_Template.pdf exista en la carpeta public.");
  }
};
