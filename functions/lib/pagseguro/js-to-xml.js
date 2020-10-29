/* const js = require('jstoxml')

const jsToXML = data => {
  const xmlOptions = {
    attributesFilter: {
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      '\'': '&apos;',
      '&': '&amp;'
    },
    filter: {
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      '\'': '&apos;',
      '&': '&amp;'
    }
  }

  return js.toXML(data, xmlOptions)
}

module.exports = jsToXML */

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