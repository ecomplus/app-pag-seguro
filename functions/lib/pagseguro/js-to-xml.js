
const FastXmlParser = require('fast-xml-parser')
const j2xParser = new FastXmlParser.j2xParser()

const jsToXML = data => {
  return j2xParser.parse(data)
}

const xmlToJson = data => {
   return FastXmlParser.parse(data)
}

module.exports = {
  jsToXML,
  xmlToJson
}