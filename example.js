const hummus = require('hummus')
    , fs = require('fs');

const inPath = 'test.pdf'
    , outPath = 'test-output.pdf';

const inStream = new hummus.PDFRStreamForFile(inPath);
const outStream = new hummus.PDFWStreamForFile(outPath);
const pdfWriter = hummus.createWriterToModify(
  inStream,
  outStream
);
const pdfReader = hummus.createReader(inPath);

const margin = 5;
const fontSize = 15;
const lineSpacing = 2;
const lineHeight = 1.5;
const lineWidth = 1.1;

const arialFont = pdfWriter.getFontForFile('arial.ttf');

function writeAp(pdfWriter, {
  w, h,
}, text, objId) {

  const xf = pdfWriter.createFormXObject(0, 0, w, h, objId);

  // draw text starting 1/4 of the way up
  const textY = h / 4;

  xf.getContentContext()
    .writeText(
      text,
      0,
      textY,
      {
        size: fontSize,
        colorspace: 'rgb',
        color: 0xFC2125,
        font: arialFont
      }
    );

  pdfWriter.endFormXObject(xf);
}

function writeText(pdfWriter, text, lineNumber, dimensions) {
  // use a common base dimension
  var baseDimensions = arialFont.calculateTextDimensions("text", fontSize);
  // calculate actual text dimensions
  var textDimensions = arialFont.calculateTextDimensions(text, fontSize);

  const w = textDimensions.width * lineWidth;
  const h = baseDimensions.height * lineHeight;
  const x = dimensions.xMin + margin;
  const y = (dimensions.yMax - margin) - (lineNumber * lineSpacing * baseDimensions.height);
  const x1 = x + w;
  const y1 = y + h;

	var objectsContext = pdfWriter.getObjectsContext();
  const annotationObj = objectsContext.startNewIndirectObject();
  const dictionaryContext = objectsContext.startDictionary();

  dictionaryContext
    .writeKey('Type')
    .writeNameValue('Annot')
    .writeKey('Subtype')
    .writeNameValue('FreeText')
    .writeKey('DA') // default appearance
    .writeLiteralStringValue(`0.987 0.129 0.146 rg /Helv ${fontSize} Tf`)
    .writeKey('DS') // default style
    .writeLiteralStringValue(`font: Helvetica,sans-serif ${fontSize}.0pt; text-align:left; color:#FC2125`)
    .writeKey('Rect') // bounding rectangle
    .writeRectangleValue([x, y, x1, y1])
    .writeKey('Contents')
    .writeLiteralStringValue(new hummus.PDFTextString(text).toBytesArray())
    .writeKey('M') // modified time
    .writeLiteralStringValue(pdfWriter.createPDFDate(new Date()).toString())
    .writeKey('AP');

  const nObjId = objectsContext.allocateNewObjectID()

  const apDict = objectsContext.startDictionary();
  apDict
    .writeKey('N')
    .writeObjectReferenceValue(nObjId);

  objectsContext
    .endDictionary(apDict)
    .endDictionary(dictionaryContext)
    .endIndirectObject();

  writeAp(pdfWriter, { w, h }, text, nObjId);

  return annotationObj;
}

const copyingContext = pdfWriter.createPDFCopyingContextForModifiedFile();
const pageId = copyingContext
  .getSourceDocumentParser()
  .getPageObjectID(0);
const pageObject = copyingContext
  .getSourceDocumentParser()
  .parsePage(0)
  .getDictionary()
  .toJSObject();
const objectsContext = pdfWriter.getObjectsContext();
const mbObj = pageObject.MediaBox.toJSArray();
const [xMin, yMin, xMax, yMax] = mbObj.map(pdfInt => pdfInt.value);
const dimensions = { xMin, xMax, yMin, yMax };

const textObjArray = [
  writeText(pdfWriter, 'Example One', 1, dimensions),
  writeText(pdfWriter, '# Two', 2, dimensions),
  writeText(pdfWriter, 'Third', 3, dimensions)
];
// const textObj = writeText(pdfWriter, 'Example', 1, dimensions);

objectsContext.startModifiedIndirectObject(pageId);
const modifiedPageObject = pdfWriter
  .getObjectsContext()
  .startDictionary();

Object.getOwnPropertyNames(pageObject).forEach(function(element, index, array) {
  if (element != 'Annots') {
    modifiedPageObject.writeKey(element);
    copyingContext.copyDirectObjectAsIs(pageObject[element]);
  }
});

const pageDict = pdfReader.parsePageDictionary(0)
const annotsObject = pdfReader.queryDictionaryObject(pageDict, 'Annots');

modifiedPageObject.writeKey('Annots');
objectsContext.startArray()
textObjArray.map(textObj => objectsContext.writeIndirectObjectReference(textObj));
annotsObject.toJSArray().map(a => objectsContext.writeIndirectObjectReference(a.getObjectID()));
objectsContext
  .endArray()
  .endLine()
  .endDictionary(modifiedPageObject)
  .endIndirectObject();

pdfWriter.end();
