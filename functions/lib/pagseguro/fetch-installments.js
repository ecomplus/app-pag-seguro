const axios = require('axios')
const env = process.env.PS_APP_SANDBOX === true ? 'sandbox.' : ''

module.exports = (session, amount, brand = 'visa') => {
  const url = `https://${env}pagseguro.uol.com.br/checkout/v2/installments.json?` +
    `sessionId=${session}&` +
    `amount=${parseFloat(amount).toFixed(2)}&` +
    `creditCardBrand=${brand}`

  return axios({
    url,
    headers: {
      'Content-Type': 'application/xml; charset=ISO-8859-1'
    }
  })
}
