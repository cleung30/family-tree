import { jsPDF } from 'jspdf'
import { autoTable } from 'jspdf-autotable'
import { buildReportRows } from './printableReport'

const MARGIN = 40

// treeImage is the { dataUrl, width, height } from FamilyTree's
// exportTreeAsDataUrl, or null if there's no tree to draw (e.g. an empty
// family) — the directory page is still useful on its own in that case.
export function buildFamilyTreePdf(people, relationships, treeImage) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })

  doc.setFontSize(18)
  doc.setTextColor('#4a0404')
  doc.text('Leung Family Tree', MARGIN, 40)
  doc.setFontSize(10)
  doc.setTextColor('#6b7280')
  doc.text(`${people.length} members · generated ${new Date().toLocaleString()}`, MARGIN, 58)

  if (treeImage) {
    const pageWidth = doc.internal.pageSize.getWidth() - MARGIN * 2
    const maxHeight = doc.internal.pageSize.getHeight() - 100
    const ratio = treeImage.width / treeImage.height
    let width = pageWidth, height = width / ratio
    if (height > maxHeight) { height = maxHeight; width = height * ratio }
    doc.addImage(treeImage.dataUrl, 'PNG', MARGIN, 74, width, height)
  } else {
    doc.setFontSize(11)
    doc.setTextColor('#9ca3af')
    doc.text('No family members yet.', MARGIN, 90)
  }

  doc.addPage('a4', 'portrait')
  doc.setFontSize(14)
  doc.setTextColor('#4a0404')
  doc.text('Family Directory', MARGIN, 40)

  const rows = buildReportRows(people, relationships)
  autoTable(doc, {
    startY: 56,
    margin: { left: MARGIN, right: MARGIN },
    head: [['Name', 'Chinese/Vietnamese Name', 'Born', 'Died', 'Relationships', 'Notes']],
    body: rows.map(r => [r.name, r.chineseName, r.born, r.died, r.relationships.join('\n'), r.notes]),
    styles: { fontSize: 8, cellPadding: 4, valign: 'top' },
    headStyles: { fillColor: '#4a0404' },
  })

  return doc.output('blob')
}
