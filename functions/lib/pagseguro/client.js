const axios = require('axios')
const { xmlToJson} = require('./js-to-xml')
const baseURL = Boolean(process.env.PS_APP_SANDBOX) === true ? 'https://ws.sandbox.pagseguro.uol.com.br' : 'https://ws.pagseguro.uol.com.br'

const instance = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/xml; charset=ISO-8859-1'
  }
})

module.exports = ({ url, method, authorizationCode, appId, appKey, data, toJSON }, credenciais = false) => {
  let uri = url
  let queryString = []

  if (authorizationCode) {
    queryString.push(`authorizationCode=${authorizationCode}`)
  }

  if (credenciais) {
    queryString.push(`appId=${process.env.PS_APP_ID || appId}`)
    queryString.push(`appKey=${process.env.PS_APP_KEY || appKey}`)
  }

  if (queryString.length) {
    uri += '?' + queryString.join('&')
  }

  const config = {
    url: uri,
    method,
    data
  }

  return instance(config).then(({ data }) => {
    if (toJSON === false) {
      return data
    } else {
      return xmlToJson(data)
    }
  })
}
